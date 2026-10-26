// M1 live checks for the Spotify catalog (plan §14), with the app token (Client Credentials).
//
// - Read-only. All Spotify calls go through the app's client, the shared limiter and the
//   circuit breaker in Redis. The script stops at a fixed call budget and at the first 429.
// - It prints aggregate results only: no tokens. Track titles appear only in the
//   side-by-side sample on the console.
//
// Run from apps/server, with the development Redis up:
//   bun run spike:catalog

import { z } from 'zod';
import { RedisKV } from '../src/cache/kv';
import { createRedis } from '../src/cache/redis';
import { loadConfig } from '../src/config';
import { sleep } from '../src/lib/async';
import { globalFetch } from '../src/lib/http';
import { normalizeTitle } from '../src/mix/normalize';
import { TokenCipher } from '../src/session/crypto';
import { AppTokenSource } from '../src/spotify/app-token';
import { SpotifyClient, type SpotifyRequest } from '../src/spotify/client';
import { SpotifyUnavailableError } from '../src/spotify/errors';
import { RedisSpotifyGuard } from '../src/spotify/guard';
import { SpotifyOAuth } from '../src/spotify/oauth';

const SPOTIFY_CALL_BUDGET = 110;
const SEARCH_PAGES = 3;

// Different sizes, genres and countries.
const ARTISTS = [
	'Daft Punk',
	'Radiohead',
	'Taylor Swift',
	'Metallica',
	'Miles Davis',
	'Bad Bunny',
	'Anitta',
	'Caetano Veloso',
	'Tame Impala',
	'Phoebe Bridgers',
	'Khruangbin',
	'Arctic Monkeys',
	'The Beatles',
	'Kendrick Lamar',
	'Björk',
	'Bon Iver',
	'Nina Simone',
	'Rosalía',
	'Boogarins',
	'Men I Trust'
];

const artistSchema = z.object({
	id: z.string(),
	name: z.string(),
	genres: z.array(z.string()).optional(),
	popularity: z.number().optional(),
	followers: z.unknown().optional()
});
const trackSchema = z.object({
	id: z.string(),
	name: z.string(),
	artists: z.array(z.object({ id: z.string(), name: z.string() })),
	external_ids: z.object({ isrc: z.string().optional() }).optional(),
	is_playable: z.boolean().optional(),
	popularity: z.number().optional()
});
const artistSearchSchema = z.object({ artists: z.object({ items: z.array(artistSchema) }) });
const trackSearchSchema = z.object({ tracks: z.object({ items: z.array(trackSchema) }) });
const deezerArtistsSchema = z.object({
	data: z.array(z.object({ id: z.number(), name: z.string() }))
});
const deezerTopSchema = z.object({
	data: z.array(z.object({ title: z.string(), title_short: z.string().optional() }))
});

type Track = z.infer<typeof trackSchema>;

const config = loadConfig(process.env);
const redis = createRedis(config.REDIS_URL);
const now = () => Date.now();
const guard = new RedisSpotifyGuard({ redis, now, sleep });
let spotifyCalls = 0;
const client = new SpotifyClient({
	fetch: (input, init) => {
		if (input.startsWith('https://api.spotify.com/')) spotifyCalls += 1;
		return globalFetch(input, init);
	},
	guard,
	sleep,
	now
});
const oauth = new SpotifyOAuth({
	clientId: config.SPOTIFY_CLIENT_ID,
	clientSecret: config.SPOTIFY_CLIENT_SECRET,
	redirectUri: config.SPOTIFY_REDIRECT_URI,
	fetch: globalFetch,
	now
});
const appToken = new AppTokenSource({
	oauth,
	kv: new RedisKV(redis),
	cipher: await TokenCipher.fromBase64Key(config.TOKEN_ENC_KEY),
	now
});
const market = config.SPOTIFY_MARKET;

async function spotify<T>(request: SpotifyRequest<T>): Promise<T> {
	if (spotifyCalls >= SPOTIFY_CALL_BUDGET) throw new Error('Spotify call budget used up');
	return client.request(appToken, request);
}

let deezerCalls = 0;
async function deezer<T>(path: string, schema: z.ZodType<T>): Promise<T> {
	await sleep(150); // Stay far below the unofficial limit of 50 requests per 5 s.
	deezerCalls += 1;
	const body: unknown = await (await globalFetch(`https://api.deezer.com${path}`)).json();
	if (typeof body === 'object' && body !== null && 'error' in body) {
		throw new Error(`Deezer error for ${path}`);
	}
	return schema.parse(body);
}

const presence = { isrc: 0, isPlayable: 0, trackPopularity: 0, tracks: 0 };
const artistFields = { genresKey: 0, genresNonEmpty: 0, popularity: 0, followers: 0, artists: 0 };
const isrcSamples: Track[] = [];
const rows: {
	artist: string;
	unique: number;
	overlap10: number;
	deezerTop5InSpotify10: number;
	deezerTop3InSpotify10: number;
}[] = [];
const samples: { artist: string; spotify: string[]; deezer: string[] }[] = [];
let stoppedBy: string | null = null;

