import { z } from 'zod';
import { sessionKey } from '../cache/keys';
import type { KV } from '../cache/kv';
import { randomToken } from '../lib/random';

/** A refresh token expires 6 months after the authorization. 180 days stays inside that. */
export const MAX_SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;

const sessionSchema = z.object({
	/** Spotify `account_id`, or the user ID for accounts without one. Key of all user data. */
	uid: z.string(),
	spotifyId: z.string(),
	displayName: z.string().nullable(),
	imageUrl: z.string().nullable(),
	/** Encrypted with TokenCipher. */
	accessToken: z.string(),
	/** Encrypted with TokenCipher. */
	refreshToken: z.string(),
	expiresAt: z.number(),
	authorizedAt: z.number(),
	scopes: z.array(z.string())
});

export type SessionData = z.infer<typeof sessionSchema>;

/** Sessions in Redis: 30 days idle, and never longer than MAX_SESSION_MS after the authorization. */
export class SessionStore {
	constructor(
		private readonly kv: KV,
		private readonly now: () => number
	) {}

	async create(data: SessionData): Promise<string> {
		const sid = randomToken();
		await this.save(sid, data);
		return sid;
	}

	async get(sid: string): Promise<SessionData | null> {
		const raw = await this.kv.get(sessionKey(sid));
		if (raw === null) return null;
		const parsed = sessionSchema.safeParse(parseJson(raw));
		if (!parsed.success || this.now() >= parsed.data.authorizedAt + MAX_SESSION_MS) {
			await this.kv.del(sessionKey(sid));
			return null;
		}
		return parsed.data;
	}

	save(sid: string, data: SessionData): Promise<void> {
		return this.kv.set(sessionKey(sid), JSON.stringify(data), this.ttlSeconds(data));
	}

	/** Restarts the idle timer. */
	touch(sid: string, data: SessionData): Promise<void> {
		return this.kv.expire(sessionKey(sid), this.ttlSeconds(data));
	}

	destroy(sid: string): Promise<void> {
		return this.kv.del(sessionKey(sid));
	}

	private ttlSeconds(data: SessionData): number {
		const remaining = Math.floor((data.authorizedAt + MAX_SESSION_MS - this.now()) / 1000);
		return Math.max(1, Math.min(IDLE_TTL_SECONDS, remaining));
	}
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
