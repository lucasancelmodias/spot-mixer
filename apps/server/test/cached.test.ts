import { describe, expect, it, spyOn } from 'bun:test';
import { cached } from '../src/cache/cached';
import type { KV } from '../src/cache/kv';
import { MemoryKV } from './support/memory-kv';

function counter<T>(value: T) {
	const loader = { calls: 0, load: async () => (loader.calls++, value) };
	return loader;
}

describe('cached', () => {
	it('calls the loader once, then reads the cache', async () => {
		const kv = new MemoryKV();
		const loader = counter({ value: 42 });

		expect(await cached(kv, 'k', { ttlSeconds: 60 }, loader.load)).toEqual({ value: 42 });
		expect(await cached(kv, 'k', { ttlSeconds: 60 }, loader.load)).toEqual({ value: 42 });
		expect(loader.calls).toBe(1);
		expect(kv.ttlSeconds('k')).toBe(60);
	});

	it('caches "not found" for a short time', async () => {
		const kv = new MemoryKV();
		const loader = counter(null);

		expect(await cached(kv, 'k', { ttlSeconds: 600, missTtlSeconds: 30 }, loader.load)).toBeNull();
		expect(await cached(kv, 'k', { ttlSeconds: 600, missTtlSeconds: 30 }, loader.load)).toBeNull();
		expect(loader.calls).toBe(1);
		expect(kv.ttlSeconds('k')).toBe(30);
	});

	it('loads again after the TTL', async () => {
		const clock = { now: 0 };
		const kv = new MemoryKV(() => clock.now);
		const loader = counter('value');

		await cached(kv, 'k', { ttlSeconds: 60 }, loader.load);
		clock.now += 61_000;
		await cached(kv, 'k', { ttlSeconds: 60 }, loader.load);

		expect(loader.calls).toBe(2);
	});

	it('still answers when Redis fails', async () => {
		const warn = spyOn(console, 'warn').mockImplementation(() => {});
		const fail = async (): Promise<never> => {
			throw new Error('Redis GET timed out after 1000 ms');
		};
		const broken: KV = {
			get: fail,
			set: fail,
			setIfAbsent: fail,
			getDel: fail,
			expire: fail,
			del: fail,
			delPrefix: fail
		};

		expect(await cached(broken, 'k', { ttlSeconds: 60 }, async () => 'value')).toBe('value');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('waits for a running loader instead of starting a second one', async () => {
		const kv = new MemoryKV();
		let calls = 0;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slow = async () => {
			calls += 1;
			await gate;
			return 'fresh';
		};

		const first = cached(kv, 'k', { ttlSeconds: 60 }, slow);
		const second = cached(kv, 'k', { ttlSeconds: 60 }, slow);
		release();

		expect(await Promise.all([first, second])).toEqual(['fresh', 'fresh']);
		expect(calls).toBe(1);
	});
});
