import { ApiError } from './api';
import { authErrorMessage } from './auth-errors';

/** A message for the user. It says what happened and what to do. */
export function describeError(error: unknown): string {
	if (!(error instanceof ApiError)) {
		return 'The app could not reach its server. Make sure that it runs, then try again.';
	}
	switch (error.code) {
		case 'unauthenticated':
		case 'session_expired':
			return 'Your Spotify session ended. Sign in again.';
		case 'spotify_unavailable': {
			const until = typeof error.body.until === 'string' ? new Date(error.body.until) : null;
			const time = until
				? until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				: 'later';
			return `Spotify calls are paused until ${time}, to protect the request quota of this app.`;
		}
		case 'too_many_calls':
			return 'This mix needs too many Spotify requests at once. Try again: the next try uses the cache. Or use fewer artists or albums.';
		case 'save_incomplete':
			return `Spotify created the playlist, but added only ${Number(error.body.added ?? 0)} tracks.`;
		case 'invalid_request': {
			const issues = Array.isArray(error.body.issues) ? error.body.issues.join('; ') : '';
			return `The mix settings are not valid. ${issues}`.trim();
		}
		case 'playlist_gone':
			return 'Spotify no longer lets this app change that playlist, so the app forgot the saved mix.';
		case 'empty_mix':
			return 'The recipe gave no tracks this time, so the playlist did not change. Check the filters.';
		case 'not_found':
			return 'The app does not know this saved mix any more. It may have expired.';
		case 'not_allowlisted':
		case 'owner_premium':
			return authErrorMessage(error.code) ?? 'Spotify refused the request.';
		default:
			return `The request failed (HTTP ${error.status}, ${error.code}). Try again.`;
	}
}
