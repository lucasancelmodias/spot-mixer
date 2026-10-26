import {
	type ArtistReasons,
	type ArtistSummary,
	type RankedArtist,
	TIME_RANGES,
	type TimeRange,
	type TrackSummary
} from '@spot-mixer/shared';

type ArtistInfo = Pick<ArtistSummary, 'id' | 'name' | 'imageUrl'>;
type TrackArtists = Pick<TrackSummary, 'artists'>;

/** The user's listening data, as Spotify returns it (plan §7.1). Lists are in Spotify's order. */
export type ListeningSignals = {
	topArtists: Record<TimeRange, ArtistInfo[]>;
	topTracks: Record<TimeRange, TrackArtists[]>;
	savedTracks: TrackArtists[];
	recentPlays: TrackArtists[];
	followedArtists: ArtistInfo[];
};

/** β, γ, δ and ε of plan §7.2: the weights of the signals next to the top-artist lists. */
export const SIGNAL_WEIGHTS = { topTracks: 0.5, savedTracks: 0.3, recentPlays: 0.2, followed: 0.1 };

// The time-range weights w_r at recency 0 (all time), 0.5 (the default of plan §7.2) and 1 (now).
// Each set sums to 1; values in between are linear.
const RANGE_WEIGHT_STOPS: readonly Record<TimeRange, number>[] = [
	{ short_term: 0.1, medium_term: 0.3, long_term: 0.6 },
	{ short_term: 0.45, medium_term: 0.35, long_term: 0.2 },
	{ short_term: 0.8, medium_term: 0.15, long_term: 0.05 }
];

/** The time-range weights for the "all time ↔ right now" slider. */
export function rangeWeights(recency: number): Record<TimeRange, number> {
	const position = Math.min(1, Math.max(0, recency)) * (RANGE_WEIGHT_STOPS.length - 1);
	const index = Math.min(RANGE_WEIGHT_STOPS.length - 2, Math.floor(position));
	const from = RANGE_WEIGHT_STOPS[index] as Record<TimeRange, number>;
	const to = RANGE_WEIGHT_STOPS[index + 1] as Record<TimeRange, number>;
	const t = position - index;
	const weight = (range: TimeRange) => from[range] + (to[range] - from[range]) * t;
	return {
		short_term: weight('short_term'),
		medium_term: weight('medium_term'),
		long_term: weight('long_term')
	};
}

type Entry = { artist: ArtistInfo; score: number; reasons: ArtistReasons };

/**
 * Ranks the user's artists (plan §7.2):
 *
 *   R(a) = Σ_r w_r · (1 − rank_r(a) / N_r)                                top artists
 *        + β · Σ_r w_r · Σ_{t ∈ top_tracks_r, a ∈ t.artists} (1 − rank_r(t) / N_r) / Z_r
 *        + γ · log(1 + saved(a)) / log(1 + max_saved)
 *        + δ · recent(a) / recent_total
 *        + ε · followed(a)
 *
 * Z_r is the largest track sum of range r, so that each term is at most its weight.
 * Compliance (Policy III.13): the score exists only inside this call. The result has the order
 * and Spotify's own facts as reasons, never the score.
 */
export function rankArtists(
	signals: ListeningSignals,
	options: { recency: number; limit: number }
): RankedArtist[] {
	const weights = rangeWeights(options.recency);
	const entries = new Map<string, Entry>();
	const entryOf = (artist: ArtistInfo | TrackArtists['artists'][number]): Entry => {
		const imageUrl = 'imageUrl' in artist ? artist.imageUrl : null;
		const found = entries.get(artist.id);
		if (found) {
			// Full artist objects have images; the artists of a track do not.
			if (found.artist.imageUrl === null && imageUrl) found.artist = { ...found.artist, imageUrl };
			return found;
		}
		const entry: Entry = {
			artist: { id: artist.id, name: artist.name, imageUrl },
			score: 0,
			reasons: { topArtist: [], topTracks: [], savedTracks: 0, recentPlays: 0, followed: false }
		};
		entries.set(artist.id, entry);
		return entry;
	};

	for (const range of TIME_RANGES) {
		const artists = signals.topArtists[range];
		artists.forEach((artist, rank) => {
			const entry = entryOf(artist);
			if (entry.reasons.topArtist.includes(range)) return;
			entry.reasons.topArtist.push(range);
			entry.score += weights[range] * (1 - rank / artists.length);
		});

		const tracks = signals.topTracks[range];
		const sums = new Map<string, number>();
		tracks.forEach((track, rank) => {
			for (const artist of uniqueArtists(track)) {
				entryOf(artist);
				sums.set(artist.id, (sums.get(artist.id) ?? 0) + (1 - rank / tracks.length));
			}
		});
		const largest = Math.max(0, ...sums.values());
		for (const [id, sum] of sums) {
			const entry = entries.get(id) as Entry;
			entry.reasons.topTracks.push(range);
			entry.score += (SIGNAL_WEIGHTS.topTracks * weights[range] * sum) / largest;
		}
	}

	const saved = countByArtist(signals.savedTracks, entryOf);
	const mostSaved = Math.max(0, ...saved.values());
	for (const [id, count] of saved) {
		const entry = entries.get(id) as Entry;
		entry.reasons.savedTracks = count;
		entry.score += (SIGNAL_WEIGHTS.savedTracks * Math.log1p(count)) / Math.log1p(mostSaved);
	}

	const recent = countByArtist(signals.recentPlays, entryOf);
	for (const [id, count] of recent) {
		const entry = entries.get(id) as Entry;
		entry.reasons.recentPlays = count;
		entry.score += (SIGNAL_WEIGHTS.recentPlays * count) / signals.recentPlays.length;
	}

	for (const artist of signals.followedArtists) {
		const entry = entryOf(artist);
		if (entry.reasons.followed) continue;
		entry.reasons.followed = true;
		entry.score += SIGNAL_WEIGHTS.followed;
	}

	return [...entries.values()]
		.sort(
			(a, b) =>
				b.score - a.score ||
				a.artist.name.localeCompare(b.artist.name) ||
				a.artist.id.localeCompare(b.artist.id)
		)
		.slice(0, options.limit)
		.map(({ artist, reasons }) => ({ ...artist, reasons }));
}

/** The artists of a track, each once. */
function uniqueArtists(track: TrackArtists): TrackArtists['artists'] {
	return track.artists.filter(
		(artist, index) => track.artists.findIndex((other) => other.id === artist.id) === index
	);
}

/** The number of tracks with each artist. */
function countByArtist(
	tracks: TrackArtists[],
	entryOf: (artist: TrackArtists['artists'][number]) => Entry
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const track of tracks) {
		for (const artist of uniqueArtists(track)) {
			entryOf(artist);
			counts.set(artist.id, (counts.get(artist.id) ?? 0) + 1);
		}
	}
	return counts;
}
