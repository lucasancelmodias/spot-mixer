import { z } from 'zod';
import { MIX_MODES } from './limits';
import { mixRecipeSchema, mixTrackSchema } from './mix';

/**
 * A saved mix: the recipe of a playlist that the app made (plan D5). It holds IDs, names and
 * options, never track data. It expires SAVED_MIX_TTL_DAYS after its last save or refresh.
 */
export const savedMixSchema = z.object({
	playlistId: z.string(),
	url: z.string(),
	name: z.string(),
	mode: z.enum(MIX_MODES),
	artistNames: z.array(z.string()),
	trackCount: z.number(),
	/** ISO times. */
	createdAt: z.string(),
	refreshedAt: z.string().nullable(),
	expiresAt: z.string(),
	recipe: mixRecipeSchema
});

/** Body of `POST /api/mixes/saved/:playlistId/refresh`. */
export const refreshMixResponseSchema = z.object({
	mix: savedMixSchema,
	tracks: z.array(mixTrackSchema),
	warnings: z.array(z.string()),
	spotifyCalls: z.number()
});

export type SavedMix = z.infer<typeof savedMixSchema>;
export type RefreshMixResponse = z.infer<typeof refreshMixResponseSchema>;
