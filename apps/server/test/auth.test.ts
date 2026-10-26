import { describe, expect, it } from 'bun:test';
import { meResponseSchema } from '@spot-mixer/shared';
import { MAX_SESSION_MS } from '../src/session/store';
import { MVP_SCOPES } from '../src/spotify/oauth';
import { buildTestApp, setCookies, TEST_ORIGIN, TEST_REDIRECT_URI } from './support/app';
import { type FetchHandler, formOf, headerOf, json, spotifyError } from './support/fakes';

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

/** A fake Spotify: the token endpoint and GET /v1/me. */
function spotifyFake(
	options: { me?: () => Response; refresh?: () => Response } = {}
): FetchHandler {
	return (url, init) => {
		if (url.href === 'https://accounts.spotify.com/api/token') {
			if (formOf(init).get('grant_type') === 'refresh_token') {
				return (
					options.refresh?.() ??
					json({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600 })
				);
			}
			return json({
				access_token: 'at-1',
				token_type: 'Bearer',
				expires_in: 3600,
				refresh_token: 'rt-1',
				scope: MVP_SCOPES.join(' ')
			});
		}
		if (url.href === 'https://api.spotify.com/v1/me') {
			return (
				options.me?.() ??
				json({
					id: 'user1',
					display_name: 'User One',
					account_id: 'acc-1',
					images: [
						{ url: 'https://i.scdn.co/big', width: 640, height: 640 },
						{ url: 'https://i.scdn.co/small', width: 64, height: 64 }
					]
				})
			);
		}
		return spotifyError(404, `unexpected call to ${url.href}`);
	};
}

/** Runs /auth/login and /auth/callback like a browser. */
async function signIn(t: TestApp, returnTo?: string) {
	const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
	const login = await t.app.request(`/auth/login${query}`);
	const state = setCookies(login).oauth_state ?? '';
	const callback = await t.app.request(`/auth/callback?code=code-1&state=${state}`, {
		headers: { Cookie: `oauth_state=${state}` }
	});
	return { state, callback, sid: setCookies(callback).sid ?? '' };
}

function withSession(sid: string, init: RequestInit = {}): RequestInit {
	return { ...init, headers: { ...init.headers, Cookie: `sid=${sid}` } };
}

const tokenCalls = (t: TestApp) => t.calls.filter((call) => call.url.pathname === '/api/token');
const meCalls = (t: TestApp) => t.calls.filter((call) => call.url.pathname === '/v1/me');

describe('GET /auth/login', () => {
	it('redirects to Spotify with a state that is stored for 10 minutes', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });

		const res = await t.app.request('/auth/login');

		expect(res.status).toBe(302);
		const location = new URL(res.headers.get('Location') ?? '');
		expect(location.origin + location.pathname).toBe('https://accounts.spotify.com/authorize');
		expect(location.searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
		const state = setCookies(res).oauth_state;
		expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(location.searchParams.get('state')).toBe(state ?? '');
		expect(t.kv.ttlSeconds(`oauth:${state}`)).toBe(600);
	});

	it('accepts only same-site return paths', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const cases = [
			['/mix/artists', '/mix/artists'],
			['//evil.example', '/'],
			['https://evil.example', '/'],
			['/\\evil.example', '/']
		];

		for (const [returnTo = '', expected] of cases) {
			const res = await t.app.request(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
			const stored = await t.kv.get(`oauth:${setCookies(res).oauth_state}`);
			expect(JSON.parse(stored ?? 'null')).toEqual({ returnTo: expected });
		}
	});
});

describe('GET /auth/callback', () => {
	it('creates a session with encrypted tokens and redirects to the return path', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });

		const { callback, sid } = await signIn(t, '/mix/artists');

		expect(callback.status).toBe(302);
		expect(callback.headers.get('Location')).toBe('/mix/artists');
		expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const raw = (await t.kv.get(`sess:${sid}`)) ?? '';
		expect(raw).not.toContain('at-1');
		expect(raw).not.toContain('rt-1');
		const session = await t.sessions.get(sid);
		expect(session).toMatchObject({
			uid: 'acc-1',
			spotifyId: 'user1',
			displayName: 'User One',
			imageUrl: 'https://i.scdn.co/small',
			authorizedAt: t.clock.now
		});
		expect(await t.cipher.decrypt(session?.accessToken ?? '')).toBe('at-1');
		expect(await t.cipher.decrypt(session?.refreshToken ?? '')).toBe('rt-1');
	});

	it('rejects a state that does not match the cookie', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const login = await t.app.request('/auth/login');
		const state = setCookies(login).oauth_state ?? '';

		const res = await t.app.request(`/auth/callback?code=code-1&state=${state}`, {
			headers: { Cookie: 'oauth_state=another-state' }
		});

		expect(res.headers.get('Location')).toBe('/?auth_error=state_mismatch');
		expect(tokenCalls(t)).toHaveLength(0);
	});

	it('rejects a state that was already used', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { state } = await signIn(t);

		const replay = await t.app.request(`/auth/callback?code=code-1&state=${state}`, {
			headers: { Cookie: `oauth_state=${state}` }
		});

		expect(replay.headers.get('Location')).toBe('/?auth_error=state_mismatch');
		expect(tokenCalls(t)).toHaveLength(1);
	});

	it('reports a cancelled login', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });

		const res = await t.app.request('/auth/callback?error=access_denied&state=x', {
			headers: { Cookie: 'oauth_state=x' }
		});

		expect(res.headers.get('Location')).toBe('/?auth_error=access_denied');
	});

	it('reports a user who is not on the allowlist, and creates no session', async () => {
		const t = await buildTestApp({
			handler: spotifyFake({
				me: () =>
					spotifyError(
						403,
						'Check settings on developer.spotify.com/dashboard, the user may not be registered.'
					)
			})
		});

		const { callback } = await signIn(t);

		expect(callback.headers.get('Location')).toBe('/?auth_error=not_allowlisted');
		expect(t.kv.keys().filter((key) => key.startsWith('sess:'))).toEqual([]);
	});

	it('reports an owner without an active Premium subscription', async () => {
		const t = await buildTestApp({
			handler: spotifyFake({
				me: () => spotifyError(403, 'Active premium subscription required for the owner of the app')
			})
		});

		const { callback } = await signIn(t);

		expect(callback.headers.get('Location')).toBe('/?auth_error=owner_premium');
	});
});

