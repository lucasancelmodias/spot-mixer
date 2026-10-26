import type { z } from 'zod';
import type { FetchLike } from '../lib/http';
import {
	type AccessProblem,
	SpotifyAccessError,
	SpotifyAuthError,
	SpotifyError,
	SpotifyNotFoundError,
	SpotifyRequestError,
	SpotifyUnavailableError
} from './errors';
import type { SpotifyGuard } from './guard';

const API_URL = 'https://api.spotify.com/v1';

export interface TokenSource {
	/** A valid access token. */
	token(): Promise<string>;
	/** A new access token, after Spotify rejected the current one. */
	refresh(): Promise<string>;
}

export type Query = Record<string, string | number | boolean | undefined>;

export type SpotifyRequest<T> = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	/** Path below /v1, for example `/me`. */
	path: string;
	query?: Query;
	body?: unknown;
	schema: z.ZodType<T>;
};

// Endpoints that new Development Mode apps cannot use (plan §5.3). The client refuses them
// without a call, so that a mistake costs no quota.
const BLOCKED_ROUTES = [
	/^GET \/artists\/[^/]+\/(top-tracks|related-artists)$/,
	/^GET \/(artists|albums|tracks)$/,
	/^GET \/(recommendations|audio-features|audio-analysis)(\/|$)/,
	/^GET \/(browse|markets)(\/|$)/,
	/^(GET|POST) \/users\/[^/]+\/playlists$/,
	/^GET \/users\/[^/]+$/,
	/^[A-Z]+ \/playlists\/[^/]+\/tracks$/
];

// Page-size maximums for new Development Mode apps. A larger `limit` returns 400.
const LIMIT_MAXIMUMS: Array<[RegExp, number]> = [
	[/^\/search$/, 10],
	[/^\/artists\/[^/]+\/albums$/, 10]
];
const DEFAULT_LIMIT_MAXIMUM = 50;

const MAX_SERVER_RETRIES = 3;
const SHORT_RETRY_AFTER_SECONDS = 30;
const SECOND_RATE_LIMIT_BLOCK_MS = 15 * 60_000;
const QUOTA_BLOCK_MS = 60 * 60_000;

export function limitMaximum(path: string): number {
	return LIMIT_MAXIMUMS.find(([pattern]) => pattern.test(path))?.[1] ?? DEFAULT_LIMIT_MAXIMUM;
}

/** Method and path with Spotify IDs replaced by `{id}`, for logs and errors. */
export function routeOf(method: string, path: string): string {
	return `${method} ${path.replace(/\/[A-Za-z0-9]{22}(?=\/|$)/g, '/{id}')}`;
}

export type ClientOptions = {
	fetch: FetchLike;
	guard: SpotifyGuard;
	sleep: (ms: number) => Promise<void>;
	now: () => number;
	log?: (line: string) => void;
	requestTimeoutMs?: number;
};

/** The one way to call the Spotify Web API (plan §5.4). */
export class SpotifyClient {
	constructor(private readonly options: ClientOptions) {}

