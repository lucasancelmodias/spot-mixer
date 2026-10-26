import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { RANDOM_TOKEN_PATTERN } from '../lib/random';
import type { TokenSource } from '../spotify/client';
import type { SessionData, SessionStore } from './store';
import type { SessionTokens } from './tokens';

export type SessionEnv = {
	Variables: { sid: string; session: SessionData; userToken: TokenSource };
};

/** Loads the session from the cookie. Without a valid session, the request ends with 401. */
export function requireSession(deps: {
	sessions: SessionStore;
	tokens: SessionTokens;
	cookieName: string;
}) {
	return createMiddleware<SessionEnv>(async (c, next) => {
		const sid = getCookie(c, deps.cookieName);
		const session = sid && RANDOM_TOKEN_PATTERN.test(sid) ? await deps.sessions.get(sid) : null;
		if (!sid || !session) return c.json({ error: 'unauthenticated' }, 401);
		await deps.sessions.touch(sid, session);
		c.set('sid', sid);
		c.set('session', session);
		c.set('userToken', deps.tokens.for(sid, session));
		await next();
	});
}
