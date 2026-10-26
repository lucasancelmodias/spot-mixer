# Spotify Web API access rules, policies and authorization for a new individual-developer app (state as of 2026-10-25)

Context: notes for "spot-mixer" (new app, owned by an individual, expected to stay in Development Mode). I read all Spotify pages on 2026-10-25. Most documentation pages show no "last updated" date, so they are marked "undated doc, read 2026-10-25". Tags: **[Historical]** = the rule changed later. **[Secondary]** = only non-Spotify sources support the claim. **[Community]** = only forum evidence supports the claim. **[Unverified]** = I could not confirm the claim. Text in quotation marks is a verbatim extract from the cited page. Other text is a paraphrase.

## Q1. Dated timeline of official Web API restrictions and policy announcements (2024-11-27 to 2026-10-25)

### Takeaway
Spotify made six restriction or policy changes in this window. All of them apply to a new individual-owned app today: the 2024-11-27 endpoint cuts, the 2025 OAuth and redirect URI rules (enforced 2025-11-27), the organizations-only Extended Quota Mode criteria (2025-05-15), the February 2026 Development Mode restrictions, six-month refresh tokens (2026-06-18), and the July 2026 quota changes. Existing Extended Quota Mode apps were exempt from the endpoint cuts, the new extended-access criteria and the 2026 Development Mode changes. Spotify stated no exemption for the OAuth change or the refresh-token change.

### Cited Findings

#### Exemption summary
| Change | Effective date(s) | Applies to | Existing Extended Quota apps exempt? | Source |
|---|---|---|---|---|
| Endpoint restrictions (related artists, recommendations, audio features and analysis, featured and category playlists, multi-get preview URLs, algorithmic and editorial playlists) | 2024-11-27 | New apps, and existing dev-mode apps without a pending extension request | Yes | [Blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) |
| Implicit grant removed; non-loopback HTTP redirect URIs and localhost aliases banned | New apps 2025-04-09; all apps 2025-11-27 | All clients | No exemption stated | [Blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify); [Blog, posted 2025-10-14](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025) |
| Extended access criteria: organizations only, at least 250k MAU | 2025-05-15 | New extended-access applications | Yes, if the app complies with the Developer Terms | [Blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access); [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) |
| Dev Mode: owner Premium, 5 users per Client ID, 1 Client ID per developer, fewer endpoints and fields | New Client IDs 2026-02-11; existing apps 2026-03-09 (endpoint part postponed for existing apps) | Development Mode apps | Yes | [Blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) |
| Refresh tokens expire 6 months after the user authorizes | New apps 2026-06-18; existing apps 2026-07-20 | User tokens (Authorization Code and PKCE) | No exemption stated | [Blog, posted 2026-06-18](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration) |
| Client ID limit 1 to 25; quota counted per developer account; 429 body gets a `reason` field | 2026-07-23 | Development Mode apps | Not applicable (Dev Mode change only) | [Blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates) |

