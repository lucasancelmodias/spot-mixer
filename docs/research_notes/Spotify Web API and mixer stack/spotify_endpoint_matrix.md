# Spotify Web API endpoint matrix for spot-mixer (new Development Mode app, state as of 2026-10-25)

Scope: a new app, created after 2026-02-11, in Development Mode, owned by one developer. Differences for Extended Quota (EQ) apps are given only where an official source states them. All paths are relative to `https://api.spotify.com/v1`.

Confidence labels used in every table and finding:
- **V-ref**: verified on the official endpoint reference page (developer.spotify.com/documentation/web-api/reference/*).
- **V-log**: verified in an official changelog, migration guide or Spotify developer blog post.
- **Inf**: inferred from official sources (reasoning is given).
- **Comm**: reported only by community or third-party sources. Items marked "(search summary)" come from search-result summaries; the thread body was not opened or could not be loaded.

Source note: page content was read through a fetch tool that summarizes pages. Quotes in this file are the quotes that the tool returned.

## 1. Catalog: Search, Artists, Albums, Tracks

### Takeaway
Search and the single-item GETs (artist, artist's albums, album, album tracks, track) still work for a new Development Mode app. The batch "Get Several" endpoints and Get Artist's Top Tracks are removed. Search and Get Artist's Albums now cap `limit` at 10 (default 5), so every listing needs more requests.

### Cited Findings

**Catalog endpoint matrix**

| Endpoint | Status for new dev-mode app | Token | Scopes | Paging: default/max `limit`; offset | Key fields; removed or deprecated fields | Replacement | Confidence | Source |
|---|---|---|---|---|---|---|---|---|
| Search: `GET /search` | Available. Limit reduced in Feb 2026 | App token (Client Credentials) or user token (Inf, see CC rule below) | None required. Scopes page associates `user-read-private` with Search | `limit` default 5, range 0–10 (was default 20, max 50). `offset` default 0, range 0–1000 | One paging object per requested type (`tracks`, `artists`, `albums`, ...) with `href, limit, next, offset, previous, total, items`. Deprecated in nested objects: track `available_markets, linked_from, popularity, preview_url`; artist `followers, genres, popularity`; album `available_markets`; playlist `tracks` (use `items`) | n/a. Paginate with `offset` for more than 10 results | V-ref + V-log | [Search ref](https://developer.spotify.com/documentation/web-api/reference/search); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Get Artist: `GET /artists/{id}` | Available | App or user token (Inf) | None | n/a | `external_urls, href, id, images, name, type, uri`. Deprecated: `followers` (`href` always null), `genres`, `popularity`. Removed for dev mode: `followers`, `popularity` | n/a | V-ref + V-log | [Get Artist ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artist); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get Several Artists: `GET /artists?ids=` | **Removed** (Feb 2026) | — | — | — | — | `GET /artists/{id}` once per ID | V-log | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get Artist's Top Tracks: `GET /artists/{id}/top-tracks` | **Removed** (Feb 2026). Reference page labeled "Deprecated". OpenAPI marks it `deprecated: true` | — | — | `market`: ISO 3166-1 alpha-2. A user token's account country takes priority. With neither, content is "unavailable for the client". Page does not state how many tracks it returns | Response was a `tracks` array of full track objects | None listed | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Top Tracks ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-top-tracks); [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml) |
| Get Artist's Albums: `GET /artists/{id}/albums` | Available. **Limit reduced to 10** (not announced in any 2026 changelog) | App or user token (Inf) | None | `include_groups`: `album, single, appears_on, compilation` (omit = all types). `limit` default 5, max 10 (page also shows "range 0–10" against a stated minimum of 1). `offset` default 0, no documented max | Simplified album: `album_type, total_tracks, release_date, release_date_precision, images, artists, restrictions, external_urls, href, id, name, type, uri`. Deprecated: `album_group`, `available_markets`. `popularity`, `label`, `external_ids` are not in this schema | n/a | V-ref (limit also in official OpenAPI spec) | [Artist's Albums ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums); [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml) |
| Get Album: `GET /albums/{id}` | Available | App or user token (Inf) | None | `market` only. Embedded `tracks` is a paging object | `album_type, total_tracks, release_date, release_date_precision, images, artists, tracks, copyrights, external_ids {isrc, ean, upc}, restrictions`. Deprecated: `available_markets`, `genres` ("always an empty array"), `label`, `popularity`. Removed for dev mode: `album_group, available_markets, label, popularity`. `external_ids` kept (March 2026 revert) | n/a | V-ref + V-log | [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Mar 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026) |
| Get Several Albums: `GET /albums?ids=` | **Removed** (Feb 2026) | — | — | — | — | `GET /albums/{id}` once per ID | V-log | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Get Album Tracks: `GET /albums/{id}/tracks` | Available | App or user token (Inf) | None | `limit` default 20, max 50. `offset` default 0, no documented max | Simplified track: `artists, disc_number, duration_ms, explicit, external_urls, href, id, is_playable, restrictions, name, track_number, type, uri, is_local`. Deprecated: `available_markets, linked_from, preview_url`. No `external_ids` in the simplified track | n/a | V-ref | [Album Tracks ref](https://developer.spotify.com/documentation/web-api/reference/get-an-albums-tracks) |
| Get Track: `GET /tracks/{id}` | Available | App or user token (Inf) | None | `market` only | `album` (simplified), `artists, disc_number, duration_ms, explicit, external_ids {isrc, ean, upc}, external_urls, href, id, is_playable, restrictions, name, track_number, type, uri, is_local`. Deprecated: `available_markets, linked_from, popularity, preview_url` | n/a | V-ref + V-log | [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get Several Tracks: `GET /tracks?ids=` (max 50 IDs; page labeled "Deprecated") | **Removed** (Feb 2026) | — | — | — | — | `GET /tracks/{id}` once per ID | V-log + V-ref | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Several Tracks ref](https://developer.spotify.com/documentation/web-api/reference/get-several-tracks) |

**Search details**
- `type` allowed values: `album, artist, playlist, track, show, episode, audiobook` (comma-separated) — [Search ref](https://developer.spotify.com/documentation/web-api/reference/search)
- Field filters in `q` and the item types they apply to (example `remaster track:Doxy artist:Miles Davis`) — [Search ref](https://developer.spotify.com/documentation/web-api/reference/search):
  - `artist:` albums, artists, tracks
  - `year:` albums, artists, tracks; a single year or a range such as `1955-1960`
  - `album:` albums, tracks
  - `genre:` artists, tracks
  - `track:` tracks
  - `isrc:` tracks
  - `upc:` albums only
  - `tag:new` albums only; albums released in the past two weeks
  - `tag:hipster` albums only; albums in the lowest 10% by popularity
- `include_external=audio` is the only allowed value. It marks externally hosted audio as playable — [Search ref](https://developer.spotify.com/documentation/web-api/reference/search)
- The migration guide says: maximum `limit` reduced from 50 to 10, default from 20 to 5, "To get more than 10 results, paginate with `offset`" — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- The Search page carries a policy note that Spotify content may not be used to train ML or AI models, and that preview clips cannot be a standalone service — [Search ref](https://developer.spotify.com/documentation/web-api/reference/search)

**Token and market rules**
- Client Credentials rule: "Since this flow does not include authorization, only endpoints that do not access user information can be accessed." — [Client Credentials flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
- The `market` rule on Search, Get Track, Get Album, Get Album Tracks and Get Artist's Albums: a valid user token's account country takes priority over `market`. If neither is given, "the content is considered unavailable for the client" — [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track); [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album)
- `is_playable` description: "If `true`, the track is playable in the given market." — [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track)

**Unannounced Artist's Albums limit change**
- No 2026 changelog page (February, March, May, July) lists a change to Get Artist's Albums. The February page lists only the Search limit change — [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Jul 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- A community thread titled "Unannounced endpoint request limit change" reports 400 errors on `artists/{id}/albums` after the limit change. A reply suggests it happened in February without a changelog entry (Comm, search summary; thread body did not load) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Unannounced-endpoint-request-limit-change/td-p/7476680)
- The official TypeScript SDK comment on top tracks says "market is flagged as optional in the docs, but it's actually required for this endpoint" — [SDK ArtistsEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/ArtistsEndpoints.ts)

### Inferences
- **Feature (a) gap.** No Development Mode endpoint returns an artist's most-played tracks. Top Tracks is removed and track `popularity` is removed. The app must use another signal. Options: albums that the user selects (Artist's Albums, then Album Tracks), Search with `artist:"Name"` and `type=track` (ranking is undocumented), or the user's own top tracks filtered by artist. This is a product decision for the plan.
- With a Client Credentials token, always send `market`. Otherwise tracks can come back as unavailable. With a user token, omit `market`: the API uses the account country. This matters because `GET /me` no longer returns `country`.
- Request counts go up. Search returns at most 10 items per type per call. An artist with 120 releases needs 12 Artist's Albums calls. Batch removal means N IDs need N calls. Cache artist, album and track objects in Redis by ID.
- The reference pages now appear to show Development Mode values (Search 10, Artist's Albums 10). The migration guide says EQ apps keep old behavior, so EQ apps probably keep Search max 50 (Inf from [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)).
- `tag:hipster` depends on popularity. It is still documented, but dev-mode apps cannot see the popularity values behind it.

### Gaps
- The current Top Tracks page does not state how many tracks it returned. No official source for a count was found.
- The sort order of Get Artist's Albums is not documented.
- No maximum `offset` is documented for Artist's Albums or Album Tracks.
- No source says whether EQ apps keep a max `limit` of 50 on Artist's Albums.
- Search ranking is not documented. No source confirms that `artist:` track results approximate "most played".
- The page size of the `tracks` object embedded in Get Album was not verified.

## 2. Discovery features: Related Artists, Recommendations, Genre Seeds, Audio Features, Audio Analysis, Featured Playlists, Category Playlists, New Releases, Markets

### Takeaway
None of these features is available to a new Development Mode app. The 2024-11-27 change blocked Related Artists, Recommendations, Audio Features, Audio Analysis, Featured Playlists, Category's Playlists, multi-get preview URLs and Spotify-owned or algorithmic playlists. The February 2026 change removed New Releases, Browse Categories and Markets for Development Mode. Each reference page now carries a "Deprecated" label.

### Cited Findings

**Discovery endpoint matrix**

| Endpoint | Status for new dev-mode app | Since | Notes | Confidence | Source |
|---|---|---|---|---|---|
| Get Artist's Related Artists: `GET /artists/{id}/related-artists` | **Restricted** (no access) | 2024-11-27 | Page labeled "Deprecated". OpenAPI `deprecated: true`. Error code: see community notes below | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Related Artists ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-related-artists); [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml) |
| Get Recommendations: `GET /recommendations` | **Restricted** | 2024-11-27 | Page labeled "Deprecated". `limit` default 20, max 100. Up to 5 seeds in total across artists, tracks and genres. Error code: see community notes below | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Recommendations ref](https://developer.spotify.com/documentation/web-api/reference/get-recommendations) |
| Get Available Genre Seeds: `GET /recommendations/available-genre-seeds` | Treat as **restricted** | — | Page labeled "Deprecated". Response `{"genres": [...]}`. The blog does not name it. It exists only to feed Recommendations | V-ref (label); status Inf | [Genre Seeds ref](https://developer.spotify.com/documentation/web-api/reference/get-recommendation-genres) |
| Get Track's Audio Features: `GET /audio-features/{id}` | **Restricted** | 2024-11-27 | Page labeled "Deprecated". Error code: see community notes below | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Audio Features ref](https://developer.spotify.com/documentation/web-api/reference/get-audio-features) |
| Get Several Audio Features: `GET /audio-features?ids=` (max 100 IDs) | **Restricted** | 2024-11-27 | Page labeled "Deprecated" | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Several Audio Features ref](https://developer.spotify.com/documentation/web-api/reference/get-several-audio-features) |
| Get Track's Audio Analysis: `GET /audio-analysis/{id}` | **Restricted** | 2024-11-27 | Page labeled "Deprecated". Error code: see community notes below | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Audio Analysis ref](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis) |
| Get Featured Playlists: `GET /browse/featured-playlists` | **Restricted** | 2024-11-27 | Page labeled "Deprecated". OpenAPI `deprecated: true` | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Featured Playlists ref](https://developer.spotify.com/documentation/web-api/reference/get-featured-playlists) |
| Get Category's Playlists: `GET /browse/categories/{category_id}/playlists` | **Restricted** | 2024-11-27 | Page labeled "Deprecated" | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Category Playlists ref](https://developer.spotify.com/documentation/web-api/reference/get-a-categories-playlists) |
| Get Several Browse Categories: `GET /browse/categories`; Get Single Browse Category: `GET /browse/categories/{id}` | **Removed** | Feb 2026 | No replacement listed | V-log | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get New Releases: `GET /browse/new-releases` | **Removed** | Feb 2026 | Page labeled "Deprecated". Page still documents `limit` default 20, max 50. No replacement listed | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [New Releases ref](https://developer.spotify.com/documentation/web-api/reference/get-new-releases) |
| Get Available Markets: `GET /markets` | **Removed** | Feb 2026 | Page labeled "Deprecated". Response was `{"markets": ["CA","BR",...]}`. No replacement | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Markets ref](https://developer.spotify.com/documentation/web-api/reference/get-available-markets) |
| 30-second preview URLs in multi-get responses (`SimpleTrack`) | **Restricted** | 2024-11-27 | `preview_url` is now marked "Deprecated" on all track objects in the reference | V-log + V-ref | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Algorithmic and Spotify-owned editorial playlists | **Restricted** | 2024-11-27 | See section 4 | V-log | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) |

**Who the 2024-11-27 change affects**
- Affected: new apps registered on or after 2024-11-27, and existing Development Mode apps without a pending extension request — [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Not affected: apps with existing extended mode Web API access that already rely on these endpoints; they "remain unaffected by this change" — [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- A community moderator answer states that apps with a quota extension request pending before 2024-11-27 kept access (Comm, search summary) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Deprecated-API-endpoints-returns-404-with-valid-token/m-p/6614027/highlight/true)

**Community notes on error codes for restricted endpoints** (Comm; search summaries only; thread bodies did not load, so the per-endpoint mapping below is not confirmed)
- Thread title "Deprecated API endpoints returns 404 with valid token". The search summary attributes to community posts a 404 with an empty body on Recommendations, a 403 on Audio Analysis, and 404s on Related Artists with valid IDs — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Deprecated-API-endpoints-returns-404-with-valid-token/td-p/6614027)
- Thread title "403 Forbidden on v1/audio-features using both user and client [tokens]" — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-v1-audio-features-using-both-user-and-client/m-p/7200198)
- Thread title "Web API Get Track's Audio Features 403 error" — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/m-p/6778841/highlight/true)

### Inferences
- spot-mixer cannot get artist similarity, audio features, tempo or key, editorial content or genre seeds in Development Mode. The "curated mix" must use the user's own data (section 3) plus catalog lookups.
- A later EQ approval would probably not restore the 2024 endpoints. The blog exempts only apps that "already rely on" them (Inf from [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)).
- Restricted endpoints return 403 or 404 in community reports. The client should treat both codes on these paths as "feature unavailable", not as a missing resource (Inf from Comm reports).

### Gaps
- Spotify does not document which HTTP status a restricted or removed endpoint returns.
- No official source states the status of Get Available Genre Seeds for new apps. The restriction is inferred.

## 3. User data: profile, top items, recently played, followed artists, saved tracks and albums, current user's playlists

### Takeaway
All user-data read endpoints that spot-mixer needs are still available with a user token. `GET /me` lost `country`, `email`, `explicit_content`, `followers` and `product`, and gained `account_id` (May 2026). Saved-item reads stay on `/me/tracks` and `/me/albums`. Only writes and "contains" checks moved to `/me/library`.

### Cited Findings

**User-data endpoint matrix** (all need a user token)

| Endpoint | Status for new dev-mode app | Scopes | Paging: default/max `limit`; offset or cursor | Key fields; removed or deprecated fields | Replacement | Confidence | Source |
|---|---|---|---|---|---|---|---|
| Get Current User's Profile: `GET /me` | Available. Fields reduced | `user-read-private` (for `country`, `explicit_content`, `product`); `user-read-email` (for `email`) | n/a | Returned: `account_id`, `display_name`, `external_urls`, `href`, `id`, `images`, `type`, `uri`. Deprecated on the page and removed for dev mode: `country`, `email`, `explicit_content`, `followers`, `product` | n/a | V-ref + V-log | [Profile ref](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [May 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/may-2026) |
| Get User's Top Items: `GET /me/top/{type}` (`artists` or `tracks`) | Available | `user-top-read` | `limit` default 20, max 50. `offset` default 0, no documented max. `time_range` default `medium_term` | Artist objects: `followers, genres, popularity` deprecated. Track objects: `available_markets, linked_from, popularity, preview_url` deprecated. `external_ids` not deprecated | n/a | V-ref | [Top Items ref](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks) |
| Get Recently Played Tracks: `GET /me/player/recently-played` | Available | `user-read-recently-played` | `limit` default 20, max 50. Cursors `after` and `before` are Unix ms timestamps and cannot be combined | `items[]`: `track`, `played_at`, `context {type, href, external_urls, uri}`. Top level: `href, limit, next, cursors {after, before}, total`. "Currently doesn't support podcast episodes" | n/a | V-ref | [Recently Played ref](https://developer.spotify.com/documentation/web-api/reference/get-recently-played) |
| Get Followed Artists: `GET /me/following?type=artist` | Available (read only) | `user-follow-read` | Cursor: `after` = last artist ID from the previous page. `limit` default 20, max 50 | `artists {href, limit, next, cursors {after, before}, total, items}`. Artist `followers, genres, popularity` deprecated | Follow/unfollow (`PUT/DELETE /me/following`) moved to `PUT/DELETE /me/library`. Contains check moved to `GET /me/library/contains` | V-ref + V-log | [Followed Artists ref](https://developer.spotify.com/documentation/web-api/reference/get-followed); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Get User's Saved Tracks: `GET /me/tracks` | Available. No deprecation banner | `user-library-read` | `limit` default 20, max 50. `offset` default 0, no documented max | `items[]`: `added_at`, `track`. Track `available_markets, linked_from, popularity, preview_url` deprecated | Save/remove (`PUT/DELETE /me/tracks`) moved to `PUT/DELETE /me/library` | V-ref + V-log | [Saved Tracks ref](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get User's Saved Albums: `GET /me/albums` | Available. No deprecation banner | `user-library-read` | `limit` default 20, range 0–50. `offset` default 0, no documented max | `items[]`: `added_at`, `album`. Album `available_markets, genres` ("always empty"), `label, popularity` deprecated | Save/remove moved to `PUT/DELETE /me/library` | V-ref + V-log | [Saved Albums ref](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-albums); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Library writes and checks: `PUT /me/library`, `DELETE /me/library`, `GET /me/library/contains` | **Added** Feb 2026. Take Spotify URIs, so one call can cover several content types | Not verified on the pages (pages not opened) | — | — | Replace all entity-specific save, remove, follow, unfollow and contains endpoints | V-log | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Get Current User's Playlists: `GET /me/playlists` | Available | `playlist-read-private` (page). The scopes page also lists `playlist-read-collaborative` | `limit` default 20, max 50. `offset` default 0, "Maximum offset: 100.000" | Simplified playlist: `items {href, total}`. `tracks {href, total}` is deprecated ("Use `items` instead") | n/a | V-ref | [My Playlists ref](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists); [Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes) |
| Get User's Profile (other user): `GET /users/{id}` | **Removed** (Feb 2026) | — | — | — | `GET /me` (current user only) | V-log | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Get User's Playlists (other user): `GET /users/{id}/playlists` | **Removed** (Feb 2026) | — | — | — | `GET /me/playlists` (current user only) | V-log | [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |

**Top Items `time_range` (current documented meaning)**
- `long_term`: "calculated from ~1 year of data and including all new data as it becomes available" — [Top Items ref](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)
- `medium_term` (default): "approximately last 6 months" — [Top Items ref](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)
- `short_term`: "approximately last 4 weeks" — [Top Items ref](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

**`account_id`**
- Added in May 2026: "A public, immutable, pseudoanonymous identifier for the user's account." Spotify recommends `account_id` instead of `id` to link accounts, because it stays stable for the life of the account — [May 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/may-2026); [Profile ref](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile)

**Community reports on depth and offsets**
- Top Items: developers report that `offset` of 50 or more returns no items, and that about 99 items is the practical maximum (limit 50 at offsets 0 and 49). A community helper quoted an older reference line: "For each time range, the top 50 tracks and artists are available for each user" (Comm, search summary) — [Community thread 1](https://community.spotify.com/t5/Spotify-for-Developers/Bug-when-using-offset-greater-than-49-when-pulling-top-tracks/m-p/5581179/highlight/true); [Community thread 2](https://community.spotify.com/t5/Spotify-for-Developers/Bug-with-offset-for-method-quot-Get-User-s-Top-Artists-and/m-p/5589035/highlight/true)
- Recently Played: developers report that only the 50 most recent plays are reachable. A `before` cursor beyond those 50 returns empty pages (Comm, search summary) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/before-and-after-are-utterly-useless-with-me-player-recently/td-p/5520713); [Community thread 2](https://community.spotify.com/t5/Spotify-for-Developers/Now-that-users-can-view-their-recently-played-tracks-in-the-apps/m-p/5565883/highlight/true)

### Inferences
- Feature (b) "curated mix" can use: top artists and top tracks (3 time ranges, plan on 50 per range), recently played (up to 50), saved tracks, saved albums and followed artists. All are available.
- `user-read-private` and `user-read-email` now unlock no returned fields for a dev-mode app, because the fields they gate are removed. The app can probably drop both scopes (Inf from [Profile ref](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile) and [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); confirm against the OAuth research).
- Use `account_id` as the stable user key in Redis and sessions. Do not depend on `email`, `country` or `product`.
- Artist `genres` is deprecated, so genre-based grouping for the curated mix is unreliable.

### Gaps
- The maximum `offset` for Top Items is not documented. Community reports conflict with each other.
- The history depth of Recently Played is not documented officially.
- The scopes for `PUT/DELETE /me/library` and `GET /me/library/contains` were not verified (pages not opened; spot-mixer may not need them).

## 4. Playlists: create, add, update/replace/reorder, change details, cover image, get playlist, get items

### Takeaway
All playlist writes that spot-mixer needs work in Development Mode on the new paths: `POST /me/playlists` and `/playlists/{id}/items`. The old `POST /users/{user_id}/playlists` and `/playlists/{id}/tracks` paths are removed; a community report shows `/tracks` returning 403. Playlist contents are readable only for playlists that the user owns or collaborates on. Spotify-owned and algorithmic playlists are blocked.

### Cited Findings

**Playlist endpoint matrix** (all need a user token unless noted)

| Endpoint | Status for new dev-mode app | Scopes | Limits and parameters | Response; removed or renamed fields | Replaces | Confidence | Source |
|---|---|---|---|---|---|---|---|
| Create Playlist: `POST /me/playlists` | Available (new path) | `playlist-modify-public` or `playlist-modify-private`. A private playlist needs `playlist-modify-private`. A collaborative playlist needs `public: false` and both scopes | Body: `name` (required, need not be unique), `public` (default `true`), `collaborative` (default `false`), `description`. Users are generally limited to "11000 playlists" | 201. Playlist object with `items` (`tracks` deprecated). The playlist is empty until items are added | `POST /users/{user_id}/playlists` (removed Feb 2026) | V-ref + V-log | [Create Playlist ref](https://developer.spotify.com/documentation/web-api/reference/create-playlist); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Add Items to Playlist: `POST /playlists/{playlist_id}/items` | Available (new path) | `playlist-modify-public`, `playlist-modify-private` | `uris`: max 100 per request, in query or JSON body. The body `uris` is ignored if the query has `uris`. Long query lists can exceed URL length, so use the body. `position`: zero-based; omit to append; items keep list order | 201 with `snapshot_id` | `POST /playlists/{id}/tracks` (removed) | V-ref + V-log | [Add Items ref](https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Update Playlist Items (replace or reorder): `PUT /playlists/{playlist_id}/items` | Available (new path) | `playlist-modify-public`, `playlist-modify-private` | Replace: `uris` max 100; overwrites all items; can clear the playlist. Reorder: `range_start`, `insert_before`, `range_length` (default 1), optional `snapshot_id`. Replace and reorder cannot be combined in one request | 200 with `snapshot_id` | `PUT /playlists/{playlist_id}/tracks` (removed) | V-ref + V-log | [Update Items ref](https://developer.spotify.com/documentation/web-api/reference/reorder-or-replace-playlists-items); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Remove Playlist Items: `DELETE /playlists/{playlist_id}/items` | Available (new path) | `playlist-modify-public`, `playlist-modify-private` | Body: `items` (required) = array of `{ "uri": "spotify:track:..." }`; "A maximum of 100 objects can be sent at once". Optional `snapshot_id`. The old body parameter `tracks` is renamed `items` | 200 with `snapshot_id` | `DELETE /playlists/{id}/tracks` (removed) | V-ref + V-log | [Remove Items ref](https://developer.spotify.com/documentation/web-api/reference/remove-items-playlist); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Change Playlist Details: `PUT /playlists/{playlist_id}` | Available | `playlist-modify-public`, `playlist-modify-private`. User must own the playlist | Body (all optional): `name`; `public` (`true`, `false`, or `null` = not relevant); `collaborative` (`true` only on non-public playlists); `description` | 200, empty body | n/a | V-ref | [Change Details ref](https://developer.spotify.com/documentation/web-api/reference/change-playlist-details) |
| Add Custom Playlist Cover Image: `PUT /playlists/{playlist_id}/images` | Available | `ugc-image-upload` plus `playlist-modify-public` or `playlist-modify-private` | Body: "Base64 encoded JPEG image data". Content-Type `image/jpeg`. Maximum payload 256 KB | 202 ("Image uploaded") | n/a | V-ref | [Cover Image ref](https://developer.spotify.com/documentation/web-api/reference/upload-custom-playlist-cover) |
| Get Playlist: `GET /playlists/{playlist_id}` | Available. Contents limited | No scope listed on the page | `market`, `fields` (nested selection with parentheses, exclusion with `!`), `additional_types` (`track`, `episode`) | `collaborative, description, external_urls, href, id, images, name, owner, public, snapshot_id`. `items` is a paging object of `{added_at, added_by, is_local, item}`, "only available for playlists owned by the current user or playlists the user is a collaborator of". For other playlists only metadata is returned and `items` is absent. `tracks` and `track` are deprecated. Image URLs expire in less than a day | n/a | V-ref + V-log | [Get Playlist ref](https://developer.spotify.com/documentation/web-api/reference/get-playlist); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Get Playlist Items: `GET /playlists/{playlist_id}/items` | Available for owned or collaborative playlists only. Others get 403 | `playlist-read-private` | `limit` default 20, max 50. `offset` default 0, no documented max. `fields`, `market`, `additional_types` (the page says this parameter may be deprecated later) | `items[]`: `added_at` (may be null for very old playlists), `added_by`, `is_local`, `item` (track or episode; check `type`). `track` deprecated | `GET /playlists/{id}/tracks` (removed) | V-ref + V-log | [Playlist Items ref](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items); [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |

**Renamed playlist fields (Feb 2026)**
- `tracks` becomes `items`; `tracks.tracks` becomes `items.items`; `tracks.tracks.track` becomes `items.items.item` — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

**Observed behavior of the old paths**
- On 2026-03-06 a Development Mode app (owner on Premium, user allowlisted) got `403 {"error": {"status": 403, "message": "Forbidden"}}` from `GET /v1/playlists/{id}/tracks`. The same token got 200 from `GET /v1/playlists/{id}/items` (Comm) — [cliamp issue #54](https://github.com/bjarneo/cliamp/issues/54)

**Spotify-owned and algorithmic playlists**
- The 2024-11-27 change blocks "Algorithmic and Spotify-owned editorial playlists" for new apps and for Development Mode apps without a pending extension — [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- A community reply says a 404 on Get Playlist or Get Playlist Items for a Spotify-owned playlist is "the expected behavior for the non-extended quota mode clients". User-created playlists still work (Comm, search summary) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/API-playlists-id-returns-404s/td-p/6550685); [Spotipy FAQ](https://sources.debian.org/src/spotipy/2.26.0-1/FAQ.md)

### Inferences
- Request `playlist-modify-public`, `playlist-modify-private` and `ugc-image-upload` for the create, add and cover flow.
- To add more than 100 tracks, send batches of up to 100 URIs in the JSON body, in order. Keep the latest `snapshot_id`. To rebuild a mix, use one replace call (up to 100 URIs), then append the rest.
- Compress the cover JPEG so that the Base64 body is at most 256 KB. The page states a payload limit, and Base64 adds about one third to the raw size.
- spot-mixer cannot read the tracks of a public playlist that the user does not own or collaborate on. "Mix from someone else's playlist" is not possible in Development Mode.
- Do not cache playlist image URLs in Redis for more than a few hours, because they expire in less than a day.
- A Client Credentials token has no current user, so Get Playlist with that token probably returns metadata only (Inf; not documented).

### Gaps
- The behavior of Get Playlist with a Client Credentials token in Development Mode is not documented.
- No official source states the HTTP status for a blocked Spotify-owned playlist. Only community reports say 404.

## 5. Object fields still populated for Development Mode apps

### Takeaway
For Development Mode, Spotify removed track and album `popularity`, `available_markets`, track `linked_from`, album `album_group` and `label`, and artist `followers` and `popularity`. `external_ids` (ISRC, UPC) stayed after the March 2026 reversal. The reference pages label removed fields "Deprecated". Code must treat each of them as possibly absent or null.

### Cited Findings

**Field status table**

| Object.field | Status for dev-mode app | Reference marker | Confidence | Source |
|---|---|---|---|---|
| Track `popularity` | Removed (Feb 2026) | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Track `preview_url` | Restricted in multi-get responses since 2024-11-27. Community reports `null` broadly, including with Client Credentials | Deprecated; "Can be `null`" | V-log + V-ref; null behavior Comm | [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track); [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Issue-with-preview-url-Always-Returning-Null-for-Authenticated/td-p/6712864) (search summary); [Community thread 2](https://community.spotify.com/t5/Spotify-for-Developers/Missing-Preview-URL-using-Client-Credentials/m-p/6492694/highlight/true) (search summary) |
| Track `external_ids.isrc` | Kept. The Feb 2026 removal was reverted in March 2026 | Not deprecated (full track object only) | V-log + V-ref | [Mar 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026); [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Track `available_markets` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Track `is_playable` | Present | Not deprecated | V-ref | [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Track `linked_from` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Track `explicit` | Present | Not deprecated | V-ref | [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Track `duration_ms` | Present | Not deprecated | V-ref | [Get Track ref](https://developer.spotify.com/documentation/web-api/reference/get-track) |
| Artist `popularity` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Get Artist ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) |
| Artist `followers` | Removed | Deprecated; `href` always null | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Get Artist ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) |
| Artist `genres` | Not in the removed list, but marked Deprecated ("If not yet classified, the array is empty"). Population for dev mode is unconfirmed | Deprecated | V-ref (marker); population unknown | [Get Artist ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artist); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Artist `images` | Present | Not deprecated | V-ref | [Get Artist ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) |
| Album `album_type` | Present | Not deprecated | V-ref | [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| Album `album_group` | Removed (field on Artist's Albums results) | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Artist's Albums ref](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums) |
| Album `release_date` (+ `release_date_precision`) | Present | Not deprecated | V-ref | [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| Album `label` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| Album `popularity` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) |
| Album `external_ids.upc` | Kept (March 2026 reversal) | Not deprecated | V-log + V-ref | [Mar 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026); [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| Album `total_tracks` | Present | Not deprecated | V-ref | [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| Album `genres` | "Always an empty array" | Deprecated | V-ref | [Get Album ref](https://developer.spotify.com/documentation/web-api/reference/get-an-album) |
| User `country, email, explicit_content, followers, product` | Removed | Deprecated | V-log + V-ref | [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026); [Profile ref](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile) |
| User `account_id` | Added (May 2026) | Not deprecated | V-log + V-ref | [May 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/may-2026) |

- The migration guide tells apps to handle removed fields "being absent, for example by checking for undefined or null" — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- EQ apps keep all fields: "Existing endpoints, fields, and behaviors remain unchanged" — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- A March 2025 community thread reports Get Artist returning no genres, or fewer genres than before, with no cause found (Comm, search summary) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Get-Artist-API-is-not-returning-any-or-all-Genres/td-p/6880841)

### Inferences
- In TypeScript types, make every "Deprecated" field optional and nullable. In Development Mode, "Deprecated" in the reference means "removed" (Inf from comparing the reference pages with the [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)).
- Use `external_ids.isrc` to remove duplicate tracks across albums, singles and compilations in a mix. It is only on full track objects (Get Track, top tracks, saved tracks, playlist items), not on simplified tracks from Get Album Tracks.
- Without `available_markets`, use `is_playable` together with a user token (account country) or an explicit `market` to filter unplayable tracks.

### Gaps
- No official source says whether removed fields are omitted or sent as `null`. The guide says to handle both.
- No source confirms whether artist `genres` is still populated for dev-mode apps.

## 6. Official migration guide and changelogs (dates and tables)

### Takeaway
Yes. Spotify publishes "February 2026 Web API Dev Mode Changes – Migration Guide" and changelog pages for February, March, May and July 2026. As of 2026-10-25 the changelog navigation lists no later pages. The guide removes batch, browse, top-tracks, markets and other-user endpoints, renames playlist `/tracks` to `/items`, moves library writes to `/me/library`, cuts the Search limit, and removes many fields. EQ apps are not affected.

### Cited Findings

**Timeline**
- 2024-11-27: Related Artists, Recommendations, Audio Features, Audio Analysis, Featured Playlists, Category's Playlists, multi-get preview URLs and Spotify-owned or algorithmic playlists blocked for new apps — [Nov 2024 blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- 2026-02-06: Spotify announces the Development Mode changes. It says "API access will be limited to a smaller set of supported endpoints" — [Feb 2026 blog](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- 2026-02-11: new Development Mode apps get the new restrictions — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- 2026-03-09: the guide says existing Development Mode apps migrate. The blog has an update: "we have decided to postpone endpoint access changes for existing integrations". The two sources conflict on endpoint timing for existing apps. A new app gets the new rules either way — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Feb 2026 blog](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- March 2026 (no day given): `external_ids` on albums and tracks restored; it "will continue to be available" — [Mar 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)
- May 2026 (no day given): `account_id` added to the user profile — [May 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)
- July 2026 (no day given): Client IDs per developer go from 1 to 25. Development Mode quotas are now counted per developer account, not per Client ID, so all of a developer's dev-mode Client IDs share quota. A 429 for quota now has a body with `"status": 429`, `"message": "Too many requests"`, `"reason": "QUOTA_EXCEEDED"` — [Jul 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- Changelog navigation lists only July, May, March and February 2026 — [Jul 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026); [May 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)

**Development Mode rules in the guide (summary only; policy is covered by other researchers)**
- The app owner needs active Premium; the app stops working if it lapses. New apps: 1 Client ID per developer (raised to 25 in July 2026) and 5 users per app. Existing apps keep extra Client IDs and users — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- EQ apps are not affected and may optionally adopt `PUT/DELETE /me/library` — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

**Guide tables: removed, renamed and replaced endpoints** — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)

| Group | Old endpoint(s) | New endpoint or status |
|---|---|---|
| Library save/follow | `PUT /me/tracks`, `/me/albums`, `/me/episodes`, `/me/shows`, `/me/audiobooks`, `/me/following`, `/playlists/{id}/followers` | `PUT /me/library` (Spotify URIs) |
| Library remove/unfollow | `DELETE` on the same seven paths | `DELETE /me/library` (Spotify URIs) |
| Library contains | `GET /me/tracks/contains`, `/me/albums/contains`, `/me/episodes/contains`, `/me/shows/contains`, `/me/audiobooks/contains`, `/me/following/contains`, `/playlists/{id}/followers/contains` | `GET /me/library/contains` |
| Playlist items | `POST`, `GET`, `DELETE /playlists/{id}/tracks`; `PUT /playlists/{playlist_id}/tracks` | `POST`, `GET` (owned or collaborative only), `DELETE` (param `tracks` → `items`), `PUT /playlists/{id}/items` |
| Batch fetch | `GET /tracks`, `/albums`, `/artists`, `/episodes`, `/shows`, `/audiobooks`, `/chapters` | Removed. Use `GET /{type}/{id}` per item |
| Browse and artist | `GET /browse/new-releases`, `/browse/categories`, `/browse/categories/{id}`, `/artists/{id}/top-tracks` | Removed. No replacement |
| Other users | `GET /users/{id}`; `GET /users/{id}/playlists`; `POST /users/{user_id}/playlists` | `GET /me`; `GET /me/playlists`; `POST /me/playlists` |
| Markets | `GET /markets` | Removed. No replacement |
| Search | `GET /search` `limit` max 50, default 20 | max 10, default 5; paginate with `offset` |

**Guide table: removed fields** — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Feb 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- Track: `available_markets`, `external_ids` (reverted March 2026), `linked_from`, `popularity`
- Album: `album_group`, `available_markets`, `external_ids` (reverted March 2026), `label`, `popularity`
- Artist: `followers`, `popularity`
- User (`GET /me`): `country`, `email`, `explicit_content`, `followers`, `product`
- Show: `available_markets`, `publisher`; Audiobook: `available_markets`, `publisher`; Chapter: `available_markets`; Episode: no change
- Playlist renames: `tracks` → `items`, `tracks.tracks` → `items.items`, `tracks.tracks.track` → `items.items.item`. Contents only for owned or collaborative playlists

**Guide checklist (condensed)**: confirm owner Premium; move library calls to `/me/library`; replace batch fetches with single fetches; remove browse, new-releases and top-tracks features; remove other-user profile and playlist features; move `/tracks` to `/items`; handle removed fields; cap Search at 10 and paginate; limit API calls to avoid rate limits — [Migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

### Inferences
- The guide is the main source for the implementation plan. The Artist's Albums limit (max 10) is the one known change outside it (section 1).
- The July 2026 per-account quota and the batch removal both push spot-mixer toward aggressive Redis caching and request budgeting. Parse the `reason: QUOTA_EXCEEDED` body on 429.

### Gaps
- The changelog pages give months but not days for the February, March, May and July entries.
- The guide and the blog conflict on whether existing apps lost endpoints on 2026-03-09. This does not affect a new app.

## 7. Tooling: official OpenAPI spec and @spotify/web-api-ts-sdk

### Takeaway
Spotify publishes an official OpenAPI 3.0 spec that already contains the 2026 paths and the dev-mode limits. The official TypeScript SDK (`@spotify/web-api-ts-sdk`) is stale: npm latest is 1.2.0 from 2024-01-17, the last commit is from 2025-10-15, and its code still calls the removed paths.

### Cited Findings

**OpenAPI spec**
- Spotify's "Building with AI" page gives the spec URL `https://developer.spotify.com/reference/web-api/open-api-schema.yaml` and says it is an OpenAPI 3.0 spec that "includes all endpoints, request/response schemas, authentication requirements, and parameter descriptions". The page does not say how often it is updated — [Building with AI](https://developer.spotify.com/documentation/web-api/tutorials/building-with-ai)
- The file declares `openapi: 3.0.3`, `info.title: Spotify Web API`, `info.version: 1.0.0` — [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml)
- The file contains `POST /me/playlists`, `/playlists/{playlist_id}/items`, `/me/library` and `/me/library/contains`. It keeps the old paths with `deprecated: true`, for example `/playlists/{playlist_id}/tracks` (GET, POST, PUT, DELETE), `/users/{user_id}/playlists` (GET, POST), `/artists/{id}/top-tracks`, `/artists/{id}/related-artists`, the batch `GET /tracks, /albums, /artists`, and `/browse/featured-playlists` — [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml)
- In the file, `/search` and `/artists/{id}/albums` both have `limit` default 5, max 10 — [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml)
- Only the first third of the file (about 100,000 of 289,601 characters) was read. Markers for `/recommendations`, `/browse/new-releases` and `/markets` were not checked — [OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml)
- A community developer reported many differences between the spec and real endpoint behavior (for example a wrong `limit` minimum). That developer maintains an unofficial corrected fork, `sonallux/spotify-web-api` (Comm, search summary) — [Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Issues-in-the-Spotify-Web-API-reference-documentation/td-p/5490777)

**@spotify/web-api-ts-sdk**
- npm `dist-tags.latest` is 1.2.0, published 2024-01-17. Earlier: 1.1.2 (2023-09-09), 1.1.1 (2023-09-03), 1.1.0 (2023-08-07). Registry metadata last modified 2025-08-08 — [npm registry](https://registry.npmjs.org/@spotify/web-api-ts-sdk)
- The GitHub repo shows no Releases, 239 commits, 48 open issues and 19 open pull requests at fetch time. No archive notice and no maintenance statement in the README — [SDK repo](https://github.com/spotify/spotify-web-api-ts-sdk)
- The five newest commits are all dated 2025-10-15 (for example "Merge pull request #153 from sspenst/fix-user-tests" and "Merge pull request #151 from sspenst/implicit-deprecate"). None relates to the 2026 API changes — [SDK commits](https://github.com/spotify/spotify-web-api-ts-sdk/commits/main)
- `PlaylistsEndpoints.ts` uses `playlists/${playlist_id}/tracks` for get, add, update and remove items, `users/${user_id}/playlists` for `createPlaylist` and `getUsersPlaylists`, and `playlists/${playlist_id}/images` (PUT, `image/jpeg`) for the cover — [SDK PlaylistsEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/PlaylistsEndpoints.ts)
- `ArtistsEndpoints.ts` calls `artists?ids=` (batch), `artists/${id}/top-tracks`, `artists/${id}/related-artists`, and types the Artist's Albums `limit` as `MaxInt<50>` — [SDK ArtistsEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/ArtistsEndpoints.ts)
- `SearchEndpoints.ts` types the Search `limit` as `MaxInt<50>` — [SDK SearchEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/SearchEndpoints.ts)
- `CurrentUserEndpoints.ts` uses `me/tracks` and `me/albums` for PUT, DELETE and contains, `me/following` for PUT and DELETE, and `playlists/{id}/followers`. It has no `me/library` path. Top Items `limit` is `MaxInt<50>` — [SDK CurrentUserEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/CurrentUserEndpoints.ts)

### Inferences
- The SDK does not match the current dev-mode paths. Its `createPlaylist`, `addItemsToPlaylist`, `getPlaylistItems`, `updatePlaylistItems` and `removeItemsFromPlaylist` call removed paths; a 403 is likely (see [cliamp issue #54](https://github.com/bjarneo/cliamp/issues/54)). Its types also allow Search and Artist's Albums limits above 10.
- For spot-mixer, a thin `fetch` client with types generated from the official OpenAPI spec is lower risk than the SDK. If the team uses the SDK, it must patch or bypass the playlist, batch and library methods.
- The spec already shows dev-mode values. Do not use it to infer EQ limits.

### Gaps
- Spotify has made no official statement on the SDK's maintenance status or deprecation.
- Spotify does not document how often the OpenAPI spec is updated, or whether it follows the reference pages exactly.
- The rest of the OpenAPI file (after about 100,000 characters) was not checked.
