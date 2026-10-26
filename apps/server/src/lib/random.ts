/** A URL-safe random string. 32 bytes give 43 characters. */
export function randomToken(bytes = 32): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

/** Matches the output of `randomToken()` with the default size. */
export const RANDOM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
