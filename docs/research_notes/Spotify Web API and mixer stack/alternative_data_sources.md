# Non-Spotify data sources that replace or supplement restricted Spotify Web API features (spot-mixer), state as of 2026-10-25

Method and markers: I read the primary docs and terms pages. I also sent anonymous, read-only HTTP requests on 2026-10-25. A "Live probe" link is the exact request that I sent. **[UNVERIFIED]** marks a claim that comes from a secondary source or a search-engine summary, or that I could not confirm on the primary page. A fetch tool extracted the terms-page text, and it can paraphrase. Check the exact wording before you rely on a clause for a legal decision. This file does not cover Spotify Web API endpoint details. Another researcher covers them.

## 1. Artist top tracks (an artist's most-played or most popular tracks)

### Takeaway
Deezer `GET /artist/{id}/top` is the source with the least friction. It needs no key and it worked on 2026-10-25. But its list items have no ISRC, so each track needs one more `GET /track/{id}` call, and its terms allow non-commercial use only. Last.fm `artist.getTopTracks` gives scrobble-based counts but no ISRC. It needs an API key, and its terms are non-commercial with attribution and approval duties. ListenBrainz `top-recordings-for-artist` now returns 401 without a user token. MusicBrainz is the free ID hub (MBID, ISRC, Spotify, Deezer and Last.fm links) at 1 request per second.

### Cited Findings

