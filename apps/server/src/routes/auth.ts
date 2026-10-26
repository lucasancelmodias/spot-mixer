import type { AuthErrorCode } from '@spot-mixer/shared';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { oauthStateKey, userCachePrefix } from '../cache/keys';
import type { KV } from '../cache/kv';
import { messageOf } from '../lib/async';
import { RANDOM_TOKEN_PATTERN, randomToken } from '../lib/random';
import {
	OAUTH_STATE_COOKIE,
	SESSION_COOKIE_MAX_AGE_SECONDS,
	sessionCookieName
} from '../session/cookies';
import type { TokenCipher } from '../session/crypto';
import type { SessionStore } from '../session/store';
import { fixedToken, type SpotifyClient } from '../spotify/client';
import { SpotifyAccessError, SpotifyUnavailableError } from '../spotify/errors';
import { MVP_SCOPES, type SpotifyOAuth, type TokenSet } from '../spotify/oauth';
import { profileSchema, smallestImage, type SpotifyProfile } from '../spotify/schemas';

const STATE_TTL_SECONDS = 600;

const pendingLoginSchema = z.object({ returnTo: z.string() });

export type AuthDeps = {
	kv: KV;
	sessions: SessionStore;
	oauth: SpotifyOAuth;
	spotify: SpotifyClient;
	cipher: TokenCipher;
	cookieSecure: boolean;
	now: () => number;
	log: (line: string) => void;
};

/** OAuth routes (plan §4.4). They live under /auth, to match the registered redirect URI. */
export function authRoutes(deps: AuthDeps) {
	const sessionCookie = sessionCookieName(deps.cookieSecure);
	const app = new Hono();

	app.get('/login', async (c) => {
		const state = randomToken();
		const pending = { returnTo: safeReturnTo(c.req.query('returnTo')) };
		await deps.kv.set(oauthStateKey(state), JSON.stringify(pending), STATE_TTL_SECONDS);
		setCookie(c, OAUTH_STATE_COOKIE, state, {
			httpOnly: true,
			secure: deps.cookieSecure,
			sameSite: 'Lax',
			path: '/auth',
			maxAge: STATE_TTL_SECONDS
		});
		return c.redirect(deps.oauth.authorizeUrl(state, MVP_SCOPES), 302);
	});

	app.get('/callback', async (c) => {
		const fail = (code: AuthErrorCode) => c.redirect(`/?auth_error=${code}`, 302);
		const cookieState = getCookie(c, OAUTH_STATE_COOKIE);
		deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/auth', secure: deps.cookieSecure });

		const { code, state, error } = c.req.query();
		if (error) return fail(error === 'access_denied' ? 'access_denied' : 'authorization_failed');
		if (!code || !state || !cookieState || !sameText(state, cookieState)) {
			return fail('state_mismatch');
		}
		// One-time use: the state is deleted as it is read.
		const pending = pendingLoginSchema.safeParse(
			JSON.parse((await deps.kv.getDel(oauthStateKey(state))) ?? 'null')
		);
		if (!pending.success) return fail('state_mismatch');

		let tokens: TokenSet;
		try {
			tokens = await deps.oauth.exchangeCode(code);
		} catch (err) {
			deps.log(`[auth] token exchange failed: ${messageOf(err)}`);
			return fail('token_exchange_failed');
		}
		if (!tokens.refreshToken) {
			deps.log('[auth] token exchange returned no refresh token');
			return fail('token_exchange_failed');
		}

		// The first API call also checks the allowlist and the owner's Premium subscription.
		let profile: SpotifyProfile;
		try {
			profile = await deps.spotify.request(fixedToken(tokens.accessToken), {
				path: '/me',
				schema: profileSchema
			});
		} catch (err) {
			deps.log(`[auth] profile check failed: ${messageOf(err)}`);
			return fail(loginErrorCode(err));
		}

		const sid = await deps.sessions.create({
			uid: profile.account_id ?? profile.id,
			spotifyId: profile.id,
			displayName: profile.display_name ?? null,
			imageUrl: smallestImage(profile.images),
			accessToken: await deps.cipher.encrypt(tokens.accessToken),
			refreshToken: await deps.cipher.encrypt(tokens.refreshToken),
			expiresAt: tokens.expiresAt,
			authorizedAt: deps.now(),
			scopes: tokens.scopes
		});
		setCookie(c, sessionCookie, sid, {
			httpOnly: true,
			secure: deps.cookieSecure,
			sameSite: 'Lax',
			path: '/',
			maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
		});
		return c.redirect(pending.data.returnTo, 302);
	});

	app.post('/logout', async (c) => {
		const sid = getCookie(c, sessionCookie);
		if (sid && RANDOM_TOKEN_PATTERN.test(sid)) {
			const session = await deps.sessions.get(sid);
			await deps.sessions.destroy(sid);
			// Delete the user's cached Spotify data at once (Spotify terms: within 5 days).
			if (session) await deps.kv.delPrefix(userCachePrefix(session.uid));
		}
		deleteCookie(c, sessionCookie, { path: '/', secure: deps.cookieSecure });
		return c.body(null, 204);
	});

	return app;
}

/** Only same-site paths, so that the login cannot redirect to another site. */
function safeReturnTo(value: string | undefined): string {
	if (!value || value.length > 200) return '/';
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
	return value;
}

function sameText(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

function loginErrorCode(error: unknown): AuthErrorCode {
	if (error instanceof SpotifyAccessError) {
		return error.problem === 'not_allowlisted' || error.problem === 'owner_premium'
			? error.problem
			: 'forbidden';
	}
	if (error instanceof SpotifyUnavailableError) return 'spotify_unavailable';
	return 'authorization_failed';
}
