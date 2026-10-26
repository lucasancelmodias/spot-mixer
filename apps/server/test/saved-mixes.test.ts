import { describe, expect, it } from 'bun:test';
import {
	refreshMixResponseSchema,
	type SavedMix,
	savedMixSchema,
	saveMixResponseSchema
} from '@spot-mixer/shared';
import { z } from 'zod';
import { SavedMixes } from '../src/saved/saved-mixes';
import { buildTestApp, signIn } from './support/app';
import { json, spotifyError } from './support/fakes';
import { MemoryKV } from './support/memory-kv';
import { fakeArtist, type SpotifyFakeOptions, sid, spotifyFake } from './support/spotify-fake';

const DAY_MS = 24 * 60 * 60 * 1000;
const daft = fakeArtist('DaftPunk');
const justice = fakeArtist('Justice');
const playlistId = 'playlist1';
const savedListSchema = z.array(savedMixSchema);

const recipe = {
	sources: [
		{ kind: 'popular', artistId: daft.id, count: 3 },
		{ kind: 'popular', artistId: justice.id, count: 2 }
	],
	options: {
		maxTracks: null,
		order: 'balanced-shuffle',
		noAdjacentSameArtist: true,
		exclude: [],
		seed: 7
	}
};

async function signedIn(options: Partial<SpotifyFakeOptions> = {}) {
	const t = await buildTestApp({ handler: spotifyFake({ artists: [daft, justice], ...options }) });
	return { ...t, ...(await signIn(t.app)) };
}

/** Saves a 5-track mix and asks the app to keep its recipe. */
async function saveRemembered(t: Awaited<ReturnType<typeof signedIn>>) {
	const uris = Array.from({ length: 5 }, (_, i) => `spotify:track:${sid(`track${i}`)}`);
	return t.post('/api/mixes', {
		name: 'Daft × Justice',
		description: '',
		trackUris: uris,
		remember: { mode: 'artists', recipe }
	});
}

const itemCalls = (t: Awaited<ReturnType<typeof signedIn>>) =>
	t.calls.filter((call) => call.url.pathname === `/v1/playlists/${playlistId}/items`);

describe('SavedMixes', () => {
	const mix = (id: string, createdAt: string): Omit<SavedMix, 'expiresAt'> => ({
		playlistId: id,
		url: `https://open.spotify.com/playlist/${id}`,
		name: id,
		mode: 'artists',
		artistNames: ['A'],
		trackCount: 1,
		createdAt,
		refreshedAt: null,
		recipe: recipe as SavedMix['recipe']
	});

	it('keeps a recipe for 90 days after its last use, and the key lives as long as the newest', async () => {
		const clock = { now: Date.UTC(2026, 9, 26) };
		const kv = new MemoryKV(() => clock.now);
		const store = new SavedMixes({ kv, now: () => clock.now });

		await store.put('u', mix('old', '2026-10-26T00:00:00.000Z'));
		clock.now += 60 * DAY_MS;
		await store.put('u', mix('new', '2026-12-25T00:00:00.000Z'));

		expect(kv.ttlSeconds('c:u:u:mixes')).toBe(90 * 24 * 60 * 60);
		expect((await store.list('u')).map((m) => m.playlistId)).toEqual(['new', 'old']);
		clock.now += 31 * DAY_MS;
		expect((await store.list('u')).map((m) => m.playlistId)).toEqual(['new']);
	});

	it('keeps at most 50 recipes, the last used first', async () => {
		const store = new SavedMixes({ kv: new MemoryKV(), now: () => Date.now() });

		for (let i = 0; i < 55; i += 1) {
			await store.put('u', mix(`p${i}`, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()));
		}

		const list = await store.list('u');
		expect(list).toHaveLength(50);
		expect(list[0]?.playlistId).toBe('p54');
	});
});

describe('saved mix routes', () => {
	it('keeps the recipe of a saved mix, with artist names from the catalog', async () => {
		const t = await signedIn();

		const saved = saveMixResponseSchema.parse(await (await saveRemembered(t)).json());
		const list = savedListSchema.parse(await (await t.get('/api/mixes/saved')).json());

		expect(saved.remembered).toBe(true);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({
			playlistId,
			name: 'Daft × Justice',
			mode: 'artists',
			artistNames: ['DaftPunk', 'Justice'],
			trackCount: 5,
			refreshedAt: null
		});
	});

	it('refreshes a mix: a new seed, and the playlist tracks replaced in order', async () => {
		const t = await signedIn();
		await saveRemembered(t);
		const before = itemCalls(t).length;

		const res = await t.post(`/api/mixes/saved/${playlistId}/refresh`, {});

		expect(res.status).toBe(200);
		const body = refreshMixResponseSchema.parse(await res.json());
		expect(body.tracks).toHaveLength(5);
		expect(body.mix.refreshedAt).not.toBeNull();
		expect(body.mix.recipe.options.seed).not.toBe(7);
		const replace = itemCalls(t).slice(before);
		expect(replace.map((call) => call.init?.method)).toEqual(['PUT']);
		expect(JSON.parse(String(replace[0]?.init?.body))).toEqual({
			uris: body.tracks.map((track) => track.uri)
		});
	});

	it('forgets the recipe when Spotify no longer lets the user change the playlist', async () => {
		let saving = true;
		const t = await signedIn({
			playlistItems: () =>
				saving ? json({ snapshot_id: 's' }, 201) : spotifyError(404, 'Not found')
		});
		await saveRemembered(t);
		saving = false;

		const res = await t.post(`/api/mixes/saved/${playlistId}/refresh`, {});

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'playlist_gone' });
		expect(savedListSchema.parse(await (await t.get('/api/mixes/saved')).json())).toEqual([]);
	});

	it('forgets a recipe on request, and answers 404 for an unknown mix', async () => {
		const t = await signedIn();
		await saveRemembered(t);

		const removed = await t.del(`/api/mixes/saved/${playlistId}`);
		const again = await t.del(`/api/mixes/saved/${playlistId}`);
		const refresh = await t.post(`/api/mixes/saved/${playlistId}/refresh`, {});

		expect(removed.status).toBe(204);
		expect(again.status).toBe(404);
		expect(refresh.status).toBe(404);
	});

	it('checks the playlist ID and the Origin header', async () => {
		const t = await signedIn();

		const badId = await t.post('/api/mixes/saved/not-an-id/refresh', {});
		const noOrigin = await t.app.request(`/api/mixes/saved/${playlistId}`, { method: 'DELETE' });

		expect(badId.status).toBe(400);
		expect(noOrigin.status).toBe(403);
	});

	it('deletes the saved recipes at logout', async () => {
		const t = await signedIn();
		await saveRemembered(t);

		await t.post('/auth/logout', {});

		expect(t.kv.keys().filter((key) => key.endsWith(':mixes'))).toEqual([]);
	});
});
