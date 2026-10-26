import { z } from 'zod';

/** Body of every API error response. */
export const apiErrorSchema = z.object({
	error: z.string(),
	/** ISO time, for `spotify_unavailable`. */
	until: z.string().optional()
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** Codes in `/?auth_error=<code>` after a failed login. */
export const AUTH_ERROR_CODES = [
	'access_denied',
	'authorization_failed',
	'state_mismatch',
	'token_exchange_failed',
	'not_allowlisted',
	'owner_premium',
	'forbidden',
	'spotify_unavailable'
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
