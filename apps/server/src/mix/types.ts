import type { MixPool, TrackSummary } from '@spot-mixer/shared';

/** A track that a source offers to the mix. */
export type Candidate = TrackSummary & {
	/** The bucket artist whose source produced the track. */
	sourceArtistId: string;
	/** Place in its source: 0 is first (the most popular track, or the first track of the first album). */
	rank: number;
	/** Only for blend sources (plan §7.3). */
	pool?: MixPool;
};
