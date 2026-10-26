import type { MixOptions, SourceSpec } from '@spot-mixer/shared';
import { orderTracks } from './order';
import { createRng, type Rng, sampleInOrder } from './rng';
import { dedupeSongs, passesFilters, songKeys } from './songs';
import type { Candidate } from './types';

export type SourceGroup = {
	spec: SourceSpec;
	artistName: string;
	/**
	 * In rank order. For album sources: album by album, in track order. For blend sources: the
	 * familiar pool, then the discovery pool, with no song in both.
	 */
	candidates: Candidate[];
};

export type MixResult = { tracks: Candidate[]; warnings: string[] };

/**
 * Builds the mix from the resolved sources (plan §6.2): filter, remove duplicate versions,
 * select per source, remove songs that two sources share, trim to the maximum, and order.
 * Pure: the same input and the same seed give the same mix.
 */
export function buildMix(groups: SourceGroup[], options: MixOptions): MixResult {
	const rng = createRng(options.seed);
	const warnings: string[] = [];
	const picked = groups.map((group) => {
		const eligible = dedupeSongs(
			group.candidates.filter((track) => passesFilters(track, options.exclude))
		);
		const tracks = select(group.spec, eligible, rng);
		const filtered = options.exclude.length > 0 ? ' after the filters' : '';
		if (group.spec.kind !== 'albums' && tracks.length < group.spec.count) {
			warnings.push(
				`${group.artistName}: ${tracks.length} of ${group.spec.count} tracks are available${filtered}.`
			);
		}
		if (group.spec.kind === 'albums' && tracks.length === 0) {
			warnings.push(`${group.artistName}: the selected albums have no tracks${filtered}.`);
		}
		return tracks;
	});
	const unique = withoutRepeats(picked);
	const sized = options.maxTracks === null ? unique : trim(unique, options.maxTracks);
	const ordered = orderTracks(sized, options, rng);
	return { tracks: ordered.tracks, warnings: [...warnings, ...ordered.warnings] };
}

/** Trims every source in proportion to its size (largest remainder method). */
export function trim(groups: Candidate[][], maxTracks: number): Candidate[][] {
	const total = groups.reduce((sum, group) => sum + group.length, 0);
	if (total <= maxTracks) return groups;
	const exact = groups.map((group) => (group.length * maxTracks) / total);
	const quotas = exact.map((value) => Math.floor(value));
	let left = maxTracks - quotas.reduce((sum, quota) => sum + quota, 0);
	const byFraction = exact
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
	for (const { index } of byFraction) {
		if (left === 0) break;
		quotas[index] = (quotas[index] ?? 0) + 1;
		left -= 1;
	}
	return groups.map((group, index) => group.slice(0, quotas[index]));
}

/**
 * Takes `familiarShare` of the tracks from the familiar pool and the rest from the discovery pool
 * (plan §7.3). A pool that runs short leaves its places to the other one. The two pools alternate
 * in proportion, so a trim to `maxTracks` keeps the ratio.
 */
export function blend(eligible: Candidate[], count: number, familiarShare: number): Candidate[] {
	const familiar = eligible.filter((track) => track.pool === 'familiar');
	const discovery = eligible.filter((track) => track.pool !== 'familiar');
	const wanted = Math.round(count * familiarShare);
	const fromFamiliar = Math.min(familiar.length, Math.max(wanted, count - discovery.length));
	const fromDiscovery = Math.min(discovery.length, count - fromFamiliar);
	const spread = (tracks: Candidate[]) =>
		tracks.map((track, i) => ({ track, position: (i + 0.5) / tracks.length }));
	// The sort is stable: on equal positions, the familiar track comes first.
	return [...spread(familiar.slice(0, fromFamiliar)), ...spread(discovery.slice(0, fromDiscovery))]
		.sort((a, b) => a.position - b.position)
		.map(({ track }) => track);
}

function select(spec: SourceSpec, eligible: Candidate[], rng: Rng): Candidate[] {
	if (spec.kind === 'blend') return blend(eligible, spec.count, spec.familiarShare);
	if (spec.kind !== 'albums') return eligible.slice(0, spec.count);
	const perAlbum = spec.randomPerAlbum;
	if (perAlbum === null) return eligible;
	const byAlbum = new Map<string, Candidate[]>();
	for (const track of eligible) {
		byAlbum.set(track.album.id, [...(byAlbum.get(track.album.id) ?? []), track]);
	}
	return [...byAlbum.values()]
		.flatMap((tracks) => sampleInOrder(tracks, perAlbum, rng))
		.sort((a, b) => a.rank - b.rank);
}

/** A song that two sources offer stays only in the first source. */
function withoutRepeats(groups: Candidate[][]): Candidate[][] {
	const seen = new Set<string>();
	return groups.map((group) =>
		group.filter((track) => {
			const keys = songKeys(track);
			if (keys.some((key) => seen.has(key))) return false;
			for (const key of keys) seen.add(key);
			return true;
		})
	);
}
