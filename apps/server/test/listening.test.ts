import { describe, expect, it } from 'bun:test';
import { Listening } from '../src/listening/listening';
import { fixedToken, SpotifyClient } from '../src/spotify/client';
import { CallBudget } from '../src/spotify/budget';
import { FakeGuard, fakeFetch, json } from './support/fakes';
import { MemoryKV } from './support/memory-kv';
import {
	fakeArtist,
	rawArtist,
	rawTrack,
	type SpotifyFakeOptions,
	sid,
	spotifyFake
} from './support/spotify-fake';

const daft = fakeArtist('DaftPunk');
const justice = fakeArtist('Justice');
const token = fixedToken('at-1');

function setup(options: Partial<SpotifyFakeOptions> = {}) {
	const now = () => Date.UTC(2026, 9, 26, 12);
	const kv = new MemoryKV(now);
	const { fetch, calls } = fakeFetch(spotifyFake({ artists: [daft, justice], ...options }));
	const spotify = new SpotifyClient({ fetch, guard: new FakeGuard(), sleep: async () => {}, now });
	const apiCalls = (path: string) => calls.filter((call) => call.url.pathname === `/v1${path}`);
	return { listening: new Listening({ spotify, kv }), kv, calls, apiCalls };
}

/** A full page of 50 tracks, numbered from `offset + 1`, with a link to the next page. */
const fullTrackPage = (offset: number, wrap = false) =>
	json({
		items: Array.from({ length: 50 }, (_, i) => {
			const track = rawTrack(daft, offset + i + 1);
			return wrap ? { added_at: '2026-01-01T00:00:00Z', track } : track;
		}),
		next: 'https://api.spotify.com/v1/next'
	});

describe('Listening.signals', () => {
	it('reads every signal within 24 calls, stops at the page caps, and caches with TTLs', async () => {
		const { listening, kv, calls } = setup({
			userTopArtists: () => json({ items: [rawArtist(daft)], next: null }),
			userTopTracks: (_range, offset) => fullTrackPage(offset),
			recentlyPlayed: () =>
				json({ items: [{ track: rawTrack(justice, 1), played_at: '2026-10-26T11:00:00Z' }] }),
			followedArtists: (after) => {
				const page = Number(after ?? 0);
				return json({
					artists: {
						items: Array.from({ length: 50 }, (_, i) => rawArtist(fakeArtist(`F${page}x${i}`))),
						next: 'https://api.spotify.com/v1/next',
						cursors: { after: String(page + 1) }
					}
				});
			},
			savedTracks: (offset) => fullTrackPage(offset, true)
		});
		const budget = new CallBudget(60);

		const signals = await listening.signals('acc-1', token, budget);
		const callsCold = calls.length;
		await listening.signals('acc-1', token, new CallBudget(60));

		expect(callsCold).toBe(24);
		expect(budget.spent).toBe(24);
		expect(calls).toHaveLength(24);
		expect(signals.topArtists.short_term.map((artist) => artist.name)).toEqual(['DaftPunk']);
		expect(signals.topTracks.long_term).toHaveLength(100);
		expect(signals.savedTracks).toHaveLength(500);
		expect(signals.followedArtists).toHaveLength(200);
		expect(signals.recentPlays.map((track) => track.artists[0]?.name)).toEqual(['Justice']);
		expect(kv.ttlSeconds('c:u:acc-1:top:artists:medium_term')).toBe(3600);
		expect(kv.ttlSeconds('c:u:acc-1:top:tracks:long_term')).toBe(3600);
		expect(kv.ttlSeconds('c:u:acc-1:recent')).toBe(900);
		expect(kv.ttlSeconds('c:u:acc-1:followed')).toBe(21_600);
		expect(kv.ttlSeconds('c:u:acc-1:saved')).toBe(21_600);
	});

	it('follows the cursor of the followed artists, and stops on a short page', async () => {
		const { listening, apiCalls } = setup({
			followedArtists: (after) =>
				json({
					artists: {
						items:
							after === null
								? Array.from({ length: 50 }, (_, i) => rawArtist(fakeArtist(`A${i}`)))
								: [rawArtist(justice)],
						next: after === null ? 'https://api.spotify.com/v1/next' : null,
						cursors: { after: after === null ? sid('A49') : null }
					}
				})
		});

		const artists = await listening.followedArtists('acc-1', token);

		expect(artists).toHaveLength(51);
		expect(apiCalls('/me/following').map((call) => call.url.searchParams.get('after'))).toEqual([
			null,
			sid('A49')
		]);
	});
});

describe('Listening.familiar', () => {
	it("lists the user's top tracks by the artist, then the saved ones, each once", async () => {
		const { listening } = setup({
			userTopTracks: (range, offset) =>
				json({
					items:
						range === 'short_term' && offset === 0
							? [rawTrack(daft, 3), rawTrack(justice, 1), rawTrack(daft, 1)]
							: [],
					next: null
				}),
			savedTracks: () =>
				json({
					items: [rawTrack(daft, 7), rawTrack(daft, 3), rawTrack(justice, 2)].map((track) => ({
						track
					})),
					next: null
				})
		});

		const tracks = await listening.familiar('acc-1', token, daft.id);

		expect(tracks.map((track) => track.name)).toEqual([
			'DaftPunk Song 3',
			'DaftPunk Song 1',
			'DaftPunk Song 7'
		]);
	});
});
