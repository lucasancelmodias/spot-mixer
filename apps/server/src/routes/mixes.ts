import {
	type MixPreview,
	type MixRecipe,
	type MixTrack,
	mixRecipeSchema,
	type RefreshMixResponse,
	type SaveMixRequest,
	type SaveMixResponse,
	saveMixRequestSchema,
	type SourceSpec,
	type TrackSummary
} from '@spot-mixer/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import type { Catalog } from '../catalog/catalog';
import { mapLimit, messageOf } from '../lib/async';
import { badRequest, parseJson } from '../lib/validate';
import type { Listening } from '../listening/listening';
import { buildMix, type SourceGroup } from '../mix/engine';
import { sameSong } from '../mix/songs';
import type { Candidate } from '../mix/types';
import { PlaylistGoneError, replaceTracks, type SavedPlaylist, saveMix } from '../playlists/save';
import type { SavedMixes } from '../saved/saved-mixes';
import type { SessionEnv } from '../session/middleware';
import { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';

/** Sources that resolve at the same time, so that one preview does not flood the limiter. */
const PARALLEL_SOURCES = 4;
/** Extra popular tracks per source, so that filters and duplicates still leave enough. */
const POPULAR_MARGIN = 10;
const MAX_SEED = 2_147_483_647;

export type MixDeps = {
	auth: MiddlewareHandler<SessionEnv>;
	catalog: Catalog;
	listening: Listening;
	spotify: SpotifyClient;
	savedMixes: SavedMixes;
	callBudget: number;
	now: () => number;
	log: (line: string) => void;
};

/** Mix routes under /api/mixes (plan §8). */
export function mixRoutes(deps: MixDeps) {
	const app = new Hono<SessionEnv>();

	app.post('/preview', deps.auth, async (c) => {
		const recipe = await parseJson(c, mixRecipeSchema);
		const budget = new CallBudget(deps.callBudget);
		const context = { deps, uid: c.get('session').uid, token: c.get('userToken'), budget };
		const result = await runRecipe(recipe, context);
		const body: MixPreview = { ...result, spotifyCalls: budget.spent };
		return c.json(body);
	});

	app.post('/', deps.auth, async (c) => {
		const request = await parseJson(c, saveMixRequestSchema);
		const budget = new CallBudget(deps.callBudget);
		const saved = await saveMix(deps.spotify, c.get('userToken'), request, budget);
		const remembered = await remember(request, saved, c.get('session').uid, deps, budget);
		const body: SaveMixResponse = { ...saved, remembered };
		return c.json(body, 201);
	});

	app.get('/saved', deps.auth, async (c) =>
		c.json(await deps.savedMixes.list(c.get('session').uid))
	);

	// Runs the recipe again with a new seed and the user's current data, and replaces the tracks.
	app.post('/saved/:playlistId/refresh', deps.auth, async (c) => {
		const uid = c.get('session').uid;
		const playlistId = playlistIdParam(c.req.param('playlistId'));
		const mix = await deps.savedMixes.get(uid, playlistId);
		if (!mix) return c.json({ error: 'not_found' }, 404);

		const recipe: MixRecipe = {
			...mix.recipe,
			options: { ...mix.recipe.options, seed: randomSeed() }
		};
		const budget = new CallBudget(deps.callBudget);
		const token = c.get('userToken');
		const result = await runRecipe(recipe, { deps, uid, token, budget });
		if (result.tracks.length === 0) return c.json({ error: 'empty_mix' }, 422);

		try {
			await replaceTracks(
				deps.spotify,
				token,
				{ id: playlistId, url: mix.url },
				result.tracks.map((track) => track.uri),
				budget
			);
		} catch (error) {
			if (error instanceof PlaylistGoneError) {
				await deps.savedMixes.remove(uid, playlistId);
				return c.json({ error: 'playlist_gone' }, 404);
			}
			throw error;
		}
		const updated = await deps.savedMixes.put(uid, {
			...mix,
			recipe,
			trackCount: result.tracks.length,
			refreshedAt: new Date(deps.now()).toISOString()
		});
		const body: RefreshMixResponse = { mix: updated, ...result, spotifyCalls: budget.spent };
		return c.json(body);
	});

	// Forgets the recipe. The Spotify playlist stays.
	app.delete('/saved/:playlistId', deps.auth, async (c) => {
		const playlistId = playlistIdParam(c.req.param('playlistId'));
		const removed = await deps.savedMixes.remove(c.get('session').uid, playlistId);
		return removed ? c.body(null, 204) : c.json({ error: 'not_found' }, 404);
	});

	return app;
}

type ResolveContext = { deps: MixDeps; uid: string; token: TokenSource; budget: CallBudget };

/** Resolves the sources of a recipe and builds the mix. */
async function runRecipe(
	recipe: MixRecipe,
	context: ResolveContext
): Promise<{ tracks: MixTrack[]; warnings: string[] }> {
	await loadUserTracks(recipe.sources, context);
	const groups = await mapLimit(recipe.sources, PARALLEL_SOURCES, (spec) =>
		resolveSource(spec, context)
	);
	const result = buildMix(groups, recipe.options);
	return {
		tracks: result.tracks.map(({ rank: _rank, ...track }) => track),
		warnings: result.warnings
	};
}

/**
 * Keeps the recipe of a saved playlist. A failure here does not undo the save: the playlist
 * exists, so the response says `remembered: false` instead.
 */
async function remember(
	request: SaveMixRequest,
	saved: SavedPlaylist,
	uid: string,
	deps: MixDeps,
	budget: CallBudget
): Promise<boolean> {
	if (!request.remember) return false;
	try {
		const { mode, recipe } = request.remember;
		// Names come from the cached catalog, not from the browser.
		const artists = await mapLimit(recipe.sources, PARALLEL_SOURCES, (spec) =>
			deps.catalog.getArtist(spec.artistId, budget)
		);
		await deps.savedMixes.put(uid, {
			playlistId: saved.playlistId,
			url: saved.url,
			name: request.name,
			mode,
			artistNames: recipe.sources.map((spec, index) => artists[index]?.name ?? spec.artistId),
			trackCount: saved.added,
			createdAt: new Date(deps.now()).toISOString(),
			refreshedAt: null,
			recipe
		});
		return true;
	} catch (error) {
		deps.log(`[api] could not keep the recipe of ${saved.playlistId}: ${messageOf(error)}`);
		return false;
	}
}

/** Spotify playlist IDs are base-62. Only safe characters may go into the request path. */
function playlistIdParam(value: string): string {
	if (!/^[A-Za-z0-9]{1,64}$/.test(value)) {
		throw badRequest('invalid_id', ['playlistId: must be a Spotify ID']);
	}
	return value;
}

function randomSeed(): number {
	return (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % MAX_SEED;
}

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
