import { afterAll, describe, expect, it } from 'bun:test';
import { RedisClient } from 'bun';
import { RedisKV } from '../src/cache/kv';
import { redisPinger } from '../src/cache/redis';
import { randomToken } from '../src/lib/random';
import { SpotifyUnavailableError } from '../src/spotify/errors';
import { type GuardOptions, RedisSpotifyGuard } from '../src/spotify/guard';

// These tests use the development Redis (compose.dev.yaml). Without it, they are skipped.
// All keys use a random prefix and are deleted at the end.
const url = process.env.TEST_REDIS_URL?.trim() || 'redis://127.0.0.1:6380';
const redis = new RedisClient(url);
const available = await redisPinger(redis, 500)();
if (!available) {
	console.warn(`[test] Redis at ${url} is not reachable: the Redis integration tests are skipped.`);
}
const prefix = `test:${randomToken(6)}:`;
const kv = new RedisKV(redis);

afterAll(async () => {
	if (available) await kv.delPrefix(prefix);
	redis.close();
});

describe.skipIf(!available)('RedisKV with a real Redis', () => {
	it('sets, reads, expires and deletes values', async () => {
		const key = `${prefix}value`;

		await kv.set(key, 'value', 60);
		expect(await kv.get(key)).toBe('value');
		expect(Number(await redis.send('TTL', [key]))).toBeGreaterThan(55);
		await kv.expire(key, 5);
		expect(Number(await redis.send('TTL', [key]))).toBeLessThanOrEqual(5);
		await kv.del(key);
		expect(await kv.get(key)).toBeNull();
	});

	it('sets a key only when it is absent', async () => {
		const key = `${prefix}lock`;

		expect(await kv.setIfAbsent(key, '1', 10_000)).toBe(true);
		expect(await kv.setIfAbsent(key, '2', 10_000)).toBe(false);
		expect(await kv.get(key)).toBe('1');
	});

	it('reads a key once with getDel', async () => {
		const key = `${prefix}state`;
		await kv.set(key, 'pending', 60);

		expect(await kv.getDel(key)).toBe('pending');
		expect(await kv.getDel(key)).toBeNull();
	});

	it('deletes only the keys with the prefix, also when the prefix has glob characters', async () => {
		const base = `${prefix}del:`;
		await kv.set(`${base}user[1]:me`, 'x', 60);
		await kv.set(`${base}user[1]:top`, 'x', 60);
		await kv.set(`${base}user1:me`, 'x', 60);

		expect(await kv.delPrefix(`${base}user[1]:`)).toBe(2);
		expect(await kv.get(`${base}user1:me`)).toBe('x');
	});
});

describe.skipIf(!available)('RedisSpotifyGuard with a real Redis', () => {
	function guardWithClock(name: string, options: Partial<GuardOptions> = {}) {
		const clock = { now: Date.UTC(2026, 9, 26, 12) };
		const sleeps: number[] = [];
		const guard = new RedisSpotifyGuard({
			redis,
			keyPrefix: `${prefix}${name}:`,
			now: () => clock.now,
			sleep: async (ms) => {
				sleeps.push(ms);
				clock.now += ms;
			},
			...options
		});
		return { guard, clock, sleeps };
	}

	it('opens the circuit for everyone and keeps the later end time', async () => {
		const { guard, clock } = guardWithClock('circuit');
		expect(await guard.blockedUntil()).toBeNull();

		await guard.openCircuit(clock.now + 60_000, 'quota');
		await guard.openCircuit(clock.now + 30_000, 'rate_limit');

		expect(await guard.blockedUntil()).toEqual({ until: clock.now + 60_000, reason: 'quota' });
		await expect(guard.check()).rejects.toBeInstanceOf(SpotifyUnavailableError);
	});

	it('lets a burst through, then makes callers wait for the refill', async () => {
		const { guard, sleeps } = guardWithClock('bucket', { capacity: 2, perSecond: 1 });

		await guard.acquire();
		await guard.acquire();
		await guard.acquire();

		expect(sleeps).toEqual([1000]);
		expect(await guard.callsToday()).toBe(3);
	});

	it('fails fast when the wait would be longer than the maximum', async () => {
		const { guard } = guardWithClock('slow', { capacity: 1, perSecond: 0.01, maxWaitMs: 5_000 });

		await guard.acquire();

		await expect(guard.acquire()).rejects.toBeInstanceOf(SpotifyUnavailableError);
	});
});
