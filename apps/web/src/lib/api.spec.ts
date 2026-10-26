import { describe, expect, it } from 'vitest';
import {
	ApiError,
	forgetSavedMix,
	getArtistInsights,
	getHealth,
	getMe,
	listSavedMixes,
	logout,
	previewMix,
	refreshSavedMix
} from './api';

function respond(status: number, body?: unknown) {
	const calls: { input: string; init?: RequestInit }[] = [];
	const fetchFn = async (input: string, init?: RequestInit) => {
		calls.push({ input, init });
		return new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	};
	return { fetchFn, calls };
}

const profile = {
	id: 'user1',
	displayName: 'User One',
	imageUrl: null,
	authorizedAt: '2026-10-26T12:00:00.000Z',
	renewBy: '2027-04-24T12:00:00.000Z'
};

describe('getHealth', () => {
	it('returns the body of a healthy API', async () => {
		const health = await getHealth(respond(200, { status: 'ok', redis: 'up' }).fetchFn);

		expect(health).toEqual({ status: 'ok', redis: 'up' });
	});

	it('returns the body when Redis is down (HTTP 503)', async () => {
		const health = await getHealth(respond(503, { status: 'degraded', redis: 'down' }).fetchFn);

		expect(health).toEqual({ status: 'degraded', redis: 'down' });
	});

	it('throws on other HTTP errors', async () => {
		await expect(getHealth(respond(500, {}).fetchFn)).rejects.toThrow('HTTP 500');
	});
});

describe('getMe', () => {
	it('returns the profile', async () => {
		expect(await getMe(respond(200, profile).fetchFn)).toEqual(profile);
	});

	it('returns null without a session', async () => {
		expect(await getMe(respond(401, { error: 'unauthenticated' }).fetchFn)).toBeNull();
	});

	it('throws an ApiError with the error code', async () => {
		const error = await getMe(respond(503, { error: 'spotify_unavailable' }).fetchFn).catch(
			(e: unknown) => e
		);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 503, code: 'spotify_unavailable' });
	});
});

describe('previewMix', () => {
	const recipe = {
		sources: [],
		options: {
			maxTracks: null,
			order: 'grouped' as const,
			noAdjacentSameArtist: true,
			exclude: [],
			seed: 1
		}
	};

	it('posts the recipe as JSON and returns the preview', async () => {
		const { fetchFn, calls } = respond(200, { tracks: [], warnings: [], spotifyCalls: 0 });

		expect(await previewMix(recipe, fetchFn)).toEqual({
			tracks: [],
			warnings: [],
			spotifyCalls: 0
		});
		expect(calls[0]?.input).toBe('/api/mixes/preview');
		expect(calls[0]?.init?.method).toBe('POST');
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(recipe);
	});

	it('keeps the error body, for example the time until Spotify works again', async () => {
		const until = '2026-10-26T15:30:00.000Z';
		const error = await previewMix(
			recipe,
			respond(503, { error: 'spotify_unavailable', until }).fetchFn
		).catch((e: unknown) => e);

		expect(error).toMatchObject({ status: 503, code: 'spotify_unavailable', body: { until } });
	});
});

describe('getArtistInsights', () => {
	it('posts the recency and returns the ranking', async () => {
		const { fetchFn, calls } = respond(200, { artists: [], spotifyCalls: 9 });

		expect(await getArtistInsights({ recency: 0.25 }, fetchFn)).toEqual({
			artists: [],
			spotifyCalls: 9
		});
		expect(calls[0]?.input).toBe('/api/insights/artists');
		expect(calls[0]?.init?.method).toBe('POST');
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ recency: 0.25 });
	});
});

describe('logout', () => {
	it('posts to /auth/logout', async () => {
		const { fetchFn, calls } = respond(204);

		await logout(fetchFn);

		expect(calls).toEqual([{ input: '/auth/logout', init: { method: 'POST' } }]);
	});

	it('throws when the server refuses', async () => {
		await expect(logout(respond(403, { error: 'bad_origin' }).fetchFn)).rejects.toMatchObject({
			code: 'bad_origin'
		});
	});
});

describe('saved mixes', () => {
	it('lists, refreshes and forgets saved mixes at their API paths', async () => {
		const list = respond(200, []);
		const refresh = respond(200, { mix: {}, tracks: [], warnings: [], spotifyCalls: 0 });
		const forget = respond(204);

		expect(await listSavedMixes(list.fetchFn)).toEqual([]);
		await refreshSavedMix('playlist1', refresh.fetchFn);
		await forgetSavedMix('playlist1', forget.fetchFn);

		expect(list.calls[0]?.input).toBe('/api/mixes/saved');
		expect(refresh.calls[0]?.input).toBe('/api/mixes/saved/playlist1/refresh');
		expect(refresh.calls[0]?.init?.method).toBe('POST');
		expect(forget.calls[0]).toEqual({
			input: '/api/mixes/saved/playlist1',
			init: { method: 'DELETE' }
		});
	});

	it('reports a playlist that the app can no longer change', async () => {
		const error = await refreshSavedMix(
			'playlist1',
			respond(404, { error: 'playlist_gone' }).fetchFn
		).catch((e: unknown) => e);

		expect(error).toMatchObject({ status: 404, code: 'playlist_gone' });
	});
});
