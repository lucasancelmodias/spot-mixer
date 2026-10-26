import {
	type ArtistInsights,
	artistInsightsRequestSchema,
	MAX_RANKED_ARTISTS
} from '@spot-mixer/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { parseJson } from '../lib/validate';
import type { Listening } from '../listening/listening';
import { rankArtists } from '../mix/ranking';
import type { SessionEnv } from '../session/middleware';
import { CallBudget } from '../spotify/budget';

/** My Mix routes under /api/insights (plan §8). */
export function insightsRoutes(deps: {
	auth: MiddlewareHandler<SessionEnv>;
	listening: Listening;
	callBudget: number;
}) {
	const app = new Hono<SessionEnv>();

	// The ranking is computed for this request only, sent only to the owner of the data, and never
	// stored (plan §7.2, Policy III.13). Only the Spotify data behind it is cached, with a TTL.
	app.post('/artists', deps.auth, async (c) => {
		const request = await parseJson(c, artistInsightsRequestSchema);
		const budget = new CallBudget(deps.callBudget);
		const signals = await deps.listening.signals(c.get('session').uid, c.get('userToken'), budget);
		const body: ArtistInsights = {
			artists: rankArtists(signals, { recency: request.recency, limit: MAX_RANKED_ARTISTS }),
			spotifyCalls: budget.spent
		};
		return c.json(body);
	});

	return app;
}
