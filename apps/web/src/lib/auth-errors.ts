import type { AuthErrorCode } from '@spot-mixer/shared';

const MESSAGES: Record<AuthErrorCode, string> = {
	access_denied: 'You cancelled the Spotify login.',
	authorization_failed: 'Spotify did not complete the login. Try again.',
	state_mismatch: 'The login expired or did not match this browser. Try again.',
	token_exchange_failed: 'Spotify did not accept the login. Try again.',
	not_allowlisted:
		'Your Spotify account is not on the user list of this app. Ask the app owner to add the email of your Spotify account in the Spotify Developer Dashboard.',
	owner_premium:
		'The Spotify Premium subscription of the app owner is not active. The app cannot use Spotify until it is active again.',
	forbidden: 'Spotify refused the login for this app.',
	spotify_unavailable: 'Spotify is not available for this app right now. Try again later.'
};

/** The message for the `auth_error` code in the URL, or null when there is no code. */
export function authErrorMessage(code: string | null): string | null {
	if (!code) return null;
	return (MESSAGES as Record<string, string>)[code] ?? 'The Spotify login failed. Try again.';
}
