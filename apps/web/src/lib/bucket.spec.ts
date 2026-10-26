import type { ArtistSummary } from '@spot-mixer/shared';
import { describe, expect, it } from 'vitest';
import { Bucket, clampCount } from './bucket.svelte';

const artist = (n: number): ArtistSummary => ({
	id: `artist${n}`.padEnd(22, '0'),
	name: `Artist ${n}`,
	imageUrl: null,
	genres: [],
	followers: null
});

function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		data,
		storage: {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value)
		} as Storage
	};
}

describe('Bucket', () => {
	it('adds each artist once, up to 12 artists', () => {
		const bucket = new Bucket(null);

		bucket.add(artist(1));
		bucket.add(artist(1));
		for (let n = 2; n <= 20; n += 1) bucket.add(artist(n));

		expect(bucket.entries).toHaveLength(12);
		expect(bucket.full).toBe(true);
		expect(bucket.entries[0]?.source).toEqual({ kind: 'popular', count: 10 });
	});

	it('is ready with 2 artists, but not while an album source has no album', () => {
		const bucket = new Bucket(null);
		bucket.add(artist(1));
		expect(bucket.ready).toBe(false);

		bucket.add(artist(2));
		expect(bucket.ready).toBe(true);

		bucket.setSource(artist(2).id, { kind: 'albums', albums: [], randomPerAlbum: null });
		expect(bucket.ready).toBe(false);
	});

	it('makes a recipe with clamped counts and plain options', () => {
		const bucket = new Bucket(null);
		bucket.add(artist(1));
		bucket.add(artist(2));
		bucket.setSource(artist(1).id, { kind: 'favorites', count: 99 });
		bucket.setSource(artist(2).id, {
			kind: 'albums',
			albums: [{ id: 'album1'.padEnd(22, '0'), name: 'Album 1' }],
			randomPerAlbum: 3
		});

		const recipe = bucket.recipe();

		expect(recipe.sources).toEqual([
			{ kind: 'favorites', artistId: artist(1).id, count: 30 },
			{
				kind: 'albums',
				artistId: artist(2).id,
				albumIds: ['album1'.padEnd(22, '0')],
				randomPerAlbum: 3
			}
		]);
		expect(JSON.parse(JSON.stringify(recipe.options))).toEqual(recipe.options);
	});

	it('keeps the draft in storage, and ignores a broken draft', () => {
		const { storage } = memoryStorage();
		const first = new Bucket(storage);
		first.add(artist(1));
		first.options.order = 'grouped';
		first.save();

		const second = new Bucket(storage);
		second.load();

		expect(second.entries.map((entry) => entry.artist.id)).toEqual([artist(1).id]);
		expect(second.options.order).toBe('grouped');

		const broken = new Bucket(memoryStorage({ 'spot-mixer:artist-mix': '{not json' }).storage);
		broken.load();
		expect(broken.entries).toEqual([]);
	});

	it('works when the storage throws', () => {
		const throwing = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			}
		} as unknown as Storage;
		const bucket = new Bucket(throwing);

		bucket.load();
		bucket.add(artist(1));
		bucket.save();

		expect(bucket.entries).toHaveLength(1);
	});
});

describe('clampCount', () => {
	it('keeps counts between 1 and 30', () => {
		expect([clampCount(0), clampCount(7.4), clampCount(31), clampCount(Number.NaN)]).toEqual([
			1, 7, 30, 10
		]);
	});
});
