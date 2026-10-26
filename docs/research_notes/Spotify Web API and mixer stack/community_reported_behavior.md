# Spotify Web API in Development Mode: community-reported behavior (2025–2026)

State as of 2026-10-25. The notes compare developer reports with official Spotify pages, which I fetched on 2026-10-25.
Evidence tags:
- **[Official]**: Spotify docs or blog.
- **[Multi]**: two or more independent reports agree.
- **[Single]**: one report.
- **[Summary-only]**: seen only in a search-engine summary. The page did not load, so I could not check its wording or date. Spotify Community pages gave only their title to the fetch tool, so all Community claims are summary-only.
- **[3rd-party]**: an aggregator, vendor or competitor page.

## Q1. Do new dev-mode apps get Artist's Top Tracks, popularity, genres, followers and ISRCs? Which errors appear for removed endpoints?

### Takeaway
A Client ID created on or after 2026-02-11 does not get Artist's Top Tracks (403 `"Forbidden"`), track/album/artist `popularity`, or artist `followers`. ISRCs (`external_ids`) were removed in February 2026 and came back in March 2026. Genres are unreliable: one detailed report shows no `genres` key, but the migration guide does not list genres as removed. Typical errors are 403 for 2026-removed endpoints and for owner or allowlist problems, 404 for endpoints removed in 2024, and 400 `"Invalid limit"` for page sizes above 10.

### Cited Findings

