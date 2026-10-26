import { describe, expect, it } from 'bun:test';
import { Catalog } from '../src/catalog/catalog';
import { TokenCipher } from '../src/session/crypto';
import { AppTokenSource } from '../src/spotify/app-token';
import { KVCapabilities } from '../src/spotify/capabilities';
import { SpotifyClient } from '../src/spotify/client';
import { SpotifyOAuth } from '../src/spotify/oauth';
import { FakeGuard, fakeFetch, json, spotifyError, TEST_ENC_KEY } from './support/fakes';
import { MemoryKV } from './support/memory-kv';
import {
	fakeArtist,
	rawAlbumRef,
	rawTrack,
	type SpotifyFakeOptions,
	spotifyFake
} from './support/spotify-fake';

const daftPunk = fakeArtist('DaftPunk');

async function setup(options: Partial<SpotifyFakeOptions> = {}) {
	const now = () => Date.UTC(2026, 9, 26, 12);
	const kv = new MemoryKV(now);
	const logs: string[] = [];
	const caps = new KVCapabilities(kv, (line) => logs.push(line));
	const { fetch, calls } = fakeFetch(spotifyFake({ artists: [daftPunk], ...options }));
	const oauth = new SpotifyOAuth({
		clientId: 'client-id',
		clientSecret: 'client-secret',
		redirectUri: 'http://127.0.0.1:5173/auth/callback',
		fetch,
		now
	});
	const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);
	const catalog = new Catalog({
		spotify: new SpotifyClient({ fetch, guard: new FakeGuard(), sleep: async () => {}, now }),
		appToken: new AppTokenSource({ oauth, kv, cipher, now }),
		kv,
		caps,
		market: 'US'
	});
	const apiCalls = (prefix: string) =>
		calls.filter((call) => call.url.pathname.startsWith(`/v1${prefix}`));
	return { catalog, caps, calls, apiCalls, logs };
}

describe('Catalog.popularTracks', () => {
	it('uses Top Tracks while the app has it', async () => {
		const { catalog, apiCalls } = await setup();

		const tracks = await catalog.popularTracks(daftPunk.id, 5);

		expect(tracks.map((track) => track.name)).toEqual(
			[1, 2, 3, 4, 5].map((n) => `DaftPunk Song ${n}`)
		);
		expect(apiCalls('/search')).toHaveLength(0);
	});

	it('adds search results ranked by popularity when it needs more than Top Tracks', async () => {
		const { catalog } = await setup({
			search: () =>
				json({
					tracks: {
						items: [11, 15, 12, 3].map((n) => rawTrack(daftPunk, n)),
						next: null
					}
				})
		});

		const tracks = await catalog.popularTracks(daftPunk.id, 13);

		// Songs 1-10 from Top Tracks, then search results by popularity; song 3 is already in.
		expect(tracks.slice(10).map((track) => track.name)).toEqual([
			'DaftPunk Song 11',
			'DaftPunk Song 12',
			'DaftPunk Song 15'
		]);
	});

	it('falls back to search when Top Tracks is gone, and remembers it for 6 hours', async () => {
		const { catalog, caps, apiCalls, logs } = await setup({
			topTracks: () => spotifyError(404, 'Not Found')
		});

		const tracks = await catalog.popularTracks(daftPunk.id, 3);
		await catalog.popularTracks(fakeArtist('DaftPunk').id, 3);

		expect(tracks.map((track) => track.name)).toEqual([
			'DaftPunk Song 1',
			'DaftPunk Song 2',
			'DaftPunk Song 3'
		]);
		expect(await caps.has('topTracks')).toBe(false);
		expect(apiCalls(`/artists/${daftPunk.id}/top-tracks`)).toHaveLength(1);
		expect(logs.some((line) => line.includes('topTracks'))).toBe(true);
	});

	it("keeps Spotify's order when the search results have no popularity", async () => {
		const { catalog } = await setup({
			topTracks: () => spotifyError(403, 'Forbidden'),
			search: () =>
				json({
					tracks: {
						items: [5, 2, 9].map((n) => rawTrack(daftPunk, n, { popularity: undefined })),
						next: null
					}
				})
		});

		const tracks = await catalog.popularTracks(daftPunk.id, 3);

		expect(tracks.map((track) => track.trackNumber)).toEqual([5, 2, 9]);
	});

	it('uses pages of 10 after Spotify refuses a limit of 50', async () => {
		const { catalog, caps, apiCalls } = await setup({
			topTracks: () => spotifyError(404, 'Not Found'),
			search: (url) =>
				url.searchParams.get('limit') === '50'
					? spotifyError(400, 'Invalid limit')
					: json({
							tracks: {
								items: [1, 2].map((n) =>
									rawTrack(daftPunk, n + Number(url.searchParams.get('offset')))
								),
								next: 'https://api.spotify.com/v1/search?next'
							}
						})
		});

		await catalog.popularTracks(daftPunk.id, 3);

		expect(await caps.has('pageSize50')).toBe(false);
		expect(apiCalls('/search').map((call) => call.url.searchParams.get('limit'))).toEqual([
			'50',
			'10',
			'10',
			'10'
		]);
	});
});

describe('Catalog albums', () => {
	it('reads albums in batches, and one by one after Spotify refuses batch reads', async () => {
		const ids = [1, 2].map((n) => rawAlbumRef(daftPunk, n).id);
		const batch = await setup();
		const refused = await setup({ batchAlbums: () => spotifyError(403, 'Forbidden') });

		const fromBatch = await batch.catalog.albumsWithTracks(ids);
		const oneByOne = await refused.catalog.albumsWithTracks(ids);

		expect(fromBatch.map((album) => album.album.id)).toEqual(ids);
		expect(fromBatch[0]?.tracks).toHaveLength(4);
		expect(batch.apiCalls('/albums')).toHaveLength(1);
		expect(oneByOne).toEqual(fromBatch);
		expect(await refused.caps.has('batchReads')).toBe(false);
		expect(refused.apiCalls('/albums/')).toHaveLength(2);
	});

	it('caches album tracks', async () => {
		const { catalog, apiCalls } = await setup();
		const id = rawAlbumRef(daftPunk, 1).id;

		await catalog.albumsWithTracks([id]);
		await catalog.albumsWithTracks([id]);

		expect(apiCalls('/albums')).toHaveLength(1);
	});

	it('lists albums before singles, newest first', async () => {
		const { catalog } = await setup();

		const releases = await catalog.artistReleases(daftPunk.id);

		expect(releases.map((release) => [release.albumType, release.releaseDate])).toEqual([
			['album', '2003-01-01'],
			['album', '2001-01-01'],
			['single', '2002-01-01']
		]);
	});
});