#### Last.fm `artist.getTopTracks`
- Parameters: `artist` (required unless `mbid` is given), `mbid`, `autocorrect[0|1]`, `page` (default 1), `limit` (default 50) and `api_key` (required). The page says that the method "does not require authentication". This means that no user session is necessary, but you still need an API key. — [Last.fm: artist.getTopTracks](https://www.last.fm/api/show/artist.getTopTracks)
- The method returns the top tracks "ordered by popularity". Each `track` has a `rank` attribute, `name`, `mbid` (empty in the official sample), `playcount` (56325 in the sample), `listeners` (23217 in the sample), `url` and `image`. There is no ISRC field. The page does not define `playcount` or `listeners`. — [Last.fm: artist.getTopTracks](https://www.last.fm/api/show/artist.getTopTracks)
- Rate limits: §4.4 says "Last.fm sets and enforces limits on use of the API". You must not circumvent the limits. Higher use needs express consent, which can come with added terms or charges. The terms publish no number. — [Last.fm API Terms of Service](https://www.last.fm/api/tos)
- Error 29 is "Rate Limit Exceeded – Your IP has made too many requests in a short period, exceeding our API guidelines". Error 26 means a suspended API key. **[UNVERIFIED: the wording comes from a search-engine summary of the page]** — [Last.fm API error codes](https://last.fm/api/errorcodes)
- Commercial use: §3.1 allows use "solely for non-commercial purposes". §3.2 requires a commercial use agreement (contact partners@last.fm). Commercial use without a licence is a material breach and lets Last.fm end access immediately. Last.fm also reserves the right to "share in revenue generated from your use of Last.fm Data". — [Last.fm API TOS](https://www.last.fm/api/tos)
- Caching and storage: §4.3.4 sets a "Reasonable Usage Cap" of "a maximum of 100 MB". It also says "You will implement suitable caching in accordance with the HTTP headers sent with web service responses". §9.3 requires you to delete Last.fm Data after termination. — [Last.fm API TOS](https://www.last.fm/api/tos)
- Attribution: §2.7 requires a "powered by AudioScrobbler" button that links to Last.fm. Links about artists, albums or tracks must go to the matching Last.fm catalogue page. "All button/link placements are subject to approval by Last.fm". Public pages that use the web services must be "previously approved by Last.fm in writing". — [Last.fm API TOS](https://www.last.fm/api/tos)
- Content limits: §5.1.8 excludes audio, audiovisual content, images and artwork ("You will not use any audio, audiovisual, images and/or artwork"). §5.1.6 forbids use of the data to personally identify or contact a user. §2.6 says "You must not gather any other data from Last.fm in any other way". — [Last.fm API TOS](https://www.last.fm/api/tos)
- Maintenance: the docs and terms pages are online in 2026 (footer "Last.fm Limited © 2026"). I did not make a live call because I had no API key. — [Last.fm API TOS](https://www.last.fm/api/tos)

#### Deezer `GET https://api.deezer.com/artist/{id}/top`
- The request needs no key, token or login. `limit=2` returned 2 items. The body has `data[]`, `total` and `next` (paging). — [Live probe: /artist/27/top?limit=2](https://api.deezer.com/artist/27/top?limit=2)
- With `limit=100` and `limit=200`, the list returned 99 items and `total: 99` for Daft Punk, with no `next`. The `tracklist` link on the artist object uses `limit=50` as its default. — [Live probe: limit=100](https://api.deezer.com/artist/27/top?limit=100)
- Each item in the top list has `id`, `readable`, `title`, `title_short`, `title_version`, `link`, `duration`, `rank`, `explicit_lyrics`, `explicit_content_lyrics`, `explicit_content_cover`, `preview`, `md5_image`, `contributors`, `artist`, `album` and `type`. The items have **no `isrc`** field (0 occurrences). — [Live probe](https://api.deezer.com/artist/27/top?limit=2)
- The full track object (`GET /track/{id}`) adds `isrc`, `bpm`, `gain`, `release_date`, `track_position`, `disk_number`, `available_countries` and `track_token`. — [Live probe: /track/3135556](https://api.deezer.com/track/3135556)
- `rank` is an integer (954234 for "Get Lucky (Radio Edit)"). I could not load the Deezer docs to confirm its definition. — [Live probe](https://api.deezer.com/artist/27/top?limit=2)
- The top lists contain more than one version of a song. The Daft Punk top 10 had two "Get Lucky" ISRCs (USQX91300809, the radio edit, and USQX91300108) and two "One More Time" ISRCs (GBDUW0000053 and GBDUW0000054). — [Live probe: /artist/27/top?limit=10](https://api.deezer.com/artist/27/top?limit=10)
- Each preview URL has a signed `hdnea=exp=` token. In the probe, the token expired 900 s after the request timestamp in the same response. — [Live probe](https://api.deezer.com/artist/27/top?limit=2)
- Artist search works without a key. `GET /search/artist?q=daft%20punk&limit=1` returned artist id 27. — [Live probe](https://api.deezer.com/search/artist?q=daft%20punk&limit=1)
- Quota: a third-party proxy README says that the Deezer quota is "50 requests per 5 seconds per IP". It uses a sliding-window limiter and does not use a token bucket, because a bucket can send a double burst in one window and trip the per-IP quota. **[UNVERIFIED: the official Deezer docs did not render for me]** — [Rocksky Deezer README](https://next.tangled.org/rocksky.app/rocksky/tree/main/deezer)
- The developer portal says: "You have to login to accept the terms and conditions of the simple API". — [Deezer for Developers](https://developers.deezer.com/api/track)
- Terms: §IV says "use of the Services is strictly limited for a non-commercial purpose", and the developer must not earn money from the Services or Content. §II(c) lets Deezer "modify, restrict or remove" access at any time. §IV says that the Services and Content "shall not be associated, directly or indirectly with any trademark, brand name, or logo". §VII requires the Deezer Trademark Guidelines. Full-length content needs Premium+; other content is "accessible only up to 30 seconds". The terms give no numeric quota, no caching rule and no "last updated" date. — [Deezer Terms of Use](https://developers.deezer.com/termsofuse)
- Maintenance: all public Deezer endpoints that I tried answered on 2026-10-25 (see the probes in this file).

#### ListenBrainz popularity API
- Endpoints: `GET /1/popularity/top-recordings-for-artist/(artist_mbid)` and `GET /1/popularity/top-release-groups-for-artist/(artist_mbid)` return top items "by listen count", with `total_listen_count` and `total_user_count`. The bulk endpoints `POST /1/popularity/recording`, `/artist`, `/release` and `/release-group` take MBID lists. They accept up to `MAX_ITEMS_PER_GET` items (the page gives no value), keep the input order, and return `null` counts for unknown items. — [ListenBrainz Popularity API](https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html)
- Top-recordings fields: `artist_mbids`, `artist_name`, `caa_id`, `caa_release_mbid`, `length`, `recording_mbid`, `recording_name`, `release_color`, `release_mbid`, `release_name`, `total_listen_count` and `total_user_count`. The response has MBIDs but no ISRC. — [ListenBrainz Popularity API](https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html)
- **Auth change:** without a token, `top-recordings-for-artist` returned HTTP 401 with this message: "Due to bad actors and AI scrapers causing undue traffic on our sites, you need to provide an Auth token for this endpoint. Sorry for this mess." The headers were `X-RateLimit-Limit: 30` and `X-RateLimit-Reset-In: 10`. — [Live probe](https://api.listenbrainz.org/1/popularity/top-recordings-for-artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56)
- The bulk `POST /1/popularity/artist` still worked without a token. For Daft Punk it returned `total_listen_count` 48,435,624 and `total_user_count` 395,703. — [Live probe (POST body `{"artist_mbids":["056e4f3e-…"]}`)](https://api.listenbrainz.org/1/popularity/artist)
- Tokens: each user gets a token on the settings page. Send it as `Authorization: Token <token>`. Requests with a valid token "may receive higher rate limits". Clients must "never make more than ONE call per second". The server sends 429 when a client exceeds the limit. The headers are `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-In` and `X-RateLimit-Reset`. — [ListenBrainz API index](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html)
- Older client-library docs still say that reads need no authentication. This is out of date for the endpoint above. — [pylistenbrainz docs](https://pylistenbrainz.readthedocs.io)

#### MusicBrainz as the ID hub
- Rate rules (dated 2012-01-08; the rules "may change at any time"): on average 1 request per second per IP. Requests above that get HTTP 503. Each request needs a User-Agent that lets MusicBrainz contact you, for example "Application name/<version> ( contact-url )" or "( contact-email )". Blank or generic agents (for example "Python-urllib") count as anonymous and share about 50 req/s. The global limit is about 300 req/s. — [MusicBrainz API Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- Live responses have `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers (1900 and 1708 in my probe). — [Live probe: ISRC lookup](https://musicbrainz.org/ws/2/isrc/GBDUW0000059?fmt=json)
- `GET /ws/2/isrc/{isrc}` returns the matching recordings (`id`, `title`, `length`, `first-release-date`). — [Live probe](https://musicbrainz.org/ws/2/isrc/GBDUW0000059?fmt=json)
- An artist lookup with `inc=url-rels` returns Spotify, Deezer and Last.fm links. Daft Punk has one Spotify URL and two Deezer artist URLs (27 and 1477045). — [Live probe](https://musicbrainz.org/ws/2/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56?inc=url-rels&fmt=json)
- Data licence: the core data is CC0, and the supplementary data is CC BY-NC-SA 3.0. MetaBrainz licenses the data for commercial use to fund the project. The page does not cover commercial use of the web service itself. — [MusicBrainz Data License](https://musicbrainz.org/doc/About/Data_License)
- MetaBrainz lists paid supporter tiers for companies, for example Bronze "For popular mobile apps and for small to mid-size start-ups with public products". It also has a Non-profit tier that includes "authors of open-source software using our data". — [MetaBrainz supporters](https://metabrainz.org/supporters)

### Inferences
- If Spotify Top Tracks is not available, Deezer is the cheapest way to get the most-played tracks. It needs one call for the top list and one `/track/{id}` call for each ISRC. For 10 tracks, that is about 11 calls for each artist. This is far below 50 calls per 5 s, if the third-party figure is correct.
- Last.fm `playcount` probably counts all scrobbles, and `listeners` probably counts distinct scrobbling users. This is my reading, because the docs do not define the fields. Last.fm only sees users who scrobble, so its data leans toward its own user base.
- The ListenBrainz per-artist top recordings endpoint now needs a token. A server app would have to send the operator's own token for all users, and the terms for that use are not documented. The bulk POST endpoints do not need a token, so they can still rank candidate recordings by MBID.
- Remove duplicate versions (radio edit and album version, remasters) before you mix. Group by normalized title and artist and keep one version (see section 4).
- MusicBrainz gives a bridge that needs no key: Spotify artist URL → MBID → Deezer artist ID and Last.fm URL. Some artists have more than one Deezer ID. Check the name or the overlap of top tracks to select the correct one.

### Gaps
- The official Deezer quota text and the definition of `rank`: the Deezer developer docs need JavaScript and a login. Only a third-party source gives "50 requests / 5 s".
- Last.fm publishes no numeric rate limit, and its docs give no maximum `limit`. I did not make a live Last.fm call (no key).
- The ListenBrainz pages that I read do not say whether one operator token can serve all users of an app, or when the token change started.
- I did not evaluate other popularity sources (TheAudioDB, Discogs, YouTube, Apple Music).

## 2. Similar or related artists

### Takeaway
Three free sources worked in October 2026. Last.fm `artist.getSimilar` gives a normalized `match` score (0–1) and optional MBIDs, but needs an API key and has non-commercial terms. Deezer `/artist/{id}/related` needs no key but gives no score. ListenBrainz gives MBID-based similarity through its labs API and the LB Radio endpoint. Both worked without a token in my probes, but the main API docs do not list them.

### Cited Findings

#### Last.fm `artist.getSimilar`
- Parameters: `artist` (or `mbid`), `limit` (the page gives no default), `autocorrect[0|1]` and `api_key`. No user authentication is necessary. Each artist in the response has `name`, `mbid`, `match` ("from 0 (not similar) to 1 (very similar)"), `url`, `image` (small to mega) and `streamable`. — [Last.fm: artist.getSimilar](https://www.last.fm/api/show/artist.getSimilar)
- The Last.fm API terms apply (non-commercial use, attribution, 100 MB cap, no images). — [Last.fm API TOS](https://www.last.fm/api/tos)

#### Deezer `GET /artist/{id}/related`
- No key is necessary. For Daft Punk, the first two results were Justice and Cassius. Fields: `id`, `name`, `link`, `picture*`, `nb_album`, `nb_fan`, `radio`, `tracklist` and `type`. There is no similarity score and no MBID. — [Live probe](https://api.deezer.com/artist/27/related?limit=2)
- The Deezer terms apply (non-commercial use only). — [Deezer Terms of Use](https://developers.deezer.com/termsofuse)

#### ListenBrainz labs similar-artists
- The labs index lists `similar-artists` and `similar-recordings` endpoints. — [ListenBrainz Labs API](https://labs.api.listenbrainz.org/)
- `GET https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=<mbid>&algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30` returned 200 without a token. Fields: `artist_mbid`, `name`, `comment`, `type`, `gender`, `score` and `reference_mbid`. The top results for Daft Punk were Nile Rodgers (score 10016), Gorillaz (8405), Todd Edwards (8367) and Radiohead. — [Live probe](https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=056e4f3e-d505-4dad-8ec1-d04f521cbb56&algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30)
- The main API docs have no section for labs or LB Radio, and the statistics page has no artist-similarity endpoint. — [ListenBrainz API index](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html); [ListenBrainz Statistics API](https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html)

#### ListenBrainz LB Radio (similar artists and their popular recordings)
- `GET /1/lb-radio/artist/{seed_artist_mbid}?mode=easy&max_similar_artists=3&max_recordings_per_artist=1&pop_begin=0&pop_end=100` returned 200 without a token. The body maps each similar-artist MBID to recordings with `recording_mbid`, `similar_artist_mbid`, `similar_artist_name` and `total_listen_count`. The result included the seed artist (Daft Punk, Pharrell Williams, Todd Edwards). The rate-limit headers showed 30 requests for each window. — [Live probe](https://api.listenbrainz.org/1/lb-radio/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56?mode=easy&max_similar_artists=3&max_recordings_per_artist=1&pop_begin=0&pop_end=100)

#### Other
- The ReccoBeats docs list a "Track recommendation" endpoint (`/docs/apis/get-recommendation`). I did not test it. — [ReccoBeats docs](https://reccobeats.com/docs/apis/get-track-audio-features)

### Inferences
- The Last.fm `match` score (0–1) is the easiest score to use for ranking. The ListenBrainz `score` is not normalized. Divide it by the top score for each seed before you combine it with Last.fm scores.
- ListenBrainz similarity uses MBIDs and listening sessions (the algorithm name suggests this), so it avoids ambiguous names. It runs on the "labs" service, which looks experimental. Treat it as best effort.
- Deezer related is a good fallback that needs no key. It gives Deezer IDs that go directly into `/artist/{id}/top`.
- LB Radio can replace part of Spotify Recommendations for the "curated mix" feature. Send the MBIDs of the user's top artists, get the popular recordings of similar artists, then map MBID → ISRC → Spotify.
- I found no independent comparison of quality. The Daft Punk samples from all three sources look plausible.

### Gaps
- I found no published comparison of similarity quality for Last.fm, Deezer and ListenBrainz.
- The rate limits, stability and documentation status of LB labs and LB Radio are unknown. I did not get the full list of valid `algorithm` values.
- The Last.fm `getSimilar` default and maximum `limit` are not stated.

## 3. Audio features (tempo, energy, key) to order tracks

### Takeaway
ReccoBeats is the only free source that I found that needs no key, accepts Spotify track IDs directly, and returns the full Spotify-style feature set (tempo, energy, key, mode, valence and others) plus the ISRC. It worked on 2026-10-25, but it has no SLA and no documented limits. Deezer gives `bpm` (often 0) and `gain`, but no key or energy. GetSongBPM needs a key and a mandatory backlink. AcousticBrainz still serves frozen data from 2022 and earlier, under CC0.

### Cited Findings

#### ReccoBeats
- `GET https://api.reccobeats.com/v1/audio-features?ids=<Spotify track ID>` returned 200 with `id` (ReccoBeats UUID), `href` (Spotify URL), `isrc`, `acousticness`, `danceability`, `energy`, `instrumentalness`, `key`, `liveness`, `loudness`, `mode`, `speechiness`, `tempo` and `valence`. For "One More Time": tempo 122.746, key 2, mode 1, energy 0.697. — [Live probe](https://api.reccobeats.com/v1/audio-features?ids=0DiWol3AO6WpXZgp0goxAV)
- `GET /v1/track?ids=<Spotify track ID>` returned `id`, `trackTitle`, `artists[]` (with Spotify artist URLs), `durationMs`, `isrc`, `ean`, `upc`, `href`, `availableCountries` and `popularity` (77 for this track). — [Live probe](https://api.reccobeats.com/v1/track?ids=0DiWol3AO6WpXZgp0goxAV)
- The docs list `GET /v1/track/:id/audio-features`. They also list endpoints for track recommendation, track detail, multiple tracks, track album, search, artist, album and "Analysis" (feature extraction). — [ReccoBeats: Get track's audio features](https://reccobeats.com/docs/apis/get-track-audio-features)
- A third-party catalog of the OpenAPI spec says that the API addresses resources by ReccoBeats UUID or by Spotify Base-62 ID. It also says that the API can extract features from an uploaded audio file. — [apis.io: ReccoBeats Audio Features API](https://apis.io/apis/reccobeats/reccobeats-audio-features-api/)
- Rate limits are "configured internally". If you exceed them, you get 429 with `Retry-After`. Bursts "may lead to temporary blocking", and the page recommends caching. — [ReccoBeats Rate Limit](https://reccobeats.com/docs/documentation/rate-limiting). The probe responses had no rate-limit headers and sent `Cache-Control: no-cache, no-store`. — [Live probe](https://api.reccobeats.com/v1/audio-features?ids=0DiWol3AO6WpXZgp0goxAV)
- Terms (Last Updated May 25, 2026; operator LatteBits): the API is "entirely free to use for both personal and commercial projects" and needs no API key. Users must not abuse the API. ReccoBeats can "rate-limit, block, or terminate access to any IP address without notice". The "core foundational metadata for tracks" is "aggregated from Spotify data", and the user must make sure that the use complies with third-party terms. The API is "as is" and can change, stop for a time, or shut down at any time. There is no caching or attribution clause. — [ReccoBeats Terms of Service](https://reccobeats.com/docs/documentation/terms-of-service)
- A comparison blog says that ReccoBeats coverage and reliability have been inconsistent. **[UNVERIFIED: secondary source]** — [musiciwant: Spotify audio features alternative](https://www.musiciwant.com/studio/spotify-audio-features-alternative)

#### GetSongBPM
- **[UNVERIFIED: the official page returned HTTP 403 to my fetch, so these details come from a search-engine summary of it]** The API is free, but a link back to GetSongBPM.com is REQUIRED (on the website or the store listing) for all uses, including commercial use. Without it, the account can be suspended without notice. Each app must register with a valid email address. The limit is 3000 requests per hour, and a key that exceeds it is blocked for one hour. Send the key as a URL parameter or in an `X-API-KEY` header. — [GetSongBPM API](https://getsongbpm.com/api)
- The API host is live. `https://api.getsong.co/search/?type=artist&lookup=daft+punk` without a key returned 401 `{"error":"API Key is missing."}`. — [Live probe](https://api.getsong.co/search/?type=artist&lookup=daft+punk)

#### Deezer `bpm` and `gain`
- The full track object has `bpm` and `gain`. For "Harder, Better, Faster, Stronger": `bpm` 0 and `gain` -12.4. — [Live probe](https://api.deezer.com/track/3135556)
- In the Daft Punk top 10, 6 tracks had a non-zero `bpm` (100.1 to 122.7) and 4 tracks had `bpm` 0. All 10 tracks had `gain`. There is no key, mode or energy field. — [Live probe: top 10, then /track/{id} for each](https://api.deezer.com/artist/27/top?limit=10)

#### AcousticBrainz
- In 2022, "the decision was made to stop collecting data". The site says "the website and its API will continue to be available" and "All of the data contained in AcousticBrainz is licensed under the CC0 license". — [AcousticBrainz](https://acousticbrainz.org/)
- The shutdown post says that the data "simply isn't of high enough quality to be useful for much at all". — [MetaBrainz blog, archived copy](https://gwern.net/doc/www/blog.metabrainz.org/54a8eae256b311a8a14cce1195ca19e27dd1f298.html)
- beets deprecated its AcousticBrainz plugin because the project "has been shut down". — [beets docs](https://docs.beets.io/en/latest/plugins/acousticbrainz.html)
- The API still answered on 2026-10-25. `/api/v1/{recording_mbid}/low-level` returned `bpm` 124.275, `key_key` "E", `key_scale` "major", and `isrc` and `musicbrainz_recordingid` metadata. — [Live probe](https://acousticbrainz.org/api/v1/f1a6a40f-78f5-4918-968d-f64363bae94c/low-level)

#### Other options seen (not evaluated)
- Essentia (open-source analysis that you host yourself), Cyanite (paid B2B), and an Apify "Spotify audio features" scraper actor (pay per result, maintained by the community). **[UNVERIFIED: secondary sources]** — [musiciwant comparison](https://www.musiciwant.com/studio/spotify-audio-features-alternative); [Apify actor](https://apify.com/musicae/spotify-audio-features-scraper)
- Soundcharts sells an "Audio Features API" (commercial). — [Soundcharts](https://www.soundcharts.com/en/audio-features-api)

### Inferences
- To order a mix, use ReccoBeats. One batch call, keyed by the Spotify IDs that the app already has, gives all the features. If ReccoBeats has no record, use Deezer `bpm` (non-zero values only) and AcousticBrainz as tempo fallbacks.
- ReccoBeats `popularity` can be a snapshot of Spotify popularity. Its source and freshness are not documented, so use it only as a weak tie-breaker.
- ReccoBeats has no SLA and says that its metadata comes from Spotify. Plan for outages: cache the results in Redis, and fall back to unsorted order. Also read the Spotify policy risks in section 6.
- You could analyze Deezer previews locally (for example with Essentia). But this conflicts with the Deezer content and non-commercial terms, and it adds much maintenance. I do not recommend it.
- Tempo values differ between sources ("Harder, Better, Faster, Stronger": AcousticBrainz 124.3, Deezer 0). Treat tempo as approximate, and accept half-time and double-time values when you compare tracks.

### Gaps
- ReccoBeats does not document the maximum number of IDs for each batch call, the numeric rate limits or its catalog coverage.
- I did not verify the GetSongBPM response fields (for example `tempo`, `key_of`, `open_key`) or whether it accepts Spotify IDs.
- I did not check the AcousticBrainz dump availability or the cut-off date of its coverage.
- The Deezer docs do not confirm the definition of `gain` (probably ReplayGain-style loudness).

## 4. Matching external tracks to Spotify track URIs

### Takeaway
The current Spotify Search reference still lists an `isrc` field filter for track searches, so ISRC → Spotify is the primary path. Free ISRC sources are Deezer `/track/{id}` and `/track/isrc:{isrc}`, MusicBrainz, ReccoBeats and AcousticBrainz. MusicBrainz also stores Spotify URLs as "free streaming" relationships for artists, releases and some recordings. The Odesli public API is closed in practice: calls without a key return 401 `PUBLIC_API_ACCESS_DEPRECATED`.

### Cited Findings

#### Spotify Search `isrc:` filter (the Spotify-side researcher must confirm)
- "The available filters are `album`, `artist`, `track`, `year`, `upc`, `tag:hipster`, `tag:new`, `isrc`, and `genre`." "The `isrc` and `track` filters can be used while searching tracks." The same page shows a `limit` range of 0–10 (default 5) and an `offset` range of 0–1000. — [Spotify Web API: Search](https://developer.spotify.com/documentation/web-api/reference/search)
- Several Spotify tracks can share one ISRC (thread title: "Inconsistency in audio analysis for tracks with same ISRC"). — [Spotify Community](https://community.spotify.com/t5/Spotify-for-Developers/Inconsistency-in-audio-analysis-for-tracks-with-same-ISRC/td-p/5520935)
- A developer reported that search returned only one track, but more than one track had that ISRC. Another reply said that `isrc` is a filter, not a search term, and that a query with several ISRCs joined by OR returned nothing. **[UNVERIFIED: from a search-engine summary; I did not open the threads]** — [Spotify Community: searching multiple tracks](https://community.spotify.com/t5/Spotify-for-Developers/What-s-the-best-way-to-search-for-multiple-tracks-by-multiple/td-p/5050147)
- A reissue can get a new ISRC, and a different sound recording must not share an ISRC. **[UNVERIFIED: search-engine summary]** — [Spotify Community: multiple versions with the same ISRC](https://community.spotify.com/t5/Content-Questions/Multiple-versions-same-ISRC-how-can-I-control-which-version-will/m-p/6514675/highlight/true)

#### Matching rules from a large-scale matcher (more than 90M tracks, six platforms)
- Labels issue a new ISRC for each variant (radio edits, extended mixes, remasters, reissues and some regional releases). Store ISRCs in a junction table (one canonical track, many ISRCs). A different ISRC in another source is not an error, but one ISRC on two canonical tracks is an error. — [Christiaan Maks, DEV Community](https://dev.to/christiaanrc/matching-90m-music-tracks-across-six-platforms-isrcs-fuzzy-matching-and-what-breaks-1hn)
- Normalize case and diacritics. Move "feat." credits out of the title and artist fields. Remove decoration tokens ("(Original Mix)", "[Clean]", track-number prefixes and "Part N" prefixes) with word boundaries. Try an exact match first, then a scored fuzzy search, and use duration to break ties. Decide whether you match "which song" or "which variant": removing "(Radio Edit)" is correct only for "which song". Handle "&" versus "and" and a leading "The". Never merge artists on name similarity alone. Short titles ("Home", "Stay") need a matching artist too. The article gives no numeric thresholds. — [Christiaan Maks, DEV Community](https://dev.to/christiaanrc/matching-90m-music-tracks-across-six-platforms-isrcs-fuzzy-matching-and-what-breaks-1hn)

#### MusicBrainz URL relationships to Spotify
- `GET /ws/2/url?resource=<Spotify URL>&inc=artist-rels|release-rels|recording-rels` resolved a Spotify artist (to the Daft Punk MBID), a Spotify album (to the release "Discovery") and a Spotify track (to a recording). All three use the relationship type "free streaming". — [Live probe: artist](https://musicbrainz.org/ws/2/url?resource=https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi&inc=artist-rels&fmt=json); [Live probe: album](https://musicbrainz.org/ws/2/url?resource=https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc&inc=release-rels&fmt=json); [Live probe: track](https://musicbrainz.org/ws/2/url?resource=https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV&inc=recording-rels&fmt=json)

#### Deezer ISRC lookup
- `GET https://api.deezer.com/track/isrc:GBDUW0000059` returned the full track object (id 3135556). — [Live probe](https://api.deezer.com/track/isrc:GBDUW0000059)

#### ReccoBeats as a Spotify ID → ISRC bridge
- `GET /v1/track?ids=<Spotify ID>` returns the `isrc` of the track and its Spotify `href`. — [Live probe](https://api.reccobeats.com/v1/track?ids=0DiWol3AO6WpXZgp0goxAV)

#### Odesli (song.link)
- `GET https://api.song.link/v1-alpha.1/links?url=...` without a key, and the `platform=spotify&type=song&id=...` form, both returned HTTP 401 `{"statusCode":401,"code":"PUBLIC_API_ACCESS_DEPRECATED"}`. — [Live probe](https://api.song.link/v1-alpha.1/links?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F0DiWol3AO6WpXZgp0goxAV&userCountry=US)
- A PHP wrapper README (updated 2026-10-17) saw the same 401 on 2026-10-03. It says to ask developers@song.link for a key and send it as `api_key`. It also says that 429 responses include `Retry-After`. — [Packagist: omnisong/odesli](https://packagist.org/packages/omnisong/odesli)
- The Odesli API page on Notion reportedly says that v1-alpha.1 is deprecated and was to retire on July 31, 2026, after which it returns 410 Gone. It reportedly also says that Odesli no longer issues API keys, but can allowlist users with a continuing need. **[UNVERIFIED: the page needs JavaScript; these claims come from a search-engine summary]** — [Odesli API docs (Notion)](https://linktree.notion.site/API-d0ebe08a5e304a55928405eb682f6741)
- Older wrappers still describe a tier without a key (historically 10 requests per minute) and an optional key for higher limits. This information is out of date. — [odesli.js on npm](https://www.npmjs.com/package/odesli.js)

### Inferences
- Pipeline: (1) get the ISRC from the source (Deezer `/track/{id}`, the MusicBrainz recording `isrcs`, AcousticBrainz or ReccoBeats); (2) send a Spotify search with `q=isrc:<ISRC>&type=track`; (3) if there is no hit, search `track:"<normalized title>" artist:"<primary artist>"` and score the candidates; (4) cache ISRC → Spotify URI (and the misses) in Redis.
- Tie-break rule when several Spotify tracks share one ISRC or one normalized title (my proposal; no source gives a rule): exact ISRC match in `external_ids.isrc`; the normalized primary artist matches; the track is playable in the user's market; the duration is within about ±3 s of the source; `album_type` album before single before compilation; avoid "Live", "Remix", "Remaster", "Radio Edit" and "Instrumental" unless the source title has the same token; then the earliest release date; then a stable ID order.
- Deezer top lists often contain radio edits, and the Deezer ISRC may not exist on Spotify. In that case, use the normalized text search. Do not fail the track.
- For artist mapping, MusicBrainz url-rels give Spotify, Deezer and Last.fm links in one call. Some artists have more than one Deezer ID.
- Do not build on Odesli. Treat it as shut down for new apps.

### Gaps
- Spotify does not document how it selects one track when several tracks share an ISRC.
- The share of MusicBrainz recordings that have a Spotify URL is unknown.
- I could not read the official Odesli deprecation text. It is not confirmed whether new keys are still available.

## 5. Richer user listening history beyond Spotify's top-items API

### Takeaway
There are three supplements. (1) The Spotify "Extended streaming history" export covers the full life of the account, with a `spotify_track_uri` for each play, but the user must request it and upload the files. (2) Last.fm `user.getTopArtists` and `user.getTopTracks` give charts from 7 days to all time for users who scrobble. They need only an API key and a username. (3) ListenBrainz user statistics give MBID-keyed charts for 9 ranges without a token, but the data can be weeks old.

### Cited Findings

#### Spotify "Download your data": Extended streaming history
- Request the data with the automated "Download your data" tool on the Account Privacy page. You get a ZIP of JSON files and a "Read Me First" file that describes each field. — [Spotify: Data rights and privacy settings](https://support.spotify.com/us/article/data-rights-and-privacy-settings/); [Spotify: Understanding my data](https://support.spotify.com/us/article/understanding-my-data/)
- The extended streaming history covers items "listened to or watched during the lifetime of your account". It lists 21 data points: stream end time (UTC), username, platform, milliseconds played, country, IP address, user agent, track name, artist name, album name, Spotify track URI, episode name, show name, episode URI, start reason, end reason, shuffle, skipped, offline, offline timestamp and private session. — [Spotify: Understanding my data](https://support.spotify.com/us/article/understanding-my-data/)
- The basic "Account data" streaming history covers only "the past year". It has the end time, the creator name, the item name and `msPlayed`. — [Spotify: Understanding my data](https://support.spotify.com/us/article/understanding-my-data/)
- JSON keys (from a third-party README): `ts`, `username`, `platform`, `ms_played`, `conn_country`, `ip_addr_decrypted`, `user_agent_decrypted`, `master_metadata_track_name`, `master_metadata_album_artist_name`, `master_metadata_album_album_name`, `spotify_track_uri` ("spotify:track:…"), `episode_name`, `episode_show_name`, `spotify_episode_uri`, `reason_start`, `reason_end`, `shuffle`, `skipped`, `offline`, `offline_timestamp` and `incognito_mode`. The files are `Streaming_History_Audio_*.json`. — [GitHub: Wallerand/spotify-unwrapped](https://github.com/Wallerand/spotify-unwrapped)
- Some records have `null` track, artist, album and URI values but a valid `ms_played` (more than 7,000 such records in one account). — [Spotify Community thread](https://community.spotify.com/t5/Other-Podcasts-Partners-etc/Extended-Streaming-History-missing-track-metadata/td-p/6269152)
- The older short-history files use `msPlayed`, `trackName` and `artistName`, and can contain `msPlayed: 0`. **[UNVERIFIED: search-engine summary]** — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Help-with-some-tracks-with-msPlayed-0/m-p/5520092/highlight/true)
- Importer tools: elbisaur (by kellnerd) parses Extended Streaming History JSON for ListenBrainz. It calculates the listen start time from the end time and the duration. It flags skipped tracks but does not filter them. — [jsr.io: @kellnerd/elbisaur](https://jsr.io/@kellnerd/elbisaur). A community post says that the ListenBrainz Spotify import page was "not implemented yet" at that time. **[UNVERIFIED; can be out of date]** — [scribe.disroot.org post](https://scribe.disroot.org/post/4166066)

#### Last.fm user charts
- `user.getTopArtists`: `user` (required), `period` = `overall` | `7day` | `1month` | `3month` | `6month` | `12month` (default overall), `limit` (default 50), `page` and `api_key`. No user authentication is necessary. The fields for each artist are `rank`, `name`, `playcount`, `mbid`, `url`, `streamable` and `image`. — [Last.fm: user.getTopArtists](https://www.last.fm/api/show/user.getTopArtists)
- `user.getTopTracks` uses the same period values. **[UNVERIFIED: I did not fetch that page]**
- §5.1.6 of the API terms forbids the use of Last.fm data to personally identify or contact users. — [Last.fm API TOS](https://www.last.fm/api/tos)

#### ListenBrainz user statistics
- `GET /1/stats/user/{mb_username}/artists`, `/releases`, `/release-groups` and `/recordings`, plus listening-activity, artist-activity, era-activity, genre-activity, daily-activity, artist-map and year-in-music. Ranges: `this_week`, `this_month`, `this_year`, `week`, `month`, `quarter`, `year`, `half_yearly` and `all_time` (the default). Use `count` and `offset` for paging. HTTP 204 means that the statistics are not calculated yet. The recordings statistic is limited to the top 1000 of all time. Fields: `artist_mbid` (optional), `artist_name` and `listen_count`. Recordings add `recording_mbid`, `track_name` and `release_name`. — [ListenBrainz Statistics API](https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html)
- Live results for the user "rob", without a token: `all_time` returned 200 with a `last_updated` value about 4 weeks before the probe. `year` returned 200 for 2025-01-01 to 2026-01-01 (the previous calendar year). `month` returned 204. — [Live probe: all_time](https://api.listenbrainz.org/1/stats/user/rob/artists?range=all_time&count=1); [Live probe: year](https://api.listenbrainz.org/1/stats/user/rob/artists?range=year&count=1); [Live probe: month](https://api.listenbrainz.org/1/stats/user/rob/artists?range=month&count=1)
- The API also has a "User history exports" section. — [ListenBrainz API index](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html)

### Inferences
- The extended history gives the strongest "most-listened" signal: plays for the full account life, with Spotify URIs, so no matching is necessary. Parse the uploaded `Streaming_History_Audio_*.json` files on the server or in the browser. Add up `ms_played` for each `spotify_track_uri` and for each `master_metadata_album_artist_name`. Skip records with a null URI and short plays (for example less than 30 s). Discard the IP and user-agent fields when you read the files, to keep less personal data.
- Last.fm and ListenBrainz need only a username, not OAuth, so they are cheap opt-in additions. Most Spotify users do not scrobble, so make them optional.
- In ListenBrainz, `year` is the previous calendar year. Use `this_year` or `all_time` for current data, and handle 204.

### Gaps
- The Spotify pages that I could read do not give a delivery time for the extended streaming history. The commonly cited "up to 30 days" is **[UNVERIFIED]**.
- Only the "Read Me First" file gives the official JSON key names (for example `ip_addr` versus `ip_addr_decrypted`, audiobook fields, and `Streaming_History_Video_*` files). I could not access it.
- The stats page does not document how often ListenBrainz refreshes its statistics.

## 6. Terms-of-use and legal risks of combining these sources with Spotify data

### Takeaway
The largest risks are: commercial-use bans (Last.fm, Deezer); the Last.fm written-approval rule for public pages; attribution duties (Last.fm, GetSongBPM, Spotify); and the Spotify policy clauses about integration with other services' content and about analysis of Spotify Content. ReccoBeats allows commercial use but makes the app responsible for compliance with the Spotify terms. MusicBrainz core data (CC0) and AcousticBrainz data (CC0) have the lowest data-licence risk.

### Cited Findings

#### Spotify Developer Policy clauses about combination (effective 15 May 2025; the Spotify-side researcher owns the interpretation)
- II.5: "metadata and cover art may only be used in connection with the underlying content". — [Spotify Developer Policy](https://developer.spotify.com/policy)
- III.5: "Do not create any product or service which is integrated with streams or content from another service." — [Spotify Developer Policy](https://developer.spotify.com/policy)
- III.7: "Do not permit any device or system to segue, mix, re-mix, or overlap any Spotify Content with any other audio content". — [Spotify Developer Policy](https://developer.spotify.com/policy)
- III.9: "Do not build an SDA that enables the transfer of data to another service, except for the purpose of enabling a user to transfer their personal data, or the metadata of the user's playlists to another service." — [Spotify Developer Policy](https://developer.spotify.com/policy)
- III.13: "Do not analyze the Spotify Content or the Spotify Service for any purpose, including without limitation, creating new or derived listenership metrics, benchmarking, functionality, usage statistics, user metrics, or building profiles of users, including for the purpose of targeting them with advertising or marketing." — [Spotify Developer Policy](https://developer.spotify.com/policy)
- III.14: "Do not use the Spotify Platform or any Spotify Content to train a machine learning or AI model". — [Spotify Developer Policy](https://developer.spotify.com/policy)
- II.4.1 and II.4.2: attribute the content to Spotify and link back to the album, track or playlist. IV.2: "commercial uses are not permitted for SDAs" (Streaming SDAs). IV.3 allows limited commercial uses, such as advertising, for Non-Streaming SDAs. — [Spotify Developer Policy](https://developer.spotify.com/policy)

#### Third-party terms
- Last.fm: non-commercial use only unless you have an agreement; an attribution button; written approval for public pages; a 100 MB cap; no images or artwork; no identification of users; you must not add terms that restrict the licence, apply DRM or sublicense the data (§4.3.1–4.3.3). — [Last.fm API TOS](https://www.last.fm/api/tos)
- Deezer: non-commercial use only; no income from the Services or Content; content must not be associated with any trademark, brand name or logo; the trademark guidelines apply; Deezer can remove access at any time. The terms have no explicit clause about combination with other services. — [Deezer Terms of Use](https://developers.deezer.com/termsofuse)
- ReccoBeats: free, also for commercial use. But its metadata is "aggregated from Spotify data", the user must make sure of third-party compliance, the service is "as is", and it can shut down. — [ReccoBeats Terms of Service](https://reccobeats.com/docs/documentation/terms-of-service)
- GetSongBPM: a mandatory backlink for all uses. **[UNVERIFIED: search-engine summary]** — [GetSongBPM API](https://getsongbpm.com/api)
- MusicBrainz: the core data is CC0. The supplementary data is CC BY-NC-SA 3.0 (non-commercial, attribution, share-alike). — [MusicBrainz Data License](https://musicbrainz.org/doc/About/Data_License). AcousticBrainz data is CC0. — [AcousticBrainz](https://acousticbrainz.org/)
- Odesli: the public API is deprecated (see section 4). — [Live probe](https://api.song.link/v1-alpha.1/links?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F0DiWol3AO6WpXZgp0goxAV&userCountry=US)

### Inferences
- spot-mixer uses third-party *metadata* only to select which Spotify tracks go into a playlist. It does not stream or play non-Spotify audio. This should stay outside III.5 and III.7, provided that the app never plays Deezer previews or other audio next to Spotify content. Do not embed Deezer previews.
- Show Spotify artwork and metadata for Spotify items (II.5). Do not show Last.fm images (§5.1.8). Show Last.fm and Deezer data only as plain text, with the necessary credit or link.
- III.13 is broad. Derived listenership metrics from Spotify data (for example statistics across users) are a risk. Mix generation for each user is the main function of the app, but avoid analytics across users, and keep user data only as long as necessary. The Spotify-side researcher must confirm this.
- ReccoBeats data that comes from Spotify (for example the audio features that Spotify withdrew) can carry an indirect Spotify-policy risk. The practical risk is low for a free personal app and higher for a commercial app.
- To use Last.fm and Deezer without separate agreements, the app must stay non-commercial (no ads, no paid tier). Spotify IV.3 allows some ads for Non-Streaming SDAs, but the Last.fm and Deezer terms do not.
- Under the Last.fm written-approval clause, a public deployment needs approval from Last.fm. A private or self-hosted instance has less risk. Make Last.fm an optional component.
- MusicBrainz tags and genres can be supplementary (CC BY-NC-SA) data. Do not depend on them if the app becomes commercial. The licence page does not say which fields are supplementary.

### Gaps
- I did not read the Spotify Developer Terms, which are separate from the Policy and can contain more rules about caching or combination. The Spotify-side researcher covers them.
- This is not a legal opinion. A fetch tool extracted the terms text, and some parts can be paraphrased.
- I did not find ListenBrainz-specific terms of use or a ListenBrainz data licence in the pages that I read.

## 7. Recommended combination for a free, low-maintenance app

### Takeaway
For a free, non-commercial, low-maintenance spot-mixer, use these sources: Deezer (no key) for top tracks ranked by popularity and for related artists; MusicBrainz for ID bridging; ReccoBeats for audio features, with Deezer and AcousticBrainz as tempo fallbacks; the Spotify `isrc:` search for matching; and a user upload of the Extended streaming history (plus optional Last.fm and ListenBrainz usernames) for history. Use the Last.fm `getSimilar` and `getTopTracks` methods as an optional quality boost that needs a key. Do not use Odesli, or the ListenBrainz per-artist top recordings endpoint (it needs a token).

### Cited Findings
The table summarizes findings from sections 1–5. Each row links the main evidence.

| Need | Primary | Fallback | Auth | Rate limit | ISRC / MBID | Main evidence |
|---|---|---|---|---|---|---|
| 1. Artist top tracks | Deezer `/artist/{id}/top`, then `/track/{id}` for ISRC | Last.fm `artist.getTopTracks`; LB `POST /1/popularity/recording` to rank MBIDs | Deezer: none. Last.fm: API key. LB POST: none | Deezer 50 req/5 s **[UNVERIFIED]**; Last.fm not published; LB 1 call/s guideline | Deezer: ISRC on `/track/{id}` only. Last.fm: MBID often empty, no ISRC. LB: MBIDs | [Deezer probe](https://api.deezer.com/artist/27/top?limit=2); [Last.fm doc](https://www.last.fm/api/show/artist.getTopTracks); [LB docs](https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html) |
| 2. Similar artists | Last.fm `artist.getSimilar` (if a key is configured) | Deezer `/artist/{id}/related`; LB labs `similar-artists`; LB Radio | Last.fm: API key. Deezer and LB: none | LB headers: 30 per window | Last.fm and LB: MBIDs. Deezer: Deezer IDs | [Last.fm doc](https://www.last.fm/api/show/artist.getSimilar); [Deezer probe](https://api.deezer.com/artist/27/related?limit=2); [LB labs probe](https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=056e4f3e-d505-4dad-8ec1-d04f521cbb56&algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30) |
| 3. Audio features | ReccoBeats `/v1/audio-features?ids=<Spotify IDs>` | Deezer `bpm` (if non-zero); AcousticBrainz low-level | None | ReccoBeats: internal, 429 with `Retry-After` | ReccoBeats: ISRC returned. AcousticBrainz: MBID key | [ReccoBeats probe](https://api.reccobeats.com/v1/audio-features?ids=0DiWol3AO6WpXZgp0goxAV); [ReccoBeats rate limit](https://reccobeats.com/docs/documentation/rate-limiting); [AcousticBrainz probe](https://acousticbrainz.org/api/v1/f1a6a40f-78f5-4918-968d-f64363bae94c/low-level) |
| 4. Spotify mapping | Spotify search `isrc:<ISRC>` | Normalized `track:`/`artist:` search; MusicBrainz url-rels | Spotify token | Spotify limits (other researcher) | ISRC | [Spotify Search reference](https://developer.spotify.com/documentation/web-api/reference/search); [MB url probe](https://musicbrainz.org/ws/2/url?resource=https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV&inc=recording-rels&fmt=json) |
| 5. History | Extended streaming history upload (`Streaming_History_Audio_*.json`) | Last.fm `user.getTopArtists`/`getTopTracks`; LB `/1/stats/user/{user}/artists` | Upload: none. Last.fm: API key. LB: none | — | Spotify URIs; LB MBIDs | [Spotify: Understanding my data](https://support.spotify.com/us/article/understanding-my-data/); [Last.fm doc](https://www.last.fm/api/show/user.getTopArtists); [LB stats docs](https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html) |
| Avoid | Odesli API | — | Key no longer issued **[UNVERIFIED]** | — | — | [Odesli probe (401)](https://api.song.link/v1-alpha.1/links?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F0DiWol3AO6WpXZgp0goxAV&userCountry=US) |

### Inferences
- Order of preference for each feature: (1) the Spotify endpoint, if the app has access (the other researcher confirms); (2) Deezer, ReccoBeats or MusicBrainz, because they need no key; (3) Last.fm and ListenBrainz as optional enrichment. This keeps the required set of credentials to Spotify only. Last.fm becomes one optional environment variable.
- Artist mode (a): Spotify artist ID → MusicBrainz url lookup (or Deezer `/search/artist`) → Deezer artist ID → `/artist/{id}/top?limit=25` → remove duplicate versions → `/track/{id}` for each ISRC → Spotify `isrc:` search → candidate tie-break (section 4) → ReccoBeats features → order by tempo and energy (or by key).
- Curated mode (b): Spotify top artists (other researcher) plus optional aggregates from the extended-history upload → optional expansion with similar artists (Last.fm, or LB labs/Deezer) → the same track pipeline as mode (a).
- Redis cache (my proposal; tune it later): Deezer top lists and related artists, 24 h; ISRC → Spotify URI and misses, 30 days; ReccoBeats features, 30 days or more (features rarely change); MusicBrainz ID bridges, 30 days. Keep Last.fm data under the 100 MB cap and follow its HTTP cache headers.
- Throttles for each service (one shared queue for each service on the server): MusicBrainz ≤ 1 req/s with a descriptive User-Agent ("spot-mixer/<version> ( <contact URL> )"); Deezer ≤ 50 requests in any sliding 5 s window; ListenBrainz ≤ 1 req/s; ReccoBeats: back off when you get 429, and obey `Retry-After`.
- Fail soft: if a source is down, the mix still builds. With no features, keep the popularity order. With no Deezer, use Last.fm (if configured) or Spotify search by name.
- Keep the app non-commercial to stay inside the Last.fm and Deezer terms. Add the "powered by AudioScrobbler" credit and the Last.fm links only if you enable Last.fm, and ask Last.fm for approval before a public deployment.

### Gaps
- I did not run coverage tests against a real catalog. Before you commit, measure the ReccoBeats hit rate, the share of Deezer tracks with non-zero `bpm`, and the hit rate of Deezer ISRCs on Spotify for the artists that you expect.
- The Deezer quota and the ReccoBeats limits are not officially documented. Watch the 429 responses and Deezer error payloads in production logs.
- The availability of ListenBrainz labs and LB Radio over time is uncertain. Both are outside the documented API.
