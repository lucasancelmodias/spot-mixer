import { describe, expect, it } from 'bun:test';
import { dedupeSongs, hasVersionTag, passesFilters, sameSong } from '../src/mix/songs';
import { candidate } from './support/tracks';

const album = (name: string, albumType = 'album', releaseDate = '2020-01-01') => ({
	id: `${name}-id`,
	name,
	albumType,
	releaseDate,
	imageUrl: null
});

describe('hasVersionTag', () => {
	it('finds versions only in brackets, dash suffixes and album titles', () => {
		expect(hasVersionTag(candidate('a', 1, { name: 'Live Forever' }), 'live')).toBe(false);
		expect(hasVersionTag(candidate('a', 1, { name: 'Song (Live)' }), 'live')).toBe(true);
		expect(hasVersionTag(candidate('a', 1, { name: 'Song - Live at Wembley' }), 'live')).toBe(true);
		expect(hasVersionTag(candidate('a', 1, { album: album('Live at Wembley') }), 'live')).toBe(
			true
		);
		expect(hasVersionTag(candidate('a', 1, { name: 'Song (Remix)' }), 'remix')).toBe(true);
		expect(hasVersionTag(candidate('a', 1, { name: 'Song - Remastered 2011' }), 'remix')).toBe(
			false
		);
	});
});

describe('passesFilters', () => {
	it('removes unplayable tracks always, and explicit or version tracks on request', () => {
		expect(passesFilters(candidate('a', 1, { isPlayable: false }), [])).toBe(false);
		expect(passesFilters(candidate('a', 1, { isPlayable: null }), [])).toBe(true);
		expect(passesFilters(candidate('a', 1, { explicit: true }), ['explicit'])).toBe(false);
		expect(passesFilters(candidate('a', 1, { name: 'Song (Acoustic)' }), ['acoustic'])).toBe(false);
		expect(passesFilters(candidate('a', 1, { name: 'Song (Acoustic)' }), ['live'])).toBe(true);
	});
});

describe('dedupeSongs', () => {
	it('keeps the studio album version at the best rank', () => {
		const single = candidate('a', 0, {
			id: 's',
			name: 'Song - Radio Edit',
			album: album('Song', 'single')
		});
		const live = candidate('a', 1, { id: 'l', name: 'Song (Live)', album: album('Live at X') });
		const studio = candidate('a', 5, { id: 'st', name: 'Song', album: album('First Album') });
		const other = candidate('a', 2, { id: 'o', name: 'Other song' });

		const result = dedupeSongs([single, live, studio, other]);

		expect(result.map((track) => [track.id, track.rank])).toEqual([
			['st', 0],
			['o', 2]
		]);
	});

	it('prefers the earliest release when the album types are equal', () => {
		const remaster = candidate('a', 0, {
			id: 'new',
			name: 'Song - 2011 Remaster',
			album: album('Remaster', 'album', '2011-05-01')
		});
		const original = candidate('a', 1, {
			id: 'old',
			name: 'Song',
			album: album('Original', 'album', '1997-05-21')
		});

		expect(dedupeSongs([remaster, original]).map((track) => track.id)).toEqual(['old']);
	});

	it('matches by ISRC across different titles', () => {
		const a = candidate('a', 0, { id: 'x', name: 'Título', isrc: 'GB0001' });
		const b = candidate('a', 1, { id: 'y', name: 'Title', isrc: 'GB0001' });

		expect(sameSong(a, b)).toBe(true);
		expect(dedupeSongs([a, b])).toHaveLength(1);
	});
});
