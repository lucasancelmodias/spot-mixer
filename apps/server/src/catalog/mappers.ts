import type { AlbumSummary, ArtistSummary, TrackSummary } from '@spot-mixer/shared';
import {
	pickImage,
	type SpotifyAlbumRef,
	type SpotifyArtist,
	type SpotifyTrack
} from '../spotify/schemas';

// Spotify objects to the app's own summaries. Fields that Spotify removed become null.

const CARD_IMAGE_WIDTH = 160;

export function toArtistSummary(artist: SpotifyArtist): ArtistSummary {
	return {
		id: artist.id,
		name: artist.name,
		imageUrl: pickImage(artist.images, CARD_IMAGE_WIDTH),
		genres: artist.genres ?? [],
		followers: artist.followers?.total ?? null
	};
}

export function toAlbumSummary(album: SpotifyAlbumRef): AlbumSummary {
	return {
		id: album.id,
		name: album.name,
		albumType: album.album_type ?? 'album',
		releaseDate: album.release_date ?? '',
		totalTracks: album.total_tracks ?? null,
		imageUrl: pickImage(album.images, CARD_IMAGE_WIDTH)
	};
}

/** `album` is the track's own album, or the parent album for the simplified tracks of an album. */
export function toTrackSummary(track: SpotifyTrack, album: AlbumSummary): TrackSummary {
	return {
		id: track.id,
		uri: track.uri,
		name: track.name,
		durationMs: track.duration_ms,
		explicit: track.explicit ?? false,
		isPlayable: track.is_playable ?? null,
		popularity: track.popularity ?? null,
		isrc: track.external_ids?.isrc ?? null,
		discNumber: track.disc_number ?? null,
		trackNumber: track.track_number ?? null,
		artists: track.artists.map(({ id, name }) => ({ id, name })),
		album: {
			id: album.id,
			name: album.name,
			albumType: album.albumType,
			releaseDate: album.releaseDate,
			imageUrl: album.imageUrl
		}
	};
}

/** Maps tracks that carry their own album (search results, top tracks). */
export function toTrackSummaries(tracks: SpotifyTrack[]): TrackSummary[] {
	return tracks.flatMap((track) =>
		track.album ? [toTrackSummary(track, toAlbumSummary(track.album))] : []
	);
}
