import { z } from 'zod';

/** Body of `GET /api/status`. */
export const statusResponseSchema = z.object({
	/** ISO time until which Spotify calls are paused, or null. */
	spotifyBlockedUntil: z.string().nullable(),
	reason: z.enum(['quota', 'rate_limit', 'local_limit']).nullable()
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;
