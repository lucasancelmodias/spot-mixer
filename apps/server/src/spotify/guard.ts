import { z } from 'zod';
import type { RedisCommandSender } from '../cache/redis';
import { withTimeout } from '../lib/async';
import { SpotifyUnavailableError, type UnavailableReason } from './errors';

export type BlockedState = { until: number; reason: UnavailableReason };

/** Shared protection for the one Spotify quota of this developer account (plan §5.4). */
export interface SpotifyGuard {
	/** Throws SpotifyUnavailableError while the circuit breaker is open. */
	check(): Promise<void>;
	/** Waits for a slot in the shared limiter, then counts the call. */
	acquire(): Promise<void>;
	/** Opens the circuit breaker for all users until `until` (ms since the epoch). */
	openCircuit(until: number, reason: UnavailableReason): Promise<void>;
	blockedUntil(): Promise<BlockedState | null>;
}

// Token bucket. Returns 0 when it took a token, else the wait in ms until a token is free.
const TAKE_TOKEN_SCRIPT = `
local capacity = tonumber(ARGV[1])
local perSecond = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local state = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(state[1]) or capacity
local ts = tonumber(state[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - ts) * perSecond / 1000)
local wait = 0
if tokens >= 1 then
  tokens = tokens - 1
else
  wait = math.ceil((1 - tokens) * 1000 / perSecond)
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[1], 60000)
return wait
`;

const COUNT_TTL_SECONDS = 3 * 24 * 60 * 60;

const blockedStateSchema = z.object({
	until: z.number(),
	reason: z.enum(['quota', 'rate_limit', 'local_limit'])
});

export type GuardOptions = {
	redis: RedisCommandSender;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	/** Prefix for all keys. Tests use it to keep their keys apart. */
	keyPrefix?: string;
	/** Burst size. Default 10. */
	capacity?: number;
	/** Refill rate in calls per second. Default 1. */
	perSecond?: number;
	/** Longest wait for a slot before the call fails. Default 30 s. */
	maxWaitMs?: number;
	/** Timeout of each Redis command. Default 1 s. */
	timeoutMs?: number;
};

/** A guard whose state lives in Redis, so that every request and process shares it. */
export class RedisSpotifyGuard implements SpotifyGuard {
	private readonly capacity: number;
	private readonly perSecond: number;
	private readonly maxWaitMs: number;

	constructor(private readonly options: GuardOptions) {
		this.capacity = options.capacity ?? 10;
		this.perSecond = options.perSecond ?? 1;
		this.maxWaitMs = options.maxWaitMs ?? 30_000;
	}

	async check(): Promise<void> {
		const blocked = await this.blockedUntil();
		if (blocked) throw new SpotifyUnavailableError(blocked.until, blocked.reason);
	}

	async acquire(): Promise<void> {
		const { now, sleep } = this.options;
		const deadline = now() + this.maxWaitMs;
		for (;;) {
			const wait = Number(
				await this.send('EVAL', [
					TAKE_TOKEN_SCRIPT,
					'1',
					this.key('rl:sp:tokens'),
					String(this.capacity),
					String(this.perSecond),
					String(now())
				])
			);
			if (wait <= 0) break;
			if (now() + wait > deadline) throw new SpotifyUnavailableError(now() + wait, 'local_limit');
			await sleep(wait);
		}
		const countKey = this.key(`rl:sp:count:${new Date(now()).toISOString().slice(0, 10)}`);
		await this.send('INCR', [countKey]);
		await this.send('EXPIRE', [countKey, String(COUNT_TTL_SECONDS)]);
	}

	async openCircuit(until: number, reason: UnavailableReason): Promise<void> {
		const ttlMs = until - this.options.now();
		if (ttlMs <= 0) return;
		// Keep the later end time when another request already opened the circuit.
		const current = await this.blockedUntil();
		if (current && current.until >= until) return;
		await this.send('SET', [
			this.key('rl:sp:blocked-until'),
			JSON.stringify({ until, reason }),
			'PX',
			String(ttlMs)
		]);
	}

	async blockedUntil(): Promise<BlockedState | null> {
		const raw = await this.send('GET', [this.key('rl:sp:blocked-until')]);
		if (raw === null || raw === undefined) return null;
		const parsed = blockedStateSchema.safeParse(JSON.parse(String(raw)));
		return parsed.success && parsed.data.until > this.options.now() ? parsed.data : null;
	}

	/** Spotify calls counted today (UTC). */
	async callsToday(): Promise<number> {
		const day = new Date(this.options.now()).toISOString().slice(0, 10);
		return Number((await this.send('GET', [this.key(`rl:sp:count:${day}`)])) ?? 0);
	}

	private key(name: string): string {
		return `${this.options.keyPrefix ?? ''}${name}`;
	}

	private send(command: string, args: string[]): Promise<unknown> {
		return withTimeout(
			this.options.redis.send(command, args),
			this.options.timeoutMs ?? 1_000,
			`Redis ${command}`
		);
	}
}
