import type { HealthResponse } from '@spot-mixer/shared';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Wrap fetch: calling a detached `window.fetch` throws "Illegal invocation" in browsers.
const browserFetch: FetchLike = (input, init) => fetch(input, init);

/** Reads the API health. HTTP 503 still has a body: the API is up, but Redis is down. */
export async function getHealth(fetchFn: FetchLike = browserFetch): Promise<HealthResponse> {
	const res = await fetchFn('/api/health');
	if (!res.ok && res.status !== 503) {
		throw new Error(`Health check failed with HTTP ${res.status}`);
	}
	return (await res.json()) as HealthResponse;
}
