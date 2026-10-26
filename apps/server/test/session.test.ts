import { describe, expect, it } from 'bun:test';
import { sessionKey } from '../src/cache/keys';
import { TokenCipher } from '../src/session/crypto';
import { MAX_SESSION_MS, type SessionData, SessionStore } from '../src/session/store';
import { SessionExpiredError, SessionTokens } from '../src/session/tokens';
import { SpotifyOAuth } from '../src/spotify/oauth';
import { type FetchHandler, fakeFetch, formOf, json, TEST_ENC_KEY } from './support/fakes';
import { MemoryKV } from './support/memory-kv';

const DAY_MS = 24 * 60 * 60 * 1000;

const refreshOk: FetchHandler = () =>
	json({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600 });

async function setup(handler: FetchHandler = refreshOk) {
	const clock = { now: Date.UTC(2026, 9, 26, 12) };
	const now = () => clock.now;
	const kv = new MemoryKV(now);
	const store = new SessionStore(kv, now);
	const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);
	const { fetch, calls } = fakeFetch(handler);
	const oauth = new SpotifyOAuth({
		clientId: 'client-id',
		clientSecret: 'client-secret',
		redirectUri: 'http://127.0.0.1:5173/auth/callback',
		fetch,
		now
	});
	const tokens = new SessionTokens({ store, oauth, cipher, now });
	const session: SessionData = {
		uid: 'acc-1',
		spotifyId: 'user1',
		displayName: 'User One',
		imageUrl: null,
		accessToken: await cipher.encrypt('at-1'),
		refreshToken: await cipher.encrypt('rt-1'),
		expiresAt: clock.now + 3_600_000,
		authorizedAt: clock.now,
		scopes: []
	};
	return { clock, kv, store, cipher, calls, tokens, session };
}

describe('SessionStore', () => {
	it('stores a session for 30 days of idle time', async () => {
		const { kv, store, session } = await setup();

		const sid = await store.create(session);

		expect(await store.get(sid)).toEqual(session);
		expect(kv.ttlSeconds(sessionKey(sid))).toBe(30 * 24 * 60 * 60);
	});

	it('never keeps a session past 180 days after the authorization', async () => {
		const { clock, kv, store, session } = await setup();

		const sid = await store.create({
			...session,
			authorizedAt: clock.now - (MAX_SESSION_MS - 2 * DAY_MS)
		});

		expect(kv.ttlSeconds(sessionKey(sid))).toBe(2 * 24 * 60 * 60);
	});

	it('deletes a session that is older than 180 days', async () => {
		const { clock, kv, store, session } = await setup();
		const old = { ...session, authorizedAt: clock.now - MAX_SESSION_MS };
		await kv.set(sessionKey('old'), JSON.stringify(old), 3600);

		expect(await store.get('old')).toBeNull();
		expect(await kv.get(sessionKey('old'))).toBeNull();
	});

	it('deletes a corrupted session', async () => {
		const { kv, store } = await setup();
		await kv.set(sessionKey('bad'), 'not json', 60);

		expect(await store.get('bad')).toBeNull();
		expect(await kv.get(sessionKey('bad'))).toBeNull();
	});
});

describe('SessionTokens', () => {
	it('returns the stored token while it is fresh', async () => {
		const { tokens, session, calls } = await setup();

		expect(await tokens.for('sid-1', session).token()).toBe('at-1');
		expect(calls).toHaveLength(0);
	});

	it('refreshes a token that expires within a minute, and saves it encrypted', async () => {
		const { clock, store, cipher, tokens, session, calls } = await setup();
		const sid = await store.create(session);
		clock.now = session.expiresAt - 30_000;
		const source = tokens.for(sid, session);

		expect(await source.token()).toBe('at-2');
		expect(formOf(calls[0]?.init).get('refresh_token')).toBe('rt-1');
		const saved = await store.get(sid);
		expect(await cipher.decrypt(saved?.accessToken ?? '')).toBe('at-2');
		// The refresh response had no new refresh token, so the old one stays.
		expect(await cipher.decrypt(saved?.refreshToken ?? '')).toBe('rt-1');
		expect(saved?.expiresAt).toBe(clock.now + 3_600_000);
		// The source keeps using the new token without another refresh.
		expect(await source.token()).toBe('at-2');
		expect(calls).toHaveLength(1);
	});

	it('runs one refresh for parallel requests of one session', async () => {
		const { store, tokens, session, calls } = await setup();
		const sid = await store.create(session);

		const results = await Promise.all([
			tokens.for(sid, session).refresh(),
			tokens.for(sid, session).refresh()
		]);

		expect(results).toEqual(['at-2', 'at-2']);
		expect(calls).toHaveLength(1);
	});

	it('deletes the session when the refresh token is no longer valid', async () => {
		const { store, tokens, session } = await setup(() => json({ error: 'invalid_grant' }, 400));
		const sid = await store.create(session);

		await expect(tokens.for(sid, session).refresh()).rejects.toBeInstanceOf(SessionExpiredError);
		expect(await store.get(sid)).toBeNull();
	});
});
