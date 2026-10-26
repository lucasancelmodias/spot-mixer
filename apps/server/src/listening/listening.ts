import type { TrackSummary } from '@spot-mixer/shared';
import { cached } from '../cache/cached';
import { userCacheKey } from '../cache/keys';
import type { KV } from '../cache/kv';
import { toTrackSummaries } from '../catalog/mappers';
import type { CallBudget } from '../spotify/budget';
import type { SpotifyClient, TokenSource } from '../spotify/client';
import { pageOf, trackSchema } from '../spotify/schemas';

const RANGES = ['short_term', 'medium_term', 'long_term'] as const;
/** 100 tracks per time range. Paging past 50 works for this app (docs/spike-results.md). */
const PAGES_PER_RANGE = 2;
const PAGE_SIZE = 50;
const TOP_TTL_SECONDS = 60 * 60;

/**
 * The user's own listening data (plan §7.1). Every key starts with the user cache prefix, so
 * logout deletes it at once.
 */
export class Listening {
	constructor(private readonly deps: { spotify: SpotifyClient; kv: KV }) {}

	/** Top tracks: the last 4 weeks first, then about 6 months, then about 1 year, each track once. */
	async topTracks(uid: string, token: TokenSource, budget?: CallBudget): Promise<TrackSummary[]> {
		const all: TrackSummary[] = [];
		for (const range of RANGES) {
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
			all.push(...(tracks ?? []));
		}
		const seen = new Set<string>();
		return all.filter((track) => {
			if (seen.has(track.id)) return false;
			seen.add(track.id);
			return true;
		});
	}

	/** The user's top tracks by one artist, in the order of `topTracks`. */
	async favorites(
		uid: string,
		token: TokenSource,
		artistId: string,
		budget?: CallBudget
	): Promise<TrackSummary[]> {
		const tracks = await this.topTracks(uid, token, budget);
		return tracks.filter((track) => track.artists.some((artist) => artist.id === artistId));
	}
}
