export const OAUTH_STATE_COOKIE = 'oauth_state';

export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** With HTTPS, the `__Host-` prefix binds the cookie to this host, Path=/ and Secure. */
export function sessionCookieName(secure: boolean): string {
	return secure ? '__Host-sid' : 'sid';
}
