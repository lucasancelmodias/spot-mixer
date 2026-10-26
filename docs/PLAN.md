# spot-mixer — implementation plan

> Status: **approved** on 2026-10-26. M0 and M1 are done. The M2 (Artist Mix) and M3 (My Mix) code is done; the live checks of both are still open (§14).
> Research behind this plan: [Spotify Web API and mixer stack](reports/Spotify%20Web%20API%20and%20mixer%20stack.md). The report gives a source and a date for every fact. The raw notes are in `docs/research_notes/`.
> Decisions are in §16. Facts that need a live check are in the M1 checks (§14).

## 1. Goal

spot-mixer makes Spotify playlists that mix two or more artists. It has two modes:

| Mode | Input | Output |
|---|---|---|
| **Artist Mix** (generic) | The user picks 2+ artists. For each artist, the user picks "popular tracks" or specific albums. | A new playlist in the user's Spotify account. |
| **My Mix** (curated) | The app reads the user's listening data and ranks the user's most-listened artists. The user selects artists from that ranking. | A new playlist in the user's Spotify account. |

Both modes use one mix engine. The engine collects candidate tracks, removes duplicates, applies filters, selects tracks per artist, and sets the track order.

spot-mixer is a **personal, non-commercial app for up to 5 Spotify users** (C2, C8). It is not a public product.

## 2. Platform constraints and design responses

Facts as of 2026-10-25. "New app" means a Development Mode Client ID created on or after 2026-02-11. "Terms" means Developer Terms v10 and "Policy" means the Developer Policy, both effective 2025-05-15.

