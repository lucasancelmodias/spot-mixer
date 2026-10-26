import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { limitMaximum, routeOf, SpotifyClient } from '../src/spotify/client';
import {
	SpotifyAccessError,
	SpotifyAuthError,
	SpotifyError,
	SpotifyNotFoundError,
	SpotifyRequestError,
	SpotifyUnavailableError
} from '../src/spotify/errors';
import {
	FakeGuard,
	type FetchHandler,
	fakeFetch,
	headerOf,
	json,
	spotifyError
} from './support/fakes';

const NOW = Date.UTC(2026, 9, 26, 12);
const ID = '4tZwfgrHOc3mvqYlEYSvVi';
const idSchema = z.object({ id: z.string() });

function setup(handler: FetchHandler) {
	const { fetch, calls } = fakeFetch(handler);
	const guard = new FakeGuard();
	const sleeps: number[] = [];
	const client = new SpotifyClient({
		fetch,
		guard,
		now: () => NOW,
		sleep: async (ms) => {
			sleeps.push(ms);
		}
	});
	return { client, calls, guard, sleeps };
}

function tokenSource() {
	const source = {
		refreshes: 0,
		token: async () => 'token-1',
		refresh: async () => {
			source.refreshes += 1;
			return `token-${source.refreshes + 1}`;
		}
	};
	return source;
}

function rejection(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => {
			throw new Error('expected a rejection');
		},
		(error: unknown) => error
	);
}

describe('SpotifyClient requests', () => {
	it('sends the token and the query, and parses the body', async () => {
		const { client, calls, guard } = setup(() => json({ id: 'track-1', ignored: true }));

		const result = await client.request(tokenSource(), {
			path: '/search',
			query: { q: 'artist:"Daft Punk"', type: 'track', limit: 10, offset: undefined },
			schema: idSchema
		});

		expect(result).toEqual({ id: 'track-1' });
		const url = calls[0]?.url;
		expect(url && url.origin + url.pathname).toBe('https://api.spotify.com/v1/search');
		expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
			q: 'artist:"Daft Punk"',
			type: 'track',
			limit: '10'
		});
		expect(headerOf(calls[0]?.init, 'Authorization')).toBe('Bearer token-1');
		expect(guard.acquired).toBe(1);
	});

	it('sends a JSON body', async () => {
		const { client, calls } = setup(() => json({ id: 'playlist-1' }, 201));

		await client.request(tokenSource(), {
			method: 'POST',
			path: '/me/playlists',
			body: { name: 'Mix', public: false },
			schema: idSchema
		});

		expect(calls[0]?.init?.method).toBe('POST');
		expect(headerOf(calls[0]?.init, 'Content-Type')).toBe('application/json');
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ name: 'Mix', public: false });
	});

	it('refuses a limit above the maximum without a call', async () => {
		const { client, calls } = setup(() => json({ id: 'x' }));

		await expect(
			client.request(tokenSource(), { path: '/search', query: { limit: 11 }, schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyRequestError);
		await expect(
			client.request(tokenSource(), {
				path: `/artists/${ID}/albums`,
				query: { limit: 20 },
				schema: idSchema
			})
		).rejects.toBeInstanceOf(SpotifyRequestError);
		expect(calls).toHaveLength(0);
		expect(limitMaximum('/me/top/artists')).toBe(50);
	});

	it('refuses endpoints that are blocked for new apps without a call', async () => {
		const { client, calls } = setup(() => json({ id: 'x' }));
		const blocked = [
			{ path: `/artists/${ID}/top-tracks` },
			{ path: `/artists/${ID}/related-artists` },
			{ path: '/recommendations' },
			{ path: `/audio-features/${ID}` },
			{ path: '/tracks', query: { ids: ID } },
			{ path: '/users/someone/playlists', method: 'POST' as const },
			{ path: `/playlists/${ID}/tracks`, method: 'POST' as const }
		];

		for (const request of blocked) {
			const error = await rejection(
				client.request(tokenSource(), { ...request, schema: idSchema })
			);
			expect(error).toBeInstanceOf(SpotifyAccessError);
			expect((error as SpotifyAccessError).problem).toBe('blocked_endpoint');
		}
		expect(calls).toHaveLength(0);
	});

	it('names routes without IDs', () => {
		expect(routeOf('GET', `/artists/${ID}/albums`)).toBe('GET /artists/{id}/albums');
	});
});

