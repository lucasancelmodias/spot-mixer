import { describe, expect, it } from 'vitest';
import { describeReasons } from './reasons';

const none = { topArtist: [], topTracks: [], savedTracks: 0, recentPlays: 0, followed: false };

describe('describeReasons', () => {
	it("states Spotify's facts, with the time ranges in words", () => {
		expect(
			describeReasons({
				topArtist: ['short_term', 'long_term'],
				topTracks: ['medium_term'],
				savedTracks: 3,
				recentPlays: 1,
				followed: true
			})
		).toEqual([
			'In your top artists: last 4 weeks, last 12 months',
			'In your top tracks: last 6 months',
			'In your saved tracks: 3 tracks',
			'In your last 50 plays: 1 play',
			'You follow this artist'
		]);
	});

	it('leaves out the signals that do not apply', () => {
		expect(describeReasons({ ...none, savedTracks: 1 })).toEqual(['In your saved tracks: 1 track']);
		expect(describeReasons(none)).toEqual([]);
	});
});
