import { describe, expect, it } from 'vitest';
import { ApiError, getHealth, getMe, logout } from './api';

function respond(status: number, body?: unknown) {
	const calls: { input: string; init?: RequestInit }[] = [];
	const fetchFn = async (input: string, init?: RequestInit) => {
		calls.push({ input, init });
		return new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	};
	return { fetchFn, calls };
}

const profile = {
	id: 'user1',
	displayName: 'User One',
	imageUrl: null,
	authorizedAt: '2026-10-26T12:00:00.000Z',
	renewBy: '2027-04-24T12:00:00.000Z'
};

describe('getHealth', () => {
	it('returns the body of a healthy API', async () => {
		const health = await getHealth(respond(200, { status: 'ok', redis: 'up' }).fetchFn);

		expect(health).toEqual({ status: 'ok', redis: 'up' });
	});

	it('returns the body when Redis is down (HTTP 503)', async () => {
		const health = await getHealth(respond(503, { status: 'degraded', redis: 'down' }).fetchFn);

		expect(health).toEqual({ status: 'degraded', redis: 'down' });
	});

	it('throws on other HTTP errors', async () => {
		await expect(getHealth(respond(500, {}).fetchFn)).rejects.toThrow('HTTP 500');
	});
});

describe('getMe', () => {
	it('returns the profile', async () => {
		expect(await getMe(respond(200, profile).fetchFn)).toEqual(profile);
	});

	it('returns null without a session', async () => {
		expect(await getMe(respond(401, { error: 'unauthenticated' }).fetchFn)).toBeNull();
	});

	it('throws an ApiError with the error code', async () => {
		const error = await getMe(respond(503, { error: 'spotify_unavailable' }).fetchFn).catch(
			(e: unknown) => e
		);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 503, code: 'spotify_unavailable' });
	});
});

describe('logout', () => {
	it('posts to /auth/logout', async () => {
		const { fetchFn, calls } = respond(204);

		await logout(fetchFn);

		expect(calls).toEqual([{ input: '/auth/logout', init: { method: 'POST' } }]);
	});

	it('throws when the server refuses', async () => {
		await expect(logout(respond(403, { error: 'bad_origin' }).fetchFn)).rejects.toMatchObject({
			code: 'bad_origin'
		});
	});
});