**Artist's Top Tracks**
- [Official] The migration guide removes `GET /artists/{id}/top-tracks` for Development Mode and gives no replacement. New apps: 2026-02-11. Existing apps: 2026-03-09. "Apps in extended quota mode are not affected." — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Official] A 2026-03-09 update to the 2026-02-06 announcement says: "we have decided to postpone endpoint access changes for existing integrations." It says "We will share further details on updated timelines" and gives no new date. — [Spotify blog, 2026-02-06, with 2026-03-09 update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **Contradiction (official vs official):** the migration guide still gives 2026-03-09 for existing apps and has no postponement note. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Multi] 2026-10-17: `GET /artists/{id}/top-tracks` returns 403 `"Forbidden"` for newer Development Mode apps. `GET /browse/new-releases` also returns 403 `"Forbidden"`. The PR says the removal happened on 2026-02-11 and "Older authorizations still receive data." — [uc-intg-spotify PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22)
- [Multi] 2026-10-06: top tracks are blocked for a dev-mode app, so artist pages were "effectively empty". — [waxon PR #39](https://github.com/danfry1/waxon/pull/39)
- [Multi] 2026-02-11: the rspotify tracker lists `artist_top_tracks`, `new_releases`, the batch getters (`albums`, `artists`, `tracks`), `user` and `user_playlists` as removed. — [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)
- [Summary-only] Undated: a player project treats a top-tracks failure as non-fatal (warn, empty list), "matching how related artists are already handled". — [dfoulkes/spotify-player PR #1](https://github.com/dfoulkes/spotify-player/pull/1)

**Popularity, followers, genres**
- [Official] Fields removed for dev mode: track `available_markets`, `linked_from`, `popularity`. Album `album_group`, `available_markets`, `label`, `popularity`. Artist `followers`, `popularity`. `GET /me` `country`, `email`, `explicit_content`, `followers`, `product`. The guide does not mention `genres`. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Official, Summary-only] The Get Artist reference still documents `genres` but marks it deprecated. It is "empty if the artist has not yet been classified". — [Get Artist reference](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)
- [Single, detailed] 2026-08-30: the reporter used "a Development Mode app created after the Feb 2026 migration", and the owner had Premium. `GET /v1/me/top/artists` returns HTTP 200. Artist objects contain only "external_urls, href, id, images, name, type, uri". `genres` and `popularity` are missing, and the key list has no `followers`. `popularity` is also missing on `/me/top/tracks` items. The fix (closed 2026-10-01) shows these fields only when they are present. — [spotify-mcp-server #73](https://github.com/marcelmarais/spotify-mcp-server/issues/73); [PR #86](https://github.com/marcelmarais/spotify-mcp-server/pull/86)
- **Contradiction:** #73 shows no `genres` key. The migration guide does not list `genres` as removed.
- [Single, not verified by its author] 2026-09-28: `GET /artists/{id}` "still exists and still returns `genres`". The PR says the workaround was "Not verified against the live Spotify API." — [spotify-calendar PR #14](https://github.com/CostardRouge/spotify-calendar/pull/14)
- [Summary-only] Undated: an MCP server issue fixes "genre analytics that read artist fields Spotify no longer returns" and suggests user-declared tags. — [NovaLux12/spotify-mcp-server #733](https://github.com/NovaLux12/spotify-mcp-server/issues/733)
- [Summary-only] 2025: a Community thread reports that many artists had their genres reworked or removed completely. This is a data change, and it happened before 2026. — [Spotify Community: Genres from artists have been removed](https://community.spotify.com/t5/Spotify-for-Developers/Genres-from-artists-have-been-removed/td-p/6659559)

**ISRC (`external_ids`)**
- [Official] The guide says track and album `external_ids` were removed in February 2026 and "reverted in March 2026". — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [March 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026) (Summary-only)
- [Single] 2026-03-13: "Spotify's March 2026 update reintroduced `external_ids` for albums and tracks." Another commenter said the last-minute changes were "getting ridiculous". The tracker body still listed `external_ids` as removed. — [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)
- [Summary-only] Undated: an export project matched ReccoBeats data by Spotify track ID first and then by ISRC (906 by ID, 484 by ISRC, 1,390 of 1,450 total). So that app could read ISRCs. Its quota mode is not known. — [HipsterVizNinja/random-data PR #10](https://github.com/HipsterVizNinja/random-data/pull/10)

**Endpoints removed in November 2024 (still unavailable to new apps)**
- [Official] From 2024-11-27, new apps lost related artists, recommendations, audio features and audio analysis. They also lost featured and category playlists, 30-second previews in multi-get responses, and algorithmic and editorial playlists. I did not fetch this post again. The list comes from my prior knowledge of the post and from razday #11. — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [razday/your_spotify_v2 #11](https://github.com/razday/your_spotify_v2/issues/11) (Summary-only)
- [Single] 2025-03-25: "Get Related Artists keeps giving me a 404." The post shows no response body. — [n8n community](https://community.n8n.io/t/spotify-related-artists-404/92782)
- [Summary-only] Undated: "/recommendations Endpoint Always Returns 404 — Even With Valid Token and Known Genres". — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Spotify-API-recommendations-Endpoint-Always-Returns-404-Even/td-p/6917868)
- [Multi, Summary-only, undated] "Spotify's /v1/audio-features returns 403 for apps created after 2024-11-27". — [HipsterVizNinja PR #10](https://github.com/HipsterVizNinja/random-data/pull/10); [Spotify Community: 403 Forbidden on /v1/audio-features](https://community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-v1-audio-features-using-both-user-and-client/td-p/7200198)
- [Single] 2026-10-06: Spotify-owned editorial playlists return 404. — [waxon PR #39](https://github.com/danfry1/waxon/pull/39)

**Observed error codes and messages**

| Request | Observed response | Report date | Source | Strength |
|---|---|---|---|---|
| `GET /artists/{id}/top-tracks` (newer app) | 403 `"Forbidden"` | 2026-10-17 | [uc-intg PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22) | Multi for removal; Single for body |
| `GET /browse/new-releases` (newer app) | 403 `"Forbidden"` | 2026-10-17 | [uc-intg PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22) | Single |
| `GET /artists/{id}/albums?limit=20` | 400 `"Invalid limit"` | 2026-10-06; 2026-10-17 | [waxon #39](https://github.com/danfry1/waxon/pull/39); [uc-intg #22](https://github.com/mase1981/uc-intg-spotify/pull/22); [spotatui #649](https://github.com/LargeModGames/spotatui/pull/649) | Multi |
| `GET /search` with `limit` > 10 | 400 "Invalid limit" | 2026-10-14 and undated | [lowspot #2](https://github.com/cfiorelli/lowspot/issues/2); see Q4 | Multi |
| `POST /users/{user_id}/playlists` | 403 `{"error":{"status":403,"message":"You cannot create a playlist for another user"}}` | 2026-05-12 | [Pipedream #20843](https://github.com/PipedreamHQ/pipedream/issues/20843) | Single for body; Multi for 403 |
| `GET/POST/DELETE /playlists/{id}/tracks` | 403 | 2026-03-19; 2026-05-07 | [navispot #1](https://github.com/betsha1830/navispot/issues/1); [ts-sdk #159](https://github.com/spotify/spotify-web-api-ts-sdk/issues/159) | Multi |
| `GET /playlists/{id}/items` (playlist the user does not own) | 403. Editorial playlists: 404. `GET /playlists/{id}` has no `items` field. | 2026-10-06 | [waxon #39](https://github.com/danfry1/waxon/pull/39) | Single (detailed) |
| `GET /artists?ids=` | "non-429 error" (no code given) | 2026-09-28 | [spotify-calendar #14](https://github.com/CostardRouge/spotify-calendar/pull/14) | Single |
| Any call, owner has no Premium | 403 "Active premium subscription required for the owner of the app" | 2026-03-15; 2026-10-10 | [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550); [cowlic #147](https://github.com/kolenkainc/cowlic/issues/147) | Multi |
| Any call, user not allowlisted | 403 "Check settings on developer.spotify.com/dashboard, the user may not be registered." | 2026-02-01; 2026-03-15 | [navispot #1](https://github.com/betsha1830/navispot/issues/1); [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550) | Multi |
| `GET /artists/{id}/related-artists` | 404 | 2025-03-25 | [n8n community](https://community.n8n.io/t/spotify-related-artists-404/92782) | Single |
| `GET /audio-features` | 403 | undated | see above | Multi (Summary-only) |

### Inferences
- spot-mixer will get a new Client ID. It will have the full February 2026 restricted set from the start. The postponement for existing integrations does not help it.
- spot-mixer cannot rank an artist's tracks by Spotify popularity or the top-tracks endpoint. It needs another ranking signal (see Q5).
- For the curated mix, plan as if Spotify genres are unavailable. Use them only when they are present.
- `/me/top/artists` and `/me/top/tracks` still return 200 for new dev-mode apps, with fewer fields ([#73](https://github.com/marcelmarais/spotify-mcp-server/issues/73); [KJ-11 PR #6](https://github.com/KJ-11/spotify-playlist-curator/pull/6) also calls `/me/top/tracks`). The "most-listened artists" input for the curated mix is therefore still available.
- A 403 status alone does not show the cause. Parse the message. "premium" means the owner's subscription. "may not be registered" means the allowlist. A plain `"Forbidden"` means the endpoint is restricted. Cache the refusal, as uc-intg PR #22 does.
- ISRCs should be present on single-track and single-album responses after March 2026. No community report confirms this for a new dev-mode app.

#### Confirmed vs anecdotal
- Several reports confirm these: top tracks blocked for new apps; popularity removed; album and search page size max 10; the owner-Premium 403 message; the allowlist 403 message; 403 on `/tracks` playlist endpoints.
- Single reports only: the exact `"Forbidden"` body for top tracks; no genres on `/me/top/artists`; 404 for editorial playlists in 2026; older authorizations still served.

### Gaps
- I found no direct observation of `external_ids.isrc` in a new dev-mode app after March 2026.
- I found no verified live check of `genres` on `GET /artists/{id}` for a new dev-mode app.
- I did not capture the response bodies of the related-artists and recommendations 404s.
- "Older authorizations" in uc-intg PR #22 can mean older Client IDs or older user tokens. The PR does not say which.

## Q2. Which rate-limit thresholds do developers see? What Retry-After values are typical? Are long lockouts reported?

### Takeaway
No report and no Spotify page gives a numeric dev-mode threshold. Reports show two mechanisms. The rolling 30-second rate limit gives short waits. The Development Mode quota gives 429 with `{"reason":"QUOTA_EXCEEDED"}` and Retry-After values of hours. One report shows about 5.6 h, and other reports claim 13–20 h. Since 2026-07-23, all dev-mode Client IDs of one developer account share one quota. Several spotDL users reported 24-hour Retry-After values (86400 s) in January and February 2026.

### Cited Findings

**Official baseline**
- [Official] The limit is "calculated based on the number of calls that your app makes to Spotify in a rolling 30 second window". It "varies depending on whether your app is in development mode or extended quota mode." The page gives no numbers. It says "development mode apps also have quota restrictions which have a different enforcement mechanism than rate limits." Retry-After is "normally" present, in seconds. The page does not document a `reason` field. — [Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Official] Over quota, the API returns 429 "Too many requests" with reason "QUOTA_EXCEEDED". "The specific groupings and limits are subject to change." — [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Official] 2026-07-23: the quota is counted per developer account, not per Client ID. "All your Development Mode Client IDs share a single quota." A quota 429 "now returns a structured JSON body with a "reason": "QUOTA_EXCEEDED" field." The post gives no threshold, Retry-After behavior or cooldown. — [Quota update blog, 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- **Contradiction (official vs official):** the rate-limits page still recommends batch endpoints to reduce calls. The migration guide removed batch GETs for dev mode. The page also suggests extended quota mode, but only organizations can apply. — [Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits); [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

**Observed quota numbers**
- [Single] 2026-10-16: one running copy made "about 17,000 Web API calls a day" because it polled the player every 10 s. From 2026-10-03 to 2026-10-11, the quota ran out "every day between about 10:10 and 10:50 local time (UTC-5)". It came back "at 11:04". With usage doubled, the quota ran out "at about 02:40". The body had `"reason":"QUOTA_EXCEEDED"`. The new budget is "about 2,900 calls a day per copy while idle, and about 10,000 if something plays all day". With no header, the fix waits 30 s, and it caps blocks at 24 h. — [uc-intg-spotify PR #19](https://github.com/mase1981/uc-intg-spotify/pull/19)
- [Single] 2026-10-19: "429 QUOTA_EXCEEDED" on search with Retry-After 20335 s ("about 5.6h"). The HTTP library dropped the header. The PR says repeated calls "may have pushed the block further out" but does not confirm it. The fix sets `blockedUntil`, uses a 60 s default when the header is missing, and caps blocks at 24 h. — [Lucky PR #2897](https://github.com/LucasSantana-Dev/Lucky/pull/2897)
- [Single] 2026-09-25: `Spotify 429 on /me/top/tracks: {"reason":"QUOTA_EXCEEDED"}` after "Earlier heavy testing drained it." The PR says "Cooldowns are reported at 13–18 hours" but gives no source. The fix fails at once when Retry-After is over 10 s. It also shows "Upload your data instead." — [spotify-playlist-curator PR #6](https://github.com/KJ-11/spotify-playlist-curator/pull/6)
- [Single] 2026-07-28: a retry cannot clear QUOTA_EXCEEDED. Because quota is per account, "the retries burn the same pool for every app on the account." — [spotify-mcp-cloudflare #2](https://github.com/jamiew/spotify-mcp-cloudflare/issues/2)
- [Summary-only; the page returned 404 when fetched] A Retry-After of 73132 s (about 20 h) cleared after a wait. — [sound-continuum-project #129](https://github.com/vmmatos/sound-continuum-project/issues/129)
- [Summary-only] Community posts: no guidance "as to when this resets"; quota cooldowns that persisted for many hours; Retry-After values of 9.5 h and about 12–13.6 h; some 429s without Retry-After. These dates are not verified. — [Developer App restricted after QUOTA_EXCEEDED](https://community.spotify.com/t5/Spotify-for-Developers/SUBJECT-Developer-App-restricted-after-QUOTA-EXCEEDED/td-p/7550379); [Feb 2026 update thread](https://community.spotify.com/t5/Spotify-for-Developers/February-2026-Spotify-for-Developers-update-thread/td-p/7330564); [Low number of requests leading to 429](https://community.spotify.com/t5/Spotify-for-Developers/Low-number-of-requests-leading-to-429-response/td-p/7338415); [Rate limit unreasonably high after one single 429](https://community.spotify.com/t5/Spotify-for-Developers/Rate-limit-unreasonably-high-after-one-single-429-response/m-p/5880001/highlight/true)

**24-hour lockouts**
- [Multi, one tracker] 2026-01-06: spotDL showed "Your application has reached a rate/request limit. Retry will occur after: 86400". Several users reported it. Some used personal Client IDs, and new credentials did not help some of them. One block lifted within hours. Others lasted days, and one user was still blocked on 2026-08-30. No root cause was found. One commenter could not create a new app because Spotify "had temporarily disabled app creation." — [spotDL #2585](https://github.com/spotDL/spotify-downloader/issues/2585)
- [Multi] 2026-02-25: the same 86400 s message appeared. A VPN change did not help. The issue was closed on 2026-05-04 as a duplicate. — [spotDL #2618](https://github.com/spotDL/spotify-downloader/issues/2618)
- [3rd-party, Summary-only] A write-up links spotDL's 24-hour errors to shared default credentials. Its fix is the user's own app with user OAuth. Date not verified. — [DEV Community](https://dev.to/inventivehero/fixing-spotdl-oauth-invalidclient-and-24-hour-rate-limit-errors-redirect-uri-port-bug-3k90)
- [Summary-only, older] "Constantly getting ~24-hour Rate-Limited during development": after many rebuilds, a 429 had no Retry-After, and the developer waited a day. Date not verified. The thread ID suggests 2024. — [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Constantly-getting-24-hour-Rate-Limited-during-development/td-p/5814282)

**Behaviors that waste quota**
- [Single, author's claim] 2026-10-14: a search with limit 20 "400s, gets swallowed, and still burns quota". The issue gives no measurement. — [lowspot #2](https://github.com/cfiorelli/lowspot/issues/2)
- [Single] 2026-09-28: per-artist lookups run 400 ms apart. About 4,300 artists take "around 30 min". An earlier version lost the whole chunk at the first 429. — [spotify-calendar PR #14](https://github.com/CostardRouge/spotify-calendar/pull/14)
- [Official; Summary-only] Batch GETs (`/tracks?ids=`, `/artists?ids=`, `/albums?ids=`) are removed for dev mode, so each lookup costs one call per item. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [LavaSrc PR #351](https://github.com/topi314/LavaSrc/pull/351)

### Inferences
- Hypothesis from one report, not confirmed by Spotify: the quota is a daily budget per developer account with a fixed reset time. PR #19 saw recovery at 11:04 UTC-5 (16:04 UTC) on several days. Retry-After values of 5.6–20 h fit a countdown to such a reset.
- Rough scale (weak, from my arithmetic on PR #19): that account ran out after about 16,000–22,000 calls in a day. Spotify says groupings and limits can change, so do not hard-code a number.
- All spot-mixer dev-mode Client IDs (for example dev, staging and prod) share one quota. More Client IDs do not add budget.
- For spot-mixer, keep one shared `blockedUntil` value in Redis for the developer account. Honor Retry-After. Use a default when the header is missing, and cap the block (other projects use 24 h). Do not retry `QUOTA_EXCEEDED`. Check `limit ≤ 10` before each call.
- The spotDL text looks like a client-library log line that repeats the Retry-After header. I did not check the library source.

### Gaps
- No 2025–2026 report that I found gives a numeric threshold for the 30-second window in dev mode.
- Spotify gives no cooldown length or reset time for QUOTA_EXCEEDED.
- It is not known whether 400 responses count against the quota.
- It is not known whether the quota is split by endpoint group. The docs mention "specific groupings".

## Q3. What do reports say about the dev-mode allowlist: the cap, any Premium requirement, and errors for non-allowlisted users?

### Takeaway
Reports agree with the official rules. An app has 5 allowlisted users. The app owner must have active Premium; Spotify began to enforce this for existing apps on about 2026-03-14. A user who is not on the allowlist can log in, but API calls then return 403. No report shows that Spotify requires Premium for allowlisted end users. The official pages disagree on whether existing apps keep more than 5 users.

### Cited Findings
- [Official] "Up to 5 authenticated Spotify users can use an app that is in development mode." The owner adds each user by name and Spotify email address (Dashboard > app > Settings > Users Management > "Add new user"). "The app owner must have a Spotify Premium account for apps in development mode to function." The page sets no Premium rule for users. "Users may be able to log into a development mode app without having been allowlisted by the developer." Their API requests "will receive a 403 status code error." The page gives no error text. — [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Official] 2026-02-06: "Development Mode use will require a Spotify Premium account". "Developers will be limited to one Development Mode Client ID". "Each Client ID will be limited to up to five authorized users". The 2026-03-09 update says these rules "will take effect as planned for existing Development Mode integrations." — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **Contradiction (official vs official):** the migration guide says "If you already have multiple Client IDs or more than 5 users, you will retain them." The blog says the user cap takes effect for existing integrations. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Official] 2026-07-23: the Client ID limit rose from 1 to 25 per developer account. — [Quota update blog](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- [3rd-party, Summary-only] 2026-02-06: the test-user limit per app fell from 25 to 5, and Premium became required. — [TechCrunch](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)

**Premium errors**
- [Multi] 2026-03-15: a Client Credentials request returned "Active premium subscription required for the owner of the app". The message added that requests may take a few hours to start again after the subscription changes. An OAuth `PUT /me/library` returned 403 with text that the user "may not be registered", plus a message that the app is blocked from the Web API without Premium. Test failures began after Spotify's server-side rollout on 2026-03-14. — [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)
- [Multi] 2026-10-10: the Spotify artist API returned HTTP 403 "Active premium subscription required for the owner of the app". — [cowlic #147](https://github.com/kolenkainc/cowlic/issues/147)

**Errors for non-allowlisted users**
- [Multi] 2026-02-01: after a successful login, `GET /v1/me` returned 403 "Check settings on developer.spotify.com/dashboard, the user may not be registered." The owner said it happened "only on free accounts". An upgrade to Duo Premium did not fix it. This is ambiguous. — [navispot #1](https://github.com/betsha1830/navispot/issues/1)
- [Summary-only, older] The older error text was "User not registered in the Developer Dashboard". A Spotify staff reply says it occurs for an account that is not on the app's allowlist. — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/User-not-registered-in-the-developer-dashboard/td-p/5495947); [SpotifyAPI-NET #700](https://github.com/JohnnyCrazy/SpotifyAPI-NET/issues/700)
- [Summary-only, older] Other causes: the allowlist email must match the Spotify account email exactly, and one reply says it is case-sensitive. Accounts created with Facebook or Google sign-in can have a different email. Some reports describe errors that come and go with no code change. Dates are not verified, and the thread IDs suggest 2022–2024. — [Some testers got 403 even when added](https://community.spotify.com/t5/Spotify-for-Developers/Some-testers-got-403-error-even-were-added-to-dev-dashboard/td-p/6235394); [Development mode, User Management, login with Google](https://community.spotify.com/t5/Spotify-for-Developers/Development-mode-API-key-User-Management-login-with-Google/td-p/6256979)
- [Summary-only] "Development Mode apps return 403 for GET /me despite Premium" has no fix. One reply reported a platform-side outage. — [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Development-Mode-apps-return-403-for-GET-me-despite-Premium/td-p/7513288)

**Account and app setup**
- [Official] Extended quota: "Spotify only accepts applications from organizations (not individuals)". It requires a legally registered business and "at least 250k MAUs". — [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Summary-only] A thread title reports "no Quota Extension Request tab visible" for a dev-mode app. — [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-playlist-creation-returns-403-in-Development-Mode-no/td-p/7482480)
- [Single] 2026-07-19: new app creation was "on hold" from roughly late December 2025. The quoted message is "New integrations are currently on hold". The author could not load the dashboard to confirm it. Community reports show successful app creation from February to April 2026. The author checked app creation again in mid-October 2026 and closed the issue. — [flutster #1](https://github.com/Nicsilver/flutster/issues/1); see also [spotDL #2585](https://github.com/spotDL/spotify-downloader/issues/2585)
- [Official; Single] `GET /me` no longer returns `email`, `product`, `country`, `followers` or `explicit_content`. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [lowspot #2, 2026-10-14](https://github.com/cfiorelli/lowspot/issues/2)
- [Single, ambiguous] 2026-05-18: a spotDL contributor disabled one command "for non-premium users until I improve the login flow". The cause is not stated. — [spotDL #2585](https://github.com/spotDL/spotify-downloader/issues/2585)

### Inferences
- The spot-mixer owner must keep Premium active. If it lapses, the app fails for all users, and recovery "may take a few hours".
- spot-mixer cannot read `product` or `email` from `/me`. It cannot check a user's Premium status, and it cannot show the email to allowlist. The owner must collect the email in another way.
- Login success does not prove access. Call `GET /me` right after login. On a 403 that contains "registered", show "ask the owner to add you" and stop.
- The 5-user cap limits spot-mixer to the owner plus a few friends.

### Gaps
- I found no report of the dashboard behavior or error text for a 6th user.
- I found no source that says whether the owner counts toward the 5 users.
- I found no confirmed report that Spotify enforces Premium for allowlisted end users.
- No community report confirms whether existing apps kept more than 5 users (the blog and the guide conflict).

## Q4. What do reports say about Search limit changes, playlist endpoint changes, and limits on reading playlists?

### Takeaway
Many independent reports confirm the official changes. Search returns 400 `"Invalid limit"` above 10, and the default is now 5. `/playlists/{id}/tracks` returns 403, and `/items` works. `POST /users/{id}/playlists` returns 403 with a misleading message, and `POST /me/playlists` replaces it. For playlists the user does not own, only metadata comes back. Artist albums are also capped at 10 per page, and the migration guide does not mention this. The official TypeScript SDK was reported to still call removed endpoints.

### Cited Findings

**Search**
- [Official] The maximum `limit` fell from 50 to 10, and the default fell from 20 to 5. Use `offset` to get more. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Multi] 2026-10-14: `runSearch('track', 20)` gets a 400 that the code swallows. — [lowspot #2](https://github.com/cfiorelli/lowspot/issues/2)
- [Multi, Summary-only, dates not verified] Other projects report the same 400 or cap search at 10: song lookups with limit 20 fail ([WrzDJ #792](https://github.com/wrzonance/WrzDJ/issues/792)); a limit cut from 12 to 10 after HTTP 400 ([CiscoNavigatorWebApp PR #67](https://github.com/Spencer8742/CiscoNavigatorWebApp/pull/67)); paged search for dev mode ([hermes-agent PR #63481](https://github.com/NousResearch/hermes-agent/pull/63481)); a cap of 10 ([NovaLux12 #857](https://github.com/NovaLux12/spotify-mcp-server/issues/857), [PR #1109](https://github.com/NovaLux12/spotify-mcp-server/pull/1109)); the old and new values ([spotify-dart #248](https://github.com/rinukkusu/spotify-dart/issues/248)); search fixes ([LavaSrc PR #351](https://github.com/topi314/LavaSrc/pull/351)).

**Artist albums (not in the migration guide)**
- [Multi] 2026-10-17: `GET /artists/{id}/albums` with `limit=20` returns 400 `"Invalid limit"`. The PR says "the reference now lists a maximum limit of 10 for newer authorizations." — [uc-intg-spotify PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22)
- [Multi] 2026-10-06: the same 400 `"Invalid limit"` at limit 20. The fix requests 10 at a time and uses at most 3 requests. — [waxon PR #39](https://github.com/danfry1/waxon/pull/39)
- [Multi, Summary-only] Undated: limit=11, 20 and 50 return 400 "Invalid limit". — [spotatui PR #649](https://github.com/LargeModGames/spotatui/pull/649)
- **Contradiction:** the migration guide does not list this limit change. Per uc-intg PR #22, the endpoint reference does.

**Playlist endpoints**
- [Official] All `/playlists/{id}/tracks` methods become `/playlists/{id}/items`. The `tracks` field becomes `items`, and the nested paths become `items.items` and `items.items.item`. `POST /me/playlists` replaces `POST /users/{user_id}/playlists`. `GET /users/{id}/playlists` is removed; use `GET /me/playlists`. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Multi] 2026-05-07: an owner got 403 on their own account for `GET/POST/DELETE /playlists/{id}/tracks` and `POST /users/{id}/playlists`. `GET /me`, `GET /me/playlists` and playback worked. On 2026-08-04, a commenter said that `/items` instead of `/tracks` fixed the 403. The issue is open with no maintainer reply. — [spotify-web-api-ts-sdk #159](https://github.com/spotify/spotify-web-api-ts-sdk/issues/159)
- [Single for body] 2026-05-12: `POST /users/{user_id}/playlists` returned `{"error":{"status":403,"message":"You cannot create a playlist for another user"}}`. This happened "regardless of whether `oauth_uid` is correct, what scopes the token has, or whether the account was just reconnected." The issue was closed on 2026-05-21 with a move to `POST /me/playlists`. The page does not show test results. — [Pipedream #20843](https://github.com/PipedreamHQ/pipedream/issues/20843)
- [Summary-only] Undated: `@spotify/web-api-ts-sdk` v1.2.0 reportedly still calls the removed endpoints. Developers patch the compiled SDK in `node_modules` or call the new endpoints directly. — [spotify-mcp-server #35](https://github.com/marcelmarais/spotify-mcp-server/issues/35); [Spotify Community, Web API label](https://community.spotify.com/t5/forums/filteredbylabelpage/board-id/Spotify_Developer/label-name/web%20api)
- [Multi, Summary-only, undated] 403 on `/playlists/{id}/tracks` after the change. — [ioBroker.spotify-premium #630](https://github.com/iobroker-community-adapters/ioBroker.spotify-premium/issues/630); [cliamp #54](https://github.com/bjarneo/cliamp/issues/54)
- [Summary-only] `POST /v1/me/playlists` still returned 403 for one developer after the move, with a Premium owner, an allowlisted test user and the correct scopes. A Spotify responder could not reproduce it. — [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-playlist-creation-returns-403-in-Development-Mode-no/td-p/7482480)
- [Summary-only] A scope-related 403 on adding tracks went away after the developer added `playlist-modify-public`. — [Spotify Community: 403 on playlist track addition](https://community.spotify.com/t5/Spotify-for-Developers/403-on-playlist-track-addition/td-p/7350134)
- [Official; Multi] Library save/remove/check moved to `PUT`/`DELETE /me/library` and `GET /me/library/contains`. These take Spotify URIs, not IDs. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [lowspot #2](https://github.com/cfiorelli/lowspot/issues/2); [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)

**Reading playlists**
- [Official] Playlist contents are "Only available for playlists the user owns or collaborates on." For other playlists, the `items` field is absent and only metadata comes back. — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Single, detailed] 2026-10-06: for a playlist the user does not own, `GET /playlists/{id}` has no `items` field. `/items` and `/tracks` return 403, and editorial playlists return 404. There is no replacement endpoint. The app now shows a restriction notice and caches restricted playlists for the session. — [waxon PR #39](https://github.com/danfry1/waxon/pull/39)
- [Multi] 2026-03-21: after the move to `/items`, reads still failed for public playlists and for playlists the user did not own. — [navispot #1](https://github.com/betsha1830/navispot/issues/1)
- [Single] A post dated Sep 5 (the year is not shown, but it refers to the Feb 2026 change) says each playlist row now carries the track object under `item`. The old `track` key is still sent, but its value is the boolean `True`. The post suggests `row.get("item") or row.get("track")` plus a dict check. — [DEV Community](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml); see also [python-spotify #774](https://github.com/joostlek/python-spotify/issues/774) (Summary-only)
- [Single] 2026-10-14: code that required `v.tracks` dropped every playlist and showed "Playlist (0)". — [lowspot #2](https://github.com/cfiorelli/lowspot/issues/2)

**Wrapper status**
- [Summary-only] spotipy release notes mention `/tracks` → `/items` and IDs → URIs for `/me/library`. Release dates are not verified. — [spotipy releases](https://github.com/spotipy-dev/spotipy/releases)
- [Single] rspotify finished its migration on 2026-03-15 and moved to maintenance mode on 2026-03-16. — [rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)

### Inferences
- spot-mixer creates playlists that the user owns. Use `POST /me/playlists`, then `POST /playlists/{id}/items`. The app can read back its own playlists.
- Do not rely on `@spotify/web-api-ts-sdk` playlist methods unless a release after May 2026 confirms the fix. A thin `fetch` client for the needed endpoints is lower risk.
- Album browsing for the "albums they select" feature needs paging with `limit=10`. Without batch GETs, each album detail is one more call.
- A playlist parser must accept the `item` key and ignore a boolean `track`.

### Gaps
- I found no dev-mode limit for URIs per `POST /playlists/{id}/items` request.
- I found no dev-mode limits for `GET /albums/{id}/tracks`, `GET /me/top/*`, `GET /me/playlists` or `GET /playlists/{id}/items`.
- It is not known how long Spotify will send the boolean `track` key.
- I did not verify whether `@spotify/web-api-ts-sdk` or `spotify-web-api-node` shipped fixes after May 2026.

## Q5. Which workarounds and services did developers adopt, and what problems did they hit?

### Takeaway
For artist top tracks, developers use Spotify search filtered by artist, or Last.fm top tracks mapped back to Spotify. For related artists they use Last.fm similar artists, and for recommendations ListenBrainz. For audio features they use ReccoBeats, which has reliability and coverage problems. For previews they use Deezer lookups by ISRC. For quota problems they fail fast, cache, and offer a "upload your data" fallback. Each outside source needs a match back to Spotify URIs, and that costs Spotify quota.

### Cited Findings

**Artist top tracks and new releases**
- [Single] 2026-10-17: call the real endpoint first. On 403 or 404, record the refusal for the session and switch to search: `q=artist:"<name>"&type=track`, filtered to the artist ID. New releases use `q=tag:new&type=album`. A 429 is not treated as a refusal. The refusal is not kept across restarts. — [uc-intg-spotify PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22)
- [Summary-only] Undated: a proposal uses Last.fm similar-artist data for related artists and Last.fm top tracks for artist top tracks, with Spotify search as fallback. Recommendations come from ListenBrainz. — [razday/your_spotify_v2 #11](https://github.com/razday/your_spotify_v2/issues/11)

**Last.fm**
- [Single, docs only, no runtime test] 2026-10-10: a project studied Last.fm because the Spotify artist API returned 403 "Active premium subscription required for the owner of the app". Its findings:
  - Read methods need only an API key; the docs say they "does not require authentication".
  - Records have no ISRC or Spotify ID, and the MBID was empty in samples.
  - Durations come only from `album.getInfo` and `track.getInfo`.
  - No complete discography is assured.
  - Last.fm publishes no numeric rate limit. Error 29 is "rate limit exceeded", and accounts "may be suspended if your application is continuously making several calls per second".
  - The verdict was "GO WITH CONDITIONS".

  — [cowlic #147](https://github.com/kolenkainc/cowlic/issues/147)

**ReccoBeats (audio features)**
- [Summary-only] It is free, needs no key, and takes Spotify track IDs. One export got features for 1,390 of 1,450 songs by matching on ID first, then ISRC. `time_signature` is not available. — [HipsterVizNinja/random-data PR #10](https://github.com/HipsterVizNinja/random-data/pull/10)
- [Summary-only] A coverage check found 14 of 15 top artists and features for all 697 first-page tracks. About 10% of tracks have an empty `availableCountries`. — [moodmusic PR #3](https://github.com/hadrienbbt/moodmusic/pull/3)
- [Summary-only] "Reccobeats just never works reliably sadly". Date not verified. — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Depending-on-deprecated-Audio-Features-API-for-my-Thesis-Help/td-p/6741862)
- [3rd-party] Reliability and coverage "have been inconsistent in the wild" ([musiciwant](https://musiciwant.com/studio/spotify-audio-features-alternative)). The method "is not publicly documented" ([Parrser](https://parrser.com/spotify-collapse)). "No SLA, no support, no commercial commitments" ([FreqBlog](https://freqblog.com/compare.html), a competing vendor, so it may be biased).
- [Summary-only] One project saves measured features so that it can survive Spotify cooldowns. — [vaporzr PR #26](https://github.com/KoBadger/vaporzr/pull/26)

**Deezer**
- [Summary-only] Projects get keyless Deezer 30-second previews by ISRC or search; one says Deezer also supplies ISRC and BPM. Another limits its Deezer provider to the public API, with ISRC "when available". — [momos-music-manager #199](https://github.com/momokli/momos-music-manager/issues/199); [Terpsichore #4](https://github.com/mohammad-elahii/Terpsichore/issues/4)

**Genres**
- [Single] 2026-09-28: call `GET /artists/{id}` one artist at a time, 400 ms apart, and cache the results. A 429 keeps the earlier results, and the route stops new lookups after 75 s. — [spotify-calendar PR #14](https://github.com/CostardRouge/spotify-calendar/pull/14)
- [Summary-only] Use genre tags that the user declares. — [NovaLux12 #733](https://github.com/NovaLux12/spotify-mcp-server/issues/733)

**Quota and restriction handling**
- [Multi] Fail fast on QUOTA_EXCEEDED, show the reset time, and offer "Upload your data instead" ([KJ-11 PR #6, 2026-09-25](https://github.com/KJ-11/spotify-playlist-curator/pull/6)). Block calls until Retry-After and fall back to another source ([Lucky PR #2897, 2026-10-19](https://github.com/LucasSantana-Dev/Lucky/pull/2897)). Poll less often ([uc-intg PR #19, 2026-10-16](https://github.com/mase1981/uc-intg-spotify/pull/19)). Treat QUOTA_EXCEEDED as terminal ([spotify-mcp-cloudflare #2, 2026-07-28](https://github.com/jamiew/spotify-mcp-cloudflare/issues/2)).
- [Single] 2026-05-01: a spotDL contributor suggested an unofficial library ("spotipyfree") that "only works for public content". — [spotDL #2585](https://github.com/spotDL/spotify-downloader/issues/2585)

### Inferences
- For "each artist's most-played tracks", spot-mixer has three options:
  1. Spotify search order with `artist:` and an artist-ID filter. This costs 1 call per 10 results, and search relevance is not documented as play count.
  2. Last.fm `artist.getTopTracks`. It gives scrobble-based order, but each track needs a Spotify search to find its URI.
  3. For the curated mix, the user's own `/me/top/tracks`.
- Last.fm records have no ISRC, so matching relies on artist and title text, which can give wrong matches.
- Results from outside services are slow to change, so a Redis cache with a long TTL lowers Spotify quota use for the matching step.
- A Spotify data export upload (as in KJ-11 PR #6) is another source for the curated mix when the quota is low. It is a single-report idea.

### Gaps
- I found no community report that uses Deezer for artist top tracks.
- I found no official ReccoBeats rate limits or uptime data.
- The Last.fm findings come from reading docs, not from runtime tests.
- No report confirms that the Spotify `isrc:` search filter works for dev-mode apps.

## Q6. Are there 2026 signals that Spotify plans more restrictions or reversals?

### Takeaway
The signals point both ways. Spotify added restrictions: Premium owner, 5 users, endpoint and field cuts, a 6-month refresh-token lifetime, and one shared quota per account. It also reversed some changes: `external_ids` came back, endpoint cuts for existing apps were postponed, and the Client ID limit went from 1 to 25. Spotify says it will "continue to evolve this model". The postponed cuts for existing apps still have no date. I found no Web API changelog for September or October 2026.

### Cited Findings
- [Official] 2026-02-06: Spotify said "advances in automation and AI have fundamentally altered the usage patterns and risk profile of developer access". It also said: "We'll continue to evolve this model and share updates as further changes are introduced over time." — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Official] 2026-03-09: endpoint changes for existing integrations were postponed. The post says "We will share further details on updated timelines". — [Spotify blog, 2026-03-09 update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Single] 2026-10-17: older authorizations still get top-tracks data, so the postponement is still in effect for some apps. — [uc-intg-spotify PR #22](https://github.com/mase1981/uc-intg-spotify/pull/22)
- [Official; Single] March 2026: `external_ids` was reverted (restored). — [Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [rspotify #550, 2026-03-13](https://github.com/ramsayleung/rspotify/issues/550)
- [Official, Summary-only] 2026-06-18: refresh tokens now expire 6 months after the user's original authorization. The rule applies to new apps from 2026-06-18 and to existing apps from 2026-07-20. A refresh does not extend the lifetime, and a new authorization starts a new 6-month period. An expired token gives 400 `invalid_grant`, and the app must send the user through the authorization code flow again. Client Credentials is not affected. — [Spotify blog, 2026-06-18](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration); [Community discussion thread](https://community.spotify.com/t5/Spotify-for-Developers/Refresh-token-expiration-discussion-thread/td-p/7474150)
- [Multi, Summary-only] Developers are adding re-auth flows for the 6-month expiry. One issue is dated 2026-10-25, and the other dates are not verified. — [hermes-agent #48381](https://github.com/NousResearch/hermes-agent/issues/48381); [LCARS47 #121](https://github.com/SkyeRangerDelta/LCARS47/issues/121); [MagicMirror forum](https://forum.magicmirror.builders/topic/20291/mmm-nowplayingonspotify-surviving-spotify-s-6-month-refresh-token-expiry-a-maintained-fork); [SpotifyEmbedded #95](https://github.com/Sh1n1230/SpotifyEmbedded/issues/95); [daily.dev post](https://daily.dev/posts/spotify-is-expiring-refresh-tokens-after-6-months-i-have-a-headless-background-app-now-i-need-to--jtwdftxc1)
- [Official] 2026-07-23: the Client ID limit went from 1 to 25 (a relaxation). The quota became one shared budget per account (a tightening). — [Quota update blog](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates); [July 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- [3rd-party] A tracker reviewed on 2026-10-07 says Spotify published no new Web API quota, token or terms changes after 2026-08-18. It says the postponed endpoint changes have "no revised timeline published". — [vorplabs tracker](https://vorplabs.com/agent-tools/spotify-api-changes)
- [Search result] My search for September or October 2026 changelogs found only entries up to July 2026. — [July 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- [Single] App creation was paused from about late December 2025 and was available again by February 2026. — [flutster #1](https://github.com/Nicsilver/flutster/issues/1)
- [Summary-only] Community mood: a moderator wrote, "I know it does not provide much comfort if you had an 'indie app' that was using development mode, that is now being impacted by the changes." In August 2026, a user wrote that Spotify treats every developer as a potential source of abuse by default. — [Feb 2026 update thread](https://community.spotify.com/t5/Spotify-for-Developers/February-2026-Spotify-for-Developers-update-thread/td-p/7330564); [Quota update thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-quota-updates-for-Development-Mode/td-p/7508852)
- [Single] Wrapper maintenance is getting weaker. rspotify moved to maintenance mode on 2026-03-16 ([rspotify #550](https://github.com/ramsayleung/rspotify/issues/550)). The official TS SDK issue #159 (2026-05-07) has no maintainer reply ([ts-sdk #159](https://github.com/spotify/spotify-web-api-ts-sdk/issues/159)).

### Inferences
- The overall trend is restrictive. The reversals are narrow (one field, one deadline, the Client ID count). Design spot-mixer to degrade cleanly when an endpoint returns 403.
- spot-mixer needs a re-auth path for the 6-month refresh-token expiry. Treat `invalid_grant` as "sign in again".
- The postponed cuts do not affect spot-mixer, because a new Client ID already has them.

### Gaps
- I found no official statement about future changes to search or playlist limits.
- Spotify has published no new date for the postponed endpoint changes to existing apps.
- The Community mood quotes come from search summaries; I could not check them on the pages.

## Q7 (objective item). Redirect URI enforcement: localhost versus 127.0.0.1

### Takeaway
Official rules and community reports agree. Spotify rejects `localhost`. For local development, `http://127.0.0.1:PORT` or `http://[::1]:PORT` works. All other redirect URIs must use HTTPS. Errors seen: "localhost is not allowed as redirect URI" in the dashboard, and "INVALID_CLIENT: Invalid redirect URI" or "INVALID_CLIENT: Insecure redirect URI" at authorization.

### Cited Findings
- [Official] 2025-02-12: "Any redirect URI using HTTP will stop being supported, except loopback IP address literals" such as `http://127.0.0.1` and `http://[::1]`. The post's example: "`http://localhost:3000` could be migrated to `http://127.0.0.1:3000`". "All clients created from the 9th of April 2025 will have the new rules enforced automatically." Existing clients had to migrate "by November 2025". The implicit grant is deprecated, and apps must use the authorization code grant. — [Spotify blog, 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- [Multi] 2026-02-15: the reporter cites the rule "localhost is not allowed as redirect URI" and got "INVALID_CLIENT: Invalid redirect URI". On 2026-02-16, `WEBHOOK_URL=http://127.0.0.1:5678` fixed it. The reporter also suspected a hyphen in the callback path ("oauth2-credential"). They said that "Even if the team said the issue was fixed I'm still facing this problem." — [n8n #25805](https://github.com/n8n-io/n8n/issues/25805); [Spotify Community: Local Redirect URI does not accept hyphen-minus](https://community.spotify.com/t5/Spotify-for-Developers/Local-Redirect-URI-does-not-accept-hyphen-minus/m-p/6929053) (Summary-only)
- [Multi, Summary-only, dates not verified] "localhost is not allowed as redirect URI" at app creation ([DeepLearning.AI forum](https://community.deeplearning.ai/t/c2w2-lab1-cant-create-spotify-app-localhost-is-not-allowed-as-redirect-uri/801160)). "INVALID_CLIENT: Insecure redirect URI" ([Strawberry forum](https://forum.strawberrymusicplayer.org/topic/5920/spotify-api-invalid_client-insecure-redirect-uri)). A thread says the localhost ban blocks testing ([Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Redirect-URI-not-allowing-localhost-prevents-me-from-testing/td-p/7235200)).
- [Multi, Summary-only, dates not verified] Projects moved to `http://127.0.0.1:PORT`. Lessons:
  - A `SPOTIFY_REDIRECT_URI` value in `.env` still overrides the default, so it must change too.
  - The redirect URI must come from a fixed config value, not from the request.
  - If the browser still opens the site on `localhost`, the result is "Invalid redirect URI"; serve the dev site on `127.0.0.1` as well.

  — [spotify-reshuffle PR #6](https://github.com/ncolomer/spotify-reshuffle/pull/6); [webplayer-test PR #1](https://github.com/Jmatt6836/webplayer-test/pull/1)

### Inferences
- In local Docker Compose development, register `http://127.0.0.1:<port>/callback` and open the app at that same origin. A browser does not send cookies set on `localhost` to `127.0.0.1`, so a PKCE verifier or session started on one host is lost on the other. This is general browser behavior, not a Spotify report.
- Set the redirect URI from config for each environment. Use HTTPS in production.
- A simple callback path without a hyphen avoids the unconfirmed hyphen problem at no cost.

### Gaps
- I do not know whether the hyphen problem still exists in late 2026. The only 2026 report is n8n #25805, and it is not confirmed.
