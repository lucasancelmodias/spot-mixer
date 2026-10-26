import { createApp } from './app';
import { RedisKV } from './cache/kv';
import { createRedis, redisPinger } from './cache/redis';
import { ConfigError, loadConfig } from './config';
import { sleep } from './lib/async';
import { globalFetch } from './lib/http';
import { TokenCipher } from './session/crypto';
import { SessionStore } from './session/store';
import { SessionTokens } from './session/tokens';
import { SpotifyClient } from './spotify/client';
import { RedisSpotifyGuard } from './spotify/guard';
import { SpotifyOAuth } from './spotify/oauth';

function readConfig() {
	try {
		return loadConfig(process.env);
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(error.message);
			process.exit(1);
		}
		throw error;
	}
}

const config = readConfig();
const now = () => Date.now();
const log = (line: string) => console.info(line);

const redis = createRedis(config.REDIS_URL);
const kv = new RedisKV(redis);
const cipher = await TokenCipher.fromBase64Key(config.TOKEN_ENC_KEY);
const oauth = new SpotifyOAuth({
	clientId: config.SPOTIFY_CLIENT_ID,
	clientSecret: config.SPOTIFY_CLIENT_SECRET,
	redirectUri: config.SPOTIFY_REDIRECT_URI,
	fetch: globalFetch,
	now
});
const guard = new RedisSpotifyGuard({ redis, now, sleep });
const spotify = new SpotifyClient({ fetch: globalFetch, guard, sleep, now, log });
const sessions = new SessionStore(kv, now);
const sessionTokens = new SessionTokens({ store: sessions, oauth, cipher, now });

const app = createApp({
	pingRedis: redisPinger(redis),
	kv,
	sessions,
	sessionTokens,
	oauth,
	spotify,
	guard,
	cipher,
	publicOrigin: config.publicOrigin,
	cookieSecure: config.cookieSecure,
	now,
	log,
	staticDir: config.STATIC_DIR
});

const server = Bun.serve({
	hostname: config.HOST,
	port: config.PORT,
	fetch: app.fetch,
	// Bun closes idle connections after 10 s by default. A cold mix preview can take longer.
	idleTimeout: 120
});

console.log(`spot-mixer API listening on ${server.url} (public origin ${config.publicOrigin})`);

async function shutdown(): Promise<void> {
	await server.stop();
	redis.close();
	process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
