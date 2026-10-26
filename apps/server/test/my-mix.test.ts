import { describe, expect, it } from 'bun:test';
import { artistInsightsSchema, mixPreviewSchema, saveMixResponseSchema } from '@spot-mixer/shared';
import { buildTestApp, signIn } from './support/app';
import { json } from './support/fakes';
import {
	type FakeArtist,
	fakeArtist,
	rawArtist,
	rawTrack,
	type SpotifyFakeOptions,
	spotifyFake
} from './support/spotify-fake';

const artists = ['Daft', 'Justice', 'Air', 'Phoenix', 'Cassius', 'Kavinsky'].map(fakeArtist);
const [daft, justice, air] = artists as [FakeArtist, FakeArtist, FakeArtist];

/**
 * A user whose top artists are the six artists in order. Each artist has its songs 2 and 4 in
 * the user's top tracks and song 6 in the saved tracks; the catalog has songs 1 to 10 as
 * Top Tracks and 1 to 20 in search results.
 */
const listener: Partial<SpotifyFakeOptions> = {
	userTopArtists: (range) =>
		json({ items: (range === 'long_term' ? [air] : artists).map(rawArtist), next: null }),
	userTopTracks: (range, offset) =>
		json({
			items:
				range === 'short_term' && offset === 0
					? artists.flatMap((artist) => [rawTrack(artist, 2), rawTrack(artist, 4)])
					: [],
			next: null
		}),
	savedTracks: () =>
		json({ items: artists.map((artist) => ({ track: rawTrack(artist, 6) })), next: null }),
	recentlyPlayed: () => json({ items: [{ track: rawTrack(justice, 2) }], next: null }),
	followedArtists: () =>
		json({ artists: { items: [rawArtist(daft)], next: null, cursors: { after: null } } })
};

async function signedIn(options: Partial<SpotifyFakeOptions> = listener, callBudget?: number) {
	const t = await buildTestApp({ handler: spotifyFake({ artists, ...options }), callBudget });
	return { ...t, ...(await signIn(t.app)) };
}

function blendRecipe(artistIds: string[], familiarShare: number, count = 4) {
	return {
		sources: artistIds.map((artistId) => ({ kind: 'blend', artistId, count, familiarShare })),
		options: {
			maxTracks: null,
			order: 'grouped',
			noAdjacentSameArtist: true,
			exclude: [],
			seed: 3
		}
	};
}

describe('POST /api/insights/artists', () => {
	it("ranks the user's artists with Spotify's facts as reasons, and no score", async () => {
		const t = await signedIn();

		const res = await t.post('/api/insights/artists', { recency: 0.5 });

		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		const insights = artistInsightsSchema.parse(body);
		expect(insights.artists.map((artist) => artist.name)).toEqual(artists.map((a) => a.name));
		expect(insights.artists[0]).toEqual({
			id: daft.id,
			name: 'Daft',
			imageUrl: 'https://i.scdn.co/Daft',
			reasons: {
				topArtist: ['short_term', 'medium_term'],
				topTracks: ['short_term'],
				savedTracks: 1,
				recentPlays: 0,
				followed: true
			}
		});
		expect(JSON.stringify(body)).not.toContain('score');
		// 3 top-artist lists, 3 top-track lists, 1 saved page, 1 recent page, 1 followed page.
		expect(insights.spotifyCalls).toBe(9);
	});

	it('reads the cache the second time, and moves all-time artists up for recency 0', async () => {
		const t = await signedIn();
		await t.post('/api/insights/artists', { recency: 0.5 });

		const res = await t.post('/api/insights/artists', { recency: 0 });

		const insights = artistInsightsSchema.parse(await res.json());
		expect(insights.artists[0]?.name).toBe('Air');
		expect(insights.spotifyCalls).toBe(0);
	});

	it('validates the request and needs a session', async () => {
		const t = await signedIn();

		const invalid = await t.post('/api/insights/artists', { recency: 2 });
		const anonymous = await t.post('/api/insights/artists', { recency: 0.5 }, '');

		expect(invalid.status).toBe(400);
		expect(anonymous.status).toBe(401);
	});

	it('returns an empty ranking for a user without listening data', async () => {
		const t = await signedIn({});

		const res = await t.post('/api/insights/artists', { recency: 0.5 });

		expect(artistInsightsSchema.parse(await res.json()).artists).toEqual([]);
	});
});

describe('POST /api/mixes/preview with blend sources', () => {
	it("mixes the user's own tracks with popular tracks that the user does not have", async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes/preview', blendRecipe([daft.id, justice.id], 0.5));

		expect(res.status).toBe(200);
		const preview = mixPreviewSchema.parse(await res.json());
		const daftTracks = preview.tracks.filter((track) => track.sourceArtistId === daft.id);
		expect(daftTracks.map((track) => [track.name, track.pool])).toEqual([
			['Daft Song 2', 'familiar'],
			['Daft Song 1', 'discovery'],
			['Daft Song 4', 'familiar'],
			['Daft Song 3', 'discovery']
		]);
		expect(preview.warnings).toEqual([]);
	});

	it('adds saved tracks after the top tracks, and popular tracks when the user has too few', async () => {
		const t = await signedIn();

		const res = await t.post('/api/mixes/preview', blendRecipe([air.id, justice.id], 1));

		const preview = mixPreviewSchema.parse(await res.json());
		const airTracks = preview.tracks.filter((track) => track.sourceArtistId === air.id);
		expect(airTracks.map((track) => [track.name, track.pool])).toEqual([
			['Air Song 2', 'familiar'],
			['Air Song 4', 'familiar'],
			['Air Song 1', 'discovery'],
			['Air Song 6', 'familiar']
		]);
	});
});

describe('My Mix end to end', () => {
	it('saves a mix of the top 5 artists, each request within the call budget', async () => {
		const budget = 60;
		const t = await signedIn(listener, budget);

		const ranking = artistInsightsSchema.parse(
			await (await t.post('/api/insights/artists', { recency: 0.5 })).json()
		);
		const top5 = ranking.artists.slice(0, 5).map((artist) => artist.id);
		const previewRes = await t.post('/api/mixes/preview', {
			...blendRecipe(top5, 0.6, 10),
			options: {
				maxTracks: null,
				order: 'balanced-shuffle',
				noAdjacentSameArtist: true,
				exclude: [],
				seed: 11
			}
		});
		const preview = mixPreviewSchema.parse(await previewRes.json());
		const saveRes = await t.post('/api/mixes', {
			name: 'spot-mixer: My Mix',
			description: '',
			trackUris: preview.tracks.map((track) => track.uri)
		});

		expect(ranking.spotifyCalls).toBeLessThanOrEqual(budget);
		expect(previewRes.status).toBe(200);
		// The user's tracks come from the cache of the ranking. Each artist needs 3 catalog calls:
		// the artist, its Top Tracks and one search page.
		expect(preview.spotifyCalls).toBe(15);
		expect(preview.tracks).toHaveLength(50);
		expect(new Set(preview.tracks.map((track) => track.sourceArtistId))).toEqual(new Set(top5));
		for (let i = 1; i < preview.tracks.length; i += 1) {
			expect(preview.tracks[i]?.sourceArtistId).not.toBe(preview.tracks[i - 1]?.sourceArtistId);
		}
		expect(saveRes.status).toBe(201);
		expect(saveMixResponseSchema.parse(await saveRes.json()).added).toBe(50);
		const created = t.calls.find((call) => call.url.pathname === '/v1/me/playlists');
		expect(JSON.parse(String(created?.init?.body))).toMatchObject({ public: false });
	});
});
