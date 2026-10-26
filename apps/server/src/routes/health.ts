import { Hono } from 'hono';
import type { HealthResponse } from '@spot-mixer/shared';
import type { RedisPing } from '../cache/redis';

export function healthRoutes(pingRedis: RedisPing) {
	return new Hono().get('/', async (c) => {
		const redisUp = await pingRedis();
		const body: HealthResponse = {
			status: redisUp ? 'ok' : 'degraded',
			redis: redisUp ? 'up' : 'down'
		};
		return c.json(body, redisUp ? 200 : 503);
	});
}
