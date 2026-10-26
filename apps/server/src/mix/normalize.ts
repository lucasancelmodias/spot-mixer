// Words that mark a version of a song or a guest credit, not a different song (plan §6.2).
const VERSION_WORDS =
	/\b(remaster(ed)?|live|version|edit|mono|stereo|deluxe|anniversary|bonus|demo|remix|mix|acoustic|instrumental|radio|single|explicit|clean|feat\.?|ft\.?|with)\b/i;

/** A key to compare song titles across releases and services. */
export function normalizeTitle(title: string): string {
	let text = title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
	// Bracketed parts that name a version or a guest: "(Remastered 2011)", "[feat. X]".
	text = text.replace(/[([{][^)\]}]*[)\]}]/g, (part) => (VERSION_WORDS.test(part) ? ' ' : part));
	// Dash suffixes that name a version: "Song - Radio Edit".
	text = text.replace(/\s[-–—]\s.*$/u, (part) => (VERSION_WORDS.test(part) ? ' ' : part));
	// Guest credits outside brackets: "Song feat. X".
	text = text.replace(/\s(feat\.?|ft\.?)\s.*$/u, ' ');
	return text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
