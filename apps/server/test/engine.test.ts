import { describe, expect, it } from 'bun:test';
import type { MixOptions, SourceSpec } from '@spot-mixer/shared';
import { buildMix, type SourceGroup, trim } from '../src/mix/engine';
import { adjacentPairs, canSeparate, orderTracks } from '../src/mix/order';
import { createRng } from '../src/mix/rng';
import type { Candidate } from '../src/mix/types';
import { candidate, candidates } from './support/tracks';

const options = (extra: Partial<MixOptions> = {}): MixOptions => ({
	maxTracks: null,
	order: 'balanced-shuffle',
	noAdjacentSameArtist: true,
	exclude: [],
	seed: 42,
	...extra
});

function popular(artist: string, count: number, available = count): SourceGroup {
	const spec: SourceSpec = { kind: 'popular', artistId: artist, count };
	return { spec, artistName: artist, candidates: candidates(artist, available) };
}

const ids = (tracks: Candidate[]) => tracks.map((track) => track.id);

describe('buildMix', () => {
	it('takes the best-ranked tracks of each popular source', () => {
		const result = buildMix(
			[popular('a', 2, 5), popular('b', 3, 5)],
			options({ order: 'grouped' })
		);

		expect(ids(result.tracks)).toEqual(['a-0', 'a-1', 'b-0', 'b-1', 'b-2']);
		expect(result.warnings).toEqual([]);
	});

	it('applies the filters before it selects, and warns when a source runs short', () => {
		const group = popular('a', 3, 3);
		group.candidates[0] = candidate('a', 0, { explicit: true });
		group.candidates[1] = candidate('a', 1, { name: 'a song 1 (Live)' });

		const result = buildMix(
			[group, popular('b', 1)],
			options({ order: 'grouped', exclude: ['explicit', 'live'] })
		);

		expect(ids(result.tracks)).toEqual(['a-2', 'b-0']);
		expect(result.warnings).toEqual(['a: 1 of 3 tracks are available after the filters.']);
	});

	it('keeps a song that two sources share only in the first source', () => {
		const shared = { name: 'Get Lucky', artists: [{ id: 'a', name: 'a' }] };
		const first = popular('a', 2);
		first.candidates[0] = candidate('a', 0, { id: 'lucky-a', ...shared });
		const second = popular('b', 2);
		second.candidates[0] = candidate('b', 0, { id: 'lucky-b', ...shared });

		const result = buildMix([first, second], options({ order: 'grouped' }));

		expect(ids(result.tracks)).toEqual(['lucky-a', 'a-1', 'b-1']);
	});

	it('selects K random tracks per album, in album order', () => {
		const tracks = [
			...candidates('a', 6).map((track) => ({ ...track, album: { ...track.album, id: 'x' } })),
			...candidates('a', 6).map((track) => ({
				...track,
				id: `y-${track.id}`,
				name: `other ${track.name}`,
				album: { ...track.album, id: 'y' },
				rank: track.rank + 10_000
			}))
		];
		const group: SourceGroup = {
			spec: { kind: 'albums', artistId: 'a', albumIds: ['x', 'y'], randomPerAlbum: 2 },
			artistName: 'a',
			candidates: tracks
		};

		const result = buildMix([group, popular('b', 1)], options({ order: 'grouped' }));
		const fromA = result.tracks.filter((track) => track.sourceArtistId === 'a');

		expect(fromA.map((track) => track.album.id)).toEqual(['x', 'x', 'y', 'y']);
		expect([...fromA].sort((p, q) => p.rank - q.rank)).toEqual(fromA);
	});

	it('trims every source in proportion to its size', () => {
		const groups = [candidates('a', 10), candidates('b', 5), candidates('c', 5)];

		expect(trim(groups, 10).map((group) => group.length)).toEqual([5, 3, 2]);
		expect(trim(groups, 30)).toBe(groups);
	});
});

describe('orderTracks', () => {
	const groupSizes = [
		[3, 3],
		[5, 1, 1],
		[4, 2, 2],
		[7, 6],
		[10, 3, 3, 2, 1],
		[1, 1, 1, 1]
	];

	for (const order of ['balanced-shuffle', 'round-robin'] as const) {
		it(`${order}: is a permutation, repeats with the same seed, and separates artists when possible`, () => {
			for (const sizes of groupSizes) {
				const groups = sizes.map((size, index) => candidates(`artist${index}`, size));
				for (let seed = 0; seed < 25; seed += 1) {
					const first = orderTracks(groups, { order, noAdjacentSameArtist: true }, createRng(seed));
					const again = orderTracks(groups, { order, noAdjacentSameArtist: true }, createRng(seed));

					expect(ids(first.tracks).sort()).toEqual(ids(groups.flat()).sort());
					expect(ids(again.tracks)).toEqual(ids(first.tracks));
					if (canSeparate(groups)) expect(adjacentPairs(first.tracks)).toBe(0);
				}
			}
		});
	}

	it('warns when one artist has more than half of the tracks', () => {
		const groups = [candidates('a', 6), candidates('b', 2)];

		const result = orderTracks(
			groups,
			{ order: 'balanced-shuffle', noAdjacentSameArtist: true },
			createRng(1)
		);

		expect(canSeparate(groups)).toBe(false);
		expect(result.warnings).toHaveLength(1);
	});

	it('grouped keeps the sources in order; chronological sorts by release and track', () => {
		const old = candidate('b', 2, {
			album: { ...candidate('b', 2).album, releaseDate: '1999-01-01' }
		});
		const groups = [candidates('a', 2), [old, candidate('b', 1)]];
		const rng = createRng(1);

		expect(
			ids(orderTracks(groups, { order: 'grouped', noAdjacentSameArtist: true }, rng).tracks)
		).toEqual(['a-0', 'a-1', 'b-2', 'b-1']);
		expect(
			ids(orderTracks(groups, { order: 'chronological', noAdjacentSameArtist: true }, rng).tracks)
		).toEqual(['b-2', 'a-0', 'a-1', 'b-1']);
	});
});
