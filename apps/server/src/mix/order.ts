import type { MixOptions } from '@spot-mixer/shared';
import { type Rng, shuffled } from './rng';
import type { Candidate } from './types';

export type Ordered = { tracks: Candidate[]; warnings: string[] };

type OrderOptions = Pick<MixOptions, 'order' | 'noAdjacentSameArtist'>;

/** Sets the track order (plan §6.3). `groups` has the tracks of each source, in rank order. */
export function orderTracks(groups: Candidate[][], options: OrderOptions, rng: Rng): Ordered {
	const filled = groups.filter((group) => group.length > 0);
	switch (options.order) {
		case 'grouped':
			return { tracks: filled.flat(), warnings: [] };
		case 'chronological':
			return { tracks: filled.flat().sort(byRelease), warnings: [] };
		case 'round-robin':
			return separate(roundRobin(filled), filled, options, rng);
		case 'balanced-shuffle':
			return separate(balancedShuffle(filled, rng), filled, options, rng);
	}
}

/** Separation is possible only when the largest group has at most ⌈n / 2⌉ tracks. */
export function canSeparate(groups: Candidate[][]): boolean {
	const total = groups.reduce((sum, group) => sum + group.length, 0);
	return Math.max(0, ...groups.map((group) => group.length)) <= Math.ceil(total / 2);
}

/** The number of neighbor pairs from one source artist. */
export function adjacentPairs(tracks: Candidate[]): number {
	let pairs = 0;
	for (let i = 1; i < tracks.length; i += 1) {
		if (tracks[i]?.sourceArtistId === tracks[i - 1]?.sourceArtistId) pairs += 1;
	}
	return pairs;
}

function separate(
	tracks: Candidate[],
	groups: Candidate[][],
	options: OrderOptions,
	rng: Rng
): Ordered {
	if (!options.noAdjacentSameArtist || groups.length < 2) return { tracks, warnings: [] };
	const repaired = repair(tracks);
	if (!canSeparate(groups)) {
		return {
			tracks: repaired,
			warnings: [
				'One artist has more than half of the tracks, so some of its tracks are next to each other.'
			]
		};
	}
	return {
		tracks: adjacentPairs(repaired) === 0 ? repaired : interleave(repaired, rng),
		warnings: []
	};
}

function roundRobin(groups: Candidate[][]): Candidate[] {
	const tracks: Candidate[] = [];
	const longest = Math.max(0, ...groups.map((group) => group.length));
	for (let i = 0; i < longest; i += 1) {
		for (const group of groups) {
			const track = group[i];
			if (track) tracks.push(track);
		}
	}
	return tracks;
}

/** Spreads each artist evenly: track i of an artist with k tracks goes near offset + i · n / k. */
function balancedShuffle(groups: Candidate[][], rng: Rng): Candidate[] {
	const total = groups.reduce((sum, group) => sum + group.length, 0);
	const placed: { track: Candidate; position: number }[] = [];
	for (const group of groups) {
		const spacing = total / group.length;
		const offset = rng() * spacing;
		shuffled(group, rng).forEach((track, i) => {
			const jitter = (rng() - 0.5) * 0.2 * spacing;
			placed.push({ track, position: offset + i * spacing + jitter });
		});
	}
	return placed.sort((a, b) => a.position - b.position).map(({ track }) => track);
}

/** Moves a track forward when it follows a track of the same artist. */
function repair(input: Candidate[]): Candidate[] {
	const tracks = [...input];
	for (let i = 1; i < tracks.length; i += 1) {
		const previous = tracks[i - 1]?.sourceArtistId;
		if (tracks[i]?.sourceArtistId !== previous) continue;
		const j = tracks.findIndex((track, k) => k > i && track.sourceArtistId !== previous);
		if (j === -1) break;
		const swap = tracks[i] as Candidate;
		tracks[i] = tracks[j] as Candidate;
		tracks[j] = swap;
	}
	return tracks;
}

/**
 * Always takes the artist with the most tracks left, but never the previous artist (ties are
 * random). This guarantees no neighbors when separation is possible. Each artist keeps its order.
 */
function interleave(tracks: Candidate[], rng: Rng): Candidate[] {
	const queues = new Map<string, Candidate[]>();
	for (const track of tracks) {
		queues.set(track.sourceArtistId, [...(queues.get(track.sourceArtistId) ?? []), track]);
	}
	const result: Candidate[] = [];
	let previous: string | null = null;
	while (result.length < tracks.length) {
		const left = [...queues].filter(([, queue]) => queue.length > 0);
		const allowed = left.filter(([artist]) => artist !== previous);
		const options = allowed.length > 0 ? allowed : left;
		const most = Math.max(...options.map(([, queue]) => queue.length));
		const best = options.filter(([, queue]) => queue.length === most);
		const [artist, queue] = best[Math.floor(rng() * best.length)] as [string, Candidate[]];
		result.push(queue.shift() as Candidate);
		previous = artist;
	}
	return result;
}

function byRelease(a: Candidate, b: Candidate): number {
	return (
		a.album.releaseDate.localeCompare(b.album.releaseDate) ||
		a.album.id.localeCompare(b.album.id) ||
		(a.discNumber ?? 0) - (b.discNumber ?? 0) ||
		(a.trackNumber ?? 0) - (b.trackNumber ?? 0)
	);
}
