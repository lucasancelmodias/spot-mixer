import { MAX_SOURCE_COUNT, spotifyIdSchema } from '@spot-mixer/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import type { Catalog } from '../catalog/catalog';
import { badRequest } from '../lib/validate';
import type { SessionEnv } from '../session/middleware';
import { CallBudget } from '../spotify/budget';

/** Catalog routes under /api (plan §8). They read with the app token, but need a session. */
export function catalogRoutes(deps: {
	auth: MiddlewareHandler<SessionEnv>;
	catalog: Catalog;
	callBudget: number;
}) {
	const { auth, catalog } = deps;
	const budget = () => new CallBudget(deps.callBudget);
	const app = new Hono<SessionEnv>();

	app.get('/search/artists', auth, async (c) => {
		const query = (c.req.query('q') ?? '').trim();
		if (query.length < 2 || query.length > 100) {
			throw badRequest('invalid_query', ['q: must have 2 to 100 characters']);
		}
		return c.json(await catalog.searchArtists(query, budget()));
	});

	app.get('/artists/:id', auth, async (c) => {
		const artist = await catalog.getArtist(spotifyId(c.req.param('id')), budget());
		return artist ? c.json(artist) : c.json({ error: 'not_found' }, 404);
	});

	app.get('/artists/:id/albums', auth, async (c) =>
		c.json(await catalog.artistReleases(spotifyId(c.req.param('id')), budget()))
	);

	app.get('/artists/:id/popular', auth, async (c) => {
		const limit = Number(c.req.query('limit') ?? 10);
		if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SOURCE_COUNT) {
			throw badRequest('invalid_limit', [`limit: must be 1 to ${MAX_SOURCE_COUNT}`]);
		}
		return c.json(await catalog.popularTracks(spotifyId(c.req.param('id')), limit, budget()));
	});

	return app;
}

function spotifyId(value: string): string {
	if (!spotifyIdSchema.safeParse(value).success) {
		throw badRequest('invalid_id', ['id: must be a Spotify ID']);
	}
	return value;
}
