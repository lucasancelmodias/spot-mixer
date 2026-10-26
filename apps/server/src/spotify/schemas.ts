import { z } from 'zod';

// Lenient response schemas: Spotify removes fields for Development Mode apps, so everything
// that is not essential is optional. Unknown fields are dropped.

/** Parses each item on its own and drops items that do not match, so one odd item does not fail a list. */
export function lenientArray<T>(item: z.ZodType<T>) {
	return z.array(z.unknown()).transform((values) =>
		values.flatMap((value) => {
			const parsed = item.safeParse(value);
			return parsed.success ? [parsed.data] : [];
		})
	);
}

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

export const artistRefSchema = z.object({ id: z.string(), name: z.string() });

export const artistSchema = artistRefSchema.extend({
	images: z.array(imageSchema).optional(),
	genres: z.array(z.string()).optional(),
	followers: z.object({ total: z.number().nullable().optional() }).optional(),
	popularity: z.number().optional()
});

export const albumRefSchema = z.object({
	id: z.string(),
	name: z.string(),
	album_type: z.string().optional(),
	release_date: z.string().optional(),
	total_tracks: z.number().optional(),
	images: z.array(imageSchema).optional()
});

export const trackSchema = z.object({
	id: z.string(),
	uri: z.string(),
	name: z.string(),
	duration_ms: z.number(),
	explicit: z.boolean().optional(),
	is_playable: z.boolean().optional(),
	popularity: z.number().optional(),
	disc_number: z.number().optional(),
	track_number: z.number().optional(),
	external_ids: z.object({ isrc: z.string().optional() }).optional(),
	artists: z.array(artistRefSchema),
	/** Absent on the simplified tracks inside an album. */
	album: albumRefSchema.optional()
});

export function pageOf<T>(item: z.ZodType<T>) {
	return z.object({
		items: lenientArray(item),
		next: z.string().nullable().optional(),
		total: z.number().optional()
	});
}

export const albumSchema = albumRefSchema.extend({ tracks: pageOf(trackSchema) });

export type SpotifyImage = z.infer<typeof imageSchema>;
export type SpotifyProfile = z.infer<typeof profileSchema>;
export type SpotifyArtist = z.infer<typeof artistSchema>;
export type SpotifyAlbumRef = z.infer<typeof albumRefSchema>;
export type SpotifyTrack = z.infer<typeof trackSchema>;
export type SpotifyAlbum = z.infer<typeof albumSchema>;

/** The smallest image, for avatars and thumbnails. */
export function smallestImage(images: SpotifyImage[] | undefined): string | null {
	return pickImage(images, 0);
}

/** The smallest image that is at least `minWidth` wide, else the largest one. */
export function pickImage(images: SpotifyImage[] | undefined, minWidth: number): string | null {
	if (!images || images.length === 0) return null;
	const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
	return (sorted.find((image) => (image.width ?? 0) >= minWidth) ?? sorted.at(-1))?.url ?? null;
}
