// Plain constants without zod, so that the web app can import them without bundling zod.
// Import path: @spot-mixer/shared/limits

export const MIN_MIX_ARTISTS = 2;
export const MAX_MIX_ARTISTS = 12;
export const MAX_SOURCE_COUNT = 30;
export const MAX_ALBUMS_PER_SOURCE = 20;
export const MAX_MIX_TRACKS = 500;

export const EXCLUDE_OPTIONS = [
	'explicit',
	'live',
	'remix',
	'acoustic',
	'instrumental',
	'demo'
] as const;

export const ORDER_OPTIONS = [
	'balanced-shuffle',
	'round-robin',
	'grouped',
	'chronological'
] as const;
