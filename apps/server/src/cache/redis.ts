import { RedisClient } from 'bun';

/** The part of the Redis client that the health check uses. Tests pass a fake. */
export type RedisCommandSender = Pick<RedisClient, 'send'>;

export type RedisPing = () => Promise<boolean>;

export function createRedis(url: string): RedisClient {
	return new RedisClient(url);
}

/** Returns a check that resolves to false when Redis fails or does not answer in time. */
export function redisPinger(client: RedisCommandSender, timeoutMs = 1_000): RedisPing {
	return async () => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Redis PING timed out')), timeoutMs);
		});
		try {
			return (await Promise.race([client.send('PING', []), timeout])) === 'PONG';
		} catch {
			return false;
		} finally {
			clearTimeout(timer);
		}
	};
}
