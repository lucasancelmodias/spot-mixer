import {
	type MixPreview,
	mixRecipeSchema,
	saveMixRequestSchema,
	type SourceSpec,
	type TrackSummary
} from '@spot-mixer/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import type { Catalog } from '../catalog/catalog';
import { mapLimit } from '../lib/async';
import { parseJson } from '../lib/validate';
import type { Listening } from '../listening/listening';
import { buildMix, type SourceGroup } from '../mix/engine';
import { sameSong } from '../mix/songs';
import type { Candidate } from '../mix/types';
import { saveMix } from '../playlists/save';
import type { SessionEnv } from '../session/middleware';
import { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';

/** Sources that resolve at the same time, so that one preview does not flood the limiter. */
const PARALLEL_SOURCES = 4;
/** Extra popular tracks per source, so that filters and duplicates still leave enough. */
const POPULAR_MARGIN = 10;

export type MixDeps = {
	auth: MiddlewareHandler<SessionEnv>;
	catalog: Catalog;
	listening: Listening;
	spotify: SpotifyClient;
	callBudget: number;
};

/** Mix routes under /api/mixes (plan §8). */
export function mixRoutes(deps: MixDeps) {
	const app = new Hono<SessionEnv>();

	app.post('/preview', deps.auth, async (c) => {
		const recipe = await parseJson(c, mixRecipeSchema);
		const budget = new CallBudget(deps.callBudget);
		const context = { deps, uid: c.get('session').uid, token: c.get('userToken'), budget };
		await loadUserTracks(recipe.sources, context);
		const groups = await mapLimit(recipe.sources, PARALLEL_SOURCES, (spec) =>
			resolveSource(spec, context)
		);
		const result = buildMix(groups, recipe.options);
		const body: MixPreview = {
			tracks: result.tracks.map(({ rank: _rank, ...track }) => track),
			warnings: result.warnings,
			spotifyCalls: budget.spent
		};
		return c.json(body);
	});

	app.post('/', deps.auth, async (c) => {
		const request = await parseJson(c, saveMixRequestSchema);
		const saved = await saveMix(
			deps.spotify,
			c.get('userToken'),
			request,
			new CallBudget(deps.callBudget)
		);
		return c.json(saved, 201);
	});

	return app;
}

type ResolveContext = { deps: MixDeps; uid: string; token: TokenSource; budget: CallBudget };

/**
 * Sources that read the user's own tracks share one cached list. It loads here once, before the
 * sources run in parallel: parallel loaders of one cold key could each call Spotify.
 */
async function loadUserTracks(sources: SourceSpec[], context: ResolveContext): Promise<void> {
	const { deps, uid, token, budget } = context;
	if (sources.some((spec) => spec.kind === 'favorites' || spec.kind === 'blend')) {
		await deps.listening.topTracks(uid, token, budget);
	}
	if (sources.some((spec) => spec.kind === 'blend')) {
		await deps.listening.savedTracks(uid, token, budget);
	}
}

async function resolveSource(spec: SourceSpec, context: ResolveContext): Promise<SourceGroup> {
	const { deps, uid, token, budget } = context;
	const artist = await deps.catalog.getArtist(spec.artistId, budget);
	const artistName = artist?.name ?? spec.artistId;
	const ranked = (tracks: TrackSummary[]): Candidate[] =>
		tracks.map((track, rank) => ({ ...track, sourceArtistId: spec.artistId, rank }));

	switch (spec.kind) {
		case 'popular': {
			const tracks = await deps.catalog.popularTracks(
				spec.artistId,
				spec.count + POPULAR_MARGIN,
				budget
			);
			return { spec, artistName, candidates: ranked(tracks) };
		}
		case 'favorites': {
			const tracks = await deps.listening.favorites(uid, token, spec.artistId, budget);
			return { spec, artistName, candidates: ranked(tracks) };
		}
		case 'blend': {
			const familiar = await deps.listening.familiar(uid, token, spec.artistId, budget);
			// Popular tracks that are versions of familiar ones stay out of the discovery pool. Any
			// count above 10 reads the same top tracks and search results, so extra tracks cost no call.
			const popular = await deps.catalog.popularTracks(
				spec.artistId,
				spec.count + POPULAR_MARGIN + familiar.length,
				budget
			);
			const discovery = popular.filter((track) => !familiar.some((own) => sameSong(own, track)));
			const candidates = [
				...ranked(familiar).map((track) => ({ ...track, pool: 'familiar' as const })),
				...ranked(discovery).map((track) => ({
					...track,
					rank: familiar.length + track.rank,
					pool: 'discovery' as const
				}))
			];
			return { spec, artistName, candidates };
		}
		case 'albums': {
			const albums = await deps.catalog.albumsWithTracks(spec.albumIds, budget);
			// Rank keeps the album order of the request, then disc and track order.
			const candidates = albums.flatMap(({ tracks }, albumIndex) =>
				tracks.map((track) => ({
					...track,
					sourceArtistId: spec.artistId,
					rank: albumIndex * 10_000 + (track.discNumber ?? 1) * 1_000 + (track.trackNumber ?? 0)
				}))
			);
			return { spec, artistName, candidates };
		}
	}
}