describe('SpotifyClient errors', () => {
	it('refreshes the token once after a 401', async () => {
		const { client, calls } = setup((_url, _init, call) =>
			call === 1 ? spotifyError(401, 'The access token expired') : json({ id: 'me' })
		);
		const tokens = tokenSource();

		expect(await client.request(tokens, { path: '/me', schema: idSchema })).toEqual({ id: 'me' });
		expect(tokens.refreshes).toBe(1);
		expect(headerOf(calls[1]?.init, 'Authorization')).toBe('Bearer token-2');
	});

	it('throws SpotifyAuthError after a second 401', async () => {
		const { client, calls } = setup(() => spotifyError(401, 'Invalid access token'));

		await expect(
			client.request(tokenSource(), { path: '/me', schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyAuthError);
		expect(calls).toHaveLength(2);
	});

	it('opens the circuit on a quota error and never retries it', async () => {
		const { client, calls, guard, sleeps } = setup(() =>
			json({ error: { status: 429, message: 'Quota exceeded', reason: 'QUOTA_EXCEEDED' } }, 429, {
				'Retry-After': '20335'
			})
		);

		const error = await rejection(client.request(tokenSource(), { path: '/me', schema: idSchema }));

		expect(error).toBeInstanceOf(SpotifyUnavailableError);
		expect(error).toMatchObject({ reason: 'quota', until: NOW + 20_335_000 });
		expect(guard.opened).toEqual([{ until: NOW + 20_335_000, reason: 'quota' }]);
		expect(calls).toHaveLength(1);
		expect(sleeps).toEqual([]);
	});

	it('waits for a short Retry-After and retries once', async () => {
		const { client, calls, sleeps } = setup((_url, _init, call) =>
			call === 1 ? json({}, 429, { 'Retry-After': '2' }) : json({ id: 'me' })
		);

		expect(await client.request(tokenSource(), { path: '/me', schema: idSchema })).toEqual({
			id: 'me'
		});
		expect(sleeps).toEqual([2000]);
		expect(calls).toHaveLength(2);
	});

	it('opens the circuit for a long Retry-After without a retry', async () => {
		const { client, calls, guard } = setup(() => json({}, 429, { 'Retry-After': '120' }));

		await expect(
			client.request(tokenSource(), { path: '/me', schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyUnavailableError);
		expect(guard.opened).toEqual([{ until: NOW + 120_000, reason: 'rate_limit' }]);
		expect(calls).toHaveLength(1);
	});

	it('without Retry-After, waits 30 s once, then opens the circuit for 15 minutes', async () => {
		const { client, calls, guard, sleeps } = setup(() => json({}, 429));

		await expect(
			client.request(tokenSource(), { path: '/me', schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyUnavailableError);
		expect(sleeps).toEqual([30_000]);
		expect(guard.opened).toEqual([{ until: NOW + 15 * 60_000, reason: 'rate_limit' }]);
		expect(calls).toHaveLength(2);
	});

	it('maps 403 messages to access problems', async () => {
		const cases = [
			[
				'Check settings on developer.spotify.com/dashboard, the user may not be registered.',
				'not_allowlisted'
			],
			['Active premium subscription required for the owner of the app', 'owner_premium'],
			['Forbidden', 'forbidden']
		] as const;

		for (const [message, problem] of cases) {
			const { client } = setup(() => spotifyError(403, message));
			const error = await rejection(
				client.request(tokenSource(), { path: '/me', schema: idSchema })
			);
			expect((error as SpotifyAccessError).problem).toBe(problem);
		}
	});

	it('retries server errors and network errors with backoff', async () => {
		const { client, calls, sleeps } = setup((_url, _init, call) => {
			if (call === 1) throw new TypeError('fetch failed');
			return call === 2 ? json({}, 503) : json({ id: 'me' });
		});

		expect(await client.request(tokenSource(), { path: '/me', schema: idSchema })).toEqual({
			id: 'me'
		});
		expect(calls).toHaveLength(3);
		expect(sleeps).toHaveLength(2);
	});

	it('gives up after three retries', async () => {
		const { client, calls } = setup(() => json({}, 500));

		await expect(
			client.request(tokenSource(), { path: '/me', schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyError);
		expect(calls).toHaveLength(4);
	});

	it('does not call Spotify while the circuit is open', async () => {
		const { client, calls, guard } = setup(() => json({ id: 'me' }));
		guard.blocked = { until: NOW + 60_000, reason: 'quota' };

		await expect(
			client.request(tokenSource(), { path: '/me', schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyUnavailableError);
		expect(calls).toHaveLength(0);
	});

	it('maps 404 and other 4xx answers, without the token in the message', async () => {
		const notFound = setup(() => spotifyError(404, 'Resource not found'));
		await expect(
			notFound.client.request(tokenSource(), { path: `/albums/${ID}/tracks`, schema: idSchema })
		).rejects.toBeInstanceOf(SpotifyNotFoundError);

		const invalid = setup(() => spotifyError(400, 'Invalid limit'));
		const error = await rejection(
			invalid.client.request(tokenSource(), { path: '/me/top/artists', schema: idSchema })
		);
		expect(error).toBeInstanceOf(SpotifyRequestError);
		expect((error as Error).message).toContain('Invalid limit');
		expect((error as Error).message).not.toContain('token-1');
	});
});
