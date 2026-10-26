import { describe, expect, it } from 'vitest';
import { getHealth } from './api';

function respond(status: number, body: unknown) {
	return async () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});
}

describe('getHealth', () => {
	it('returns the body of a healthy API', async () => {
		const health = await getHealth(respond(200, { status: 'ok', redis: 'up' }));

		expect(health).toEqual({ status: 'ok', redis: 'up' });
	});

	it('returns the body when Redis is down (HTTP 503)', async () => {
		const health = await getHealth(respond(503, { status: 'degraded', redis: 'down' }));

		expect(health).toEqual({ status: 'degraded', redis: 'down' });
	});

	it('throws on other HTTP errors', async () => {
		await expect(getHealth(respond(500, {}))).rejects.toThrow('HTTP 500');
	});
});
