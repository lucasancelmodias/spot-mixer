import { describe, expect, it } from 'bun:test';
import { artistSummarySchema, mixPreviewSchema, saveMixResponseSchema } from '@spot-mixer/shared';
import { z } from 'zod';
import { buildTestApp, setCookies, TEST_ORIGIN } from './support/app';
import { headerOf, json } from './support/fakes';
import {
	fakeArtist,
	rawAlbumRef,
	rawTrack,
	type SpotifyFakeOptions,
	sid,
	spotifyFake
} from './support/spotify-fake';

const daft = fakeArtist('DaftPunk');
const justice = fakeArtist('Justice');

/** A signed-in test app with helpers that send the session cookie (and Origin for POST). */
async function signedIn(options: Partial<SpotifyFakeOptions> = {}, callBudget?: number) {
	const t = await buildTestApp({
		handler: spotifyFake({ artists: [daft, justice], ...options }),
		callBudget
	});
	const login = await t.app.request('/auth/login');
	const state = setCookies(login).oauth_state ?? '';
	const callback = await t.app.request(`/auth/callback?code=c&state=${state}`, {
		headers: { Cookie: `oauth_state=${state}` }
	});
	const session = setCookies(callback).sid ?? '';
	const get = (path: string) => t.app.request(path, { headers: { Cookie: `sid=${session}` } });
	const post = (path: string, body: unknown, cookie = `sid=${session}`) =>
		t.app.request(path, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { Cookie: cookie, Origin: TEST_ORIGIN, 'Content-Type': 'application/json' }
		});
	return { ...t, get, post };
}

function recipe(sources: unknown[], options: Record<string, unknown> = {}) {
	return {
		sources,
		options: {
			maxTracks: null,
			order: 'balanced-shuffle',
			noAdjacentSameArtist: true,
			exclude: [],
			seed: 7,
			...options
		}
	};
}

const popularDaft = { kind: 'popular', artistId: daft.id, count: 3 };
const justiceAlbum = {
	kind: 'albums',
	artistId: justice.id,
	albumIds: [rawAlbumRef(justice, 1).id],
	randomPerAlbum: null
};

describe('POST /api/mixes/preview', () => {
	it('mixes popular tracks and an album, with no two neighbors from one artist', async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes/preview', recipe([popularDaft, justiceAlbum]));

		expect(res.status).toBe(200);
		const preview = mixPreviewSchema.parse(await res.json());
		expect(preview.tracks).toHaveLength(7);
		expect(
			preview.tracks
				.filter((track) => track.sourceArtistId === daft.id)
				.map((track) => track.name)
				.sort()
		).toEqual(['DaftPunk Song 1', 'DaftPunk Song 2', 'DaftPunk Song 3']);
		for (let i = 1; i < preview.tracks.length; i += 1) {
			expect(preview.tracks[i]?.sourceArtistId).not.toBe(preview.tracks[i - 1]?.sourceArtistId);
		}
		expect(preview.warnings).toEqual([]);
		expect(preview.spotifyCalls).toBe(5);
	});

	it('gives the same mix for the same seed, and reads the cache the second time', async () => {
		const t = await signedIn();
		const body = recipe([popularDaft, justiceAlbum]);

		const first = mixPreviewSchema.parse(await (await t.post('/api/mixes/preview', body)).json());
		const second = mixPreviewSchema.parse(await (await t.post('/api/mixes/preview', body)).json());

		expect(second.tracks.map((track) => track.id)).toEqual(first.tracks.map((track) => track.id));
		expect(second.spotifyCalls).toBe(0);
	});

	it("uses the user's own top tracks for a favorites source", async () => {
		const t = await signedIn({
			userTopTracks: (range, offset) =>
				json({
					items:
						range === 'short_term' && offset === 0 ? [rawTrack(daft, 7), rawTrack(justice, 2)] : [],
					next: null
				})
		});

		const res = await t.post(
			'/api/mixes/preview',
			recipe([
				{ kind: 'favorites', artistId: daft.id, count: 5 },
				{ kind: 'popular', artistId: justice.id, count: 1 }
			])
		);

		const preview = mixPreviewSchema.parse(await res.json());
		expect(preview.tracks.map((track) => track.name).sort()).toEqual([
			'DaftPunk Song 7',
			'Justice Song 1'
		]);
		expect(preview.warnings).toEqual(['DaftPunk: 1 of 5 tracks are available.']);
	});

	it('rejects a recipe with one artist or with a repeated artist', async () => {
		const t = await signedIn();

		const one = await t.post('/api/mixes/preview', recipe([popularDaft]));
		const repeated = await t.post('/api/mixes/preview', recipe([popularDaft, popularDaft]));

		expect(one.status).toBe(400);
		expect(repeated.status).toBe(400);
		expect(await repeated.json()).toMatchObject({ error: 'invalid_request' });
	});

	it('needs a session', async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes/preview', recipe([popularDaft, justiceAlbum]), '');

		expect(res.status).toBe(401);
	});

	it('stops when the preview needs more Spotify calls than the budget allows', async () => {
		const t = await signedIn({}, 2);

		const res = await t.post('/api/mixes/preview', recipe([popularDaft, justiceAlbum]));

		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ error: 'too_many_calls', limit: 2 });
	});
});

