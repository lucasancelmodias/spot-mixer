import { z } from 'zod';

// Lenient response schemas: Spotify removes fields for Development Mode apps, so everything
// that is not essential is optional. Unknown fields are dropped.

export const imageSchema = z.object({
	url: z.string(),
	width: z.number().nullable().optional(),
	height: z.number().nullable().optional()
});

export const profileSchema = z.object({
	id: z.string(),
	display_name: z.string().nullable().optional(),
	images: z.array(imageSchema).optional(),
	/** Stable account key, added in May 2026. Prefer it over `id`. */
	account_id: z.string().optional()
});

export type SpotifyImage = z.infer<typeof imageSchema>;
export type SpotifyProfile = z.infer<typeof profileSchema>;

/** The smallest image, for avatars and thumbnails. */
export function smallestImage(images: SpotifyImage[] | undefined): string | null {
	if (!images || images.length === 0) return null;
	const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
	return sorted[0]?.url ?? null;
}
