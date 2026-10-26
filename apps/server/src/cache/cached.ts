import { messageOf, sleep } from '../lib/async';
import type { KV } from './kv';

export type CacheOptions = {
	ttlSeconds: number;
	/** How long a "not found" result (null) stays cached. Default 5 minutes. */
	missTtlSeconds?: number;
	/** How long one loader may hold the stampede lock. Default 10 s. */
	lockMs?: number;
};

const MISS = '{"__miss":true}';
const LOCK_POLL_MS = 100;
const LOCK_POLLS = 20;

/**
 * Read-through cache. The loader returns null for "not found", and null is cached for a short time.
 * Redis problems never break the request: a failed read is a miss, and a failed write is skipped.
 */
export async function cached<T>(
	kv: KV,
	key: string,
	options: CacheOptions,
	loader: () => Promise<T | null>
): Promise<T | null> {
	const hit = await quietly(() => kv.get(key), key);
	if (hit != null) return decode<T>(hit);

	// Stampede lock: one loader per key at a time. Other callers wait a short time for its result.
	const lockKey = `lock:${key}`;
	const locked = await quietly(() => kv.setIfAbsent(lockKey, '1', options.lockMs ?? 10_000), key);
	if (locked === false) {
		for (let poll = 0; poll < LOCK_POLLS; poll += 1) {
			await sleep(LOCK_POLL_MS);
			const later = await quietly(() => kv.get(key), key);
			if (later != null) return decode<T>(later);
		}
	}

	try {
		const value = await loader();
		const ttl = value === null ? (options.missTtlSeconds ?? 300) : options.ttlSeconds;
		await quietly(() => kv.set(key, value === null ? MISS : JSON.stringify(value), ttl), key);
		return value;
	} finally {
		if (locked) await quietly(() => kv.del(lockKey), key);
	}
}

/** Reads one cached JSON value, for batch reads. Returns undefined on a miss or a Redis problem. */
export async function readCached<T>(kv: KV, key: string): Promise<T | undefined> {
	const raw = await quietly(() => kv.get(key), key);
	return raw == null || raw === MISS ? undefined : (JSON.parse(raw) as T);
}

/** Writes one JSON value, for batch reads. A Redis problem is logged, not thrown. */
export async function writeCached(
	kv: KV,
	key: string,
	value: unknown,
	ttlSeconds: number
): Promise<void> {
	await quietly(() => kv.set(key, JSON.stringify(value), ttlSeconds), key);
}

function decode<T>(raw: string): T | null {
	return raw === MISS ? null : (JSON.parse(raw) as T);
}

async function quietly<T>(operation: () => Promise<T>, key: string): Promise<T | undefined> {
	try {
		return await operation();
	} catch (error) {
		console.warn(`[cache] Redis operation failed for ${key}: ${messageOf(error)}`);
		return undefined;
	}
}
