import type { KV } from '../../src/cache/kv';

/** An in-memory KV with TTLs, for tests. */
export class MemoryKV implements KV {
	readonly entries = new Map<string, { value: string; expiresAt: number }>();

	constructor(private readonly now: () => number = () => Date.now()) {}

	async get(key: string): Promise<string | null> {
		return this.live(key)?.value ?? null;
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
	}

	async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
		if (this.live(key)) return false;
		this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
		return true;
	}

	async getDel(key: string): Promise<string | null> {
		const value = this.live(key)?.value ?? null;
		this.entries.delete(key);
		return value;
	}

	async expire(key: string, ttlSeconds: number): Promise<void> {
		const entry = this.live(key);
		if (entry) entry.expiresAt = this.now() + ttlSeconds * 1000;
	}

	async del(...keys: string[]): Promise<void> {
		for (const key of keys) this.entries.delete(key);
	}

	async delPrefix(prefix: string): Promise<number> {
		let deleted = 0;
		for (const key of [...this.entries.keys()]) {
			if (key.startsWith(prefix)) {
				this.entries.delete(key);
				deleted += 1;
			}
		}
		return deleted;
	}

	/** Remaining TTL in seconds, or null when the key does not exist. */
	ttlSeconds(key: string): number | null {
		const entry = this.live(key);
		return entry ? Math.round((entry.expiresAt - this.now()) / 1000) : null;
	}

	keys(): string[] {
		return [...this.entries.keys()].filter((key) => this.live(key));
	}

	private live(key: string) {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return entry;
	}
}
