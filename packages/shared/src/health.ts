import { z } from 'zod';

/** Body of `GET /api/health`. The API returns HTTP 503 with this body when Redis is down. */
export const healthResponseSchema = z.object({
	status: z.enum(['ok', 'degraded']),
	redis: z.enum(['up', 'down'])
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
