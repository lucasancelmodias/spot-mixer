/** 3:07 */
export function formatDuration(ms: number): string {
	const seconds = Math.round(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** 47 min, or 2 h 05 min */
export function formatTotal(ms: number): string {
	const minutes = Math.round(ms / 60_000);
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** The default playlist name, for example "spot-mixer: Daft Punk × Justice". At most 100 characters. */
export function mixName(artistNames: string[]): string {
	const name = `spot-mixer: ${artistNames.join(' × ')}`;
	return name.length <= 100 ? name : `${name.slice(0, 99)}…`;
}

/** The year of a Spotify release date (YYYY, YYYY-MM or YYYY-MM-DD). */
export function releaseYear(date: string): string {
	return date.slice(0, 4);
}
