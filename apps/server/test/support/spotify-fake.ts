import { MVP_SCOPES } from '../../src/spotify/oauth';
import { type FetchHandler, formOf, json, spotifyError } from './fakes';

/** A 22-character Spotify ID made from a label. */
export function sid(label: string): string {
	return `${label.replace(/[^A-Za-z0-9]/g, '')}${'0'.repeat(22)}`.slice(0, 22);
}

export type FakeArtist = { id: string; name: string };

export function fakeArtist(name: string): FakeArtist {
	return { id: sid(name), name };
}

export function rawAlbumRef(artist: FakeArtist, n: number, albumType = 'album') {
	return {
		id: sid(`${artist.name}A${n}`),
		name: `${artist.name} Album ${n}`,
		album_type: albumType,
		release_date: `${2000 + n}-01-01`,
		total_tracks: 4,
		images: [{ url: `https://i.scdn.co/${artist.name}${n}`, width: 300, height: 300 }]
	};
}

/** A full track object. Popularity falls with `n`, so track 1 is the most popular. */
export function rawTrack(artist: FakeArtist, n: number, extra: Record<string, unknown> = {}) {
	const id = sid(`${artist.name}T${n}`);
	return {
		id,
		uri: `spotify:track:${id}`,
		name: `${artist.name} Song ${n}`,
		duration_ms: 180_000,
		explicit: false,
		is_playable: true,
		popularity: 100 - n,
		disc_number: 1,
		track_number: n,
		external_ids: { isrc: `ISRC${artist.name}${n}` },
		artists: [{ id: artist.id, name: artist.name }],
		album: rawAlbumRef(artist, 1),
		...extra
	};
}

/** An album with `count` simplified tracks (no album field). */
export function rawAlbum(artist: FakeArtist, n: number, count = 4) {
	return {
		...rawAlbumRef(artist, n),
		tracks: {
			items: Array.from({ length: count }, (_, i) => {
				const { album: _album, ...track } = rawTrack(artist, n * 100 + i + 1, {
					track_number: i + 1
				});
				return track;
			}),
			next: null
		}
	};
}

export type SpotifyFakeOptions = {
	artists: FakeArtist[];
	/** Default: 10 tracks, ranked 1 to 10. */
	topTracks?: (artist: FakeArtist) => Response;
	/** Default: 20 tracks of the artist in the query, plus 1 track of another artist. */
	search?: (url: URL) => Response;
	/** Default: the albums of `rawAlbum`. */
	batchAlbums?: (ids: string[]) => Response;
	playlistItems?: (call: number) => Response;
	userTopTracks?: (range: string, offset: number) => Response;
};

/** A fake Spotify for route and catalog tests: accounts, catalog, user and playlist endpoints. */
export function spotifyFake(options: SpotifyFakeOptions): FetchHandler {
	const byId = new Map(options.artists.map((artist) => [artist.id, artist]));
	const albumOwner = new Map<string, { artist: FakeArtist; n: number }>();
	for (const artist of options.artists) {
		for (let n = 1; n <= 3; n += 1) albumOwner.set(sid(`${artist.name}A${n}`), { artist, n });
	}
	let itemCalls = 0;

	return (url, init) => {
		const path = url.pathname;
		if (url.href === 'https://accounts.spotify.com/api/token') {
			const grant = formOf(init).get('grant_type');
			if (grant === 'client_credentials') {
				return json({ access_token: 'app-token', token_type: 'Bearer', expires_in: 3600 });
			}
			if (grant === 'refresh_token') {
				return json({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600 });
			}
			return json({
				access_token: 'at-1',
				token_type: 'Bearer',
				expires_in: 3600,
				refresh_token: 'rt-1',
				scope: MVP_SCOPES.join(' ')
			});
		}
		if (path === '/v1/me')
			return json({ id: 'user1', display_name: 'User One', account_id: 'acc-1' });

		const artistRoute = /^\/v1\/artists\/([^/]+)(\/top-tracks|\/albums)?$/.exec(path);
		if (artistRoute) {
			const artist = byId.get(artistRoute[1] ?? '');
			if (!artist) return spotifyError(404, 'Resource not found');
			if (artistRoute[2] === '/top-tracks') {
				return (
					options.topTracks?.(artist) ??
					json({ tracks: Array.from({ length: 10 }, (_, i) => rawTrack(artist, i + 1)) })
				);
			}
			if (artistRoute[2] === '/albums') {
				return json({
					items: [rawAlbumRef(artist, 1), rawAlbumRef(artist, 2, 'single'), rawAlbumRef(artist, 3)],
					next: null
				});
			}
			return json({ ...artist, genres: ['test'], followers: { total: 1000 }, images: [] });
		}

		if (path === '/v1/albums') {
			const ids = (url.searchParams.get('ids') ?? '').split(',');
			if (options.batchAlbums) return options.batchAlbums(ids);
			return json({
				albums: ids.map((id) => {
					const owner = albumOwner.get(id);
					return owner ? rawAlbum(owner.artist, owner.n) : null;
				})
			});
		}
		const albumRoute = /^\/v1\/albums\/([^/]+)$/.exec(path);
		if (albumRoute) {
			const owner = albumOwner.get(albumRoute[1] ?? '');
			return owner
				? json(rawAlbum(owner.artist, owner.n))
				: spotifyError(404, 'Resource not found');
		}

		if (path === '/v1/search' && url.searchParams.get('type') === 'artist') {
			const query = (url.searchParams.get('q') ?? '').toLowerCase();
			const items = options.artists
				.filter((artist) => artist.name.toLowerCase().includes(query))
				.map((artist) => ({ ...artist, images: [], genres: [], followers: { total: 1 } }));
			return json({ artists: { items, next: null } });
		}
		if (path === '/v1/search') {
			if (options.search) return options.search(url);
			const query = url.searchParams.get('q') ?? '';
			const artist = options.artists.find((a) => query.includes(a.name));
			const other = fakeArtist('Somebody Else');
			const items = artist ? Array.from({ length: 20 }, (_, i) => rawTrack(artist, i + 1)) : [];
			return json({ tracks: { items: [...items, rawTrack(other, 1)], next: null } });
		}

		if (path === '/v1/me/top/tracks') {
			const range = url.searchParams.get('time_range') ?? '';
			const offset = Number(url.searchParams.get('offset') ?? 0);
			if (options.userTopTracks) return options.userTopTracks(range, offset);
			return json({ items: [], next: null });
		}

		if (path === '/v1/me/playlists' && init?.method === 'POST') {
			return json(
				{
					id: 'playlist1',
					external_urls: { spotify: 'https://open.spotify.com/playlist/playlist1' }
				},
				201
			);
		}
		if (/^\/v1\/playlists\/[^/]+\/items$/.test(path)) {
			itemCalls += 1;
			return (
				options.playlistItems?.(itemCalls) ?? json({ snapshot_id: `snapshot${itemCalls}` }, 201)
			);
		}

		return spotifyError(404, `unexpected call to ${path}`);
	};
}
