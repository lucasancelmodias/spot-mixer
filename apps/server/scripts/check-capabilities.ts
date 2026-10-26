// Read-only probe: which Spotify endpoints and page sizes does this app still have?
// Spotify postponed the February 2026 cuts for existing apps with no new date, so run this again
// when something stops working. One call per probe, through the shared limiter and circuit breaker.
// It goes around the client's blocklist on purpose. It prints statuses and counts, never tokens.
//
// Run from apps/server, with the development Redis up:
//   bun run check:capabilities

import { RedisKV } from '../src/cache/kv';
import { createRedis } from '../src/cache/redis';
import { loadConfig } from '../src/config';
import { sleep } from '../src/lib/async';
import { globalFetch } from '../src/lib/http';
import { TokenCipher } from '../src/session/crypto';
import { AppTokenSource } from '../src/spotify/app-token';
import { RedisSpotifyGuard } from '../src/spotify/guard';
import { SpotifyOAuth } from '../src/spotify/oauth';

const ARTIST = '4Z8W4fKeB5YxbusRsdQVPb'; // Radiohead
const TRACKS = ['70LcF31zb1H0PyJoS1Sx1r', '2nTsKOXIVGDf2iPeVQO2Gm']; // Creep, Let Down

const config = loadConfig(process.env);
const market = config.SPOTIFY_MARKET;
const redis = createRedis(config.REDIS_URL);
const now = () => Date.now();
const guard = new RedisSpotifyGuard({ redis, now, sleep });
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

const probes: [string, string, (body: Record<string, unknown>) => string][] = [
	[
		'Artist top tracks',
		`/artists/${ARTIST}/top-tracks?market=${market}`,
		(b) => `${(b.tracks as unknown[])?.length ?? 0} tracks`
	],
	[
		'Related artists',
		`/artists/${ARTIST}/related-artists`,
		(b) => `${(b.artists as unknown[])?.length ?? 0} artists`
	],
	[
		'Recommendations',
		`/recommendations?seed_artists=${ARTIST}&limit=5&market=${market}`,
		(b) => `${(b.tracks as unknown[])?.length ?? 0} tracks`
	],
	['Audio features', `/audio-features/${TRACKS[0]}`, (b) => `tempo ${String(b.tempo ?? 'none')}`],
	[
		'Batch track read',
		`/tracks?ids=${TRACKS.join(',')}&market=${market}`,
		(b) => `${(b.tracks as unknown[])?.length ?? 0} tracks`
	],
	[
		'Search limit=50',
		`/search?q=Radiohead&type=track&limit=50&market=${market}`,
		(b) => `${((b.tracks as { items?: unknown[] })?.items ?? []).length} items`
	],
	[
		'Artist albums limit=50',
		`/artists/${ARTIST}/albums?include_groups=album,single&limit=50&market=${market}`,
		(b) => `${(b.items as unknown[])?.length ?? 0} items`
	]
];

const results: Record<string, string> = {};
for (const [name, path, describe] of probes) {
	await guard.check();
	await guard.acquire();
	const res = await globalFetch(`https://api.spotify.com/v1${path}`, {
		headers: { Authorization: `Bearer ${await appToken.token()}` }
	});
	const text = await res.text();
	let body: Record<string, unknown> = {};
	try {
		body = JSON.parse(text) as Record<string, unknown>;
	} catch {
		// Not JSON.
	}
	const detail = res.ok
		? describe(body)
		: String((body.error as { message?: string })?.message ?? text.slice(0, 80));
	results[name] = `${res.status} ${detail}`;
	if (res.status === 429) break; // Never continue after a rate limit.
}
console.log(JSON.stringify({ market, checkedAt: new Date().toISOString(), results }, null, 1));
redis.close();
