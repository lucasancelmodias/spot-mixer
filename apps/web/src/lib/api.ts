import type { ApiErrorBody, HealthResponse, MeResponse } from '@spot-mixer/shared';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Wrap fetch: calling a detached `window.fetch` throws "Illegal invocation" in browsers.
const browserFetch: FetchLike = (input, init) => fetch(input, init);

/** An API error with the error code from the response body. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string
	) {
		super(`API request failed with HTTP ${status} (${code})`);
		this.name = 'ApiError';
	}
}

/** Reads the API health. HTTP 503 still has a body: the API is up, but Redis is down. */
export async function getHealth(fetchFn: FetchLike = browserFetch): Promise<HealthResponse> {
	const res = await fetchFn('/api/health');
	if (!res.ok && res.status !== 503) {
		throw new Error(`Health check failed with HTTP ${res.status}`);
	}
	return (await res.json()) as HealthResponse;
}

/** The signed-in user, or null without a session. */
export async function getMe(fetchFn: FetchLike = browserFetch): Promise<MeResponse | null> {
	const res = await fetchFn('/api/me');
	if (res.status === 401) return null;
	if (!res.ok) throw new ApiError(res.status, await errorCode(res));
	return (await res.json()) as MeResponse;
}

/** Ends the session. The server also deletes the cached Spotify data of the user. */
export async function logout(fetchFn: FetchLike = browserFetch): Promise<void> {
	const res = await fetchFn('/auth/logout', { method: 'POST' });
	if (!res.ok) throw new ApiError(res.status, await errorCode(res));
}

async function errorCode(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as Partial<ApiErrorBody>;
		return typeof body.error === 'string' ? body.error : 'unknown';
	} catch {
		return 'unknown';
	}
}
