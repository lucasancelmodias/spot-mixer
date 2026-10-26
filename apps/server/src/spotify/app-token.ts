import { z } from 'zod';
import { APP_TOKEN_KEY } from '../cache/keys';
import type { KV } from '../cache/kv';
import { messageOf } from '../lib/async';
import type { TokenCipher } from '../session/crypto';
import type { TokenSource } from './client';
import type { SpotifyOAuth } from './oauth';

const EARLY_RENEW_MS = 60_000;

const storedTokenSchema = z.object({ token: z.string(), expiresAt: z.number() });

/**
 * Client Credentials token for catalog reads (plan §5.2). It is kept in memory and, encrypted,
 * in Redis, so that a server restart does not need a new token.
 */
export class AppTokenSource implements TokenSource {
	private current: { token: string; expiresAt: number } | null = null;
	private pending: Promise<string> | null = null;

	constructor(
		private readonly deps: { oauth: SpotifyOAuth; kv: KV; cipher: TokenCipher; now: () => number }
	) {}

	async token(): Promise<string> {
		if (this.current && this.isFresh(this.current.expiresAt)) return this.current.token;
		const stored = await this.readStored();
		if (stored) {
			this.current = stored;
			return stored.token;
		}
		return this.refresh();
	}

	refresh(): Promise<string> {
		this.pending ??= this.fetchNew().finally(() => {
			this.pending = null;
		});
		return this.pending;
	}

	private async fetchNew(): Promise<string> {
		const { oauth, kv, cipher, now } = this.deps;
		const tokens = await oauth.clientCredentials();
		this.current = { token: tokens.accessToken, expiresAt: tokens.expiresAt };
		const ttlSeconds = Math.floor((tokens.expiresAt - now() - EARLY_RENEW_MS) / 1000);
		if (ttlSeconds > 0) {
			const value = JSON.stringify({
				token: await cipher.encrypt(tokens.accessToken),
				expiresAt: tokens.expiresAt
			});
			await kv.set(APP_TOKEN_KEY, value, ttlSeconds).catch((error: unknown) => {
				console.warn(`[spotify] could not store the app token: ${messageOf(error)}`);
			});
		}
		return tokens.accessToken;
	}

	private async readStored(): Promise<{ token: string; expiresAt: number } | null> {
		try {
			const raw = await this.deps.kv.get(APP_TOKEN_KEY);
			if (raw === null) return null;
			const stored = storedTokenSchema.parse(JSON.parse(raw));
			if (!this.isFresh(stored.expiresAt)) return null;
			return { token: await this.deps.cipher.decrypt(stored.token), expiresAt: stored.expiresAt };
		} catch (error) {
			console.warn(`[spotify] could not read the stored app token: ${messageOf(error)}`);
			return null;
		}
	}

	private isFresh(expiresAt: number): boolean {
		return expiresAt - EARLY_RENEW_MS > this.deps.now();
	}
}
