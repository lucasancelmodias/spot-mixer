import { z } from 'zod';
import { spotifyIdSchema, trackSummarySchema } from './catalog';
import {
	EXCLUDE_OPTIONS,
	MAX_ALBUMS_PER_SOURCE,
	MAX_MIX_ARTISTS,
	MAX_MIX_TRACKS,
	MAX_SOURCE_COUNT,
	MIN_MIX_ARTISTS,
	ORDER_OPTIONS
} from './limits';

/** Where the tracks of one bucket artist come from (plan §6.1). */
export const sourceSpecSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('popular'),
		artistId: spotifyIdSchema,
		count: z.number().int().min(1).max(MAX_SOURCE_COUNT)
	}),
	z.object({
		kind: z.literal('favorites'),
		artistId: spotifyIdSchema,
		count: z.number().int().min(1).max(MAX_SOURCE_COUNT)
	}),
	z.object({
		kind: z.literal('albums'),
		artistId: spotifyIdSchema,
		albumIds: z.array(spotifyIdSchema).min(1).max(MAX_ALBUMS_PER_SOURCE),
		/** Null: every track of the selected albums. */
		randomPerAlbum: z.number().int().min(1).max(50).nullable()
	})
]);

export const mixOptionsSchema = z.object({
	/** Null: no limit. Larger mixes are trimmed in proportion. */
	maxTracks: z.number().int().min(1).max(MAX_MIX_TRACKS).nullable(),
	order: z.enum(ORDER_OPTIONS),
	noAdjacentSameArtist: z.boolean(),
	exclude: z.array(z.enum(EXCLUDE_OPTIONS)),
	/** The same seed and the same input give the same mix. */
	seed: z.number().int().min(0).max(2_147_483_647)
});

export const mixRecipeSchema = z.object({
	sources: z
		.array(sourceSpecSchema)
		.min(MIN_MIX_ARTISTS)
		.max(MAX_MIX_ARTISTS)
		.refine(
			(sources) => new Set(sources.map((source) => source.artistId)).size === sources.length,
			'each artist can appear only once'
		),
	options: mixOptionsSchema
});

export const mixTrackSchema = trackSummarySchema.extend({
	/** The bucket artist whose source produced the track. */
	sourceArtistId: z.string()
});

/** Body of `POST /api/mixes/preview`. */
export const mixPreviewSchema = z.object({
	tracks: z.array(mixTrackSchema),
	warnings: z.array(z.string()),
	spotifyCalls: z.number()
});

export const trackUriSchema = z
	.string()
	.regex(/^spotify:track:[A-Za-z0-9]{22}$/, 'must be a Spotify track URI');

/** Request of `POST /api/mixes`. */
export const saveMixRequestSchema = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().trim().max(300),
	trackUris: z.array(trackUriSchema).min(1).max(MAX_MIX_TRACKS)
});

/** Body of `POST /api/mixes`. */
export const saveMixResponseSchema = z.object({
	playlistId: z.string(),
	url: z.string(),
	added: z.number()
});

export type SourceSpec = z.infer<typeof sourceSpecSchema>;
export type MixOptions = z.infer<typeof mixOptionsSchema>;
export type MixRecipe = z.infer<typeof mixRecipeSchema>;
export type MixTrack = z.infer<typeof mixTrackSchema>;
export type MixPreview = z.infer<typeof mixPreviewSchema>;
export type SaveMixRequest = z.infer<typeof saveMixRequestSchema>;
export type SaveMixResponse = z.infer<typeof saveMixResponseSchema>;
