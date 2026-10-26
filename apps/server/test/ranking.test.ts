import { describe, expect, it } from 'bun:test';
import { TIME_RANGES } from '@spot-mixer/shared';
import { type ListeningSignals, rangeWeights, rankArtists } from '../src/mix/ranking';

const artist = (name: string) => ({ id: name, name, imageUrl: `https://i.scdn.co/${name}` });
const track = (...names: string[]) => ({ artists: names.map((name) => ({ id: name, name })) });
const empty = () => ({ short_term: [], medium_term: [], long_term: [] });

function signals(extra: Partial<ListeningSignals> = {}): ListeningSignals {
	return {
		topArtists: empty(),
		topTracks: empty(),
		savedTracks: [],
		recentPlays: [],
		followedArtists: [],
		...extra
	};
}

const rank = (input: ListeningSignals, recency = 0.5, limit = 50) =>
	rankArtists(input, { recency, limit });
const names = (ranked: { name: string }[]) => ranked.map((entry) => entry.name);

describe('rangeWeights', () => {
	it('uses the weights of plan §7.2 by default, and each set sums to 1', () => {
		expect(rangeWeights(0.5)).toEqual({ short_term: 0.45, medium_term: 0.35, long_term: 0.2 });
		for (const recency of [0, 0.2, 0.5, 0.8, 1]) {
			const weights = rangeWeights(recency);
			expect(TIME_RANGES.reduce((sum, range) => sum + weights[range], 0)).toBeCloseTo(1, 10);
		}
	});

	it('moves weight to the short range as the recency grows, and clamps the input', () => {
		const shorts = [0, 0.25, 0.5, 0.75, 1].map((recency) => rangeWeights(recency).short_term);

		expect([...shorts].sort((a, b) => a - b)).toEqual(shorts);
		expect(rangeWeights(-1)).toEqual(rangeWeights(0));
		expect(rangeWeights(2)).toEqual(rangeWeights(1));
		expect(rangeWeights(0).long_term).toBeGreaterThan(rangeWeights(0).short_term);
	});
});

describe('rankArtists', () => {
	it("follows Spotify's order, and an artist in every range beats one in a single range", () => {
		const ranked = rank(
			signals({
				topArtists: {
					short_term: [artist('a'), artist('b'), artist('c')],
					medium_term: [artist('c')],
					long_term: [artist('c')]
				}
			})
		);

		expect(names(ranked)).toEqual(['c', 'a', 'b']);
	});

	it('ranks by what the user plays now or by all-time listening, as the slider says', () => {
		const input = signals({
			topArtists: { short_term: [artist('now')], medium_term: [], long_term: [artist('old')] }
		});

		expect(names(rank(input, 1))).toEqual(['now', 'old']);
		expect(names(rank(input, 0))).toEqual(['old', 'now']);
	});

	it("gives Spotify's facts as reasons, and never the score", () => {
		const ranked = rank(
			signals({
				topArtists: { ...empty(), short_term: [artist('a')] },
				topTracks: { ...empty(), medium_term: [track('a', 'guest'), track('a')] },
				savedTracks: [track('a'), track('a'), track('a'), track('guest')],
				recentPlays: [track('a'), track('b'), track('a')],
				followedArtists: [artist('a')]
			})
		);

		expect(ranked[0]).toEqual({
			id: 'a',
			name: 'a',
			imageUrl: 'https://i.scdn.co/a',
			reasons: {
				topArtist: ['short_term'],
				topTracks: ['medium_term'],
				savedTracks: 3,
				recentPlays: 2,
				followed: true
			}
		});
		expect(ranked.find((entry) => entry.id === 'guest')?.reasons).toEqual({
			topArtist: [],
			topTracks: ['medium_term'],
			savedTracks: 1,
			recentPlays: 0,
			followed: false
		});
	});

	it('takes images from full artist objects, also when a track named the artist first', () => {
		const ranked = rank(
			signals({
				savedTracks: [track('x'), track('y')],
				followedArtists: [artist('x')]
			})
		);

		expect(ranked.find((entry) => entry.id === 'x')?.imageUrl).toBe('https://i.scdn.co/x');
		expect(ranked.find((entry) => entry.id === 'y')?.imageUrl).toBeNull();
	});

	it('counts an artist once per track', () => {
		const ranked = rank(
			signals({ savedTracks: [track('a', 'a')], recentPlays: [track('a', 'a')] })
		);

		expect(ranked[0]?.reasons).toMatchObject({ savedTracks: 1, recentPlays: 1 });
	});

	it('weighs each signal as plan §7.2 says', () => {
		// Scores: top 0.45, saved 0.3 (γ), tracks 0.225 (β · 0.45), recent 0.2 (δ), followed 0.1 (ε).
		const ranked = rank(
			signals({
				topArtists: { ...empty(), short_term: [artist('top')] },
				topTracks: { ...empty(), short_term: [track('tracks')] },
				savedTracks: [track('saved')],
				recentPlays: [track('recent'), track('recent')],
				followedArtists: [artist('followed')]
			})
		);

		expect(names(ranked)).toEqual(['top', 'saved', 'tracks', 'recent', 'followed']);
	});

	it('breaks ties by name and keeps at most `limit` artists', () => {
		const input = signals({ followedArtists: [artist('b'), artist('c'), artist('a')] });

		expect(names(rank(input))).toEqual(['a', 'b', 'c']);
		expect(names(rank(input, 0.5, 2))).toEqual(['a', 'b']);
		expect(rank(signals())).toEqual([]);
	});
});
