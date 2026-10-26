import { z } from 'zod';

/** Body of `GET /api/me`. */
export const meResponseSchema = z.object({
	id: z.string(),
	displayName: z.string().nullable(),
	imageUrl: z.string().nullable(),
	/** ISO time of the Spotify authorization. */
	authorizedAt: z.string(),
	/** ISO time after which the user must authorize again (refresh tokens expire after 6 months). */
	renewBy: z.string()
});

export type MeResponse = z.infer<typeof meResponseSchema>;