	async request<T>(auth: TokenSource, request: SpotifyRequest<T>): Promise<T> {
		const method = request.method ?? 'GET';
		const route = routeOf(method, request.path);
		if (BLOCKED_ROUTES.some((pattern) => pattern.test(`${method} ${request.path}`))) {
			throw new SpotifyAccessError('blocked_endpoint', route);
		}
		const limit = request.query?.limit;
		const maximum = limitMaximum(request.path);
		if (typeof limit === 'number' && limit > maximum) {
			throw new SpotifyRequestError(
				`limit ${limit} is above the maximum ${maximum} for ${route}`,
				400
			);
		}

		await this.options.guard.check();
		const url = buildUrl(request.path, request.query);
		let token = await auth.token();
		let refreshed = false;
		let waitedForRateLimit = false;
		let serverFailures = 0;

		for (;;) {
			await this.options.guard.acquire();
			const started = this.options.now();
			let res: Response;
			try {
				res = await this.options.fetch(url, {
					method,
					headers: {
						Authorization: `Bearer ${token}`,
						...(request.body === undefined ? {} : { 'Content-Type': 'application/json' })
					},
					body: request.body === undefined ? undefined : JSON.stringify(request.body),
					signal: AbortSignal.timeout(this.options.requestTimeoutMs ?? 10_000)
				});
			} catch (error) {
				serverFailures += 1;
				this.log(`${route} network error (attempt ${serverFailures})`);
				if (serverFailures > MAX_SERVER_RETRIES) {
					throw new SpotifyError(`Spotify request failed: ${route}`, undefined, { cause: error });
				}
				await this.options.sleep(backoffMs(serverFailures));
				continue;
			}
			this.log(`${route} ${res.status} ${this.options.now() - started}ms`);

			if (res.ok) {
				const text = await res.text();
				return request.schema.parse(text ? JSON.parse(text) : undefined);
			}

			if (res.status === 401) {
				if (refreshed) throw new SpotifyAuthError(route);
				refreshed = true;
				token = await auth.refresh();
				continue;
			}

			if (res.status === 429) {
				// Never retry a quota error: retries drain the shared quota and extend the lockout.
				const quota = (await res.text()).includes('QUOTA_EXCEEDED');
				const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
				const shortWait = (retryAfter ?? SHORT_RETRY_AFTER_SECONDS) <= SHORT_RETRY_AFTER_SECONDS;
				if (!quota && !waitedForRateLimit && shortWait) {
					waitedForRateLimit = true;
					await this.options.sleep((retryAfter ?? SHORT_RETRY_AFTER_SECONDS) * 1000);
					continue;
				}
				const blockMs =
					retryAfter !== null
						? retryAfter * 1000
						: quota
							? QUOTA_BLOCK_MS
							: SECOND_RATE_LIMIT_BLOCK_MS;
				const until = this.options.now() + blockMs;
				const reason = quota ? 'quota' : 'rate_limit';
				await this.options.guard.openCircuit(until, reason);
				throw new SpotifyUnavailableError(until, reason);
			}

			if (res.status >= 500) {
				serverFailures += 1;
				if (serverFailures > MAX_SERVER_RETRIES) {
					throw new SpotifyError(`Spotify returned ${res.status} for ${route}`, res.status);
				}
				await this.options.sleep(backoffMs(serverFailures));
				continue;
			}

			const message = await errorMessage(res);
			if (res.status === 403) throw new SpotifyAccessError(classifyForbidden(message), route);
			if (res.status === 404) throw new SpotifyNotFoundError(route);
			throw new SpotifyRequestError(
				`Spotify returned ${res.status} for ${route}: ${message}`,
				res.status
			);
		}
	}

	private log(line: string): void {
		this.options.log?.(`[spotify] ${line}`);
	}
}

/** A token source for one fixed access token, for example right after the code exchange. */
export function fixedToken(token: string): TokenSource {
	return {
		token: async () => token,
		refresh: async () => {
			throw new SpotifyAuthError('a fixed access token');
		}
	};
}

function buildUrl(path: string, query: Query | undefined): string {
	const url = new URL(`${API_URL}${path}`);
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== undefined) url.searchParams.set(key, String(value));
	}
	return url.toString();
}

function parseRetryAfter(value: string | null): number | null {
	if (value === null || value.trim() === '') return null;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

function backoffMs(attempt: number): number {
	return 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

async function errorMessage(res: Response): Promise<string> {
	const text = await res.text();
	try {
		const body = JSON.parse(text) as { error?: { message?: unknown } };
		if (typeof body.error?.message === 'string') return body.error.message;
	} catch {
		// Not JSON: use the raw text.
	}
	return text.slice(0, 200);
}

// Messages reported by developers (research notes, community_reported_behavior.md).
function classifyForbidden(message: string): AccessProblem {
	const text = message.toLowerCase();
	if (text.includes('not be registered') || text.includes('not registered'))
		return 'not_allowlisted';
	if (text.includes('premium')) return 'owner_premium';
	return 'forbidden';
}
