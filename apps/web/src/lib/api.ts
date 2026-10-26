import type {
	AlbumSummary,
	ArtistSummary,
	HealthResponse,
	MeResponse,
	MixPreview,
	MixRecipe,
	SaveMixRequest,
	SaveMixResponse
} from '@spot-mixer/shared';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Wrap fetch: calling a detached `window.fetch` throws "Illegal invocation" in browsers.
const browserFetch: FetchLike = (input, init) => fetch(input, init);

/** An API error with the error code and the rest of the response body. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly body: Record<string, unknown> = {}
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
	if (!res.ok) throw await apiError(res);
	return (await res.json()) as MeResponse;
}

/** Ends the session. The server also deletes the cached Spotify data of the user. */
export async function logout(fetchFn: FetchLike = browserFetch): Promise<void> {
	const res = await fetchFn('/auth/logout', { method: 'POST' });
	if (!res.ok) throw await apiError(res);
}

export function searchArtists(query: string, fetchFn: FetchLike = browserFetch) {
	return request<ArtistSummary[]>(`/api/search/artists?q=${encodeURIComponent(query)}`, fetchFn);
}

/** Albums and singles of an artist: albums first, newest first. */
export function getArtistReleases(artistId: string, fetchFn: FetchLike = browserFetch) {
	return request<AlbumSummary[]>(`/api/artists/${encodeURIComponent(artistId)}/albums`, fetchFn);
}

export function previewMix(recipe: MixRecipe, fetchFn: FetchLike = browserFetch) {
	return request<MixPreview>('/api/mixes/preview', fetchFn, postJson(recipe));
}

/** Creates a private playlist in the user's Spotify account. */
export function saveMix(body: SaveMixRequest, fetchFn: FetchLike = browserFetch) {
	return request<SaveMixResponse>('/api/mixes', fetchFn, postJson(body));
}

async function request<T>(path: string, fetchFn: FetchLike, init?: RequestInit): Promise<T> {
	const res = await fetchFn(path, init);
	if (!res.ok) throw await apiError(res);
	return (await res.json()) as T;
}

function postJson(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	};
}

async function apiError(res: Response): Promise<ApiError> {
	let body: Record<string, unknown> = {};
	try {
		body = (await res.json()) as Record<string, unknown>;
	} catch {
		// No JSON body: keep the status only.
	}
	return new ApiError(res.status, typeof body.error === 'string' ? body.error : 'unknown', body);
}
