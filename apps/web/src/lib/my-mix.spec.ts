import type { RankedArtist } from '@spot-mixer/shared';
import { describe, expect, it } from 'vitest';
import { clampArtistCount, MyMix } from './my-mix.svelte';

const ranked = (n: number): RankedArtist => ({
	id: `artist${n}`.padEnd(22, '0'),
	name: `Artist ${n}`,
	imageUrl: null,
	reasons: {
		topArtist: ['short_term'],
		topTracks: [],
		savedTracks: 0,
		recentPlays: 0,
		followed: false
	}
});
const ranking = (count: number) => Array.from({ length: count }, (_, i) => ranked(i + 1));
const id = (n: number) => ranked(n).id;

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

describe('MyMix', () => {
	it('selects the top 5 artists of a new ranking by default', () => {
		const myMix = new MyMix(null);

		myMix.setRanking(ranking(8));

		expect(myMix.selected).toEqual([1, 2, 3, 4, 5].map(id));
		expect(myMix.ready).toBe(true);
	});

	it('follows the top of the ranking until the user changes the selection', () => {
		const myMix = new MyMix(null);
		myMix.setRanking(ranking(8));

		myMix.selectTop(3);
		myMix.setRanking([...ranking(8)].reverse());
		expect(myMix.selected).toEqual([8, 7, 6].map(id));

		myMix.toggle(id(8));
		myMix.toggle(id(1));
		myMix.setRanking(ranking(5));
		expect(myMix.followsTop).toBe(false);
		expect(myMix.selected).toEqual([id(1)]);
		expect(myMix.ready).toBe(false);
	});

	it('selects at most 12 artists, and keeps the ranking order in the recipe', () => {
		const myMix = new MyMix(null);
		myMix.setRanking(ranking(20));

		myMix.selectTop(50);
		myMix.toggle(id(15));
		myMix.toggle(id(2));
		myMix.toggle(id(15));
		myMix.toggle(id(14));

		expect(clampArtistCount(1)).toBe(2);
		expect(myMix.settings.artistCount).toBe(12);
		expect(myMix.selected).toHaveLength(12);
		expect(myMix.full).toBe(true);
		expect(myMix.selectedArtists.map((artist) => artist.name).at(-1)).toBe('Artist 15');
	});

	it('makes a recipe of blend sources with the track settings', () => {
		const myMix = new MyMix(null);
		myMix.setRanking(ranking(3));
		myMix.selectTop(2);
		myMix.settings.familiarShare = 0.3;
		myMix.settings.count = 99;

		const recipe = myMix.recipe();

		expect(recipe.sources).toEqual([
			{ kind: 'blend', artistId: id(1), count: 30, familiarShare: 0.3 },
			{ kind: 'blend', artistId: id(2), count: 30, familiarShare: 0.3 }
		]);
		expect(JSON.parse(JSON.stringify(recipe.options))).toEqual(recipe.options);
	});

	it('keeps the settings in storage, but not the ranking', () => {
		const { storage, data } = memoryStorage();
		const first = new MyMix(storage);
		first.setRanking(ranking(5));
		first.settings.recency = 1;
		first.settings.familiarShare = 0.8;
		first.options.order = 'round-robin';
		first.save();

		const second = new MyMix(storage);
		second.load();

		expect(second.settings).toMatchObject({ recency: 1, familiarShare: 0.8 });
		expect(second.options.order).toBe('round-robin');
		expect(second.ranking).toEqual([]);
		expect(data.get('spot-mixer:my-mix')).not.toContain(id(1));
	});

	it('ignores a broken draft and clamps stored values', () => {
		const broken = new MyMix(memoryStorage({ 'spot-mixer:my-mix': '{not json' }).storage);
		broken.load();
		expect(broken.settings.familiarShare).toBe(0.6);

		const draft = {
			version: 1,
			settings: { recency: 3, familiarShare: -1, count: 0, artistCount: 40 },
			options: {}
		};
		const odd = new MyMix(memoryStorage({ 'spot-mixer:my-mix': JSON.stringify(draft) }).storage);
		odd.load();
		expect(odd.settings).toEqual({ recency: 1, familiarShare: 0, count: 1, artistCount: 12 });
	});
});
