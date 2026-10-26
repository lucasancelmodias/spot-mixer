import type { ArtistReasons, TimeRange } from '@spot-mixer/shared';

const RANGE_LABELS: Record<TimeRange, string> = {
	short_term: 'last 4 weeks',
	medium_term: 'last 6 months',
	long_term: 'last 12 months'
};

function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/**
 * Why an artist is in the My Mix ranking, in Spotify's own facts (plan §7.2), for example
 * "In your top artists: last 4 weeks, last 6 months".
 */
export function describeReasons(reasons: ArtistReasons): string[] {
	const ranges = (list: TimeRange[]) => list.map((range) => RANGE_LABELS[range]).join(', ');
	const lines: string[] = [];
	if (reasons.topArtist.length > 0) lines.push(`In your top artists: ${ranges(reasons.topArtist)}`);
	if (reasons.topTracks.length > 0) lines.push(`In your top tracks: ${ranges(reasons.topTracks)}`);
	if (reasons.savedTracks > 0) {
		lines.push(`In your saved tracks: ${count(reasons.savedTracks, 'track', 'tracks')}`);
	}
	if (reasons.recentPlays > 0) {
		lines.push(`In your last 50 plays: ${count(reasons.recentPlays, 'play', 'plays')}`);
	}
	if (reasons.followed) lines.push('You follow this artist');
	return lines;
}
