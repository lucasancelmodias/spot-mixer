import { z } from 'zod';

/** A Spotify ID: 22 base-62 characters. */
export const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/, 'must be a Spotify ID');

export const artistSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	imageUrl: z.string().nullable(),
	genres: z.array(z.string()),
	followers: z.number().nullable()
});

export const albumSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	/** album, single or compilation. */
	albumType: z.string(),
	/** YYYY, YYYY-MM or YYYY-MM-DD, as Spotify sends it. */
	releaseDate: z.string(),
	totalTracks: z.number().nullable(),
	imageUrl: z.string().nullable()
});

export const trackSummarySchema = z.object({
	id: z.string(),
	uri: z.string(),
	name: z.string(),
	durationMs: z.number(),
	explicit: z.boolean(),
	/** Null when Spotify did not say. */
	isPlayable: z.boolean().nullable(),
	/** Null when Spotify no longer sends the field (plan C1). */
	popularity: z.number().nullable(),
	isrc: z.string().nullable(),
	discNumber: z.number().nullable(),
	trackNumber: z.number().nullable(),
	artists: z.array(z.object({ id: z.string(), name: z.string() })),
	album: albumSummarySchema.omit({ totalTracks: true })
});

export type ArtistSummary = z.infer<typeof artistSummarySchema>;
export type AlbumSummary = z.infer<typeof albumSummarySchema>;
export type TrackSummary = z.infer<typeof trackSummarySchema>;
