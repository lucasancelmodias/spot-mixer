import type { FetchLike } from '../../src/lib/http';
import { SpotifyUnavailableError, type UnavailableReason } from '../../src/spotify/errors';
import type { BlockedState, SpotifyGuard } from '../../src/spotify/guard';

export type FetchCall = { url: URL; init: RequestInit | undefined };

export type FetchHandler = (
	url: URL,
	init: RequestInit | undefined,
	call: number
) => Response | Promise<Response>;

/** A fetch that answers with `handler` and records every call. */
export function fakeFetch(handler: FetchHandler) {
	const calls: FetchCall[] = [];
	const fetch: FetchLike = async (input, init) => {
		const url = new URL(input);
		calls.push({ url, init });
		return handler(url, init, calls.length);
	};
	return { fetch, calls };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	});
}

export function spotifyError(status: number, message: string, extra: object = {}): Response {
	return json({ error: { status, message, ...extra } }, status);
}

/** Form fields of a token request. */
export function formOf(init: RequestInit | undefined): URLSearchParams {
	return new URLSearchParams(String(init?.body ?? ''));
}

export function headerOf(init: RequestInit | undefined, name: string): string | null {
	return new Headers(init?.headers).get(name);
}

/** A guard that allows every call and records the circuit openings. */
export class FakeGuard implements SpotifyGuard {
	blocked: BlockedState | null = null;
	acquired = 0;
	readonly opened: BlockedState[] = [];

	async check(): Promise<void> {
		if (this.blocked) throw new SpotifyUnavailableError(this.blocked.until, this.blocked.reason);
	}

	async acquire(): Promise<void> {
		this.acquired += 1;
	}

	async openCircuit(until: number, reason: UnavailableReason): Promise<void> {
		this.opened.push({ until, reason });
		this.blocked = { until, reason };
	}

	async blockedUntil(): Promise<BlockedState | null> {
		return this.blocked;
	}
}

/** A fixed key for tests. Real keys come from TOKEN_ENC_KEY. */
export const TEST_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
