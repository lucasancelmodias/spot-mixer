import type { SaveMixRequest, SaveMixResponse } from '@spot-mixer/shared';
import { z } from 'zod';
import type { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';
import { SpotifyAccessError, SpotifyNotFoundError } from '../spotify/errors';

const ITEMS_PER_CALL = 100;

/** Spotify created the playlist, but did not add all the tracks. */
export class PartialSaveError extends Error {
	constructor(
		readonly playlistUrl: string,
		readonly added: number,
		options?: ErrorOptions
	) {
		super(`The playlist was created, but only ${added} tracks were added`, options);
		this.name = 'PartialSaveError';
	}
}

/** The playlist is gone, or the user can no longer change it. */
export class PlaylistGoneError extends Error {
	constructor(
		readonly playlistId: string,
		options?: ErrorOptions
	) {
		super(`Spotify refused changes to playlist ${playlistId}`, options);
		this.name = 'PlaylistGoneError';
	}
}

const createdSchema = z.object({
	id: z.string(),
	external_urls: z.object({ spotify: z.string().optional() }).optional()
});
const snapshotSchema = z.object({ snapshot_id: z.string().optional() });

export type SavedPlaylist = Omit<SaveMixResponse, 'remembered'>;

/**
 * Creates a private playlist and adds the tracks in order, 100 per call (plan §4.4).
 * `POST /me/playlists` makes a public playlist unless `public: false` is sent.
 */
export async function saveMix(
	spotify: SpotifyClient,
	token: TokenSource,
	request: SaveMixRequest,
	budget?: CallBudget
): Promise<SavedPlaylist> {
	const playlist = await spotify.request(token, {
		method: 'POST',
		path: '/me/playlists',
		body: {
			name: request.name,
			public: false,
			...(request.description ? { description: request.description } : {})
		},
		schema: createdSchema,
		budget
	});
	const url = playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`;
	let added = 0;
	try {
		for (let start = 0; start < request.trackUris.length; start += ITEMS_PER_CALL) {
			const uris = request.trackUris.slice(start, start + ITEMS_PER_CALL);
			await addItems(spotify, token, playlist.id, uris, budget);
			added += uris.length;
		}
	} catch (error) {
		throw new PartialSaveError(url, added, { cause: error });
	}
	return { playlistId: playlist.id, url, added };
}

/**
 * Replaces all tracks of an existing playlist (plan D5, "refresh mix"): `PUT` with the first 100,
 * then `POST` for the rest, in order. Throws PlaylistGoneError when Spotify refuses the first
 * change, and PartialSaveError when a later batch fails.
 */
export async function replaceTracks(
	spotify: SpotifyClient,
	token: TokenSource,
	playlist: { id: string; url: string },
	trackUris: string[],
	budget?: CallBudget
): Promise<number> {
	try {
		await spotify.request(token, {
			method: 'PUT',
			path: `/playlists/${playlist.id}/items`,
			body: { uris: trackUris.slice(0, ITEMS_PER_CALL) },
			schema: snapshotSchema,
			budget
		});
	} catch (error) {
		const gone =
			error instanceof SpotifyNotFoundError ||
			(error instanceof SpotifyAccessError && error.problem === 'forbidden');
		if (gone) throw new PlaylistGoneError(playlist.id, { cause: error });
		throw error;
	}
	let added = Math.min(ITEMS_PER_CALL, trackUris.length);
	try {
		for (let start = ITEMS_PER_CALL; start < trackUris.length; start += ITEMS_PER_CALL) {
			const uris = trackUris.slice(start, start + ITEMS_PER_CALL);
			await addItems(spotify, token, playlist.id, uris, budget);
			added += uris.length;
		}
	} catch (error) {
		throw new PartialSaveError(playlist.url, added, { cause: error });
	}
	return added;
}

async function addItems(
	spotify: SpotifyClient,
	token: TokenSource,
	playlistId: string,
	uris: string[],
	budget?: CallBudget
): Promise<void> {
	await spotify.request(token, {
		method: 'POST',
		path: `/playlists/${playlistId}/items`,
		body: { uris },
		schema: snapshotSchema,
		budget
	});
}
