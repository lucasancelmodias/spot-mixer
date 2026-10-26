import type { StatusResponse } from '@spot-mixer/shared';
import { Hono } from 'hono';
import type { SpotifyGuard } from '../spotify/guard';

/** Tells the UI whether Spotify calls are paused (quota banner). */
export function statusRoutes(guard: SpotifyGuard) {
	return new Hono().get('/', async (c) => {
		const blocked = await guard.blockedUntil();
		const body: StatusResponse = {
			spotifyBlockedUntil: blocked ? new Date(blocked.until).toISOString() : null,
			reason: blocked?.reason ?? null
		};
		return c.json(body);
	});
}
