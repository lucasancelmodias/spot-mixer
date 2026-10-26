import type { SaveMixRequest, SaveMixResponse } from '@spot-mixer/shared';
import { z } from 'zod';
import type { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';

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

const createdSchema = z.object({
	id: z.string(),
	external_urls: z.object({ spotify: z.string().optional() }).optional()
});
const snapshotSchema = z.object({ snapshot_id: z.string().optional() });

/**
 * Creates a private playlist and adds the tracks in order, 100 per call (plan §4.4).
 * `POST /me/playlists` makes a public playlist unless `public: false` is sent.
 */
export async function saveMix(
	spotify: SpotifyClient,
	token: TokenSource,
	request: SaveMixRequest,
	budget?: CallBudget
): Promise<SaveMixResponse> {
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
			await spotify.request(token, {
				method: 'POST',
				path: `/playlists/${playlist.id}/items`,
				body: { uris },
				schema: snapshotSchema,
				budget
			});
			added += uris.length;
		}
	} catch (error) {
		throw new PartialSaveError(url, added, { cause: error });
	}
	return { playlistId: playlist.id, url, added };
}
