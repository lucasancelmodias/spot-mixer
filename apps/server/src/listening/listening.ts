import {
	type ArtistSummary,
	TIME_RANGES,
	type TimeRange,
	type TrackSummary
} from '@spot-mixer/shared';
import { z } from 'zod';
import { cached } from '../cache/cached';
import { userCacheKey } from '../cache/keys';
import type { KV } from '../cache/kv';
import { toArtistSummary, toTrackSummaries } from '../catalog/mappers';
import type { ListeningSignals } from '../mix/ranking';
import type { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';
import { artistSchema, lenientArray, pageOf, trackSchema } from '../spotify/schemas';

/** 100 tracks per time range. Paging past 50 works for this app (docs/spike-results.md). */
const PAGES_PER_RANGE = 2;
const PAGE_SIZE = 50;
/** 200 followed artists and 500 saved tracks at most (plan §7.1). */
const FOLLOWED_PAGES = 4;
const SAVED_PAGES = 10;
const MINUTE_SECONDS = 60;
const TOP_TTL_SECONDS = 60 * MINUTE_SECONDS;
const RECENT_TTL_SECONDS = 15 * MINUTE_SECONDS;
const LIBRARY_TTL_SECONDS = 6 * 60 * MINUTE_SECONDS;

const followingSchema = z.object({
	artists: pageOf(artistSchema).extend({
		cursors: z.object({ after: z.string().nullable().optional() }).nullable().optional()
	})
});
const playedSchema = z.object({ items: lenientArray(z.object({ track: trackSchema })) });

/**
 * The user's own listening data (plan §7.1). Every key starts with the user cache prefix, so
 * logout deletes it at once.
 */
export class Listening {
	constructor(private readonly deps: { spotify: SpotifyClient; kv: KV }) {}

	/** All signals of the My Mix ranking: at most 24 Spotify calls with a cold cache. */
	async signals(uid: string, token: TokenSource, budget?: CallBudget): Promise<ListeningSignals> {
		// At most 4 loaders at a time (plan §5.4). Recent plays need 1 call, so they come last.
		const [topArtists, topTracks, savedTracks, followedArtists] = await Promise.all([
			this.topArtistsByRange(uid, token, budget),
			this.topTracksByRange(uid, token, budget),
			this.savedTracks(uid, token, budget),
			this.followedArtists(uid, token, budget)
		]);
		const recentPlays = await this.recentPlays(uid, token, budget);
		return { topArtists, topTracks, savedTracks, recentPlays, followedArtists };
	}

	/** The user's top artists of each time range, 50 each, in Spotify's order. */
	async topArtistsByRange(
		uid: string,
		token: TokenSource,
		budget?: CallBudget
	): Promise<Record<TimeRange, ArtistSummary[]>> {
		return byRange(async (range) => {
			const key = userCacheKey(uid, `top:artists:${range}`);
			const artists = await cached(this.deps.kv, key, { ttlSeconds: TOP_TTL_SECONDS }, async () => {
				const data = await this.deps.spotify.request(token, {
					path: '/me/top/artists',
					query: { time_range: range, limit: PAGE_SIZE },
					schema: pageOf(artistSchema),
					budget
				});
				return data.items.map(toArtistSummary);
			});
			return artists ?? [];
		});
	}

	/** The user's top tracks of each time range, 100 each, in Spotify's order. */
	async topTracksByRange(
		uid: string,
		token: TokenSource,
		budget?: CallBudget
	): Promise<Record<TimeRange, TrackSummary[]>> {
		return byRange(async (range) => {
			const key = userCacheKey(uid, `top:tracks:${range}`);
			const tracks = await cached(this.deps.kv, key, { ttlSeconds: TOP_TTL_SECONDS }, async () => {
				const found: TrackSummary[] = [];
				for (let page = 0; page < PAGES_PER_RANGE; page += 1) {
					const data = await this.deps.spotify.request(token, {
						path: '/me/top/tracks',
						query: { time_range: range, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
						schema: pageOf(trackSchema),
						budget
					});
					found.push(...toTrackSummaries(data.items));
					if (!data.next || data.items.length < PAGE_SIZE) break;
				}
				return found;
			});
			return tracks ?? [];
		});
	}

	/** Top tracks: the last 4 weeks first, then about 6 months, then about 1 year, each track once. */
	async topTracks(uid: string, token: TokenSource, budget?: CallBudget): Promise<TrackSummary[]> {
		const ranges = await this.topTracksByRange(uid, token, budget);
		return uniqueTracks(TIME_RANGES.flatMap((range) => ranges[range]));
	}

	/** The user's top tracks by one artist, in the order of `topTracks`. */
	async favorites(
		uid: string,
		token: TokenSource,
		artistId: string,
		budget?: CallBudget
	): Promise<TrackSummary[]> {
		const tracks = await this.topTracks(uid, token, budget);
		return tracks.filter(byArtist(artistId));
	}

	/**
	 * The familiar pool of My Mix (plan §7.3): the user's top tracks by the artist in their order,
	 * then the user's saved tracks by the artist, the last saved first.
	 */
	async familiar(
		uid: string,
		token: TokenSource,
		artistId: string,
		budget?: CallBudget
	): Promise<TrackSummary[]> {
		const top = await this.favorites(uid, token, artistId, budget);
		const saved = await this.savedTracks(uid, token, budget);
		return uniqueTracks([...top, ...saved.filter(byArtist(artistId))]);
	}

	/** The last 50 plays, the newest first. */
	async recentPlays(uid: string, token: TokenSource, budget?: CallBudget): Promise<TrackSummary[]> {
		const key = userCacheKey(uid, 'recent');
		const tracks = await cached(this.deps.kv, key, { ttlSeconds: RECENT_TTL_SECONDS }, async () => {
			const data = await this.deps.spotify.request(token, {
				path: '/me/player/recently-played',
				query: { limit: PAGE_SIZE },
				schema: playedSchema,
				budget
			});
			return toTrackSummaries(data.items.map((item) => item.track));
		});
		return tracks ?? [];
	}

	/** The artists that the user follows, at most 200. */
	async followedArtists(
		uid: string,
		token: TokenSource,
		budget?: CallBudget
	): Promise<ArtistSummary[]> {
		const key = userCacheKey(uid, 'followed');
		const artists = await cached(
			this.deps.kv,
			key,
			{ ttlSeconds: LIBRARY_TTL_SECONDS },
			async () => {
				const found: ArtistSummary[] = [];
				let after: string | undefined;
				for (let page = 0; page < FOLLOWED_PAGES; page += 1) {
					const { artists } = await this.deps.spotify.request(token, {
						path: '/me/following',
						query: { type: 'artist', limit: PAGE_SIZE, after },
						schema: followingSchema,
						budget
					});
					found.push(...artists.items.map(toArtistSummary));
					after = artists.cursors?.after ?? undefined;
					if (!artists.next || !after || artists.items.length < PAGE_SIZE) break;
				}
				return found;
			}
		);
		return artists ?? [];
	}

	/** The user's saved tracks, the last saved first, at most 500. */
	async savedTracks(uid: string, token: TokenSource, budget?: CallBudget): Promise<TrackSummary[]> {
		const key = userCacheKey(uid, 'saved');
		const tracks = await cached(
			this.deps.kv,
			key,
			{ ttlSeconds: LIBRARY_TTL_SECONDS },
			async () => {
				const found: TrackSummary[] = [];
				for (let page = 0; page < SAVED_PAGES; page += 1) {
					const data = await this.deps.spotify.request(token, {
						path: '/me/tracks',
						query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
						schema: pageOf(z.object({ track: trackSchema })),
						budget
					});
					found.push(...toTrackSummaries(data.items.map((item) => item.track)));
					if (!data.next || data.items.length < PAGE_SIZE) break;
				}
				return found;
			}
		);
		return tracks ?? [];
	}
}

/** Loads the time ranges one after the other, so that one signal makes one call at a time. */
async function byRange<T>(load: (range: TimeRange) => Promise<T>): Promise<Record<TimeRange, T>> {
	const result = {} as Record<TimeRange, T>;
	for (const range of TIME_RANGES) result[range] = await load(range);
	return result;
}

function byArtist(artistId: string) {
	return (track: TrackSummary) => track.artists.some((artist) => artist.id === artistId);
}

function uniqueTracks(tracks: TrackSummary[]): TrackSummary[] {
	const seen = new Set<string>();
	return tracks.filter((track) => {
		if (seen.has(track.id)) return false;
		seen.add(track.id);
		return true;
	});
}
