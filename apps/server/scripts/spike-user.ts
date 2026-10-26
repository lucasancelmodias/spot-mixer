// M1 live checks for the user endpoints (plan §14), with the newest session in Redis.
//
// - It reads Spotify data only. It also forces one token refresh, which updates that session
//   in Redis in the same way as the server does.
// - It prints counts and field presence only: no tokens, no names, no listening history.
//
// Run from apps/server after a sign-in, with the development Redis up:
//   bun run spike:user

import { z } from 'zod';
import { RedisKV } from '../src/cache/kv';
import { createRedis } from '../src/cache/redis';
import { loadConfig } from '../src/config';
import { sleep } from '../src/lib/async';
import { globalFetch } from '../src/lib/http';
import { TokenCipher } from '../src/session/crypto';
import { type SessionData, SessionStore } from '../src/session/store';
import { SessionTokens } from '../src/session/tokens';
import { SpotifyClient, type SpotifyRequest } from '../src/spotify/client';
import { RedisSpotifyGuard } from '../src/spotify/guard';
import { SpotifyOAuth } from '../src/spotify/oauth';

const config = loadConfig(process.env);
const redis = createRedis(config.REDIS_URL);
const now = () => Date.now();
const cipher = await TokenCipher.fromBase64Key(config.TOKEN_ENC_KEY);
const oauth = new SpotifyOAuth({
	clientId: config.SPOTIFY_CLIENT_ID,
	clientSecret: config.SPOTIFY_CLIENT_SECRET,
	redirectUri: config.SPOTIFY_REDIRECT_URI,
	fetch: globalFetch,
	now
});
const guard = new RedisSpotifyGuard({ redis, now, sleep });
let calls = 0;
const client = new SpotifyClient({
	fetch: (input, init) => {
		if (input.startsWith('https://api.spotify.com/')) calls += 1;
		return globalFetch(input, init);
	},
	guard,
	sleep,
	now
});
const store = new SessionStore(new RedisKV(redis), now);
const tokens = new SessionTokens({ store, oauth, cipher, now });

// The newest session. Only the owner and allowlisted friends can sign in.
const sids: string[] = [];
let cursor = '0';
do {
	const [next, keys] = (await redis.send('SCAN', [cursor, 'MATCH', 'sess:*', 'COUNT', '100'])) as [
		string | number,
		string[]
	];
	cursor = String(next);
	sids.push(...keys.map((key) => key.slice('sess:'.length)));
} while (cursor !== '0');
let chosen: { sid: string; session: SessionData } | null = null;
for (const sid of sids) {
	const session = await store.get(sid);
	if (session && (!chosen || session.authorizedAt > chosen.session.authorizedAt)) {
		chosen = { sid, session };
	}
}
if (!chosen) {
	console.log('No session in Redis: sign in first.');
	redis.close();
	process.exit(1);
}
const user = tokens.for(chosen.sid, chosen.session);

const record = z.record(z.string(), z.unknown());
const page = z.object({
	items: z.array(record),
	total: z.number().optional(),
	next: z.string().nullable().optional()
});
const get = <T>(request: SpotifyRequest<T>) => client.request(user, request);
const has = (item: Record<string, unknown>, key: string) => item[key] !== undefined;
const count = (
	items: Record<string, unknown>[],
	test: (item: Record<string, unknown>) => boolean
) => items.filter(test).length;

const profile = await get({ path: '/me', schema: record });
const profileFields = Object.fromEntries(
	['account_id', 'country', 'product', 'email', 'explicit_content', 'followers'].map((key) => [
		key,
		has(profile, key)
	])
);

// Force one refresh and use the new token, to test the refresh path live.
await user.refresh();
const afterRefresh = await get({ path: '/me', schema: record });

const topArtists: Record<string, unknown> = {};
const topTracks: Record<string, unknown> = {};
for (const range of ['short_term', 'medium_term', 'long_term']) {
	const artists = await get({
		path: '/me/top/artists',
		query: { time_range: range, limit: 50 },
		schema: page
	});
	topArtists[range] = {
		items: artists.items.length,
		total: artists.total,
		withGenres: count(artists.items, (a) => Array.isArray(a.genres) && a.genres.length > 0),
		withPopularity: count(artists.items, (a) => has(a, 'popularity'))
	};
	const tracks = await get({
		path: '/me/top/tracks',
		query: { time_range: range, limit: 50 },
		schema: page
	});
	topTracks[range] = {
		items: tracks.items.length,
		total: tracks.total,
		withPopularity: count(tracks.items, (t) => has(t, 'popularity'))
	};
}
const deeperArtists = await get({
	path: '/me/top/artists',
	query: { time_range: 'long_term', limit: 50, offset: 50 },
	schema: page
});
const deeperTracks = await get({
	path: '/me/top/tracks',
	query: { time_range: 'long_term', limit: 50, offset: 50 },
	schema: page
});

const recent = await get({
	path: '/me/player/recently-played',
	query: { limit: 50 },
	schema: page
});
const playedAt = recent.items
	.map((item) => Date.parse(String(item.played_at)))
	.filter(Number.isFinite);
const following = await get({
	path: '/me/following',
	query: { type: 'artist', limit: 50 },
	schema: z.object({ artists: page })
});
const saved = await get({ path: '/me/tracks', query: { limit: 50 }, schema: page });

console.log(
	JSON.stringify(
		{
			sessionsFound: sids.length,
			scopes: chosen.session.scopes,
			profileFields,
			refresh: { worked: typeof afterRefresh.id === 'string' },
			topArtists,
			topTracks,
			beyondFirst50: {
				topArtistsLongTerm: deeperArtists.items.length,
				topTracksLongTerm: deeperTracks.items.length
			},
			recentlyPlayed: {
				items: recent.items.length,
				spanHours: playedAt.length
					? Math.round((Math.max(...playedAt) - Math.min(...playedAt)) / 3_600_000)
					: null
			},
			followedArtists: { total: following.artists.total },
			savedTracks: { total: saved.total, firstPage: saved.items.length },
			spotifyCalls: calls
		},
		null,
		1
	)
);
redis.close();
