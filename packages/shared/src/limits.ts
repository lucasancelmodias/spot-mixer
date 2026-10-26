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

/** Spotify's time ranges for top items: about 4 weeks, 6 months and 1 year. */
export const TIME_RANGES = ['short_term', 'medium_term', 'long_term'] as const;

/** My Mix: the user's own tracks of an artist, or the artist's popular tracks (plan §7.3). */
export const MIX_POOLS = ['familiar', 'discovery'] as const;

/** The longest My Mix ranking. */
export const MAX_RANKED_ARTISTS = 50;