describe('POST /auth/logout', () => {
	it('needs the Origin header of the app', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { sid } = await signIn(t);

		const attempts: Record<string, string>[] = [{}, { Origin: 'https://evil.example' }];
		for (const headers of attempts) {
			const res = await t.app.request(
				'/auth/logout',
				withSession(sid, { method: 'POST', headers })
			);
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ error: 'bad_origin' });
		}
		expect(await t.sessions.get(sid)).not.toBeNull();
	});

	it('deletes the session and the cached user data', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { sid } = await signIn(t);
		await t.app.request('/api/me', withSession(sid));
		expect(await t.kv.get('c:u:acc-1:me')).not.toBeNull();

		const res = await t.app.request(
			'/auth/logout',
			withSession(sid, { method: 'POST', headers: { Origin: TEST_ORIGIN } })
		);

		expect(res.status).toBe(204);
		expect(await t.kv.get(`sess:${sid}`)).toBeNull();
		expect(await t.kv.get('c:u:acc-1:me')).toBeNull();
		expect(res.headers.getSetCookie().some((cookie) => /^sid=;.*Max-Age=0/.test(cookie))).toBe(
			true
		);
	});
});

describe('GET /api/me', () => {
	it('needs a session', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });

		const res = await t.app.request('/api/me');

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'unauthenticated' });
	});

	it('returns the profile and caches it for 5 minutes', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { sid } = await signIn(t);
		const before = meCalls(t).length;

		const res = await t.app.request('/api/me', withSession(sid));
		await t.app.request('/api/me', withSession(sid));

		expect(res.status).toBe(200);
		expect(meResponseSchema.parse(await res.json())).toEqual({
			id: 'user1',
			displayName: 'User One',
			imageUrl: 'https://i.scdn.co/small',
			authorizedAt: new Date(t.clock.now).toISOString(),
			renewBy: new Date(t.clock.now + MAX_SESSION_MS).toISOString()
		});
		expect(meCalls(t)).toHaveLength(before + 1);
		expect(t.kv.ttlSeconds('c:u:acc-1:me')).toBe(300);
	});

	it('refreshes an expired access token', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { sid } = await signIn(t);
		t.clock.now += 2 * 60 * 60 * 1000;

		const res = await t.app.request('/api/me', withSession(sid));

		expect(res.status).toBe(200);
		expect(tokenCalls(t).map((call) => formOf(call.init).get('grant_type'))).toEqual([
			'authorization_code',
			'refresh_token'
		]);
		expect(headerOf(meCalls(t).at(-1)?.init, 'Authorization')).toBe('Bearer at-2');
	});

	it('ends the session when the refresh token is no longer valid', async () => {
		const t = await buildTestApp({
			handler: spotifyFake({ refresh: () => json({ error: 'invalid_grant' }, 400) })
		});
		const { sid } = await signIn(t);
		t.clock.now += 2 * 60 * 60 * 1000;

		const res = await t.app.request('/api/me', withSession(sid));

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'session_expired' });
		expect(await t.kv.get(`sess:${sid}`)).toBeNull();
	});

	it('answers 503 while Spotify calls are paused', async () => {
		const t = await buildTestApp({ handler: spotifyFake() });
		const { sid } = await signIn(t);
		t.guard.blocked = { until: t.clock.now + 60_000, reason: 'quota' };

		const res = await t.app.request('/api/me', withSession(sid));

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error: 'spotify_unavailable',
			until: new Date(t.clock.now + 60_000).toISOString()
		});
	});
});

describe('GET /api/status', () => {
	it('reports whether Spotify calls are paused', async () => {
		const t = await buildTestApp();

		expect(await (await t.app.request('/api/status')).json()).toEqual({
			spotifyBlockedUntil: null,
			reason: null
		});
		t.guard.blocked = { until: t.clock.now + 60_000, reason: 'quota' };
		expect(await (await t.app.request('/api/status')).json()).toEqual({
			spotifyBlockedUntil: new Date(t.clock.now + 60_000).toISOString(),
			reason: 'quota'
		});
	});
});
