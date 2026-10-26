import { describe, expect, it } from 'bun:test';
import { healthResponseSchema } from '@spot-mixer/shared';
import { redisPinger } from '../src/cache/redis';
import { buildTestApp } from './support/app';

describe('GET /api/health', () => {
	it('returns 200 when Redis answers', async () => {
		const { app } = await buildTestApp({ pingRedis: async () => true });

		const res = await app.request('/api/health');

		expect(res.status).toBe(200);
		expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'ok', redis: 'up' });
	});

	it('returns 503 when Redis does not answer', async () => {
		const { app } = await buildTestApp({ pingRedis: async () => false });

		const res = await app.request('/api/health');

		expect(res.status).toBe(503);
		expect(healthResponseSchema.parse(await res.json())).toEqual({
			status: 'degraded',
			redis: 'down'
		});
	});

	it('returns a JSON 404 for an unknown API route', async () => {
		const { app } = await buildTestApp();

		const res = await app.request('/api/unknown');

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'not_found' });
	});
});

describe('redisPinger', () => {
	it('is true when Redis replies PONG', async () => {
		const ping = redisPinger({ send: async () => 'PONG' });

		expect(await ping()).toBe(true);
	});

	it('is false when the command fails', async () => {
		const ping = redisPinger({
			send: async () => {
				throw new Error('connection refused');
			}
		});

		expect(await ping()).toBe(false);
	});

	it('is false when Redis does not reply in time', async () => {
		const ping = redisPinger({ send: () => new Promise(() => {}) }, 20);

		expect(await ping()).toBe(false);
	});
});
