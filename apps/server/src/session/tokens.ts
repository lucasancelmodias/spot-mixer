import type { TokenSource } from '../spotify/client';
import { InvalidGrantError } from '../spotify/errors';
import type { SpotifyOAuth, TokenSet } from '../spotify/oauth';
import type { TokenCipher } from './crypto';
import type { SessionData, SessionStore } from './store';

const EARLY_REFRESH_MS = 60_000;

/** The refresh token expired or was revoked. The session was deleted; the user must sign in again. */
export class SessionExpiredError extends Error {
	constructor() {
		super('The Spotify session expired. Sign in again.');
		this.name = 'SessionExpiredError';
	}
}

type Refreshed = { session: SessionData; token: string };

/** Makes token sources for sessions. In this process, one refresh per session runs at a time. */
export class SessionTokens {
	private readonly refreshing = new Map<string, Promise<Refreshed>>();

	constructor(
		private readonly deps: {
			store: SessionStore;
			oauth: SpotifyOAuth;
			cipher: TokenCipher;
			now: () => number;
		}
	) {}

	for(sid: string, initial: SessionData): TokenSource {
		let session = initial;
		const refresh = async (): Promise<string> => {
			let running = this.refreshing.get(sid);
			if (!running) {
				running = this.refreshSession(sid, session).finally(() => this.refreshing.delete(sid));
				this.refreshing.set(sid, running);
			}
			const result = await running;
			session = result.session;
			return result.token;
		};
		return {
			token: async () =>
				session.expiresAt - EARLY_REFRESH_MS > this.deps.now()
					? this.deps.cipher.decrypt(session.accessToken)
					: refresh(),
			refresh
		};
	}

	private async refreshSession(sid: string, session: SessionData): Promise<Refreshed> {
		const { cipher, oauth, store } = this.deps;
		let tokens: TokenSet;
		try {
			tokens = await oauth.refresh(await cipher.decrypt(session.refreshToken));
		} catch (error) {
			if (error instanceof InvalidGrantError) {
				// Spotify says: discard the token and sign in again, without retries.
				await store.destroy(sid);
				throw new SessionExpiredError();
			}
			throw error;
		}
		const updated: SessionData = {
			...session,
			accessToken: await cipher.encrypt(tokens.accessToken),
			// A refresh response does not always include a new refresh token. Keep the old one.
			refreshToken: tokens.refreshToken
				? await cipher.encrypt(tokens.refreshToken)
				: session.refreshToken,
			expiresAt: tokens.expiresAt
		};
		await store.save(sid, updated);
		return { session: updated, token: tokens.accessToken };
	}
}
