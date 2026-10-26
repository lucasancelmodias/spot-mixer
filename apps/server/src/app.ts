import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import type { KV } from './cache/kv';
import type { RedisPing } from './cache/redis';
import type { Catalog } from './catalog/catalog';
import { messageOf } from './lib/async';
import type { Listening } from './listening/listening';
import { PartialSaveError } from './playlists/save';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { healthRoutes } from './routes/health';
import { insightsRoutes } from './routes/insights';
import { meRoutes } from './routes/me';
import { mixRoutes } from './routes/mixes';
import { statusRoutes } from './routes/status';
import { SavedMixes } from './saved/saved-mixes';
import { sessionCookieName } from './session/cookies';
import type { TokenCipher } from './session/crypto';
import { requireSession } from './session/middleware';
import type { SessionStore } from './session/store';
import { SessionExpiredError, type SessionTokens } from './session/tokens';
import { CallBudgetExceededError } from './spotify/budget';
import type { SpotifyClient } from './spotify/client';
import {
	SpotifyAccessError,
	SpotifyAuthError,
	SpotifyError,
	SpotifyNotFoundError,
	SpotifyUnavailableError
} from './spotify/errors';
import type { SpotifyGuard } from './spotify/guard';
import type { SpotifyOAuth } from './spotify/oauth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_BODY_BYTES = 256 * 1024;

export type AppDeps = {
	pingRedis: RedisPing;
	kv: KV;
	sessions: SessionStore;
	sessionTokens: SessionTokens;
	oauth: SpotifyOAuth;
	spotify: SpotifyClient;
	guard: SpotifyGuard;
	cipher: TokenCipher;
	catalog: Catalog;
	listening: Listening;
	/** Spotify calls allowed for one request (plan §5.4). */
	callBudget: number;
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
	app.use(
		'/api/*',
		bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'too_large' }, 413) })
	);

	const auth = requireSession({
		sessions: deps.sessions,
		tokens: deps.sessionTokens,
		cookieName: sessionCookieName(deps.cookieSecure)
	});
	const { catalog, listening, spotify, callBudget } = deps;

	app.route('/api/health', healthRoutes(deps.pingRedis));
	app.route('/api/status', statusRoutes(deps.guard));
	app.route('/api/me', meRoutes({ auth, kv: deps.kv, spotify }));
	app.route('/api/insights', insightsRoutes({ auth, listening, callBudget }));
	const savedMixes = new SavedMixes({ kv: deps.kv, now: deps.now });
	app.route(
		'/api/mixes',
		mixRoutes({
			auth,
			catalog,
			listening,
			spotify,
			savedMixes,
			callBudget,
			now: deps.now,
			log: deps.log
		})
	);
	app.route('/api', catalogRoutes({ auth, catalog, callBudget }));
	app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));
	app.route(
		'/auth',
		authRoutes({
			kv: deps.kv,
			sessions: deps.sessions,
			oauth: deps.oauth,
			spotify,
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
		if (error instanceof HTTPException) return error.getResponse();
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
		if (error instanceof SpotifyNotFoundError) return c.json({ error: 'not_found' }, 404);
		if (error instanceof CallBudgetExceededError) {
			return c.json({ error: 'too_many_calls', limit: error.limit }, 422);
		}
		if (error instanceof PartialSaveError) {
			deps.log(`[api] save incomplete: ${messageOf(error.cause)}`);
			return c.json(
				{ error: 'save_incomplete', playlistUrl: error.playlistUrl, added: error.added },
				502
			);
		}
		deps.log(`[api] ${c.req.method} ${c.req.path} failed: ${messageOf(error)}`);
		if (error instanceof SpotifyError) return c.json({ error: 'spotify_error' }, 502);
		return c.json({ error: 'internal' }, 500);
	});

	return app;
}
