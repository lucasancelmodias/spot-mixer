import type { AlbumSummary, ArtistSummary, TrackSummary } from '@spot-mixer/shared';
import { z } from 'zod';
import { cached, readCached, writeCached } from '../cache/cached';
import type { KV } from '../cache/kv';
import { sameSong } from '../mix/songs';
import type { CallBudget } from '../spotify/budget';
import type { Capabilities, Capability } from '../spotify/capabilities';
import type { SpotifyClient, SpotifyRequest, TokenSource } from '../spotify/client';
import { SpotifyAccessError, SpotifyNotFoundError, SpotifyRequestError } from '../spotify/errors';
import {
	albumRefSchema,
	albumSchema,
	artistSchema,
	lenientArray,
	pageOf,
	type SpotifyAlbum,
	trackSchema
} from '../spotify/schemas';
import { toAlbumSummary, toArtistSummary, toTrackSummaries, toTrackSummary } from './mappers';

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const LARGE_PAGE = 50;
const SMALL_PAGE = 10;
const MAX_RELEASE_PAGES = 5;
const MAX_RELEASES = 200;
const ALBUMS_PER_BATCH = 20;

/** Search results to rank for "popular" tracks: one page of 50, or three pages of 10. */
function searchResultsFor(pageSize: number): number {
	return pageSize === LARGE_PAGE ? 50 : 30;
}

export type AlbumWithTracks = { album: AlbumSummary; tracks: TrackSummary[] };

export type CatalogDeps = {
	spotify: SpotifyClient;
	appToken: TokenSource;
	kv: KV;
	caps: Capabilities;
	market: string;
};

/**
 * Catalog reads with the app token, cached in Redis (plan §5.3). Each read uses the capabilities
 * that this app still has, and falls back when Spotify refuses one (plan D2).
 */
export class Catalog {
	constructor(private readonly deps: CatalogDeps) {}

	async searchArtists(query: string, budget?: CallBudget): Promise<ArtistSummary[]> {
		const key = `c:sp:search:artist:${this.deps.market}:${query.trim().toLowerCase()}`;
		const artists = await cached(this.deps.kv, key, { ttlSeconds: 6 * HOUR_SECONDS }, async () => {
			const data = await this.get({
				path: '/search',
				query: { q: query, type: 'artist', limit: SMALL_PAGE, market: this.deps.market },
				schema: z.object({ artists: pageOf(artistSchema) }),
				budget
			});
			return data.artists.items.map(toArtistSummary);
		});
		return artists ?? [];
	}

	/** Null when Spotify does not know the artist. */
	getArtist(id: string, budget?: CallBudget): Promise<ArtistSummary | null> {
		return cached(this.deps.kv, `c:sp:artist:${id}`, { ttlSeconds: DAY_SECONDS }, async () => {
			try {
				return toArtistSummary(
					await this.get({ path: `/artists/${id}`, schema: artistSchema, budget })
				);
			} catch (error) {
				if (error instanceof SpotifyNotFoundError) return null;
				throw error;
			}
		});
	}

	/** Albums first, then singles, each newest first. At most MAX_RELEASES. */
	async artistReleases(id: string, budget?: CallBudget): Promise<AlbumSummary[]> {
		const key = `c:sp:artist-albums:${id}:${this.deps.market}`;
		const releases = await cached(this.deps.kv, key, { ttlSeconds: DAY_SECONDS }, async () => {
			const found: AlbumSummary[] = [];
			let offset = 0;
			for (let page = 0; page < MAX_RELEASE_PAGES && found.length < MAX_RELEASES; page += 1) {
				const { data, limit } = await this.withPageSize((size) =>
					this.get({
						path: `/artists/${id}/albums`,
						query: {
							include_groups: 'album,single',
							limit: size,
							offset,
							market: this.deps.market
						},
						schema: pageOf(albumRefSchema),
						budget
					})
				);
				found.push(...data.items.map(toAlbumSummary));
				if (!data.next || data.items.length < limit) break;
				offset += limit;
			}
			return found.slice(0, MAX_RELEASES).sort(byTypeThenNewest);
		});
		return releases ?? [];
	}

	/**
	 * The albums with their tracks (the first 50 tracks of each album), in the order of `ids`.
	 * Uses batch reads while this app has them, else one call per album.
	 */
	async albumsWithTracks(ids: string[], budget?: CallBudget): Promise<AlbumWithTracks[]> {
		const found = new Map<string, AlbumWithTracks>();
		const missing: string[] = [];
		for (const id of ids) {
			const hit = await readCached<AlbumWithTracks>(this.deps.kv, this.albumKey(id));
			if (hit) found.set(id, hit);
			else missing.push(id);
		}
		for (const album of await this.fetchAlbums(missing, budget)) {
			const entry = toAlbumWithTracks(album);
			found.set(album.id, entry);
			await writeCached(this.deps.kv, this.albumKey(album.id), entry, DAY_SECONDS);
		}
		return ids.flatMap((id) => found.get(id) ?? []);
	}

