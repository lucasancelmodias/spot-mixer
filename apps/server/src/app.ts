import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { KV } from './cache/kv';
import type { RedisPing } from './cache/redis';
import { messageOf } from './lib/async';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import { statusRoutes } from './routes/status';
import { sessionCookieName } from './session/cookies';
import type { TokenCipher } from './session/crypto';
import { requireSession } from './session/middleware';
import type { SessionStore } from './session/store';
import { SessionExpiredError, type SessionTokens } from './session/tokens';
import type { SpotifyClient } from './spotify/client';
import { SpotifyAccessError, SpotifyAuthError, SpotifyUnavailableError } from './spotify/errors';
import type { SpotifyGuard } from './spotify/guard';
import type { SpotifyOAuth } from './spotify/oauth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type AppDeps = {
	pingRedis: RedisPing;
	kv: KV;
	sessions: SessionStore;
	sessionTokens: SessionTokens;
	oauth: SpotifyOAuth;
	spotify: SpotifyClient;
	guard: SpotifyGuard;
	cipher: TokenCipher;
	publicOrigin: string;
	cookieSecure: boolean;
	now: () => number;
	log: (line: string) => void;
	/** Folder with the built SPA. Without it, the app serves the API only (development, tests). */
	staticDir?: string;
};

export function createApp(deps: AppDeps) {
	const app = new Hono();

	// CSRF protection: browsers send an Origin header with every POST, PUT and DELETE.
	app.use('*', async (c, next) => {
		if (!SAFE_METHODS.has(c.req.method) && c.req.header('Origin') !== deps.publicOrigin) {
			return c.json({ error: 'bad_origin' }, 403);
		}
		await next();
	});

	const auth = requireSession({
		sessions: deps.sessions,
		tokens: deps.sessionTokens,
		cookieName: sessionCookieName(deps.cookieSecure)
	});

	app.route('/api/health', healthRoutes(deps.pingRedis));
	app.route('/api/status', statusRoutes(deps.guard));
	app.route('/api/me', meRoutes({ auth, kv: deps.kv, spotify: deps.spotify }));
	app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));
	app.route(
		'/auth',
		authRoutes({
			kv: deps.kv,
			sessions: deps.sessions,
			oauth: deps.oauth,
			spotify: deps.spotify,
			cipher: deps.cipher,
			cookieSecure: deps.cookieSecure,
			now: deps.now,
			log: deps.log
		})
	);

	if (deps.staticDir) {
		app.use('*', serveStatic({ root: deps.staticDir }));
		// SPA fallback: the client-side router handles every other path.
		app.get('*', serveStatic({ path: 'index.html', root: deps.staticDir }));
	}

	app.onError((error, c) => {
		if (error instanceof SessionExpiredError || error instanceof SpotifyAuthError) {
			return c.json({ error: 'session_expired' }, 401);
		}
		if (error instanceof SpotifyUnavailableError) {
			return c.json(
				{ error: 'spotify_unavailable', until: new Date(error.until).toISOString() },
				503
			);
		}
		if (error instanceof SpotifyAccessError) return c.json({ error: error.problem }, 403);
		if (error instanceof HTTPException) return error.getResponse();
		deps.log(`[api] ${c.req.method} ${c.req.path} failed: ${messageOf(error)}`);
		return c.json({ error: 'internal' }, 500);
	});

	return app;
}