#### 2024-11-27: "Introducing some changes to our Web API"
- "Posted November 27, 2024". Effective "today", so 2024-11-27. — [Spotify blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Restricted for new Web API use cases: (1) related artists, (2) recommendations, (3) audio features, (4) audio analysis, (5) featured playlists, (6) category playlists, (7) 30-second preview URLs in multi-get responses (`SimpleTrack` objects), (8) algorithmic and Spotify-owned editorial playlists. — [Spotify blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Affected apps: new apps registered on or after 2024-11-27, and existing development-mode apps without a pending extension request. — [Spotify blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Exempt apps: apps with existing extended mode Web API access that relied on these endpoints "remain unaffected by this change." — [Spotify blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- Stated reason: Spotify rolled out the measures "with the aim of creating a more secure platform." — [Spotify blog, posted 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)

#### 2025-02-12: "Increasing the security requirements for integrating with Spotify"
- Spotify is "deprecating use of the implicit grant" (`response_type=token`, and `AuthorizationResponse.Type.TOKEN` in the Android SDK). — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- Spotify removes support for "unencrypted HTTP redirect URIs". The exception is loopback IP literals such as `http://127.0.0.1` and `http://[::1]`. The example migrates `http://localhost:3000` to `http://127.0.0.1:3000`. — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- Dates: "All clients created from the 9th of April 2025 will have the new rules enforced automatically." "Migration of existing clients to an acceptable state must be made by November 2025." — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- Custom-scheme redirects such as `com.example://callback` "will still be supported." The post lists no exemptions. — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- Migration advice: move from implicit grant to the authorization code grant. Public clients use PKCE. Confidential clients use the authorization code flow. Change HTTP redirect URIs to HTTPS. — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- The redirect URI doc repeats the dates: "Beginning on the 9th of April 2025 we will enforce the subsequent validations to all newly created apps." "We expect all clients to migrate to the new redirect URI validation by November 2025." — [Redirect URIs, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

#### 2025-04-15: "Updating the Criteria for Web API Extended Access" (effective 2025-05-15)
- Extended access "will be reserved for apps with established, scalable, and impactful use cases". Such use cases must also advance the platform strategy and promote artist and creator discovery. — [Spotify blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- The change starts on 2025-05-15. The updated Developer Terms take effect on the same day. Spotify reviews requests submitted before 2025-05-15 under the old framework. — [Spotify blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- Exempt: developers "previously granted extended access and actively using the Web API in compliance with our Developer Terms" remain unaffected. — [Spotify blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- Development mode stays available for experimentation and personal use. Spotify estimates that fewer than 1% of developers are affected. The post gives no MAU number and does not mention individuals. The organizations-only rule and the 250k MAU threshold appear on the quota modes page (see Q3). — [Spotify blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)

#### 2025-05-15: Developer Terms version 10 and Developer Policy take effect
- "Version 10, effective as of 15 May, 2025". — [Spotify Developer Terms, effective 2025-05-15](https://developer.spotify.com/terms)
- "Effective as of 15 May, 2025". The Policy shows no version number. — [Spotify Developer Policy, effective 2025-05-15](https://developer.spotify.com/policy)

#### 2025-10-14: "Reminder: OAuth Migration - 27 November 2025"
- "On _27 November 2025_, Spotify will remove support for the _implicit grant flow_...". The post also says: "HTTP redirect URIs will no longer be allowed." and "Localhost aliases (such as localhost or similar patterns) will be prohibited." — [Spotify blog, posted 2025-10-14](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025)
- "You can still use local IP addresses like http://127.0.0.1." Requests that use deprecated flows or redirect URIs "will fail". The post mentions no exemptions, including for extended quota apps. — [Spotify blog, posted 2025-10-14](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025)
- The implicit flow page says: "The Implicit Grant Flow will be sunset on November 27, 2025." It recommends "Authorization code with PKCE instead". — [Implicit Grant Flow, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/tutorials/implicit-flow)
- Enforcement evidence after the deadline: a Spotify Community thread is titled "INVALID_CLIENT: Insecure redirect URI (using custom URI)". I read only the title, not the thread body. **[Community]** — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/INVALID-CLIENT-Insecure-redirect-URI-using-custom-URI/td-p/6919036/page/2)

#### 2026-02-06: "Update on Developer Access and Platform Security"
- Stated reason: "advances in automation and AI have fundamentally altered the usage patterns and risk profile of developer access". — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Development Mode becomes smaller in scope. It still supports learning, experimentation and personal non-commercial projects. It "should not be relied on as a foundation for building or scaling a business on Spotify." — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Restrictions (paraphrase): a Spotify Premium account is required for Development Mode; one Development Mode Client ID per developer; up to five authorized users per Client ID; access only to a smaller set of endpoints. — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Timeline: new Development Mode Client IDs fall under the new rules from Wednesday 11 February 2026. Existing integrations follow from March 9, 2026. — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); the migration guide timeline gives "February 11, 2026: New Development Mode apps are created with new restrictions" and "March 9, 2026: Existing Development Mode apps are migrated to new restrictions" — [Migration guide, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Owner Premium: "All Development Mode apps require the app owner to have an active Spotify Premium subscription." The app stops working when the subscription lapses and works again after the owner resubscribes. — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Grandfathering: "If you already have multiple Client IDs or more than 5 users, you will retain them." — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Extended Quota exemption: "Apps in extended quota mode are not affected by any of the changes described in this guide." — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Removed endpoints, as the guide names them:
  - Batch reads: `GET /tracks`, `/albums`, `/artists`, `/episodes`, `/shows`, `/audiobooks`, `/chapters`.
  - Browse and artist: `GET /browse/new-releases`, `GET /browse/categories`, `GET /browse/categories/{id}`, `GET /artists/{id}/top-tracks`.
  - Other users and markets: `GET /users/{id}`, `GET /users/{id}/playlists` ("No replacement - use GET /me/playlists for current user."), `POST /users/{user_id}/playlists`, `GET /markets`.
  - Playlist tracks: `POST`, `GET` and `DELETE /playlists/{id}/tracks`, and `PUT /playlists/{playlist_id}/tracks`.
  - Per-type library endpoints for save, remove, follow, unfollow and "contains".
  - Source: [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Changed endpoints: library calls move to `PUT/DELETE /me/library` and `GET /me/library/contains` (with Spotify URIs). Playlist `/tracks` paths become `/items`, and the response field `tracks` becomes `items`. Playlist items come back only for playlists that the user owns or collaborates on. Create playlist moves from `POST /users/{user_id}/playlists` to `POST /me/playlists`. The Search `limit` maximum drops from 50 to 10, and the default drops from 20 to 5. — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Removed response fields:
  - Track: `available_markets`, `external_ids` (later reverted), `linked_from`, `popularity`.
  - Album: `album_group`, `available_markets`, `external_ids` (later reverted), `label`, `popularity`.
  - Artist: `followers`, `popularity`.
  - User (`GET /me`): `country`, `email`, `explicit_content`, `followers`, `product`.
  - Show: `available_markets`, `publisher`. Audiobook and Chapter: `available_markets`, plus `publisher` for audiobooks.
  - Source: [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Press confirmation of the date: TechCrunch, 2026-02-06. **[Secondary; I saw the search result only, not the article; the date comes from the URL path]** — [TechCrunch](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)

#### 2026-03-09: Endpoint changes postponed for existing integrations
- An "Update (March 9)" note on the 2026-02-06 post says Spotify postponed the endpoint access changes for existing integrations "after some review and feedback from the community". The Premium requirement, the five-user cap and the one-Client-ID limit still took effect on schedule for existing Development Mode integrations. Spotify will share updated timelines for the endpoint changes later. — [Spotify blog, posted 2026-02-06, updated March 9](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Enforcement signal for new apps: one developer reports that Development Mode apps created after February 2026 get 403 from batch endpoints such as `/v1/artists?ids=` and `/v1/tracks?ids=`. **[Secondary; search-result snippet of a GitHub pull request; not fetched]** — [LavaSrc PR #351](https://github.com/topi314/LavaSrc/pull/351)

#### March 2026 changelog
- "[REVERTED] external_ids" for Album and Track: "This field was previously marked as removed in the February 2026 changelog but will continue to be available." The page gives a month, not a day. — [Web API changelog, March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)

#### May 2026 changelog
- "[ADDED] **account_id** — A public, immutable, pseudoanonymous identifier for the user's account." "This field is returned by the Get Current User's Profile endpoint." "Use account_id rather than id when linking user accounts to your service". — [Web API changelog, May 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)

#### 2026-06-18: "Introducing refresh token expiration"
- "we're introducing a 6-month expiration on refresh tokens." New apps are "affected as of today" (2026-06-18). Existing apps are "affected from **July 20, 2026**." — [Spotify blog, posted 2026-06-18](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration)
- Scope: "This only applies to tokens issued on behalf of a user (Authorization Code and Authorization Code with PKCE flows)." The Client Credentials flow is not affected. The post covers "apps registered on Spotify for Developers" and states no Extended Quota exemption. — [Spotify blog, posted 2026-06-18](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration)

#### 2026-07-23: "Web API quota updates for Development Mode"
- "Client ID limit increased from 1 to 25 per developer account." "Going forward, the quota is counted per developer account." All Development Mode apps under one account share a single quota. — [Spotify blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- A quota-exceeded 429 response "now returns a structured JSON body with a "reason": "QUOTA_EXCEEDED" field." — [Spotify blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- Changelog entry: "API quotas for development mode are now counted per developer account rather than per Client ID." The 429 body includes `"message": "Too many requests"` and `"reason": "QUOTA_EXCEEDED"`. — [Web API changelog, July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- The migration guide adds: "As of July 2026, the Client IDs per developer limit has been increased to 25." — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- A Spotify Community announcement thread with the same title exists. I could read only its title. **[Community]** — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-quota-updates-for-Development-Mode/td-p/7508852)

#### 2026-08-13 to 2026-10-25: no further Web API restriction found
- "Introducing Spotify Soloist" (posted 2026-08-13) presents a command-line Spotify Connect client with a local WebSocket API. An October 2026 update added macOS and Windows desktop support. The post contains no Web API, quota or policy change. — [Spotify blog, posted 2026-08-13](https://developer.spotify.com/blog/2026-08-13-introducing-spotify-soloist)
- The Spotify for Developers news list shows these items, newest first: Soloist (2026-08-13), quota updates (2026-07-23), refresh token expiration (2026-06-18), developer access update (2026-02-06), OAuth reminder (2025-10-14). — [Spotify for Developers community page, read 2026-10-25](https://developer.spotify.com/community)
- The changelog sidebar lists only the February, March, May and July 2026 changelogs. — [Web API changelog, July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)

### Inferences
- spot-mixer will be a new Development Mode app created after 2026-02-11. Thus the smaller endpoint set and the removed fields apply from day one. The 2026-03-09 postponement covers only "existing integrations".
- The February 2026 guide names several endpoints that hit spot-mixer feature (a) directly. `GET /artists/{id}/top-tracks` is removed with no replacement listed. `popularity` is removed from Track, Album and Artist objects. Batch `GET /artists`, `/albums` and `/tracks` are removed. Search returns at most 10 items. Without these, the app has no documented "most-played" signal in Development Mode. The endpoint researcher must confirm what remains.
- The 2024-11-27 cuts block the recommendations API, related artists, and algorithmic and Spotify-owned editorial playlists. So spot-mixer cannot build "most played" or "curated" lists from Spotify's own editorial or algorithmic playlists.
- Playlist writes for a new dev-mode app use `POST /me/playlists` and `/playlists/{id}/items` (names from the migration guide).
- The OAuth and refresh-token rules have no stated exemption, so they apply to every app, including Extended Quota apps.

### Gaps
- I found no official new timeline for the postponed endpoint changes for existing Development Mode apps (checked through 2026-10-25).
- No official post-deadline note confirms the 2025-11-27 enforcement. Only a Community thread title supports it.
- The "Update (March 9)" note does not print a year. I infer 2026 from the post date and the migration guide timeline.
- Possible conflict: the migration guide says existing apps "will retain" multiple Client IDs or more than 5 users. The March 9 update says the five-user cap and the one-Client-ID limit took effect for existing integrations. One reading is "keep current users, add no new ones". No source confirms that reading.
- A search-engine summary of a cached Community page gave other dates (quota updates on 2026-08-13; refresh token expiration on 2026-07-23). The primary blog pages and the Spotify for Developers news list contradict it, so I treat it as a summarizer error.
- `https://developer.spotify.com/blog` returned HTTP 404 on 2026-10-25. The news list shows only the five latest posts. An official post that search engines did not index could be missing from this timeline.
- I could not load the bodies of Spotify Community threads, so Community confirmation is limited to thread titles.

## Q2. Today's Development Mode limits

### Takeaway
A Development Mode app allows up to 5 allowlisted Spotify users. The app owner needs an active Premium subscription. A developer account may have up to 25 Client IDs (since 2026-07-23), and all of them share one per-account request quota. A user who is not on the allowlist can log in, but every API call made with that user's token gets HTTP 403.

### Cited Findings
- "Newly-created apps begin in development mode." — [Quota modes, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- User cap: "Up to 5 authenticated Spotify users can use an app that is in development mode". — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes); the blog says up to five authorized users per Client ID (paraphrase) — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **[Historical]** The cap was 25 users from 2021: "You can invite up to 25 Spotify users to install your Development Mode app". — [Spotify blog, posted 2021-05-27](https://developer.spotify.com/blog/2021-05-27-improving-the-developer-and-user-experience-for-third-party-apps). The 5-user cap replaced it on 2026-02-11 (new apps) and 2026-03-09 (existing apps). — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide). Only a press report says the cap was still 25 just before the change ("originally allowed up to 25 test users per app"). **[Secondary; search-result snippet; I could not load an archived copy of the quota modes page]** — [TechCrunch, 2026-02-06](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)
- Allowlist: "Each Spotify user who installs your app will need to be added to your app's allowlist before they can use it." — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- How users are added: the 2021 post says the developer identifies each user in the Developer Dashboard. — [Spotify blog, posted 2021-05-27](https://developer.spotify.com/blog/2021-05-27-improving-the-developer-and-user-experience-for-third-party-apps). Community answers say: add each user under the app's "User Management" tab with the exact name and email address of their Spotify account. **[Community; search-result snippets, thread bodies not loaded]** — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Spotify-403-User-not-registered-in-the-Developer-Dashboard/td-p/5395902); [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/User-not-registered-in-the-developer-dashboard/m-p/5614506/highlight/true)
- Non-allowlisted users: "Users may be able to log into a development mode app without having been allowlisted by the developer. API requests with an access token associated to that user and app will receive a 403 status code error." — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Error text that users report: "User not registered in the Developer Dashboard". This text comes from Community thread titles. One poster quotes the variant "Check settings on developer.spotify.com/dashboard, the user may not be registered". **[Community; no official page documents the body text]** — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/403-User-not-registered-in-the-Developer-Dashboard/m-p/5374390/highlight/true); [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/quot-User-not-registered-in-the-Developer-Dashboard-quot-error/m-p/5603950/highlight/true)
- Owner Premium: "The app owner must have a Spotify Premium account for apps in development mode to function." — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes); "All Development Mode apps require the app owner to have an active Spotify Premium subscription." — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Users and Premium: no Spotify page that I read requires allowlisted users to have Premium. A secondary guide says testers generally do not need Premium only to test an app. **[Secondary; search-result snippet, not fetched]** — [itechguides](https://www.itechguides.com/spotify-changes-developer-mode-api-to-require-premium-accounts-and-limit-test-users/)
- Client IDs: "Client ID limit increased from 1 to 25 per developer account." — [Spotify blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates). The apps doc says a developer account can create "up to **25 apps**", each with its own Client ID. — [Apps, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/apps)
- **[Historical]** One Development Mode Client ID per developer applied from 2026-02-11 until 2026-07-23. — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); [Spotify blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- Quota: the Development Mode quota "limits the number of requests made through development mode apps that belong to a single developer account". When the quota is exceeded, "the Web API returns a `429 Too Many Requests` response". — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **[Historical]** Before July 2026, Spotify counted the quota per Client ID. — [Web API changelog, July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- Data reduction in Development Mode: `GET /me` no longer returns `country`, `email`, `explicit_content`, `followers` or `product`. — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- One code per app: "You may not use more than one Security Code for each SDA" (Section VI.1.2). — [Developer Terms v10, effective 2025-05-15](https://developer.spotify.com/terms)
- Purpose: Development Mode supports learning, experimentation and personal non-commercial projects. — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)

### Inferences
- spot-mixer can serve at most 5 named Spotify accounts per Client ID. That fits a personal or small-group tool only.
- Extra Client IDs do not add quota, because all Development Mode apps under one account share it.
- To split one product across several Client IDs only to pass the 5-user cap could conflict with Terms VI.1.2 (one Security Code per SDA). This is my reading, not a stated Spotify rule.
- The owner's Premium subscription is a runtime dependency. If it lapses, the app fails for all users.
- The app cannot read a user's subscription level (`product` was removed), so it cannot check Premium status through `GET /me`. It also cannot read `email`. The May 2026 `account_id` field is the documented stable key for linking accounts.
- A 403 on API calls after a successful login most likely means "user not on the allowlist". The app should show a clear message for that case.

### Gaps
- No official page names the Dashboard tab or the fields for allowlisting. The "User Management" detail comes from Community posts only.
- No official page documents the exact 403 body text for non-allowlisted users.
- Not documented: whether removing a user frees a slot, or whether the 5-user cap is per Client ID only or also per developer account.
- Not documented: any separate rules for "owner" accounts beyond the Premium requirement.

## Q3. Extended Quota Mode eligibility today

### Takeaway
Since 2025-05-15, Spotify accepts Extended Quota applications only from organizations. The organization needs a legally registered business, a launched service and at least 250k monthly active users, and it must apply from a company email. An individual or hobby project cannot get Extended Quota Mode, so spot-mixer must plan to stay in Development Mode.

### Cited Findings
- "Please note that as of May 15th 2025, Spotify only accepts applications from organizations (not individuals)." — [Quota modes, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- "Application must be sent through a company email". — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Listed requirements: "Established Business Entity (legally registered business or organisation)"; "Operating an active, and Launched Service"; "Maintaining a minimum of active users (at least 250k MAUs)"; "Being available in key Spotify markets"; "Commercial Viability"; "Adherence to Terms". — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Process: "If your Partner Application form is approved, you can ask Spotify to move your app from development mode into extended quota mode." Spotify's app review team checks compliance with the Developer Policy. "This review process can take up to six weeks." The questionnaire has 4 steps. — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Extended Quota benefits: "Apps in this category can be installed by an unlimited number of users"; "the allowlist in development mode no longer applies"; "Extended quota mode apps also have access to a higher rate limit than development mode apps do." — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Criteria wording: extended access "will be reserved for apps with established, scalable, and impactful use cases". — [Spotify blog, posted 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- Terms: "If your SDA reaches a quota limit, you may be eligible to apply for extended access using the forms provided to you." (VI.7.2). "you must use the additional quota granted only for the use case that Spotify reviewed" (VI.7.3). — [Developer Terms v10, effective 2025-05-15](https://developer.spotify.com/terms)
- Development Mode "should not be relied on as a foundation for building or scaling a business on Spotify." — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Some docs still describe a self-service route. The apps doc says you can "request an extension of this quota if needed" with the Request Extension link. — [Apps, undated doc](https://developer.spotify.com/documentation/web-api/concepts/apps). The rate limits doc says you can request an extension from the app detail page in the Developer Dashboard. — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- **[Historical]** In 2021, Spotify said Extended Quota apps "will have higher API rate limits and no limits on the amount of Spotify users that can connect", and that their OAuth scopes are locked to the scopes approved at review (paraphrase). — [Spotify blog, posted 2021-05-27](https://developer.spotify.com/blog/2021-05-27-improving-the-developer-and-user-experience-for-third-party-apps)

### Inferences
- An individual owner fails the first criterion (organization) and the MAU criterion. Thus spot-mixer has no route to Extended Quota Mode.
- The "Request Extension" wording on the apps and rate-limits pages looks older than the organizations-only rule. It does not override the quota modes page.

### Gaps
- Spotify does not define "key Spotify markets" or "Commercial Viability" in measurable terms.
- I could not verify whether the 2021 scope-locking rule still applies to Extended Quota apps today.

## Q4. OAuth flows, redirect URI rules, token lifetime and refresh token behavior

### Takeaway
Spotify supports Authorization Code, Authorization Code with PKCE, and Client Credentials. Spotify sunset the Implicit Grant on 2025-11-27. Redirect URIs must use HTTPS. The only HTTP exception is a loopback IP literal (`http://127.0.0.1:PORT` or `http://[::1]:PORT`). `localhost` is not allowed. Redirect URIs must match exactly, except that loopback URIs may use a dynamic port. Access tokens last 1 hour. Refresh tokens expire 6 months after the user authorizes, and a refresh does not extend that window. Rotation is possible but not guaranteed.

### Cited Findings
- Flows: "Spotify implements the following ones:" Authorization code; Authorization code with PKCE extension; Client credentials. The sidebar lists "Implicit grant [Deprecated]". — [Authorization, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- Flow table: Authorization code gives access to user resources, needs a secret (server-side), and allows access token refresh. PKCE gives access to user resources, needs no secret, and allows refresh. Client credentials gives no access to user resources, needs a secret, and allows no refresh. — [Authorization, undated doc](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- Choice of flow: for long-running server-side apps where "the client secret can be safely stored, then the authorization code flow is the recommended choice." PKCE fits apps where "storing the client secret is not safe". Client credentials "does not include user authorization". — [Authorization, undated doc](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- Implicit grant: "The Implicit Grant Flow will be sunset on November 27, 2025." — [Implicit Grant Flow, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/implicit-flow)
- HTTPS: "Use HTTPS for your redirect URI, unless you are using a loopback address, when HTTP is permitted." — [Redirect URIs, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- Loopback: use the explicit IPv4 or IPv6 literal, for example "`http://127.0.0.1:PORT`" and "`http://[::1]:PORT`". The examples are `https://example.com/callback`, `http://127.0.0.1:8000/callback` and `http://[::1]:8000/callback`. — [Redirect URIs, undated doc](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- localhost: "`localhost` is not allowed as redirect URI." — [Redirect URIs, undated doc](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- Exact match: "The definition of the redirect URI must exactly match the redirect URI you provide when you create your app." "The only exception is for loopback IP literals, which can dynamically be assigned ports." — [Redirect URIs, undated doc](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- Dynamic ports: "register your redirect URI with a loopback IP literal, but without any port number." "You can add the dynamically assigned port number to the redirect URI in the authorization request." "Please note that this is only supported for loopback IP literals, and not for other redirect URIs." — [Redirect URIs, undated doc](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- Custom schemes such as `com.example://callback` "will still be supported." — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)
- The getting-started tutorial uses `http://127.0.0.1:3000` as its example redirect URI. — [Getting started, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/getting-started)
- App settings: you "enter one or more addresses that you want to allowlist with Spotify" as redirect URIs. Secret handling: "Always store the client secret key securely; never reveal it publicly!" A ROTATE action on the app overview page regenerates a leaked secret. — [Apps, undated doc](https://developer.spotify.com/documentation/web-api/concepts/apps)
- Access token lifetime: access tokens are "intentionally configured to have a limited lifespan (1 hour)". `expires_in` refers to the access token, "not the refresh token". — [Refreshing tokens, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Refresh request: `POST https://accounts.spotify.com/api/token` with `grant_type=refresh_token` and `refresh_token`. `client_id` is required only for PKCE. `Content-Type: application/x-www-form-urlencoded` is required. For the Authorization Code flow, send `Authorization: Basic <base64 client_id:client_secret>`. — [Refreshing tokens, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Rotation: "a refresh token might not be included in each response". If no new token comes back, keep the existing one. The sample code stores a new token only "if (response.refresh_token)". — [Refreshing tokens, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Expiry: refresh tokens for apps registered in the Developer Dashboard "have a lifetime of 6 months". The clock starts when the user authorizes the app. Refreshing does "not extend the refresh token's lifetime". "Build reauthorization into your app before refresh tokens expire." — [Refreshing tokens, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Expiry dates and errors: new apps from 2026-06-18, existing apps from 2026-07-20. "Refreshing an access token does not reset or extend the refresh token's 6-month lifetime." An expired token gives a "`400 Bad Request` response with an `invalid_grant` error." Handle `invalid_grant` by discarding the stored token and sending the user through sign-in again; do not retry the refresh. Store your own authorization timestamp, because refresh tokens do not expose an issue date. — [Spotify blog, posted 2026-06-18](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration)
- Revocation: `invalid_grant` comes back when a token is "expired, revoked, or otherwise invalid". — [Refreshing tokens, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Scopes: "Make sure that your app isn't requesting any OAuth scopes that it does not need." "Don't ask for scopes on the basis that your app might include a feature later that requires them." You "can always ask users to re-authorize your app later." — [Compliance Tips, undated doc, read 2026-10-25](https://developer.spotify.com/compliance-tips)
- **[Historical]** The implicit grant (`response_type=token`) worked until 2025-11-27 for apps created before 2025-04-09. HTTP redirect URIs that were not loopback, and `localhost` redirect URIs, followed the same dates. — [Spotify blog, posted 2025-02-12](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify); [Spotify blog, posted 2025-10-14](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025)

### Inferences
- spot-mixer has a server (Bun) that can keep a secret. Spotify's guidance therefore points to the Authorization Code flow. PKCE is also allowed.
- Register an HTTPS callback for any deployed host. For local development, register `http://127.0.0.1:<port>/callback`, not `http://localhost:<port>/callback`. If the Docker Compose host port can change, register the loopback URI without a port.
- The token store (Redis) must keep the refresh token and an "authorized at" timestamp. It must replace the refresh token when the token endpoint returns a new one. On `invalid_grant` it must delete the token and ask the user to sign in again. Plan a re-consent prompt before the 6-month limit.
- A new sign-in issues a new refresh token, so it probably starts a new 6-month window. This follows from "the clock starts at the user's original authorization", but no page states it directly.

### Gaps
- Not documented: whether issuing a new refresh token invalidates the old one, and whether PKCE refreshes always rotate the token.
- Not covered in the official pages that I read: user-initiated revocation (removing app access from the Spotify account) and how fast it takes effect.
- Not stated: whether exact matching is case-sensitive or tolerates a trailing slash.
- I did not collect the PKCE parameter details (challenge method, verifier length).

## Q5. Rate-limit behavior

### Takeaway
Spotify calculates the rate limit per app over a rolling 30-second window. Spotify publishes no numbers. Extended Quota apps get a "much higher" limit. A 429 response normally carries `Retry-After` in seconds. Development Mode apps also have a separate request quota. Since July 2026 Spotify counts that quota per developer account, and a quota 429 carries a JSON body with `"reason": "QUOTA_EXCEEDED"`.

### Cited Findings
- Spotify's rate limit is "calculated based on the number of calls that your app makes to Spotify in a rolling 30 second window." The page speaks of "the rate limit for your app". — [Rate limits, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- "The limit varies depending on whether your app is in development mode or extended quota mode." Extended quota apps have "a rate limit that is much higher than apps in development mode". The page gives no request counts; its chart is only an example. — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- Development Mode quota restrictions "have a different enforcement mechanism than rate limits." — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- Custom limits: "A few API endpoints, like the playlist image upload endpoint, have a custom rate limit that may differ from your app-wide rate limit." — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- 429: "The header of the 429 response will normally include a `Retry-After` header with a value in seconds." Wait that number of seconds before you call the API again. — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- Quota 429: "When a user's quota has been exceeded, the 429 Too Many Requests response now contains the following body:" with `"message": "Too many requests"` and `"reason": "QUOTA_EXCEEDED"` (July 2026). — [Web API changelog, July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026); [Spotify blog, posted 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- Quota scope: the quota covers "development mode apps that belong to a single developer account". — [Quota modes, undated doc](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Recommended strategies: back off and retry after `Retry-After`; use batch APIs (for example Get Multiple Albums); store a playlist's `snapshot_id` to skip downloading an unchanged playlist; check the request graphs in the Developer Dashboard; make calls lazy (only on user action). — [Rate limits, undated doc](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- "Implement exponential backoff and respect the Retry-After header when receiving HTTP 429 responses." — [Building with AI, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/web-api/tutorials/building-with-ai)
- Terms: "Spotify may limit the number of service calls that your SDA may make" (VI.2). "Spotify may use quotas and place use restrictions to ensure that the Spotify Platform is accessed and used as intended" (VI.7.1). Section IV.2.4(b) prohibits calls in excess of what the app strictly needs (paraphrase). — [Developer Terms v10, effective 2025-05-15](https://developer.spotify.com/terms)
- The batch endpoints that the rate-limit page recommends (`GET /albums`, `/tracks`, `/artists`) are removed for new Development Mode apps. — [Migration guide, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

### Inferences
- spot-mixer must handle two kinds of 429. A rate-limit 429 carries `Retry-After`. A quota 429 carries `reason: QUOTA_EXCEEDED`. The client should read both the header and the body.
- Without batch endpoints, a mix over N artists and M albums needs about one call per item. The app needs a concurrency limit, caching (within the Terms limits in Q6) and lazy loading.
- The quota is shared across all Client IDs of the owner's account. A test app under the same account uses the same budget as production.

### Gaps
- Spotify publishes no rate-limit or quota numbers, and no window length for the quota.
- Not stated: whether a quota 429 includes `Retry-After`, and the full JSON structure around `message` and `reason`.
- Not stated: whether rate limits also apply per user. The July 2026 changelog says "a user's quota", and that wording is ambiguous.

## Q6. Developer Terms (version 10) and Developer Policy clauses that constrain a playlist-mixing app

### Takeaway
The Developer Terms (version 10) and the Developer Policy both took effect on 2025-05-15. They limit spot-mixer in seven areas. (1) Caching: no indefinite storage, no databases of Spotify Content, and keep displayed data current. Spotify sets no maximum duration. (2) Disconnect: provide a disconnect function, and delete the user's personal data within 5 days. (3) ML/AI: no training on, or ingesting of, Spotify Content. (4) Other services: no integration with streams or content from another service, and no transfer of Spotify Content to third parties. (5) Analysis: no derived listenership metrics or user profiles. (6) Commercial use: limited, and Development Mode is meant for non-commercial use. (7) Branding: attribute with the Spotify logo, and link back to the album, track or playlist on Spotify. No clause addresses playlist creation directly.

### Cited Findings

#### Versions and definitions
- Developer Terms: "Version 10, effective as of 15 May, 2025". — [Developer Terms, effective 2025-05-15](https://developer.spotify.com/terms)
- Developer Policy: "Effective as of 15 May, 2025". No version number is shown. — [Developer Policy, effective 2025-05-15](https://developer.spotify.com/policy)
- Design and Branding Guidelines and Compliance Tips show no version or date ("© 2026 Spotify AB" footer only). — [Design guidelines, undated doc, read 2026-10-25](https://developer.spotify.com/documentation/design); [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)
- "Spotify Content" (II.8) "means any content, data, information or material made available through the Spotify Platform". "SDA" (II.9) means "any application, website or service that accesses the Spotify Service or Spotify Content". A "Non-Streaming SDA" "is an SDA that does not provide any Streaming functionality." — [Developer Terms v10](https://developer.spotify.com/terms)

#### Caching and storing Spotify Content and metadata
- IV.3.1: "Except as otherwise set out in these Developer Terms, you may not store, aggregate or create compilations or databases of Spotify Content, other than as strictly necessary to operate your SDA. You must use reasonable efforts to ensure that any data you display to users is the most up to date data available through the Spotify Platform, and to delete older data. Do not store Spotify Content indefinitely." — [Developer Terms v10](https://developer.spotify.com/terms)
- IV.3.2: "Do not locally cache any Spotify Content, except as strictly necessary to enhance the performance of your SDA". The permitted temporary caching covers "metadata and cover art" and Premium-only Conditional Downloads. — [Developer Terms v10](https://developer.spotify.com/terms)
- Neither the Terms nor the Policy gives a maximum cache duration. — [Developer Terms v10](https://developer.spotify.com/terms); [Developer Policy](https://developer.spotify.com/policy)
- Guidance: "Avoid storing data that your app can fetch on the fly through the Spotify API." — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips). The AI guide's suggested prompt rule reads "do not cache Spotify content beyond what is needed for immediate use". This is tutorial guidance, not a Terms clause. — [Building with AI, undated doc](https://developer.spotify.com/documentation/web-api/tutorials/building-with-ai)

#### Storing user (listening) data and deleting it on disconnect
- V.3: "You will only request the data you need to operate your SDA." V.7: "You may only process Spotify Personal Data for as long as is necessary to provide your SDA to the applicable user". — [Developer Terms v10](https://developer.spotify.com/terms)
- V.8: "You must provide all users with a working and easily accessible mechanism to disconnect". After a disconnect, "you agree to delete and no longer request or process any of that user's Spotify Personal Data". — [Developer Terms v10](https://developer.spotify.com/terms)
- Appendix A, 5(c): "you shall discontinue accessing the applicable Spotify Personal Data" and "delete the applicable Spotify Personal Data in your possession or control within five (5) days". — [Developer Terms v10](https://developer.spotify.com/terms)
- V.4: users may consent at connection to share "certain categories of Spotify Personal Data with you, with those categories selected by you in advance." For other Spotify Personal Data, "you must obtain explicit consent from the user who provided the data to us before using it for any purpose other than displaying it back to the user on your SDA." — [Developer Terms v10](https://developer.spotify.com/terms)
- Appendix A, section 8 bars making Personal Data available "for any valuable consideration (monetary or otherwise)". V.5: "You will not sell any Spotify Content or other data obtained from Spotify." — [Developer Terms v10](https://developer.spotify.com/terms)
- Policy I.1: "You must provide a privacy policy which clearly describes how you intend to access, use, process and disclose user data." "Don't email users unless they have provided you with their explicit consent." Users need "an easily accessible mechanism to disconnect their Spotify account". After disconnect, "you agree to delete and no longer request or process any of that user's personal data." — [Developer Policy, effective 2025-05-15](https://developer.spotify.com/policy)
- A data-deletion request "should be easy and your response must be prompt and clear". — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)

#### Creating or changing playlists for a user
- The Terms and the Policy contain no clause about creating or changing a user's playlists. Outside II.4.2 and V.2.3 (link-back rules), the only Policy text that mentions playlists is III.9: "Do not build an SDA that enables the transfer of data to another service, except for the purpose of enabling a user to transfer their personal data, or the metadata of the user's playlists to another service." — [Developer Policy](https://developer.spotify.com/policy)
- The Terms IV.2.4(a) bars "using any robot, spider, site search/retrieval application, or other tool to retrieve, duplicate, or index any portion" of the Spotify Service or Spotify Content. The clause says Spotify Content "includes playlist data". — [Developer Terms v10](https://developer.spotify.com/terms)
- Compliance guidance: request only the scopes you need, and tell the user why each scope is needed. — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)

#### Combining Spotify data with data from other services
- Policy III.5: "Do not create any product or service which is integrated with streams or content from another service." — [Developer Policy](https://developer.spotify.com/policy)
- Policy III.9 (quoted above) limits data transfer to another service.
- Terms IV.2.5: "do not transfer Spotify Content to third parties". It also bars "directly or indirectly transferring any data (including aggregate, anonymous or derivative data)" to "any ad network, ad exchange, data broker, or other advertising or monetization-related toolset". — [Developer Terms v10](https://developer.spotify.com/terms)
- Branding: "Don't use the Spotify brand together with any other brand or in any co-branded communications." — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design)
- "Repackaging data that you've gathered from the API and selling it to businesses" is not allowed. — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)

#### Analysis, metrics and replicating Spotify
- Policy III.13: "Do not analyze the Spotify Content or the Spotify Service for any purpose, including without limitation, creating new or derived listenership metrics, benchmarking, functionality, usage statistics, user metrics, or building profiles of users, including for the purpose of targeting them with advertising or marketing." — [Developer Policy](https://developer.spotify.com/policy)
- Policy III.11: "Do not build products or services that mimic, or replicate or attempt to replace a core user experience of Spotify or its group companies without our prior written permission." The product "must add independent value or functionality that improves users' interactions with Spotify." — [Developer Policy](https://developer.spotify.com/policy)
- Policy III.7: "Do not permit any device or system to segue, mix, re-mix, or overlap any Spotify Content with any other audio content (including other Spotify Content)." — [Developer Policy](https://developer.spotify.com/policy)
- Policy II.2 bars artificial manipulation of play or follow counts (paraphrase). — [Developer Policy](https://developer.spotify.com/policy)

#### Machine learning and AI
- Terms IV.2.1(a) prohibits "using the Spotify Platform or any Spotify Content to train a machine learning or AI model or otherwise ingesting Spotify Content into a machine learning or AI model;". — [Developer Terms v10](https://developer.spotify.com/terms)
- Policy III.14: "Do not use the Spotify Platform or any Spotify Content to train a machine learning or AI model". — [Developer Policy](https://developer.spotify.com/policy)

#### Commercial use
- Terms III.1(a) licenses you to "Use the Spotify Platform to develop and distribute Streaming SDAs and Non-Streaming SDAs that comply with the Branding Guidelines: (i) for private personal use; and (ii) on Approved Devices; and (iii) in accordance with the Developer Policy." — [Developer Terms v10](https://developer.spotify.com/terms)
- Policy IV.2: "Except for the limited commercial uses for Non-Streaming SDAs (set out below) commercial uses are not permitted for SDAs." IV.3: "The following are the only permitted commercial uses of Non-Streaming SDAs:" IV.3.1: "the sale of advertising, sponsorships, or promotions on the Non-Streaming SDA;" IV.3.2: "the sale of, or sale of access to, a Non-Streaming SDA (including any e-commerce initiated via the Non-Streaming SDA)." — [Developer Policy](https://developer.spotify.com/policy)
- Policy IV.1: streaming of music sound recordings "shall only be made available to subscribers" of the Premium Spotify Service. — [Developer Policy](https://developer.spotify.com/policy)
- Policy III.10: "Do not build products or services which are targeted for use by businesses". — [Developer Policy](https://developer.spotify.com/policy)
- Example of an allowed non-streaming commercial use: "Making a playlist manager app and charging users $5/month to use it." — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)
- Development Mode supports personal non-commercial projects and is not a basis for a business. — [Spotify blog, posted 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)

#### Attribution and branding
- Policy II.4.1: "If you display any Spotify Content you must clearly attribute the content as being supplied and made available by Spotify". II.4.2: "Metadata, cover art and Audio Preview Clips must be accompanied by a link back to the applicable album, content or playlist on the Spotify Service". II.4.3: "You must not offer metadata, cover art, and/or Audio Preview Clips as a standalone service or product." — [Developer Policy](https://developer.spotify.com/policy)
- Policy II.5: "metadata and cover art may only be used in connection with the underlying content". "there shall be no playback of Spotify Content without showing relevant cover art and metadata in your SDA." — [Developer Policy](https://developer.spotify.com/policy)
- Terms III.1(c): "Use any of the Spotify Marks found in the Branding Guidelines solely to promote your use" of the platform. IV.2.3(b) bars uses "such as using Spotify Marks as part of the name of your company or service." IV.2.1(b): "You may adjust the size of metadata or cover art as necessary;". — [Developer Terms v10](https://developer.spotify.com/terms)
- Logo: "you must always attribute content from Spotify with the logo." "In partner integrations, you should always use our full logo (icon + wordmark)." "Use the icon on its own only if you do not have enough room for the full logo." "The Spotify logo should never be smaller than 70px in digital or 20mm in print". The icon minimum is "21px in digital or 6mm in print". "The exclusion zone is equal to half the height of the icon." "The Spotify green logo should only be used on a black or white background". — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design)
- Link back: use "OPEN SPOTIFY, PLAY ON SPOTIFY or LISTEN ON SPOTIFY" when the Spotify app is installed, and "GET SPOTIFY FREE" when it is not. Metadata "must always link back to the Spotify Service." — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design)
- Cover art: "You may only use the artwork provided by Spotify." "Don't crop the artwork in any way." "Don't overlay images or text on top of the artwork." "Small & medium devices should use a 4px corner radius, whereas large devices should use a 8px corner radius." When space is limited, "it's OK to not include any album artwork." — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design); "do not modify, crop or adjust artwork" — [Compliance Tips, undated doc](https://developer.spotify.com/compliance-tips)
- Metadata: titles "must always be presented with the metadata provided by Spotify." "You may truncate metadata if space is limited. The user should always be able to view the entire metadata." Plan layouts for 25 characters (playlist and album names), 18 (artist names) and 23 (track names). — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design)
- App name and logo (paraphrase): the app name must not contain "Spotify" or sound or look like it. "for Spotify" wording is allowed if it does not imply endorsement. The app logo must not look like Spotify brand elements (Spotify Green, the circle, the waves). — [Design guidelines, undated doc](https://developer.spotify.com/documentation/design)

### Inferences
- **Redis cache:** every cached Spotify object (metadata, cover-art URLs, top-artist lists) is "Spotify Content". Give each key a bounded TTL. Refresh data before display. Do not build a persistent catalog. The TTL length is a design choice, because Spotify sets no number.
- **Disconnect:** spot-mixer needs a "disconnect Spotify" action that deletes the user's tokens, cached personal data and derived data within 5 days (immediate deletion is simplest). It also needs a privacy policy page.
- **Curated mix (feature b):** using a user's top artists to build a playlist for that same user looks like "displaying it back" to the user under Terms V.4, if the scope is requested at sign-in. Policy III.13 bans "derived listenership metrics" and "building profiles of users". So keep the processing transient and user-facing, and do not store long-term taste profiles. This is my reading. Spotify has not ruled on it.
- **Combining with Last.fm or Deezer:** III.5 ("integrated with streams or content from another service") and IV.2.5 ("do not transfer Spotify Content to third parties") create a real risk. Examples are play counts from another service that drive track choice, or Spotify track names sent to a third-party API. The co-branding ban also limits showing another service's logo next to Spotify's. No source gives an explicit ruling on metadata lookups, so treat this as a compliance risk.
- **ML/AI:** "otherwise ingesting Spotify Content into a machine learning or AI model" covers more than training. Do not send Spotify metadata or listening data to an LLM to build the curated mix.
- **Audio mixing:** Policy III.7 covers audio (segue, mix, overlap). spot-mixer only composes playlists and does no audio processing, so III.7 does not apply. Do not add crossfades or audio blending.
- **Replicating Spotify:** III.11 requires "independent value". Artist-mix and personal-mix playlists resemble Spotify's own personalized playlists, so the app must clearly add value of its own.
- **Commercial use:** without playback, spot-mixer is a Non-Streaming SDA, and Policy IV.3 would allow ads or paid access. But Development Mode is for non-commercial use, Terms III.1(a) says "private personal use", and Extended Quota is closed to individuals. In practice, treat spot-mixer as non-commercial.
- **Branding:** every track, album, artist and playlist that the app shows needs a link back to Spotify. The app also needs Spotify logo attribution and uncropped cover art with a 4 px or 8 px corner radius. After the app creates a playlist, show an "OPEN SPOTIFY" (or similar) link to it.
- **Name risk:** the name "spot-mixer" starts with "spot". The guideline bans names that contain "Spotify" or sound or look like it. Review the name against the exact guideline text before any public release.

### Gaps
- Spotify publishes no maximum cache duration for metadata or cover art.
- No clause addresses creating or changing playlists for a user, or the use of artist "most-played" data in a generated playlist.
- No official guidance says whether a lookup in another service by Spotify IDs or names counts as "integration" (III.5) or "transfer" (IV.2.5).
- I captured the exact Design guidelines wording on app names only as a paraphrase.
- Not checked: the Data Protection Appendix beyond sections 5(c) and 8.
