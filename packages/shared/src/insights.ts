import { z } from 'zod';
import { TIME_RANGES } from './limits';

export const timeRangeSchema = z.enum(TIME_RANGES);

/** Request of `POST /api/insights/artists`. */
export const artistInsightsRequestSchema = z.object({
	/** 0 ranks by all-time listening, 1 by what the user plays now. 0.5 is the default of plan §7.2. */
	recency: z.number().min(0).max(1)
});

/**
 * Spotify's own facts that put an artist in the ranking (plan §7.2). The API never sends the score
 * itself: the order of the list is the only result of the ranking.
 */
export const artistReasonsSchema = z.object({
	/** Time ranges in which the artist is one of the user's top artists. */
	topArtist: z.array(timeRangeSchema),
	/** Time ranges in which the user's top tracks include the artist. */
	topTracks: z.array(timeRangeSchema),
	/** Saved tracks with the artist (at most the first 500 saved tracks are read). */
	savedTracks: z.number().int(),
	/** Plays of the artist in the last 50 plays. */
	recentPlays: z.number().int(),
	followed: z.boolean()
});

export const rankedArtistSchema = z.object({
	id: z.string(),
	name: z.string(),
	/** Null for artists that the user only has in tracks: track artists carry no images. */
	imageUrl: z.string().nullable(),
	reasons: artistReasonsSchema
});

/** Body of `POST /api/insights/artists`. */
export const artistInsightsSchema = z.object({
	/** Most-listened first. */
	artists: z.array(rankedArtistSchema),
	spotifyCalls: z.number()
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type ArtistInsightsRequest = z.infer<typeof artistInsightsRequestSchema>;
export type ArtistReasons = z.infer<typeof artistReasonsSchema>;
export type RankedArtist = z.infer<typeof rankedArtistSchema>;
export type ArtistInsights = z.infer<typeof artistInsightsSchema>;
