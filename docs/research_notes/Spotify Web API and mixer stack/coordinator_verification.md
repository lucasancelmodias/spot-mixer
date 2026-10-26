# Coordinator verification (2026-10-25)

Read-only checks against primary sources. They confirm key claims in the other notes. Each check ran on 2026-10-25.

## npm registry

Source: `https://registry.npmjs.org/-/package/<name>/dist-tags` and `https://registry.npmjs.org/<name>/latest`.

| Package | `latest` | Other tags | Manifest facts |
|---|---|---|---|
| `@sveltejs/kit` | 3.1.0 | next 3.0.0-next.32 | engines node `>=22.17`; peer typescript `^6.0.0` |
| `@sveltejs/adapter-bun` | 1.0.0 | next 1.0.0-next.1 | engines bun `>=1.4.0`; peer kit `^3.0.0-next.0` |
| `@sveltejs/adapter-static` | 4.0.0 | next 4.0.0-next.4 | peer kit `^3.0.0-next.0` |
| `svelte-adapter-bun` (community) | 1.0.2 | — | **deprecated** on npm; peer kit `^2.4.0`, typescript `^5` |
| `svelte` | 5.57.2 | — | — |
| `svelte-check` | 4.7.7 | — | peer typescript `^5.0.0 \|\| ^6.0.0` |
| `typescript` | **7.0.2** | rc 7.0.1-rc, beta 7.1.0-beta | 6.0.3 exists; 6.0.4 and 6.0.5 do not. SvelteKit 3.1 and svelte-check need 6.x, so pin `6.0.3`. |
| `bun` | 1.4.4 | canary 1.4.4-canary.20261025.1 | — |
| `hono` | 4.13.14 | next 5.0.0-rc.1 | — |
| `elysia` | 1.4.30 | rc 2.0.0-rc.0, next 2.0.0-beta.32 | — |
| `vitest` | 5.0.5 | — | engines node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| `eslint` | 10.13.0 | maintenance 9.39.5 | — |
| `@spotify/web-api-ts-sdk` | 1.2.0 | — | — |
| `zod` | 4.6.7 | — | — |

## Docker Hub tags

Source: `https://hub.docker.com/v2/repositories/<repo>/tags/<tag>`. All returned HTTP 200.

| Image | Last updated |
|---|---|
| `redis:8.10.2-alpine` | 2026-10-22 |
| `redis:8-alpine` | 2026-10-22 |
| `oven/bun:1.4.4`, `1.4.4-alpine`, `1.4.4-slim`, `1.4.4-distroless` | 2026-10-22 |

## Spotify OpenAPI spec

Source: `https://developer.spotify.com/reference/web-api/open-api-schema.yaml` (HTTP 200, 289,721 bytes). The coordinator checked the whole file with grep and awk.

No `deprecated: true` flag on these operations:

| Operation | `limit` maximum in spec |
|---|---|
| `GET /search` | 10 (offset maximum 1000) |
| `GET /artists/{id}/albums` | 10 |
| `GET /me/following` | 50 |
| `GET /me/player/recently-played` | 50 |
| `GET /artists/{id}`, `GET /albums/{id}/tracks`, `GET /me/top/{type}`, `GET /me/tracks`, `GET /me/albums` | not stated inline (shared parameter) |
| `/me/playlists`, `/playlists/{playlist_id}/items`, `/me/library` | — |

Flagged `deprecated: true`:

- `/artists/{id}/top-tracks`, `/artists/{id}/related-artists`
- Batch reads: `/artists`, `/albums`, `/tracks` (and `/shows`, `/episodes`, `/audiobooks`, `/chapters`)
- `GET` and `POST /users/{user_id}/playlists`, `/users/{user_id}`
- `/playlists/{playlist_id}/tracks`, `/playlists/{playlist_id}/followers`, `/playlists/{playlist_id}/followers/contains`
- `PUT` and `DELETE` on `/me/tracks`, `/me/albums`, `/me/following` (the `GET` operations are not flagged)
- `/recommendations`, `/recommendations/available-genre-seeds`, `/audio-features`, `/audio-features/{id}`, `/audio-analysis/{id}`
- `/browse/featured-playlists`, `/browse/categories`, `/browse/categories/{category_id}`, `/browse/categories/{category_id}/playlists`, `/browse/new-releases`, `/markets`

The `q` parameter description of `GET /search` lists the `isrc` filter. It says that `isrc` and `track` filters work for track searches.

Limit: a `deprecated` flag does not tell which app types lose access. The migration guide in `spotify_endpoint_matrix.md` gives that.
