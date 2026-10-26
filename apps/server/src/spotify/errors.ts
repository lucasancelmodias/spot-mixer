// Error messages name routes and error codes. They never contain tokens or secrets.

export class SpotifyError extends Error {
	constructor(
		message: string,
		readonly status?: number,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = new.target.name;
	}
}

export type UnavailableReason = 'quota' | 'rate_limit' | 'local_limit';

/** The shared circuit breaker is open, or the shared limiter had no free slot in time. */
export class SpotifyUnavailableError extends SpotifyError {
	constructor(
		readonly until: number,
		readonly reason: UnavailableReason
	) {
		super(`Spotify calls are paused until ${new Date(until).toISOString()} (${reason})`, 503);
	}
}

export type AccessProblem = 'not_allowlisted' | 'owner_premium' | 'forbidden' | 'blocked_endpoint';

export class SpotifyAccessError extends SpotifyError {
	constructor(
		readonly problem: AccessProblem,
		readonly route: string
	) {
		super(`Spotify refused ${route}: ${problem}`, 403);
	}
}

export class SpotifyNotFoundError extends SpotifyError {
	constructor(readonly route: string) {
		super(`Spotify returned 404 for ${route}`, 404);
	}
}

/** Spotify rejected the access token, also after one refresh. */
export class SpotifyAuthError extends SpotifyError {
	constructor(readonly route: string) {
		super(`Spotify rejected the access token for ${route}`, 401);
	}
}

/** The request is not valid: a limit above the maximum, or another 4xx answer from Spotify. */
export class SpotifyRequestError extends SpotifyError {}

/** The refresh token expired or was revoked (`400 invalid_grant`). The user must sign in again. */
export class InvalidGrantError extends SpotifyError {
	constructor() {
		super('The Spotify refresh token is no longer valid (invalid_grant)', 400);
	}
}
