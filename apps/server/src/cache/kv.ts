import { withTimeout } from '../lib/async';
import type { RedisCommandSender } from './redis';

/** A small key-value interface over Redis, so that tests can use an in-memory store. */
export interface KV {
	get(key: string): Promise<string | null>;
	/** Sets the value with a TTL in seconds. */
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
	/** Sets the value only if the key does not exist. Returns true when it was set. */
	setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
	/** Reads and deletes the key in one step. */
	getDel(key: string): Promise<string | null>;
	expire(key: string, ttlSeconds: number): Promise<void>;
	del(...keys: string[]): Promise<void>;
	/** Deletes every key that starts with the prefix. Returns the number of deleted keys. */
	delPrefix(prefix: string): Promise<number>;
}

export class RedisKV implements KV {
	constructor(
		private readonly redis: RedisCommandSender,
		private readonly timeoutMs = 1_000
	) {}

	async get(key: string): Promise<string | null> {
		return stringOrNull(await this.send('GET', [key]));
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		await this.send('SET', [key, value, 'EX', String(ttlSeconds)]);
	}

	async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
		return (await this.send('SET', [key, value, 'PX', String(ttlMs), 'NX'])) === 'OK';
	}

	async getDel(key: string): Promise<string | null> {
		return stringOrNull(await this.send('GETDEL', [key]));
	}

	async expire(key: string, ttlSeconds: number): Promise<void> {
		await this.send('EXPIRE', [key, String(ttlSeconds)]);
	}

	async del(...keys: string[]): Promise<void> {
		if (keys.length > 0) await this.send('DEL', keys);
	}

	async delPrefix(prefix: string): Promise<number> {
		const match = `${prefix.replace(/[*?[\]\\]/g, '\\$&')}*`;
		let cursor = '0';
		let deleted = 0;
		do {
			const [next, keys] = (await this.send('SCAN', [cursor, 'MATCH', match, 'COUNT', '100'])) as [
				string | number,
				string[]
			];
			cursor = String(next);
			if (keys.length > 0) {
				await this.send('DEL', keys);
				deleted += keys.length;
			}
		} while (cursor !== '0');
		return deleted;
	}

	private send(command: string, args: string[]): Promise<unknown> {
		return withTimeout(this.redis.send(command, args), this.timeoutMs, `Redis ${command}`);
	}
}

function stringOrNull(value: unknown): string | null {
	return value === null || value === undefined ? null : String(value);
}