describe('POST /api/mixes', () => {
	const uris = (count: number) =>
		Array.from({ length: count }, (_, i) => `spotify:track:${sid(`track${i}`)}`);

	it('creates a private playlist and adds the tracks in batches of 100', async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes', { name: 'Mix', description: '', trackUris: uris(150) });

		expect(res.status).toBe(201);
		expect(saveMixResponseSchema.parse(await res.json())).toEqual({
			playlistId: 'playlist1',
			url: 'https://open.spotify.com/playlist/playlist1',
			added: 150
		});
		const create = t.calls.find((call) => call.url.pathname === '/v1/me/playlists');
		expect(JSON.parse(String(create?.init?.body))).toEqual({ name: 'Mix', public: false });
		expect(headerOf(create?.init, 'Authorization')).toBe('Bearer at-1');
		const batches = t.calls
			.filter((call) => call.url.pathname === '/v1/playlists/playlist1/items')
			.map((call) => (JSON.parse(String(call.init?.body)) as { uris: string[] }).uris.length);
		expect(batches).toEqual([100, 50]);
	});

	it('reports a playlist that Spotify created but did not fill', async () => {
		const t = await signedIn({
			playlistItems: (call) => (call === 1 ? json({ snapshot_id: 's' }, 201) : json({}, 500))
		});

		const res = await t.post('/api/mixes', { name: 'Mix', description: 'x', trackUris: uris(150) });

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({
			error: 'save_incomplete',
			playlistUrl: 'https://open.spotify.com/playlist/playlist1',
			added: 100
		});
	});

	it('rejects URIs that are not Spotify track URIs', async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes', {
			name: 'Mix',
			description: '',
			trackUris: ['spotify:episode:abc']
		});

		expect(res.status).toBe(400);
	});
});

describe('catalog routes', () => {
	it('searches artists, with at least 2 characters', async () => {
		const t = await signedIn();

		const short = await t.get('/api/search/artists?q=D');
		const found = await t.get('/api/search/artists?q=daft');

		expect(short.status).toBe(400);
		expect(
			z
				.array(artistSummarySchema)
				.parse(await found.json())
				.map((a) => a.name)
		).toEqual(['DaftPunk']);
	});

	it('lists the releases of an artist and checks the ID', async () => {
		const t = await signedIn();

		const bad = await t.get('/api/artists/not-an-id/albums');
		const releases = await t.get(`/api/artists/${daft.id}/albums`);

		expect(bad.status).toBe(400);
		expect(((await releases.json()) as unknown[]).length).toBe(3);
	});
});
