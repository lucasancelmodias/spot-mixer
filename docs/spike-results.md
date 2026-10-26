# M1 live checks: results

Date: 2026-10-26. Market: US. Token: app token (Client Credentials). All calls were read-only and went through the shared limiter and circuit breaker. No 429 occurred.

Scripts (run from `apps/server`, with the development Redis up):

| Script | Purpose | Spotify calls |
|---|---|---|
| `bun run spike:catalog` | Field presence, `isrc:` filter, Search order against Deezer top tracks | about 90 |
| `bun run check:capabilities` | Which endpoints and page sizes this app still has. Run it again when something stops working. | 7 |

Spotify calls used on 2026-10-26: 188. The catalog check ran twice, because the console cut the first output. There were also 1 top-tracks check and 1 capability probe. Deezer calls: 80.

## Summary

1. **This app is an existing Development Mode app.**
   - The November 2024 cuts apply to it.
   - The February 2026 cuts do not apply yet. Spotify postponed them for existing apps, with no new date, so they can arrive at any time.
2. **Artist's Top Tracks works** for this app: 10 tracks, each with `popularity`.
3. **Search order is a weak "most played" signal.**
   - It matched Deezer's top 10 for about half of the tracks on average.
   - For 6 of 20 artists, it matched 0 to 2 tracks.
4. **ISRCs are reliable:**
   - Every full track object had one.
   - `isrc:` search found the same track 5 times out of 5.

## Capabilities (`check:capabilities`)

| Probe | Result | Spotify change |
|---|---|---|
| Artist's Top Tracks | 200, 10 tracks | February 2026 cut, postponed for this app |
| Batch track read (`/tracks?ids=`) | 200 | February 2026 cut, postponed |
| Search with `limit=50` | 200, 50 items | February 2026 limit, postponed |
| Artist's Albums with `limit=50` | 200, 45 items | February 2026 limit, postponed |
| Related Artists | 404 | November 2024 cut, applies |
| Recommendations | 404 | November 2024 cut, applies |
| Audio Features | 403 | November 2024 cut, applies |

## Field presence (`spike:catalog`)

| Object | Field | Present |
|---|---|---|
| Track (Search results) | `external_ids.isrc` | 341 of 341 |
| Track (Search results) | `is_playable` (with `market`) | 341 of 341 |
| Track (Search results) | `popularity` | 341 of 341 |
| Artist (Search results) | `genres` | 20 of 20 (17 not empty) |
| Artist (Search results) | `popularity`, `followers` | 20 of 20 |
| Artist (`GET /artists/{id}`) | `genres`, `popularity`, `followers` | 3 of 3 |

## Search order against Deezer top tracks

Method:
- **Spotify side:** Search `artist:"<name>"` with `type=track`, 3 pages of 10. Keep the tracks that include the artist ID. Remove duplicates by normalized title (`src/mix/normalize.ts`).
- **Deezer side:** `/artist/{id}/top?limit=25`, with the same duplicate removal.
- **Comparison:** the first 10 titles of each list.

| Artist | Unique songs in 30 results | Overlap of top 10 | Deezer top 5 in Spotify top 10 | Deezer top 3 in Spotify top 10 |
|---|---|---|---|---|
| Daft Punk | 13 | 8 | 5 | 3 |
| Radiohead | 15 | 9 | 5 | 3 |
| Taylor Swift | 12 | 5 | 4 | 3 |
| Metallica | 15 | 7 | 4 | 3 |
| Miles Davis | 12 | 1 | 1 | 1 |
| Bad Bunny | 15 | 1 | 1 | 1 |
| Anitta | 11 | 0 | 0 | 0 |
| Caetano Veloso | 14 | 1 | 0 | 0 |
| Tame Impala | 12 | 8 | 5 | 3 |
| Phoebe Bridgers | 24 | 6 | 5 | 3 |
| Khruangbin | 21 | 7 | 3 | 2 |
| Arctic Monkeys | 15 | 9 | 5 | 3 |
| The Beatles | 14 | 6 | 4 | 3 |
| Kendrick Lamar | 15 | 6 | 3 | 1 |
| Björk | 12 | 8 | 5 | 3 |
| Bon Iver | 14 | 2 | 1 | 0 |
| Nina Simone | 11 | 5 | 3 | 3 |
| Rosalía | 14 | 0 | 0 | 0 |
| Boogarins | 29 | 5 | 4 | 3 |
| Men I Trust | 18 | 5 | 4 | 3 |
| **Mean** | **15.3** | **4.95** | **3.10** | **2.05** |

The low results come from artists with many collaborations and guest appearances (Anitta, Bad Bunny, Rosalía) and from catalog-heavy artists (Miles Davis, Caetano Veloso). This explanation is an inference: the script did not check it.

## Answers to the M1 questions (plan §14)

| # | Question | Answer |
|---|---|---|
| 1 | Is the Search order close to Deezer's top list? | Not reliably: mean overlap 4.95 of 10, and 0–2 for 6 of 20 artists. |
| 2 | Does the `isrc:` filter work? | Yes, 5 of 5. |
| 3 | Do full track objects include ISRCs and `is_playable`? | Yes, 341 of 341. |
| 4 | Can `/me/top/{type}` page past 50 items? | Not tested yet: needs a signed-in user. |
| 5 | Do artist objects include `genres`? | Yes, for this app. |
| 6 | Does the owner use one of the 5 user places? | The API cannot show this. Check User Management in the Dashboard. |
| 7 | Does Spotify accept PKCE with a client secret? | Not tested. The app uses the confidential Authorization Code flow. |
| 8 | Requests per operation | Catalog check: about 4.5 calls per artist. Login: 1 Web API call. `/api/me`: 1 call per 5 minutes per user. |

## Still open (needs a signed-in user)

- Login end to end, `/api/me` with a real account, and a token refresh after 1 hour.
- User endpoints: depth of `/me/top/{type}`, `/me/player/recently-played`, `/me/following`, `/me/tracks`.
