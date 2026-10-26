import { createApp } from '../../src/app';
import type { RedisPing } from '../../src/cache/redis';
import { TokenCipher } from '../../src/session/crypto';
import { SessionStore } from '../../src/session/store';
import { SessionTokens } from '../../src/session/tokens';
import { SpotifyClient } from '../../src/spotify/client';
import { SpotifyOAuth } from '../../src/spotify/oauth';
import { FakeGuard, type FetchHandler, fakeFetch, json, TEST_ENC_KEY } from './fakes';
import { MemoryKV } from './memory-kv';

export const TEST_ORIGIN = 'http://127.0.0.1:5173';
export const TEST_REDIRECT_URI = `${TEST_ORIGIN}/auth/callback`;

export type TestClock = { now: number };

/** The full app with in-memory Redis, a fake Spotify and a controllable clock. */
export async function buildTestApp(
	options: { handler?: FetchHandler; pingRedis?: RedisPing; clock?: TestClock } = {}
) {
	const clock = options.clock ?? { now: Date.UTC(2026, 9, 26, 12) };
	const now = () => clock.now;
	const kv = new MemoryKV(now);
	const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);
	const { fetch, calls } = fakeFetch(
		options.handler ?? (() => json({ error: { status: 418, message: 'no handler' } }, 418))
	);
	const guard = new FakeGuard();
	const sleeps: number[] = [];
	const sleep = async (ms: number) => {
		sleeps.push(ms);
	};
	const oauth = new SpotifyOAuth({
		clientId: 'client-id',
		clientSecret: 'client-secret',
		redirectUri: TEST_REDIRECT_URI,
		fetch,
		now
	});
	const spotify = new SpotifyClient({ fetch, guard, sleep, now });
	const sessions = new SessionStore(kv, now);
	const sessionTokens = new SessionTokens({ store: sessions, oauth, cipher, now });
	const logs: string[] = [];
	const app = createApp({
		pingRedis: options.pingRedis ?? (async () => true),
		kv,
		sessions,
		sessionTokens,
		oauth,
		spotify,
		guard,
		cipher,
		publicOrigin: TEST_ORIGIN,
		cookieSecure: false,
		now,
		log: (line) => logs.push(line)
	});
	return { app, kv, cipher, calls, guard, sessions, sleeps, logs, clock };
}

/** Cookie values from the Set-Cookie headers of a response. */
export function setCookies(res: Response): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const header of res.headers.getSetCookie()) {
		const [pair] = header.split(';');
		const index = pair?.indexOf('=') ?? -1;
		if (pair && index > 0) cookies[pair.slice(0, index)] = pair.slice(index + 1);
	}
	return cookies;
}
