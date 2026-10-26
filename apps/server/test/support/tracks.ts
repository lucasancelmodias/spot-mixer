import type { Candidate } from '../../src/mix/types';

/** A candidate for engine tests. `artist` is the source artist and the primary artist. */
export function candidate(artist: string, n: number, extra: Partial<Candidate> = {}): Candidate {
	return {
		id: `${artist}-${n}`,
		uri: `spotify:track:${artist}-${n}`,
		name: `${artist} song ${n}`,
		durationMs: 200_000,
		explicit: false,
		isPlayable: true,
		popularity: 50,
		isrc: null,
		discNumber: 1,
		trackNumber: n,
		artists: [{ id: artist, name: artist }],
		album: {
			id: `${artist}-album`,
			name: `${artist} album`,
			albumType: 'album',
			releaseDate: '2020-01-01',
			imageUrl: null
		},
		sourceArtistId: artist,
		rank: n,
		...extra
	};
}

/** `count` candidates of one artist, ranked 0 to count - 1. */
export function candidates(artist: string, count: number): Candidate[] {
	return Array.from({ length: count }, (_, n) => candidate(artist, n));
}
