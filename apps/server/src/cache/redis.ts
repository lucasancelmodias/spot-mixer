import { RedisClient } from 'bun';
import { withTimeout } from '../lib/async';

/** The part of the Redis client that this app uses. Tests pass a fake. */
export type RedisCommandSender = Pick<RedisClient, 'send'>;

export type RedisPing = () => Promise<boolean>;

export function createRedis(url: string): RedisClient {
	return new RedisClient(url);
}

/**
 * Returns a check that resolves to false when Redis fails or does not answer in time.
 * Bun's client does not fail fast while Redis is down: a command waits for a reconnect.
 */
export function redisPinger(client: RedisCommandSender, timeoutMs = 1_000): RedisPing {
	return async () => {
		try {
			return (await withTimeout(client.send('PING', []), timeoutMs, 'Redis PING')) === 'PONG';
		} catch {
			return false;
		}
	};
}