	/**
	 * Popular tracks of an artist, most popular first (plan §5.5, D2):
	 * 1. Artist's Top Tracks (up to 10, ranked by Spotify) while this app has it.
	 * 2. For more tracks, or without Top Tracks: Search by artist name, filtered by artist ID,
	 *    ranked by `popularity` while Spotify sends it, else in Spotify's order.
	 */
	async popularTracks(
		artistId: string,
		count: number,
		budget?: CallBudget
	): Promise<TrackSummary[]> {
		const tracks: TrackSummary[] = [];
		if (await this.deps.caps.has('topTracks')) {
			try {
				tracks.push(...(await this.topTracks(artistId, budget)));
			} catch (error) {
				if (!isEndpointRefusal(error)) throw error;
				await this.deps.caps.lose('topTracks', describe(error));
			}
		}
		if (tracks.length < count) {
			const artist = await this.getArtist(artistId, budget);
			if (artist) {
				for (const track of await this.searchedTracks(artist, budget)) {
					if (!tracks.some((known) => sameSong(known, track))) tracks.push(track);
				}
			}
		}
		return tracks.slice(0, count);
	}

	private async topTracks(artistId: string, budget?: CallBudget): Promise<TrackSummary[]> {
		const key = `c:pop:top:${artistId}:${this.deps.market}`;
		const tracks = await cached(this.deps.kv, key, { ttlSeconds: DAY_SECONDS }, async () => {
			const data = await this.get({
				path: `/artists/${artistId}/top-tracks`,
				query: { market: this.deps.market },
				schema: z.object({ tracks: lenientArray(trackSchema) }),
				budget
			});
			return toTrackSummaries(data.tracks);
		});
		return tracks ?? [];
	}

	private async searchedTracks(
		artist: ArtistSummary,
		budget?: CallBudget
	): Promise<TrackSummary[]> {
		const key = `c:pop:search:${artist.id}:${this.deps.market}`;
		const tracks = await cached(this.deps.kv, key, { ttlSeconds: DAY_SECONDS }, async () => {
			const query = `artist:"${artist.name.replaceAll('"', '')}"`;
			const found: TrackSummary[] = [];
			let offset = 0;
			for (;;) {
				const { data, limit } = await this.withPageSize((size) =>
					this.get({
						path: '/search',
						query: { q: query, type: 'track', limit: size, offset, market: this.deps.market },
						schema: z.object({ tracks: pageOf(trackSchema) }),
						budget
					})
				);
				found.push(...toTrackSummaries(data.tracks.items));
				offset += limit;
				if (!data.tracks.next || offset >= searchResultsFor(limit)) break;
			}
			return rankByPopularity(
				found.filter((track) => track.artists.some((a) => a.id === artist.id))
			);
		});
		return tracks ?? [];
	}

	private async fetchAlbums(ids: string[], budget?: CallBudget): Promise<SpotifyAlbum[]> {
		if (ids.length === 0) return [];
		if (await this.deps.caps.has('batchReads')) {
			try {
				const albums: SpotifyAlbum[] = [];
				for (let start = 0; start < ids.length; start += ALBUMS_PER_BATCH) {
					const data = await this.get({
						path: '/albums',
						query: {
							ids: ids.slice(start, start + ALBUMS_PER_BATCH).join(','),
							market: this.deps.market
						},
						schema: z.object({ albums: lenientArray(albumSchema) }),
						budget
					});
					albums.push(...data.albums);
				}
				return albums;
			} catch (error) {
				if (!isEndpointRefusal(error)) throw error;
				await this.deps.caps.lose('batchReads', describe(error));
			}
		}
		const albums: SpotifyAlbum[] = [];
		for (const id of ids) {
			try {
				albums.push(
					await this.get({
						path: `/albums/${id}`,
						query: { market: this.deps.market },
						schema: albumSchema,
						budget
					})
				);
			} catch (error) {
				if (!(error instanceof SpotifyNotFoundError)) throw error;
			}
		}
		return albums;
	}

	/** Runs a list request with pages of 50 while this app has them, else with pages of 10. */
	private async withPageSize<T>(
		run: (limit: number) => Promise<T>
	): Promise<{ data: T; limit: number }> {
		const capability: Capability = 'pageSize50';
		if (await this.deps.caps.has(capability)) {
			try {
				return { data: await run(LARGE_PAGE), limit: LARGE_PAGE };
			} catch (error) {
				if (!isInvalidLimit(error)) throw error;
				await this.deps.caps.lose(capability, describe(error));
			}
		}
		return { data: await run(SMALL_PAGE), limit: SMALL_PAGE };
	}

	private albumKey(id: string): string {
		return `c:sp:album:${id}:${this.deps.market}`;
	}

	private get<T>(request: SpotifyRequest<T>): Promise<T> {
		return this.deps.spotify.request(this.deps.appToken, request);
	}
}

function toAlbumWithTracks(album: SpotifyAlbum): AlbumWithTracks {
	const summary = toAlbumSummary(album);
	return {
		album: summary,
		tracks: album.tracks.items.map((track) => toTrackSummary(track, summary))
	};
}

/** Most popular first while every track has `popularity`; else Spotify's order. The sort is stable. */
function rankByPopularity(tracks: TrackSummary[]): TrackSummary[] {
	if (!tracks.every((track) => track.popularity !== null)) return tracks;
	return [...tracks].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

function byTypeThenNewest(a: AlbumSummary, b: AlbumSummary): number {
	const order = (album: AlbumSummary) => (album.albumType === 'album' ? 0 : 1);
	return order(a) - order(b) || b.releaseDate.localeCompare(a.releaseDate);
}

/** Spotify removed the endpoint for this app: 404, or a plain 403 (not an account problem). */
function isEndpointRefusal(error: unknown): boolean {
	return (
		error instanceof SpotifyNotFoundError ||
		(error instanceof SpotifyAccessError && error.problem === 'forbidden')
	);
}

function isInvalidLimit(error: unknown): boolean {
	return (
		error instanceof SpotifyRequestError && error.status === 400 && /limit/i.test(error.message)
	);
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