| # | Constraint | Effect | Design response |
|---|---|---|---|
| C1 | New apps get 403 from Get Artist's Top Tracks. The `popularity` field is removed from tracks, artists and albums. | No Spotify endpoint gives an artist's "most played" tracks. | "Popular" is a provider chain (§5.5). |
| C2 | Development Mode allows at most 5 allowlisted users, and the owner needs an active Premium subscription. After a Premium renewal, service can take hours to come back. Extended Quota Mode accepts only organizations with a launched service and ≥ 250k monthly active users. `GET /me` does not return the email. | No public launch. A user who is not on the allowlist can sign in, but gets 403 on every call. | Owner setup steps (§5.1). Clear error messages (§9). |
| C3 | Search and Get Artist's Albums return at most 10 items per page; a larger `limit` returns 400 "Invalid limit". Batch reads (several artists, albums, tracks) are removed. Album track lists have no ISRC. | More requests per mix. | Redis cache, on-demand album pages, limit guards, request budgets (§5.4). |
| C4 | Rate limit: rolling 30-second window, no published numbers. The dev-mode quota returns 429 with `"reason":"QUOTA_EXCEEDED"`. Reports show `Retry-After` values of 20,335 s and 86,400 s. All dev-mode Client IDs of one account share one quota, and retries drain it further. | One bug, for example a retry loop or a test against the live API, can block every user for hours. | Never retry a quota error. Circuit breaker, limiter, daily counter (§5.4). |
| C5 | Playlists: create with `POST /me/playlists` (`public` defaults to `true`), items at `/playlists/{id}/items`. The old paths return 403. The official TS SDK 1.2.0 still calls the old paths. | Do not use `@spotify/web-api-ts-sdk`. Always send `public: false`. | A thin typed client of our own (§5.4). |
| C6 | Related Artists, Recommendations, Audio Features and Audio Analysis are blocked for new apps since 2024-11-27. | No Spotify similar-artist data and no BPM or energy ordering. | Not in the MVP. Later options in §7.4. |
| C7 | OAuth: Authorization Code (Spotify's recommended flow for servers), Authorization Code with PKCE, or Client Credentials. Implicit Grant ended on 2025-11-27. Redirect URIs must be HTTPS, except loopback IPs (`http://127.0.0.1:PORT`). `localhost` is rejected. Access tokens last 1 h. A refresh token expires 6 months after the user's authorization, and a refresh does not extend it. | All local URLs use `127.0.0.1`. Users must authorize again every 6 months. | §5.2. |
| C8 | **Terms prohibit:**<br>• indefinite storage of Spotify content, or databases of it (IV.3.1)<br>• tools that retrieve, duplicate or index Spotify content (IV.2.4(a))<br>• ML or AI ingestion (IV.2.1(a))<br>• transfer of Spotify content to third parties (IV.2.5)<br><br>**Terms require:**<br>• a disconnect option (V.8)<br>• deletion of user data within 5 days (App. A 5(c))<br>• private personal use only in Development Mode (III.1(a))<br><br>**Policy prohibits:**<br>• integration "with streams or content from another service" (III.5)<br>• any system that can "segue, mix, re-mix, or overlap" Spotify audio (III.7)<br>• analysis "for any purpose", including derived listenership metrics and user profiles (III.13)<br><br>**Policy requires:**<br>• a privacy policy (I.1)<br><br>**Design guidelines require:**<br>• attribution and a link back on every item<br>• a logo of at least 70 px<br>• uncropped cover art with 4 or 8 px corners<br>• no other brand next to Spotify's<br>• no app name that contains or resembles "Spotify" | Limits caching, external data, the My Mix ranking, the UI, and the app name. | Compliance rules (§12). Decisions D2 and D3. |
| C9 | `GET /me` no longer returns `country`, `email`, `product` or `explicit_content`. It returns `account_id` (May 2026), which Spotify recommends as the stable user key. With a user token, the account's country sets availability. | The app cannot read the user's market. | Key users by `account_id`. Catalog reads use one configured market (§5.2, D7). |
| C10 | Full track objects return `external_ids.isrc` again (since March 2026). Search documents an `isrc:` filter. No report confirms either for a new app. | Exact matching is possible, but untested. | ISRC-aware dedupe (§6.2). M1 checks (§14). |

**This app** (M1 checks on 2026-10-26, [spike-results.md](spike-results.md)):
- The Client ID was created between 2024-11-27 and 2026-02-11.
- The November 2024 cuts (C6) apply.
- The February 2026 cuts do not apply yet. Top Tracks, `popularity`, batch reads and `limit=50` still work, so C1, C3 and part of C9 are not in effect for this app today.
- Spotify can apply those cuts at any time, so the design keeps every fallback. `bun run check:capabilities` shows the current state.

## 3. Scope

### 3.1 Artist Mix (generic)

1. The user searches for artists and adds them to the **bucket**. Minimum 2 artists. Maximum 12 artists.
2. For each artist in the bucket, the user selects one source:
   - **Popular**: the artist's popular tracks, from the provider chain (§5.5). The UI calls them an estimate. The user sets the count (default 10, maximum 20).
   - **Albums**: the user selects albums, singles or EPs. Then the user selects "all tracks" or "K random tracks per album".
   - **Your favorites**: the user's own top tracks by this artist.
3. The user sets the mix options: maximum length, track order, filters (explicit, live, remix), and artist weights.
4. The app shows a preview. The user can remove tracks, move tracks, lock tracks, and regenerate with a new random seed.
5. The user saves the mix as a new private playlist.

### 3.2 My Mix (curated)

1. The app reads the user's listening signals (§7.1).
2. The app shows a ranked list of the user's artists. Each artist shows the Spotify facts that put it in the list, for example "In your top artists: last 4 weeks".
3. The user sets the number of artists, or selects artists manually.
4. The user sets the **familiar ↔ discovery** ratio (§7.3).
5. The app builds the mix with the same engine. The user previews and saves it.

### 3.3 Not in the MVP

- A public launch (C2).
- Similar-artist expansion and audio-feature ordering (C6, §7.4).
- Crossfades or any other audio mixing (Policy III.7). In spot-mixer, a "mix" is only a playlist.
- Playback inside the app (Web Playback SDK).
- Mobile apps.
- Commercial use (C8). The Deezer and Last.fm terms also allow non-commercial use only.

## 4. Architecture

### 4.1 Stack and versions

Versions checked against npm, Docker Hub and the Spotify OpenAPI spec on 2026-10-25.

| Part | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Bun | **1.4.4** | Upgraded on the dev machine on 2026-10-26 (was 1.2.12). Bun 1.4 uses the isolated linker for new workspaces and parses `bunfig.toml` strictly. |
| Language | TypeScript | **6.0.3** (exact pin) | npm `latest` is 7.0.2. SvelteKit 3.1 needs `^6.0.0`, svelte-check accepts 5.x or 6.x, and typescript-eslint accepts versions below 6.1.0. `bun init` writes TS 7, so change it. |
| Frontend | Svelte 5 + SvelteKit 3 in SPA mode | svelte 5.57.2, @sveltejs/kit 3.1.0, @sveltejs/adapter-static 4.0.0, Vite 8 | SvelteKit 3 shipped on 2026-10-01. Its config moved into `vite.config.ts`, and the `$lib` alias is now `#lib` (import TS modules as `#lib/name.js`). Vite runs under Bun (`bun --bun vite`) for dev and build; M0 checked both. svelte-check and Vitest need Node ≥ 22.17; the local machine has 22.20. |
| HTTP server | Hono on Bun | hono 4.13.14, @hono/bun 1.0.1 | Import the Bun helpers (for example `serveStatic`) from `@hono/bun`. That makes the later move to Hono 5 (now a release candidate, ESM-only) small. |
| Validation | zod | 4.6.x | Schemas in `packages/shared`. |
| Cache and sessions | Redis | 8.10.2 (`redis:8.10.2-alpine`) | Bun's built-in `RedisClient`: one node, auto-pipelining, reconnects. Use `send()` for `MULTI` and `EVAL`. If the Redis license is a concern, Valkey 9.1.2 (BSD-3-Clause) is a drop-in alternative. |
| Containers | Docker Compose | local v2.38 is enough | Base image `oven/bun:1.4.4-slim`. |
| Lint and format | ESLint 10 + eslint-plugin-svelte + typescript-eslint; Prettier + prettier-plugin-svelte; svelte-check 4.7 | — | Biome supports `.svelte` only as an experiment. |
| Tests | `bun test` (server); Vitest 5 + @testing-library/svelte 5.4 + jsdom 29 (web); Playwright 1.64 on Node (optional) | vitest 5.0.x | Vitest needs Node ≥ 22.12. jsdom 30 needs Node ≥ 22.22.2, so the web app pins jsdom 29. Playwright does not officially support Bun. |

### 4.2 Repository layout

A Bun workspace with a Bun API server, a Svelte SPA, and one shared package:

```text
spot-mixer/
├─ apps/
│  ├─ server/                 # Hono on Bun; serves the built SPA in production
│  │  ├─ src/
│  │  │  ├─ index.ts          # Bun.serve({ fetch, idleTimeout: 120 })
│  │  │  ├─ config.ts         # environment validation (zod)
│  │  │  ├─ routes/           # auth, me, catalog, mixes, insights, status, health
│  │  │  ├─ spotify/          # oauth, app token, client, catalog, user, playlists
│  │  │  ├─ providers/        # popular-tracks providers, matcher, Deezer client (optional)
│  │  │  ├─ mix/              # engine.ts, ranking.ts (pure functions)
│  │  │  ├─ cache/            # redis client, cached(), limiter, circuit breaker
│  │  │  └─ session/          # cookies, token encryption, middleware
│  │  └─ test/
│  └─ web/                    # SvelteKit 3 SPA (adapter-static, ssr = false)
│     └─ src/
│        ├─ routes/           # /, /mix/artists, /mix/me, /settings, /privacy
│        └─ lib/              # (#lib) typed api client, stores (.svelte.ts), components
├─ packages/
│  └─ shared/                 # zod schemas and types for server and web
├─ docs/
├─ Dockerfile                 # multi-stage: build SPA and server, then runtime image
├─ compose.yaml               # app + redis (production-like)
├─ compose.dev.yaml           # development override: Redis only, port on 127.0.0.1
├─ .env.example
└─ package.json               # workspaces and root scripts
```

Root scripts:

| Script | Action |
|---|---|
| `bun run dev` | Starts the server (`bun --watch`) and the Vite dev server (under Bun) in parallel (`bun run --filter './apps/*' dev`) |
| `bun run check` | `tsc --noEmit`, `svelte-check`, ESLint |
| `bun run test` | `bun test` in `apps/server`, Vitest in `apps/web` |
| `bun run build` | Builds the SPA and the server bundle |

Why a separate API and not SvelteKit server routes: see D1.

### 4.3 Runtime topology

Development (Windows host):

```text
Browser ─▶ http://127.0.0.1:5173  Vite dev server (SPA, hot reload)
              └─ /api/* and /auth/* proxy ─▶ http://127.0.0.1:3000  Bun API (bun --watch)
                                     ├─▶ Redis container, published on 127.0.0.1:6380
                                     ├─▶ accounts.spotify.com, api.spotify.com
                                     └─▶ api.deezer.com (only if D2 enables it)
```

Production-like (Compose):

```text
Browser ─▶ http://127.0.0.1:3000  app container (Bun: /api/* routes + static SPA)
                                     └─▶ redis container (not published)
```

The browser never receives Spotify tokens. All Spotify calls go through the server.

### 4.4 Main flows

**Login**

1. The browser opens `GET /auth/login`.
2. The server makes a random `state`. It stores `state` in Redis for 10 minutes and in a short-lived `oauth_state` cookie.
3. The server redirects to `https://accounts.spotify.com/authorize` with the scopes (§5.2).
4. Spotify redirects to `GET /auth/callback?code=…&state=…`.
5. The server compares `state` with the cookie and with Redis, then deletes it. It exchanges the code for tokens with the client secret.
6. The server calls `GET /me` at once. If the call returns 403, the server shows the matching error: "not on the allowlist" or "owner Premium required" (§9).
7. The server creates a session in Redis, keyed to `account_id`, and records `authorized_at`. It sets the `sid` cookie and redirects to `/`.

**Preview a mix**

1. The web app sends the mix recipe to `POST /api/mixes/preview`.
2. The server checks the circuit breaker and the request budget. It resolves each source, cache first.
3. The server runs the mix engine and returns the ordered tracks and warnings.

`Bun.serve` closes idle connections after 10 s by default. A cold preview can take longer, so the server sets `idleTimeout: 120`. If previews still take too long, stream progress with server-sent events.

**Save a mix**

1. The web app sends the name, description and track URIs to `POST /api/mixes`.
2. The server validates every URI.
3. It calls `POST /me/playlists` with `public: false`.
4. It calls `POST /playlists/{id}/items` with a JSON body, 100 URIs per call, in order.
5. The server returns the playlist URL. The UI shows a link back to Spotify.

## 5. Spotify integration

### 5.1 App setup (owner, one time)

1. Make sure that the owner's Spotify account has an active **Premium** subscription. Without it, every call returns 403.
2. Create the app early in the Spotify Developer Dashboard and select **Web API**. Developers reported a pause in new app creation from about late December 2025.
3. Add the redirect URIs. Each URI must match exactly. A loopback URI registered without a port accepts any port.
   - `http://127.0.0.1:5173/auth/callback` (development)
   - `http://127.0.0.1:3000/auth/callback` (Compose)
   - `https://<domain>/auth/callback` (only when deployed)
4. Ask each friend for the email of their Spotify account. The app cannot read it from `GET /me`.
5. In **User Management**, add each user's name and email. Maximum 5 users. It is not known if the owner uses one of the 5 places (M1 check).
6. Put the Client ID and Client Secret in `.env`. Never commit `.env`.

### 5.2 Authorization and tokens

- **Flow:** confidential **Authorization Code** flow. The client secret stays on the server, and `state` is bound to a cookie. The research did not cover PKCE together with a client secret. Add PKCE only if the M1 check shows that Spotify accepts it.
- **Access token:** lasts 1 h. The server refreshes it 60 s before expiry. A refresh response does not always include a new refresh token, so the server keeps the old one unless a new one arrives.
- **Refresh token:** expires 6 months after the authorization, and tokens carry no issue date. The server therefore stores `authorized_at`. From month 5, the UI asks the user to renew access. On `400 invalid_grant`, the server deletes the tokens and does not try again. It returns 401, and the web app starts a new login.
- **Session lifetime:** 30 days idle, and never longer than 6 months after `authorized_at`.
- **Catalog reads** (search, artist, album list, album tracks): use a Client Credentials app token with `market=SPOTIFY_MARKET`. All users share one cache, and the market is explicit. This assumes all users live in one market (D7).
- **User reads and playlist writes:** use the user token.

Scopes follow Spotify's least-scope rule: do not ask for a scope before its feature ships.

| Scope | Used by | When |
|---|---|---|
| `playlist-modify-private` | Save a private playlist | MVP |
| `user-top-read` | My Mix; "Your favorites" source | MVP |
| `user-read-recently-played` | My Mix | MVP |
| `user-follow-read` | My Mix | MVP |
| `user-library-read` | My Mix | MVP |
| `playlist-modify-public` | Save a public playlist | Only if that option ships |
| `ugc-image-upload` | Custom playlist cover | Only if covers ship (M4) |

`user-read-private` and `user-read-email` are not needed, because the fields that they gate no longer reach a Development Mode app.

### 5.3 Endpoint map per feature

| Feature | Endpoint | Token | Page limit | Notes |
|---|---|---|---|---|
| Profile | `GET /me` | user | — | Use `account_id` as the user key |
| Artist autocomplete | `GET /search?type=artist` | app | 10, offset ≤ 1000 | Debounce 300 ms, at least 2 characters |
| Artist details | `GET /artists/{id}` | app | — | No `popularity` or `followers`. `genres` can be missing. |
| Popular tracks | `GET /artists/{id}/top-tracks`, then `GET /search?type=track&q=artist:"<name>"` | app | 10 top tracks; Search 50 (10 after a refusal) | Top Tracks while this app has it; Search fills up and is the fallback (§5.5). |
| Album list | `GET /artists/{id}/albums?include_groups=album,single` | app | 50 (10 after a refusal) | All pages, at most 200 releases. `album_type` labels each result. Do not add `appears_on` to the same request. |
| Album tracks | `GET /albums?ids=` (20 per call), else `GET /albums/{id}` | app | First 50 tracks per album | Batch reads while this app has them (§5.5). Simplified tracks: no ISRC. |
| ISRC lookup (only for `deezer-rank`) | `GET /search?type=track&q=isrc:<code>` | app | 10 | Documented, but untested for a new app (M1) |
| Top artists, top tracks | `GET /me/top/{type}?time_range=short_term\|medium_term\|long_term` | user | 50 | About 50 items per range. Reports say offsets ≥ 50 return nothing. |
| Recent plays | `GET /me/player/recently-played` | user | 50 | Only the last 50 plays |
| Followed artists | `GET /me/following?type=artist` | user | 50 | Cursor paging |
| Saved tracks | `GET /me/tracks` | user | 50 | Page cap (§7.1) |
| Create playlist | `POST /me/playlists` | user | — | Send `public: false`. `POST /users/{id}/playlists` returns 403. |
| Add tracks | `POST /playlists/{id}/items` | user | 100 URIs | JSON body, sequential batches |
| Read or replace tracks (later "refresh mix") | `GET` and `PUT /playlists/{id}/items` | user | 50 read, 100 write | Only playlists that the user owns. Each row holds the track under `item`. The old `track` key can hold a boolean. |
| Cover image (later) | `PUT /playlists/{id}/images` | user | Base64 JPEG ≤ 256 KB | `ugc-image-upload`. Has its own rate limit. |

The app does not use these endpoints. They are blocked for new apps or marked deprecated in the official OpenAPI spec:
- Top Tracks and Related Artists
- Recommendations and Genre Seeds
- Audio Features and Audio Analysis
- Batch reads of artists, albums and tracks
- Browse, New Releases and Markets
- Other users' profiles and playlists
- `/playlists/{id}/tracks`
- `PUT` and `DELETE` on `/me/tracks`, `/me/albums` and `/me/following` (replaced by `/me/library`)

### 5.4 Client behavior and quota guard

One fetch wrapper (`spotify/client.ts`) handles all Spotify calls. It does not use the official SDK (C5). Lenient zod schemas, derived from the official OpenAPI spec, make every deprecated field optional. A missing field never breaks the app.

| Situation | Behavior |
|---|---|
| Before every call | Check the circuit breaker (`rl:sp:blocked-until`). Reject a `limit` above the endpoint maximum (10, 50, or 100 URIs) without sending the call. Take a token from the shared limiter. Increment `rl:sp:count:{date}`. |
| `401` | Refresh the user token one time, then send the request again. |
| `429` with `"reason":"QUOTA_EXCEEDED"`, or `Retry-After` > 30 s | Never try again. Open the circuit until `now + Retry-After` for all users. Fail fast with `SpotifyUnavailable(until)`. The web app shows a banner with the time. |
| `429` with `Retry-After` ≤ 30 s | Wait, then try again one time. |
| `429` without `Retry-After` | Wait 30 s one time. After a second 429, open the circuit for 15 minutes. |
| `403` | Map the message to a typed error: user not on the allowlist, owner Premium lapsed, or another refusal. |
| Blocked endpoint | The client keeps a fixed blocklist of the removed endpoints and refuses them without a call. A refusal cache keyed by route was dropped: one 403 for one playlist would block all playlists. `bun run check:capabilities` checks what the app still has. |
| `5xx` | Try again up to 3 times with exponential backoff and jitter. |
| Paging | Async generator that follows `next`, with a hard page cap for each list. |
| Parallel calls | At most 4 at a time for each operation. |
| Logs | Method, path, status, duration and request count. Never tokens. |

Start values for the shared limiter: 1 request per second, bursts up to 10. Tune them with the counts from M1. Also watch the request graph in the Developer Dashboard.

Normal use is cheap. One report shows an app that made about 17,000 calls per day and ran out of quota every day. spot-mixer's normal use is far below that. The danger is a bug. Thus no background jobs, no polling, no cache warming, and no test that calls the live API.

Request budget for each operation (default cap: 60 Spotify calls, configurable). If an operation needs more, it stops and returns a warning.

| Operation | Spotify calls (cold cache) |
|---|---|
| Artist Mix preview, 4 artists, "popular" source | 4 × 3 search pages = 12 (`deezer-rank` adds at most 5 ISRC lookups per artist) |
| Album picker for one artist | 1–3 album pages |
| Artist Mix with 6 selected albums | 6 album-track calls |
| Save a 60-track mix | 1 create + 1 add |
| My Mix analysis | 3 + 6 + 1 + ≤ 4 + ≤ 10 = ≤ 24 (§7.1) |
| My Mix preview, 5 artists, after the analysis | 5 × 3 = 15: artist, Top Tracks and 1 search page each. The user's tracks come from the analysis cache. |

### 5.5 Popular tracks and capabilities (D2)

**Capabilities** (`spotify/capabilities.ts`). This app still has three features that Spotify removed for apps created after 2026-02-11: Top Tracks, batch reads and pages of 50 ([spike-results.md](spike-results.md)).
- The catalog uses a capability while it works.
- When Spotify refuses it, the catalog records the loss in Redis (`cap:lost:{name}`, 6 hours) and uses the fallback at once. A refusal is a 404 or a plain 403, or for page size a 400 "Invalid limit".
- After 6 hours, the catalog tries the capability again. `bun run check:capabilities` shows the current state.

**Popular tracks** (`Catalog.popularTracks`, M2):

| Step | Source | Spotify calls | When |
|---|---|---|---|
| 1 | `GET /artists/{id}/top-tracks`: Spotify's own ranking, up to 10 tracks | 1 per artist (cached 24 h) | While the app has Top Tracks |
| 2 | Search `type=track`, `q=artist:"<name>"`, filtered by artist ID. Ranked by `popularity` while every result has it, else in Spotify's order. | 1 page of 50, or 3 pages of 10 (cached 24 h) | When more than the top tracks are needed, or without Top Tracks |
| Later option | `deezer-rank`: Deezer's top list re-ranks the Search results | 0–5 | Not built. Only if Spotify removes Top Tracks and `popularity`. It is a gray area under Policy III.5, and Deezer allows non-commercial use only. |

The steps share one duplicate check: track ID, ISRC, or normalized title plus primary artist.

"Your favorites" (`Listening.favorites`) is the user's top tracks by the artist: 3 time ranges, 2 pages each, cached 1 hour.

Rules for `deezer-rank`, if it is built later:

- **Artist lookup:** `GET https://api.deezer.com/search/artist?q=<name>`, then take the exact normalized name match. One artist can have two Deezer IDs.
  - The first matched tracks are a free check. They must include the chosen Spotify artist ID; if they do not, try the next Deezer candidate.
  - If no candidate passes, keep the Spotify order.
- **Data flows inward only (Terms IV.2.5):** Deezer receives only an artist name and Deezer track IDs. It never receives Spotify IDs or user data.
- **Branding:** the UI labels the result "estimated popularity", with no Deezer branding.
- **Version duplicates:** Deezer top lists contain several versions of one song, and the dedupe step (§6.2) removes them.

**Track matcher** (used by `deezer-rank` and the history import):

1. Search by ISRC.
2. Then search by normalized title and artist.
3. Break ties by artist ID, by duration (±2 s), and by album type.
4. Never merge two artists only because their names match.
5. Cache hits and misses with a bounded TTL (§10).

Not used:
- Last.fm, because its terms are stricter: non-commercial use, a credit line, a 100 MB cache cap, no Last.fm images, and written approval for public pages.
- ListenBrainz per-artist top recordings, because they now need a user token.
- Odesli, because it is closed to new apps.

## 6. Mix engine

The engine is a set of pure functions in `apps/server/src/mix/engine.ts`. It has no I/O, so `bun test` can test it fully.

### 6.1 Data model

```ts
type ArtistRef = { id: string; name: string; imageUrl?: string };

type SourceSpec =
  | { kind: "popular"; artist: ArtistRef; count: number }
  | { kind: "favorites"; artist: ArtistRef; count: number }
  | { kind: "albums"; artist: ArtistRef; albumIds: string[]; pick: "all" | { randomPerAlbum: number } }
  | { kind: "blend"; artist: ArtistRef; count: number; familiarShare: number }; // My Mix (§7.3)

type MixOptions = {
  maxTracks?: number;                         // trims each artist in proportion
  order: "balanced-shuffle" | "round-robin" | "grouped" | "chronological";
  noAdjacentSameArtist: boolean;
  exclude: Array<"explicit" | "live" | "remix" | "acoustic" | "instrumental" | "demo">;
  weights?: Record<string, number>;           // artistId → weight, default 1
  seed: number;                               // same seed + same input = same mix
};

type Candidate = {
  uri: string;
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  isPlayable?: boolean;                       // present when a market is sent
  artists: ArtistRef[];
  album: { id: string; name: string; type: string; releaseDate: string };
  trackNumber?: number;
  sourceArtistId: string;                     // the bucket artist that produced it
  rank?: number;                              // 0 = most popular in its source
  isrc?: string;                              // full track objects only, not album track lists
  pool?: "familiar" | "discovery";            // blend sources only (§7.3)
};
```

### 6.2 Pipeline

1. **Resolve**: convert each `SourceSpec` to `Candidate[]` through the cached Spotify client and providers.
2. **Normalize**: make a dedupe key for each candidate. Try the keys in this order:
   1. The URI (the same track from two sources).
   2. The ISRC, if both candidates have one.
   3. The normalized title plus the primary artist ID.

   Normalization steps:
   - Apply Unicode NFKD and remove diacritics.
   - Change to lowercase.
   - Remove "feat." credits, and remove bracketed or ` - ` suffixes that contain version words (remaster, live, version, edit, mono, stereo, deluxe, anniversary, bonus).
   - Collapse spaces and punctuation.
3. **Dedupe**: keep one candidate per key.
   - Prefer the studio album, then the single, then a compilation, then a live release.
   - Then prefer the earliest release date.
   - Then prefer the best rank.
4. **Filter**:
   - Remove tracks with `isPlayable === false`.
   - Remove explicit tracks if requested.
   - Remove version types that match title or album-name patterns (live, remix, acoustic, instrumental, demo, karaoke).
   - Optional: remove tracks shorter than 60 s (interludes).
5. **Allocate**: calculate how many tracks each artist gets.
   - Each source has its own count.
   - If `maxTracks` is set, divide it by the weights, and round with the largest remainder method.
   - If an artist has fewer candidates than its quota, give the difference to the other artists in proportion.
6. **Select**:
   - "popular" and "favorites" sources: take the best-ranked tracks.
   - Album sources: take all tracks, or a seeded random sample per album.
7. **Order**: see §6.3.
8. **Report**: return the ordered tracks and warnings, for example "Artist X has only 6 tracks after filters".

### 6.3 Track order

- **balanced-shuffle** (default): spreads each artist evenly across the playlist.
  1. For an artist with `k` tracks in a playlist of `n` tracks, `spacing = n / k`.
  2. `offset = rng() * spacing`. Track `i` gets position `offset + i * spacing + jitter`, with `|jitter| ≤ 0.1 * spacing`.
  3. Sort all tracks by position.
  4. Repair pass: if two adjacent tracks have the same primary artist, swap the second one with the nearest later track of a different artist.
- **round-robin**: A1, B1, C1, A2, B2, C2, … in rank order.
- **grouped**: all tracks of artist A, then all tracks of artist B.
- **chronological**: sort by album release date, then by track number.

"No two adjacent tracks from one artist" is possible only if the largest artist group has at most `⌈n / 2⌉` tracks. If not, the engine keeps adjacency as low as possible and returns a warning.

Properties for tests:

- The output is a permutation of the selected tracks.
- The same input and the same seed give the same output.
- When the constraint is possible, no two adjacent tracks share a primary artist.

## 7. My Mix (curated)

### 7.1 Signals and request budget

| Signal | Endpoint | Calls | Cache TTL |
|---|---|---|---|
| Top artists, 3 time ranges | `GET /me/top/artists` | 3 | 1 h |
| Top tracks, 3 time ranges, 100 each | `GET /me/top/tracks` | 6 | 1 h |
| Last 50 plays | `GET /me/player/recently-played` | 1 | 15 min |
| Followed artists | `GET /me/following?type=artist` | ≤ 4 (200 artists) | 6 h |
| Saved tracks | `GET /me/tracks` | ≤ 10 (500 tracks) | 6 h |

Time ranges:
- `short_term`: about 4 weeks
- `medium_term`: about 6 months
- `long_term`: about 1 year

The API has no lifetime history. §7.4 covers that gap. Genres are unreliable for new apps, so the ranking does not use them.

### 7.2 Artist ranking

For each artist `a`:

```text
R(a) = Σ_r w_r · (1 − rank_r(a) / N_r)                      top-artist lists
     + β · Σ_r w_r · Σ_{t ∈ top_tracks_r, a ∈ t.artists} (1 − rank_r(t) / N_r) / Z
     + γ · log(1 + saved(a)) / log(1 + max_saved)
     + δ · recent(a) / recent_total
     + ε · followed(a)
```

- `r` is a time range. Default weights: short 0.45, medium 0.35, long 0.20. The "all time ↔ right now" slider moves the `w_r` values:
  - The slider value goes from 0 (all time) to 1 (right now). The default is 0.5.
  - The weights are linear between three sets, each with a sum of 1: (0.10, 0.30, 0.60) at 0, the default weights at 0.5, and (0.80, 0.15, 0.05) at 1.
- `Z` is `Z_r`, the largest track sum of range `r` over all artists. So each top-tracks term is at most `β · w_r`.
- Start values: `β = 0.5`, `γ = 0.3`, `δ = 0.2`, `ε = 0.1` (`SIGNAL_WEIGHTS` in `mix/ranking.ts`). Tune them with live data (M3 live check, §14).
- Ties: by artist name. The API returns at most 50 artists.
- **Compliance rule (Policy III.13):**
  - Read literally, III.13 could cover this ranking. The safe form follows.
  - The server computes `R(a)` on demand, for one request, and shows the result only to the owner of the data.
  - The app does not show `R(a)` as a number, does not store it, and runs no analytics across users.
  - The UI shows Spotify's own facts as reasons, for example "In your top artists: last 4 weeks", "You follow this artist" or "In your saved tracks".

### 7.3 Track selection per artist

For each selected artist, the engine merges two pools:

- **Familiar pool**: the user's top tracks and saved tracks by this artist, in the user's rank order.
- **Discovery pool**: popular tracks from the provider chain (§5.5) that are not in the user's saved or top tracks.

The familiar ↔ discovery slider sets the ratio between the pools. Then the normal pipeline (§6.2) runs.

Implementation (`blend` source, M3):

- **Familiar pool order:** the user's top tracks by the artist (short range first, then medium, then long), then the saved tracks by the artist, the last saved first.
- **No song in both pools:** a popular track that is a version of a familiar track (§6.2 keys) stays out of the discovery pool.
- **Ratio:** the engine takes `round(count × familiarShare)` familiar tracks and fills the rest with discovery tracks. If one pool runs short, the other pool fills its places.
- **Order inside the source:** the two pools alternate in proportion. A trim to `maxTracks` (§6.2 step 5) then keeps the ratio.
- **Preview:** each track carries its pool, and the UI tags it "Familiar" or "Discovery".

### 7.4 Later options

| Option | Data | Notes |
|---|---|---|
| Import the extended streaming history | The user requests "Download your data" in the Spotify account page, then selects the `Streaming_History_Audio_*.json` files. The export covers the account's lifetime with 21 fields per play, including `ts`, `ms_played`, `master_metadata_album_artist_name` and `spotify_track_uri`. Some records have null track fields. | The **browser** parses the files and sends only per-artist totals with each My Mix request. The raw files contain IP addresses and user agents, so they never leave the browser. The server does not store the totals. Spotify does not document the delivery time of the export. No API quota is used. |
| Last.fm username | `user.getTopArtists` and `user.getTopTracks`, periods `7day` to `overall` | Only for users who scrobble. Last.fm terms apply. Gray area under Policy III.5. |
| Similar artists | Deezer `/artist/{id}/related`; ListenBrainz labs `similar-artists` | Gray area under Policy III.5. Needs D2. The labs endpoints are undocumented. |
| Audio-feature ordering | ReccoBeats accepts Spotify track IDs and returns tempo, key, energy and valence | Sends Spotify IDs out (Terms IV.2.5). It has no SLA, and its terms say that its data comes from Spotify. Gray area. |

## 8. HTTP API (server)

API routes are under `/api`. OAuth routes are under `/auth`, to match the registered redirect URI. Every input is validated with zod schemas from `packages/shared`. JSON bodies are limited to 256 KB.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness and Redis check (done in M0) |
| GET | `/api/status` | Circuit breaker state (`spotifyBlockedUntil`) for the UI banner |
| GET | `/auth/login` | Start OAuth |
| GET | `/auth/callback` | Finish OAuth, check access, create the session |
| POST | `/auth/logout` | Delete the session and all user cache keys |
| GET | `/api/me` | Profile summary and the renewal date (`authorized_at` + 6 months) |
| GET | `/api/search/artists?q=` | Artist autocomplete |
| GET | `/api/artists/:id` | Artist details |
| GET | `/api/artists/:id/popular?limit=` | Popular tracks (provider chain) |
| GET | `/api/artists/:id/albums` | Albums and singles (all pages, at most 200) |
| POST | `/api/insights/artists` | My Mix ranking with reasons. Body: `{ recency }` (0 to 1); later also the history totals (§7.4) |
| POST | `/api/mixes/preview` | Run the engine on a recipe |
| POST | `/api/mixes` | Create the playlist and add the tracks; with `remember`, keep the recipe (M4) |
| GET | `/api/mixes/saved` | Saved mix recipes, the last used first (M4) |
| POST | `/api/mixes/saved/:playlistId/refresh` | Run the recipe again and replace the playlist tracks (M4) |
| DELETE | `/api/mixes/saved/:playlistId` | Forget the recipe; the playlist stays (M4) |
| DELETE | `/api/me/data` | Delete all data that the app keeps for the user |

Input limits: at most 12 artists, 50 albums and 500 tracks per mix. Each URI must match `^spotify:track:[A-Za-z0-9]{22}$`.

Request and response types come from the zod schemas in `packages/shared`. The web app calls the API with a small typed `fetch` client. It does not use the Hono RPC client (`hc<AppType>`), because that would pull server code and Bun types into the web type check.

## 9. Frontend

Svelte 5 with runes. State lives in `.svelte.ts` modules. SvelteKit runs in SPA mode (`adapter-static` with a fallback page, `ssr = false`).

| Route | Content |
|---|---|
| `/` | "Connect with Spotify" (logged out), or the two mode cards (logged in) |
| `/mix/artists` | Artist search, bucket, per-artist source editor, album picker, mix options, preview, save |
| `/mix/me` | Analysis progress, ranked artists with reasons, sliders, preview, save |
| `/settings` | Renew access, disconnect, delete my data, (later) history import |
| `/privacy` | Privacy policy (Policy I.1) |

Shared components (M2): `ArtistSearch`, `BucketItem`, `AlbumPicker`, `MixOptionsForm`, `TrackList` (move, remove), `SaveDialog`. M3 adds `RankedArtistList` (selection and reasons), and `TrackList` tags the tracks of a My Mix as "Familiar" or "Discovery". Not built yet: track locking, a separate `QuotaBanner` (quota errors show as messages for now).

The My Mix settings (sliders, counts, mix options) are stored in `localStorage` like the bucket draft. The ranking and the selection are not stored (§7.2).

Spotify branding rules (design guidelines):

- Show the Spotify logo, at least 70 px wide, where Spotify content appears.
- Link every track, album, artist and saved playlist back to Spotify (`open.spotify.com`), with link text from the guidelines, for example "OPEN SPOTIFY".
- Show cover art uncropped, with no overlays and a 4 px or 8 px corner radius.
- Show no other brand next to Spotify's.

Error states:

| Situation | Message |
|---|---|
| 403 "…the user may not be registered" | "Ask the app owner to add your Spotify account" |
| 403 "Active premium subscription required for the owner of the app" | "The app owner's Premium subscription is not active" |
| Circuit breaker open | Quota banner with the time when the app works again |
| Month 5 after authorization | "Renew access" prompt |
| `invalid_grant` | "Sign in again" |

The bucket draft is stored in `localStorage` as a convenience only. All reads and writes use try/catch, and the app works without it.

## 10. Redis design

Every key has a TTL, so no Spotify data is stored without a time limit (Terms IV.3.1). Spotify data has TTLs of 24 h or less. `{uid}` is the Spotify `account_id`. `{m}` is `SPOTIFY_MARKET`.

| Key | Type | TTL | Content |
|---|---|---|---|
| `sess:{sid}` | hash | 30 d idle, ≤ 6 months after `authorized_at` | `uid`, encrypted tokens, token expiry, `authorized_at` |
| `oauth:{state}` | string | 10 min | Return path |
| `sp:apptoken` | string | `expires_in − 60 s` | Client Credentials token |
| `c:sp:search:artist:{q}:{m}` | string | 6 h | Search results |
| `c:sp:artist:{id}` | string | 24 h | Artist |
| `c:sp:artist-albums:{id}:{m}:{page}` | string | 24 h | Album page |
| `c:sp:album:{id}:{m}` | string | 24 h | Album with its first 50 tracks |
| `c:pop:top:{artistId}:{m}` | string | 24 h | Top Tracks of the artist |
| `c:pop:search:{artistId}:{m}` | string | 24 h | Search results of the artist, ranked |
| `cap:lost:{capability}` | string | 6 h | A capability that Spotify refused (§5.5) |
| `c:match:{isrc}:{m}` | string | 24 h | ISRC → Spotify URI, or "no match" |
| `c:dz:artist:{name}` | string | 7 d | Deezer artist ID (Deezer data; only with D2) |
| `c:dz:top:{deezerId}` | string | 24 h | Deezer top list (only with D2) |
| `c:u:{uid}:me` | string | 5 min | Profile for `/api/me` |
| `c:u:{uid}:mixes` | string | 90 d after the newest use | Saved mix recipes (IDs, names, options; no track data), at most 50 |
| `c:u:{uid}:top:{type}:{range}` | string | 1 h | User top items (top tracks: 2 pages, 100 tracks) |
| `c:u:{uid}:recent` | string | 15 min | Recent plays |
| `c:u:{uid}:followed` | string | 6 h | Followed artist IDs |
| `c:u:{uid}:saved` | string | 6 h | Saved tracks (capped) |
| `rl:sp:blocked-until` | string | until `Retry-After` | Circuit breaker |
| `rl:sp:tokens` | hash | 1 min | Shared limiter state |
| `rl:sp:count:{date}` | counter | 3 d | Daily request count |
| `rl:sess:{sid}:{route}` | counter | 1 min | Per-session route limit |
| `lock:{key}` | string | 10 s | Cache stampede lock |

- `cached(key, ttl, loader)` helper: read the key. On a miss, take the lock, load, write and release. Cache 404 results for 5 minutes.
- No cache warming and no background crawling (Terms IV.2.4(a)). The app fetches data only on a user action.
- Limiter and circuit breaker: small Lua scripts through `RedisClient.send("EVAL", …)`, so each check is atomic.
- Memory: `maxmemory 256mb`, `maxmemory-policy volatile-lru`.
- Persistence: RDB snapshots plus AOF with `appendfsync everysec`, so sessions survive a restart.
- Access: the Redis image has no password by default. Production Compose does not publish its port. A deployment adds a password through a mounted config file.
  - Development publishes the port on `127.0.0.1:6380` only.
  - It does not use 6379, because another local Redis can hold `127.0.0.1:6379`. In M0, a Redis in WSL with mirrored networking answered there, and Windows `netstat` did not show it.
- Timeouts: Bun's `RedisClient` does not fail fast when Redis is down. A command waits for a reconnect.
  - Every Redis call needs a timeout.
  - A cache read that times out counts as a miss.
  - `/api/health` uses a 1 s PING timeout.

## 11. Docker

### 11.1 Dockerfile (root, multi-stage)

See `Dockerfile` and `.dockerignore` in the repository root.

- Build stage (`oven/bun:1.4.4-slim`): `bun install --frozen-lockfile`, then `vite build` under Bun (the image has no Node.js) and `bun build` for the server.
- Runtime stage (`oven/bun:1.4.4-slim`): the bundled server file (about 235 KB) and the static SPA in `./public`. No `node_modules`. The process runs as the `bun` user.
- `.dockerignore` excludes `node_modules`, `.env`, build output, `docs/` and `.git`.

### 11.2 compose.yaml (production-like)

See `compose.yaml`.

- `app`:
  - Built from the `Dockerfile` and published on `127.0.0.1:3000` only.
  - Has a healthcheck on `/api/health`, and starts after Redis is healthy.
  - Its `environment` overrides `.env` inside the container: `HOST=0.0.0.0`, `REDIS_URL=redis://redis:6379` and `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/auth/callback`. M1 adds `PUBLIC_ORIGIN=http://127.0.0.1:3000`.
- `redis`:
  - Image `redis:8.10.2-alpine`.
  - Persistence: AOF (`everysec`) plus RDB snapshots, in the `redis-data` volume.
  - Memory: `maxmemory 256mb` with `volatile-lru`.
  - Healthcheck: `redis-cli ping`. The port is not published.

### 11.3 compose.dev.yaml (development override)

See `compose.dev.yaml`. It puts the `app` service in the `full` profile, so only Redis starts. It publishes Redis on `127.0.0.1:6380` (§10).

Development steps:

1. Start Redis: `docker compose -f compose.yaml -f compose.dev.yaml up -d`.
2. Start the app on the host: `bun run dev`.
3. Open `http://127.0.0.1:5173`, not `localhost`. Cookies for `localhost` do not reach `127.0.0.1`, so the OAuth `state` cookie would be lost. The Vite config sets `server.host: "127.0.0.1"` and `strictPort: true`.

Bun runs on the host because Docker Desktop on WSL 2 sends file-change events only for files in the Linux file system. The project is on `E:\`, so a bind mount does not get hot reload.

### 11.4 Environment (`.env.example`)

```dotenv
# Used since M0
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/auth/callback
# HOST=127.0.0.1           # defaults; compose.yaml overrides them in the container
# PORT=3000
# REDIS_URL=redis://127.0.0.1:6380

# Used since M1
TOKEN_ENC_KEY=             # 32 random bytes, base64 (AES-256-GCM)
# SPOTIFY_MARKET=US        # ISO 3166-1 alpha-2 code of the users' country

# Planned for M2
POPULAR_PROVIDER=          # depends on D2
SPOTIFY_CALL_BUDGET=60
```

`SPOTIFY_REDIRECT_URI` also gives the public origin (for the Origin check) and the cookie mode: an HTTPS URI makes cookies `Secure` with the `__Host-` prefix. There is no `SESSION_SECRET`: the session ID is a random 256-bit value that only Redis maps to a session, so it needs no signature.

`config.ts` validates these values at startup. The server stops with a clear message if a value is missing or not valid. For a deployment, `config.ts` also reads `<NAME>_FILE` variables, so secrets can come from Compose secrets in `/run/secrets/`.

## 12. Security, privacy and Spotify terms

Security:

- The client secret and the tokens stay on the server.
- Tokens are encrypted at rest in Redis with AES-256-GCM (WebCrypto). The key is `TOKEN_ENC_KEY`.
- Session cookie: `HttpOnly`, `SameSite=Lax`. In production also `Secure` and the `__Host-` prefix.
- OAuth `state` is bound to a cookie and to Redis, and is used one time.
- Mutating routes require an `Origin` header that equals the public origin (the origin of `SPOTIFY_REDIRECT_URI`).
- Per-session rate limits on `/mixes/preview` and `/mixes`.
- Logs never contain tokens, cookies or authorization codes.

Spotify terms (C8):

| Rule | Implementation |
|---|---|
| No indefinite storage, no databases of Spotify content (Terms IV.3.1) | Every key has a TTL. Spotify data: 24 h or less (§10). |
| No tools that retrieve, duplicate or index content (Terms IV.2.4(a)) | No cache warming, no crawling, no background jobs. |
| Delete user data ≤ 5 days after a disconnect (Terms V.8, App. A 5(c)) | Logout and `DELETE /me/data` delete the session and all `c:u:{uid}:*` keys at once. |
| Privacy policy (Policy I.1) | `/privacy` lists the data, the TTLs, the deletion steps, and the revoke link in the Spotify account page. |
| No ML or AI ingestion (Terms IV.2.1(a)) | No Spotify data goes to AI or LLM services, not even for one request. |
| No transfer of Spotify content to third parties (Terms IV.2.5) | Outside services receive only artist names and their own IDs. |
| No integration with other services' content (Policy III.5) | External providers are off by default (D2). No outside audio or outside brand in the UI. |
| No audio mixing (Policy III.7) | Playlists only. No crossfades, no overlaps. |
| No analysis, no derived metrics, no user profiles (Policy III.13) | The ranking is computed on demand, shown only to its owner, and never stored (§7.2). |
| Private personal use (Terms III.1(a)) | Non-commercial app for up to 5 users. |
| Attribution and branding (design guidelines) | Logo ≥ 70 px, links back, uncropped art, no other brand (§9). |
| App name must not resemble "Spotify" (design guidelines) | Choose a public display name (D3). |

## 13. Testing and validation

| Layer | Tool | What |
|---|---|---|
| Mix engine, ranking, normalization, matcher | `bun test` | Pure functions, property-style checks (§6.3) |
| Spotify client | `bun test` with a mocked `fetch` | 401 refresh, short 429 wait, `QUOTA_EXCEEDED` circuit with no retry, missing `Retry-After`, 403 mapping, limit guards, 5xx backoff, page caps, missing fields |
| Cache, limiter, circuit breaker | `bun test` with Redis from Compose | Hit, miss, lock, negative cache, atomic limiter |
| API routes | `bun test` | Validation errors, auth guard, Origin check, preview and save with a mocked Spotify |
| Web components | Vitest 5 + @testing-library/svelte | Bucket, album picker, track list |
| End to end (optional) | Playwright on Node with a mocked API | Build a mix and save it |
| Spotify contract | `bun run check:spotify-spec` | Downloads the official OpenAPI spec. Fails if an operation that the app uses is gone or marked `deprecated`. |

Rules:

- **Tests never call the live Spotify API.** A test run against the live API can lock out every user for hours (C4).
- Live calls happen only in the M1 check script. That script counts its calls and stops at a fixed budget.
- Server code never imports SvelteKit `$app` modules, because `bun test` cannot resolve them.
- Test fixtures use recorded JSON shapes with fake IDs. Fixtures never contain real tokens.

Checks for each change: `bun run check`, `bun run test`, `docker compose build`.

## 14. Milestones

| ID | Content | Done when |
|---|---|---|
| M0 | Spotify app setup (§5.1). Bun 1.4.4 workspace, TS 6.0.3, SvelteKit 3 SPA, Hono, ESLint, test runners. Dockerfile and both Compose files. `/api/health`. | `docker compose up` shows both services healthy. `bun run check` and `bun run test` pass. |
| M1 | OAuth, sessions, refresh, `invalid_grant` handling, app token, Spotify client, limiter, circuit breaker, `cached()`. **Live checks** (below). | An allowlisted user signs in. `/api/me` works. Client tests pass. `docs/spike-results.md` records the answers and the call counts. |
| M2 | Artist Mix: search, album picker, `spotify-search` and `my-top` providers, bucket, engine, preview, save. | A 3-artist mix saves to Spotify as a private playlist with the expected tracks and order. |
| M3 | My Mix: signals, ranking, reasons UI, familiar ↔ discovery, save. | The ranking shows reasons. A mix saves from the top 5 artists within the request budget. |
| M4 | Options, one by one: `deezer-rank` (if D2), saved recipes and "refresh mix", cover image, history import. | Per option |
| M5 | Hardening: error states, privacy page, branding review, `check:spotify-spec`, deploy notes (HTTPS, secrets, Redis password). | Checklist in `docs/deploy.md` |

M0 is done (2026-10-26). Results of the M0 checks:

1. `bun --bun vite dev` works with SvelteKit 3.1 and Vite 8 on Windows. It starts in about 0.6 s, against 1.7 s under Node. The web scripts use `bun --bun`.
2. `vite build` runs under Bun 1.4.4 in the Docker build stage. `docker compose up` shows both services healthy.
3. Found on the way: a Redis in WSL answered on `127.0.0.1:6379`, so the dev Redis moved to port 6380 (§10).

M1 is done (2026-10-26):
- **Code:**
  - Server: OAuth routes, encrypted sessions, token refresh with `invalid_grant` handling, the app token, the Spotify client, and the Redis limiter, circuit breaker and `cached()`.
  - Web: sign-in, sign-out and `auth_error` messages.
- **Live checks:** sign-in with the owner's account works. The catalog and user-endpoint results are in [spike-results.md](spike-results.md).
- **Still open:** whether the owner uses one of the 5 user places. PKCE with a client secret was not tested: the app uses the confidential flow.

M2 status (2026-10-26):
- **Server code:** done. It has capabilities with fallbacks (§5.5), the catalog service, "Your favorites", the mix engine (§6), the playlist save, and the routes in §8 with a call budget per request.
- **Web code:** done. The `/mix/artists` page has:
  - artist search
  - the bucket, with its localStorage draft
  - the album picker and the mix options
  - the preview list (move, remove, shuffle again) and the save dialog
- **Tests:** 114 server tests and 26 web tests.
- **Live check** (owner session, read-only):
  - The preview mixed Daft Punk (5 popular tracks), 4 random tracks from one Radiohead album and Anitta (5 popular tracks).
  - It gave 14 tracks in 877 ms, with 8 Spotify calls and no neighbors from one artist.
  - The same preview from the cache used 0 calls.
- **Still open:**
  - Save a mix from the browser and check the playlist in Spotify. This is the "done when" check of M2.
  - Track locking (§3.1) is not built yet.

M3 status (2026-10-26):
- **Server code:** done.
  - `Listening` reads the five signals of §7.1, at most 24 calls with a cold cache. The keys and TTLs follow §10.
  - `mix/ranking.ts` computes `R(a)` (§7.2) as a pure function.
  - `POST /api/insights/artists` returns the ranked artists with Spotify's facts as reasons: the time ranges in the top artists and top tracks, the number of saved tracks and recent plays, and the follow. It never returns the score.
  - The `blend` source and its engine step implement §7.3.
  - The preview loads the user's tracks once before the sources run in parallel. Before this change, parallel sources could each load one cold key.
- **Web code:** done. The `/mix/me` page has:
  - the ranking, read when the page opens, with reasons and links to Spotify
  - the "all time ↔ right now" slider, which ranks again from the cache
  - the number of artists (default: the top 5), or a manual selection of up to 12 artists
  - the familiar ↔ discovery slider and the tracks per artist
  - the mix options, the preview and the save dialog of M2
- **Tests:** 137 server tests and 38 web tests. One route test runs the "done when" flow against a fake Spotify: ranking, then a preview of the top 5 artists, then the save. Each request stays within the default budget of 60 calls. The ranking needs 9 calls and the preview 15.
- **UI check:** the page ran against the real API routes with the test fakes (Vite dev server, Playwright, desktop and 390 px wide). The ranking, the slider, the preview with pool tags and the save all worked.
- **Still open:**
  - Live check with the owner's account: a My Mix of the top 5 artists saves to Spotify, and the call counts match §5.4. This is the "done when" check of M3.
  - Tune `β`, `γ`, `δ` and `ε` with that data (§7.2).

M4 status (2026-10-26). The owner chose the options:
- **Built: saved mixes and "refresh mix" (D5).**
  - A save keeps the recipe: the mode, the sources and the options, plus artist names from the cached catalog. It holds no track data.
  - The recipes live in one key per user, `c:u:{uid}:mixes`, at most 50.
  - Each recipe expires 90 days after its last save or refresh. Logout and "delete my data" remove the key at once.
  - "Refresh" runs the recipe again with a new seed and the user's current data, then replaces the playlist tracks: `PUT` the first 100, `POST` the rest.
  - If Spotify refuses the change (404, or a plain 403), the app forgets the recipe and answers `playlist_gone`.
  - "Forget" removes only the recipe; the playlist stays in Spotify. The `/mixes` page lists, refreshes and forgets saved mixes.
- **Not built:**
  - `deezer-rank`: not needed while Top Tracks works (D2).
  - Cover image: deferred. The owner prefers an album-art collage, but the design guidelines forbid changes to cover art (C8), and the feature needs the `ugc-image-upload` scope, so every user would sign in again. Decide before building.
  - History import (D6).
- **Tests:** 145 server tests and 41 web tests.
- **Live check:** `GET /api/mixes/saved` answers on the owner's dev server. Saving and refreshing write to the owner's Spotify account, so the owner checks them in the browser.

M1 live checks (one allowlisted account, small fixed call budget):

1. How close is the Search order (`artist:"<name>"`) to Deezer's top list for 20 artists of different sizes? How many Deezer top tracks match by title?
2. Does the `isrc:` search filter work for a new app?
3. Do full track objects (search results, top tracks) include `external_ids.isrc`? Does `is_playable` appear with `market`?
4. Do artist objects include `genres`?
5. Does the owner use one of the 5 user places?
6. Does Spotify accept PKCE together with client-secret authentication?
7. How many requests does each operation in §5.4 use? Do any 429 responses appear?

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spotify removes more endpoints or fields. It changed rules in 2024, 2025 and 2026, and once changed a page limit with no changelog entry. | High | High | Capabilities with fallbacks (§5.5), lenient parsing, `check:capabilities`, `check:spotify-spec`, watch the developer changelog |
| A quota lockout blocks the app for hours | Medium | High | No retries on quota errors, budgets, limiter, circuit breaker, no live API in tests |
| The Search order is a poor "popular" signal | Measured: weak (mean overlap 4.95 of 10) | Medium | The app uses Top Tracks and `popularity` while it has them (D2). If Spotify removes both, build `deezer-rank`. |
| The `isrc:` filter does not work for new apps | Medium | Low | Affects only the `deezer-rank` fallback. Title matching still works. |
| A terms problem (external data, ranking, name, branding) | Low for a 5-user personal app | High if the app is shared | §12 rules, D2 and D3, review before sharing |
| The owner's Premium lapses | Low | High | Every call returns 403, and recovery can take hours after renewal. Document it in the README. |
| New app creation is paused when the project starts | Low | High | Register the Client ID first (§5.1). |
| Stack churn: SvelteKit 3 is weeks old, Bun 1.4 changed defaults, Hono 5 and TS 7 are near | Medium | Low | Exact version pins, lockfile, planned upgrades |
| Users must authorize again every 6 months | Certain | Low | Renewal prompt from month 5, quick re-login |

## 16. Decisions

Confirmed on 2026-10-26:
- **D1:** a separate Hono API.
- **D2:** changed after the M1 checks. The app uses what it still has: Top Tracks for popular tracks, plus batch reads and pages of 50, each with an automatic fallback (§5.5). The first choice, "Search order as the default", is now the fallback.
- **D3:** keep the name `spot-mixer`, because the app stays private.
- **D4:** local only.
- **D5 to D7:** as recommended.

| ID | Decision | Recommendation | Alternative |
|---|---|---|---|
| D1 | App architecture | **Hono API on Bun + SvelteKit SPA** (this plan), for three reasons:<br>• The server stays on Bun even if `bun --bun vite dev` fails on Windows (not yet verified).<br>• The backend does not depend on SvelteKit 3's new server adapter, which is weeks old.<br>• One image works on plain `http://127.0.0.1` and behind HTTPS, with no per-environment build. | One SvelteKit 3 app with the official `@sveltejs/adapter-bun` 1.0.0. The research report prefers this option: it has one process and no RPC layer. But it needs a build-time `paths.origin` for local HTTP: SvelteKit 3 removed `ORIGIN`, and form POSTs over plain HTTP fail with 403 (issue #17328). |
| D2 | Source of "most played" tracks | **Decided:** Top Tracks while this app has it, then Search ranked by `popularity`, then Search order (§5.5). | `deezer-rank`: re-ranks with Deezer's real top list for 0–5 extra Spotify calls per artist. It is a gray area under Policy III.5, and Deezer allows non-commercial use only. |
| D3 | Public app name | Keep `spot-mixer` as the repository name. Choose a display name without "Spot" or other "Spotify"-like words. | Keep the name and accept the risk while the app stays private. |
| D4 | Hosting | **Local only** for the MVP (`127.0.0.1`). | A hosted HTTPS domain. Needs a TLS proxy, an HTTPS redirect URI (cookies then get `Secure`), secrets, a Redis password and one more redirect URI. |
| D5 | Saved mix recipes ("refresh this mix later") | **Built in M4.** The recipe lives in Redis for 90 days after its last use, and logout removes it. | Add SQLite or Postgres if history becomes a core feature. |
| D6 | History import (lifetime play counts) | **M4, optional.** The browser parses the files (§7.4). | Leave it out. My Mix then uses the API signals only (about 1 year). |
| D7 | Market | **One market for all users** (`SPOTIFY_MARKET`, the owner's country). Catalog reads use the app token and one shared cache. | A market per user, with per-user catalog caches. Only needed if the users live in different countries. |
