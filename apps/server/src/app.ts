import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import type { RedisPing } from './cache/redis';
import { healthRoutes } from './routes/health';

export type AppDeps = {
	pingRedis: RedisPing;
	/** Folder with the built SPA. Without it, the app serves the API only (development, tests). */
	staticDir?: string;
};

export function createApp(deps: AppDeps) {
	const app = new Hono();

	app.route('/api/health', healthRoutes(deps.pingRedis));
	app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

	if (deps.staticDir) {
		app.use('*', serveStatic({ root: deps.staticDir }));
		// SPA fallback: the client-side router handles every other path.
		app.get('*', serveStatic({ path: 'index.html', root: deps.staticDir }));
	}

	return app;
}
