import type { MeResponse } from '@spot-mixer/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { cached } from '../cache/cached';
import { userCacheKey } from '../cache/keys';
import type { KV } from '../cache/kv';
import type { SessionEnv } from '../session/middleware';
import { MAX_SESSION_MS } from '../session/store';
import type { SpotifyClient } from '../spotify/client';
import { profileSchema, smallestImage } from '../spotify/schemas';

const PROFILE_TTL_SECONDS = 300;

export function meRoutes(deps: {
	auth: MiddlewareHandler<SessionEnv>;
	kv: KV;
	spotify: SpotifyClient;
}) {
	return new Hono<SessionEnv>().use(deps.auth).get('/', async (c) => {
		const session = c.get('session');
		const profile = await cached(
			deps.kv,
			userCacheKey(session.uid, 'me'),
			{ ttlSeconds: PROFILE_TTL_SECONDS },
			() => deps.spotify.request(c.get('userToken'), { path: '/me', schema: profileSchema })
		);
		if (profile === null) throw new Error('Spotify returned no profile');
		const body: MeResponse = {
			id: profile.id,
			displayName: profile.display_name ?? null,
			imageUrl: smallestImage(profile.images),
			authorizedAt: new Date(session.authorizedAt).toISOString(),
			renewBy: new Date(session.authorizedAt + MAX_SESSION_MS).toISOString()
		};
		return c.json(body);
	});
}