try {
	for (const name of ARTISTS) {
		const found = await spotify({
			path: '/search',
			query: { q: name, type: 'artist', limit: 5, market },
			schema: artistSearchSchema
		});
		const artist =
			found.artists.items.find((a) => normalizeTitle(a.name) === normalizeTitle(name)) ??
			found.artists.items[0];
		if (!artist) continue;
		artistFields.artists += 1;
		if (artist.genres !== undefined) artistFields.genresKey += 1;
		if (artist.genres?.length) artistFields.genresNonEmpty += 1;
		if (artist.popularity !== undefined) artistFields.popularity += 1;
		if (artist.followers !== undefined) artistFields.followers += 1;

		const tracks: Track[] = [];
		for (let page = 0; page < SEARCH_PAGES; page += 1) {
			const result = await spotify({
				path: '/search',
				query: { q: `artist:"${name}"`, type: 'track', limit: 10, offset: page * 10, market },
				schema: trackSearchSchema
			});
			tracks.push(...result.tracks.items);
		}
		for (const track of tracks) {
			presence.tracks += 1;
			if (track.external_ids?.isrc) presence.isrc += 1;
			if (track.is_playable !== undefined) presence.isPlayable += 1;
			if (track.popularity !== undefined) presence.trackPopularity += 1;
		}
		const own = tracks.filter((t) => t.artists.some((a) => a.id === artist.id));
		const sample = own.find((t) => t.external_ids?.isrc);
		if (sample && isrcSamples.length < 5) isrcSamples.push(sample);
		const spotifyTitles = unique(own.map((t) => normalizeTitle(t.name)));

		const deezerFound = await deezer(
			`/search/artist?q=${encodeURIComponent(name)}&limit=5`,
			deezerArtistsSchema
		);
		const deezerArtist =
			deezerFound.data.find((a) => normalizeTitle(a.name) === normalizeTitle(name)) ??
			deezerFound.data[0];
		const deezerTop = deezerArtist
			? await deezer(`/artist/${deezerArtist.id}/top?limit=25`, deezerTopSchema)
			: { data: [] };
		const deezerTitles = unique(
			deezerTop.data.map((t) => normalizeTitle(t.title_short ?? t.title))
		);

		const spotify10 = new Set(spotifyTitles.slice(0, 10));
		rows.push({
			artist: name,
			unique: spotifyTitles.length,
			overlap10: deezerTitles.slice(0, 10).filter((t) => spotify10.has(t)).length,
			deezerTop5InSpotify10: deezerTitles.slice(0, 5).filter((t) => spotify10.has(t)).length,
			deezerTop3InSpotify10: deezerTitles.slice(0, 3).filter((t) => spotify10.has(t)).length
		});
		if (samples.length < 3) {
			samples.push({
				artist: name,
				spotify: spotifyTitles.slice(0, 5),
				deezer: deezerTitles.slice(0, 5)
			});
		}
	}
} catch (error) {
	stoppedBy = error instanceof Error ? error.message : String(error);
	if (error instanceof SpotifyUnavailableError) stoppedBy = `circuit opened: ${error.message}`;
}

// The isrc: search filter, with ISRCs taken from the search results.
const isrcCheck = { tried: 0, sameTrack: 0, sameIsrc: 0 };
if (!stoppedBy) {
	for (const track of isrcSamples) {
		const isrc = track.external_ids?.isrc ?? '';
		const result = await spotify({
			path: '/search',
			query: { q: `isrc:${isrc}`, type: 'track', limit: 5, market },
			schema: trackSearchSchema
		});
		isrcCheck.tried += 1;
		if (result.tracks.items.some((t) => t.id === track.id)) isrcCheck.sameTrack += 1;
		if (result.tracks.items.some((t) => t.external_ids?.isrc === isrc)) isrcCheck.sameIsrc += 1;
	}
}

// Full artist objects from GET /artists/{id}.
const fullArtist = { checked: 0, genresKey: 0, popularity: 0, followers: 0 };
const topTracksCheck = { status: 0, message: '' };
if (!stoppedBy) {
	const ids = await spotify({
		path: '/search',
		query: { q: 'Radiohead', type: 'artist', limit: 3, market },
		schema: artistSearchSchema
	});
	for (const artist of ids.artists.items.slice(0, 3)) {
		const full = await spotify({ path: `/artists/${artist.id}`, schema: artistSchema });
		fullArtist.checked += 1;
		if (full.genres !== undefined) fullArtist.genresKey += 1;
		if (full.popularity !== undefined) fullArtist.popularity += 1;
		if (full.followers !== undefined) fullArtist.followers += 1;
	}

	// Confirm that Artist's Top Tracks is blocked. The client refuses this route, so this one
	// call goes around it, but still through the shared limiter and circuit breaker.
	const first = ids.artists.items[0];
	if (first) {
		await guard.check();
		await guard.acquire();
		spotifyCalls += 1;
		const res = await globalFetch(
			`https://api.spotify.com/v1/artists/${first.id}/top-tracks?market=${market}`,
			{ headers: { Authorization: `Bearer ${await appToken.token()}` } }
		);
		topTracksCheck.status = res.status;
		const text = await res.text();
		try {
			topTracksCheck.message = String(JSON.parse(text).error?.message ?? '');
		} catch {
			topTracksCheck.message = text.slice(0, 80);
		}
	}
}

const mean = (values: number[]) =>
	values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 'n/a';

console.log(
	JSON.stringify(
		{
			market,
			stoppedBy,
			calls: { spotify: spotifyCalls, deezer: deezerCalls, spotifyToday: await guard.callsToday() },
			artistSearch: artistFields,
			trackFields: presence,
			isrcFilter: isrcCheck,
			fullArtist,
			topTracks: topTracksCheck,
			order: {
				artists: rows.length,
				meanOverlap10: mean(rows.map((r) => r.overlap10)),
				meanDeezerTop5InSpotify10: mean(rows.map((r) => r.deezerTop5InSpotify10)),
				meanDeezerTop3InSpotify10: mean(rows.map((r) => r.deezerTop3InSpotify10)),
				meanUniqueSongsFrom30Results: mean(rows.map((r) => r.unique)),
				rows
			},
			samples
		},
		null,
		2
	)
);

redis.close();

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}
