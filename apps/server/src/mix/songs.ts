import type { MixOptions, TrackSummary } from '@spot-mixer/shared';
import { normalizeTitle } from './normalize';

type VersionTag = Exclude<MixOptions['exclude'][number], 'explicit'>;

// Version words inside the bracketed parts or the dash suffix of a title: "(Live)", "- Remix".
const TITLE_PATTERNS: Record<VersionTag, RegExp> = {
	live: /\b(live|unplugged)\b/i,
	remix: /\b(remix(es|ed)?|rmx)\b/i,
	acoustic: /\bacoustic\b/i,
	instrumental: /\binstrumentals?\b/i,
	demo: /\b(demos?|karaoke)\b/i
};

// Album titles that make the whole album one version: "Live at Wembley", "The Remixes".
const ALBUM_PATTERNS: Record<VersionTag, RegExp> = {
	live: /\b(live (at|in|from|on)|unplugged)\b/i,
	remix: /\bremix(es)?\b/i,
	acoustic: /\bacoustic\b/i,
	instrumental: /\binstrumentals?\b/i,
	demo: /\bdemos?\b/i
};

const ALBUM_TYPE_ORDER: Record<string, number> = { album: 0, single: 1, compilation: 2 };

// Only these parts of a title name a version. "Live Forever" is a song, "Song (Live)" a version.
function versionParts(title: string): string[] {
	const parts = title.match(/[([{][^)\]}]*[)\]}]/g) ?? [];
	const dash = /\s[-–—]\s(.*)$/u.exec(title)?.[1];
	return dash ? [...parts, dash] : parts;
}

export function hasVersionTag(track: TrackSummary, tag: VersionTag): boolean {
	const pattern = TITLE_PATTERNS[tag];
	return (
		versionParts(track.name).some((part) => pattern.test(part)) ||
		ALBUM_PATTERNS[tag].test(track.album.name)
	);
}

/** False for unplayable tracks and for tracks that an exclude option removes. */
export function passesFilters(track: TrackSummary, exclude: MixOptions['exclude']): boolean {
	if (track.isPlayable === false) return false;
	return exclude.every((option) =>
		option === 'explicit' ? !track.explicit : !hasVersionTag(track, option)
	);
}

/**
 * Keys that identify a song across its versions (plan §6.2): the track ID, the ISRC, and the
 * normalized title together with the primary artist.
 */
export function songKeys(track: TrackSummary): string[] {
	const keys = [`id:${track.id}`];
	if (track.isrc) keys.push(`isrc:${track.isrc}`);
	const title = normalizeTitle(track.name);
	if (title) keys.push(`title:${track.artists[0]?.id ?? ''}:${title}`);
	return keys;
}

/** True when the two tracks are versions of one song. */
export function sameSong(a: TrackSummary, b: TrackSummary): boolean {
	const keys = new Set(songKeys(a));
	return songKeys(b).some((key) => keys.has(key));
}

type Ranked = TrackSummary & { rank: number };

/**
 * Sort order of the versions of one song: studio album, then single, then compilation, with
 * live versions last; then the earliest release; then the best rank.
 */
export function preferVersion(a: Ranked, b: Ranked): number {
	const kind = (track: Ranked) =>
		(ALBUM_TYPE_ORDER[track.album.albumType] ?? 3) + (hasVersionTag(track, 'live') ? 10 : 0);
	return (
		kind(a) - kind(b) || compareDates(a.album.releaseDate, b.album.releaseDate) || a.rank - b.rank
	);
}

/** Keeps the preferred version of each song, at the best rank of all its versions, in rank order. */
export function dedupeSongs<T extends Ranked>(tracks: T[]): T[] {
	const groups: T[][] = [];
	const groupOfKey = new Map<string, number>();
	for (const track of tracks) {
		const keys = songKeys(track);
		const found = keys.map((key) => groupOfKey.get(key)).find((index) => index !== undefined);
		const index = found ?? groups.push([]) - 1;
		groups[index]?.push(track);
		for (const key of keys) groupOfKey.set(key, index);
	}
	return groups
		.flatMap((group) => {
			const best = [...group].sort(preferVersion)[0];
			return best ? [{ ...best, rank: Math.min(...group.map((track) => track.rank)) }] : [];
		})
		.sort((a, b) => a.rank - b.rank);
}

// Empty dates sort last.
function compareDates(a: string, b: string): number {
	if (!a || !b) return a ? -1 : b ? 1 : 0;
	return a < b ? -1 : a > b ? 1 : 0;
}
