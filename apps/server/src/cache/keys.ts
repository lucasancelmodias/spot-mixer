// Redis key names (plan §10). Every key that holds user data starts with the user cache prefix,
// so that logout can delete all of it at once.

export function userCachePrefix(uid: string): string {
	return `c:u:${uid}:`;
}

export function userCacheKey(uid: string, name: string): string {
	return `${userCachePrefix(uid)}${name}`;
}

export function oauthStateKey(state: string): string {
	return `oauth:${state}`;
}

export function sessionKey(sid: string): string {
	return `sess:${sid}`;
}

export const APP_TOKEN_KEY = 'sp:apptoken';
