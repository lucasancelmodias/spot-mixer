# Tech stack for spot-mixer: Bun, Svelte/SvelteKit, Redis and Docker Compose (state as of 2026-10-25)

Conventions: "accessed 2026-10-25" marks an undated documentation page read on that date. npm registry and GitHub API timestamps are UTC. Version data came from read-only queries to `registry.npmjs.org`, `api.github.com` and `hub.docker.com` on 2026-10-25. Developer machine context (from the assignment): Windows 11, Bun 1.2.12, Docker Desktop with Compose v2.38.

## 1. Bun: current version, Bun.serve, built-in Redis client, bun test, Docker images, workspaces, Windows

### Takeaway
Bun 1.4.4 (2026-10-22) is the current stable release. Bun 1.4 (2026-08-20) is a Zig-to-Rust rewrite with Node.js 26 compatibility and many behavior changes. The built-in Redis client (since 1.2.9) covers a single Redis or Valkey node with Pub/Sub, TLS, RESP3 and auto-pipelining, but it has no Cluster or Sentinel support, and transactions and Lua need raw `send()` calls. The developer's Bun 1.2.12 is too old for the official SvelteKit Bun adapter, which requires Bun 1.4 or newer.

### Cited Findings

#### Versions and project status
- Latest stable is Bun 1.4.4: GitHub release published 2026-10-22 10:11 UTC; npm `bun@1.4.4` published 2026-10-22 10:19 UTC. The npm `canary` tag is `1.4.4-canary.20261025.1` (2026-10-25) — [GitHub release bun-v1.4.4](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4); [npm: bun](https://www.npmjs.com/package/bun) (accessed 2026-10-25)
- Recent stable releases: 1.4.3 (2026-10-10), 1.4.2 (2026-09-05), 1.4.1 (2026-09-04), 1.4.0 (2026-08-20), 1.3.14 (2026-05-13), 1.3.0 (2025-10-10) — [oven-sh/bun releases](https://github.com/oven-sh/bun/releases); [Bun blog index](https://bun.com/blog) (accessed 2026-10-25)
- The developer's Bun 1.2.12 is from early May 2025. The `oven/bun:1.2.12` image tag was last updated 2025-05-04 — [Docker Hub: oven/bun tags](https://hub.docker.com/r/oven/bun/tags) (accessed 2026-10-25)
- Bun 1.4 "rewrites Bun from Zig to Rust". The post also says "Bun is now written in Rust - and this is the first release" — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Bun 1.4 names five changes "most likely to need a line in your project": "Node.js 26" (`NODE_MODULE_VERSION` 147, `res.writeHeader()` removed), "New monorepos default to the isolated linker", "Bun invoked as `node`" no longer loads `.env` files, "`Bun.YAML` follows YAML 1.2", and "`Bun.TOML` and `bunfig.toml` are strict" — [Bun 1.4 blog, "Upgrading to 1.4"](https://bun.com/blog/bun-v1.4), 2026-08-20
- Bun 1.4: "`bun init` now writes typescript `^7`." — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Bun 1.4 claims 1,517 more Node.js test-suite passes and lists Playwright, Next.js 16, vitest, OpenTelemetry and dd-trace as working. It also claims about 5x lower idle CPU, about 2x faster Linux startup and 2.5x faster Windows startup — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Anthropic acquired Bun. Bun's post "Bun is joining Anthropic" is dated 2025-12-02 in the search summary. Both posts say Bun stays MIT-licensed and the same team continues. (Search-result summary only. I did not open these pages.) — [Bun blog: Bun is joining Anthropic](https://bun.com/blog/bun-joins-anthropic); [Anthropic news](https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone) (searched 2026-10-25)

#### Bun.serve: routes, static responses, HTML imports, full-stack dev server
- "`routes` requires Bun v1.2.3+". A route value can be a static `Response` (`"/api/status": new Response("OK")`), a handler that reads `req.params`, an object keyed by HTTP method (`GET`, `POST`), a wildcard (`"/api/*"`), or a file (`Bun.file("./favicon.ico")`). An optional `fetch(req)` handles unmatched requests — [Bun docs: HTTP server](https://bun.com/docs/runtime/http/server) (accessed 2026-10-25)
- `server.reload()` replaces `fetch`, `error`, `routes` and `websocket` without a restart. WebSockets support topics (`ws.subscribe()`, `server.publish()`). The default `idleTimeout` is 10 seconds (maximum 255, 0 disables it). The WebSocket idle timeout is 120 seconds. HTTP/3 requires TLS — [Bun docs: HTTP server](https://bun.com/docs/runtime/http/server) (accessed 2026-10-25)
- Bun 1.4 adds directory routes (`"/static/*": { dir: "./public" }`), `Range` support (206), conditional requests (304/412) and experimental HTTP/3. "In production, `Bun.serve` no longer serves sourcemaps for HTML routes". Per-method route objects now answer `HEAD` with the `GET` handler — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- HTML imports: an imported `index.html` placed in `routes` makes Bun bundle its `<script>` and `<link>` tags. `development: { hmr: true, console: true }` enables HMR and echoes browser console logs to the terminal. "As of Bun v1.2.17, you can use `Bun.build` or `bun build` to bundle your fullstack application ahead of time" (`bun build --target=bun --production --outdir=dist ./src/index.ts`) — [Bun docs: Fullstack dev server](https://bun.com/docs/bundler/fullstack) (accessed 2026-10-25)
- Stated limits of the full-stack server: "Auto-discovery of API routes is not implemented", "Server-side rendering (SSR) is not built-in", and "The fullstack dev server is a work in progress. Features and APIs may change." The page has only a React example and does not mention Svelte — [Bun docs: Fullstack dev server](https://bun.com/docs/bundler/fullstack) (accessed 2026-10-25)
- Svelte in Bun's dev server uses `bun-plugin-svelte` (`[serve.static] plugins = ["bun-plugin-svelte"]` in `bunfig.toml`). Its README says it "does not yet support server-side imports (e.g. for SSR)". It also lists source maps, CSS extensions in `<style>` blocks and TypeScript enums/namespaces as not yet supported. The latest npm version is 0.0.6, published 2025-03-26 — [bun-plugin-svelte README](https://github.com/oven-sh/bun/tree/main/packages/bun-plugin-svelte) (accessed 2026-10-25); [npm: bun-plugin-svelte](https://www.npmjs.com/package/bun-plugin-svelte)
- Bun 1.3 added `request.cookies` in `Bun.serve()`, a Map-like API in which `set()` and `delete()` add `Set-Cookie` headers. It also added `Bun.Cookie` and `Bun.CookieMap` for use outside the server — [Bun 1.3 blog](https://bun.com/blog/bun-v1.3), 2025-10-10

#### Built-in Redis client (Bun.redis and RedisClient)
- Introduced in Bun v1.2.9 under the heading "Bun.redis is Bun's builtin Redis client": "An incredibly fast Redis/Valkey client is now built into Bun." The post says "66 commands are supported" and describes the client as experimental. Its own benchmark reports 44.82% to 85.39% faster batched GETs than ioredis — [Bun v1.2.9 blog](https://bun.com/blog/bun-v1.2.9), 2025-04-09
- Pub/Sub was added in Bun v1.2.23 — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25); the [Bun blog index](https://bun.com/blog) dates v1.2.23 to 2025-09-28
- Bun 1.3 says Pub/Sub is fully supported and shows a vendor chart with more than 7.9x the ioredis throughput. It says "Clusters, streams, and Lua scripting" are "in the works" — [Bun 1.3 blog](https://bun.com/blog/bun-v1.3), 2025-10-10
- API: `import { redis } from "bun"` gives the default client. `new RedisClient(url, options)` creates a custom client, with `connect()` and `close()`. The client connects lazily on the first command. `REDIS_URL` takes precedence over `VALKEY_URL`, and the fallback is `redis://localhost:6379`. URL schemes: `redis://`, `rediss://`, `redis+tls://`, `redis+unix://`, `redis+tls+unix://` — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25)
- Option defaults: `connectionTimeout` 10000 ms, `idleTimeout` 0, `autoReconnect` true, `maxRetries` 20, `enableOfflineQueue` true, `enableAutoPipelining` true, and `tls` false. `tls` also accepts an object with `rejectUnauthorized`, `ca`, `cert`, `key` and `serverName`. Reconnect backoff starts at 50 ms and is capped at 2000 ms — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25)
- Typed helpers cover strings and keys (`set`, `get`, `getBuffer`, `del`, `exists`, `expire`, `ttl`, `incr`, `decr`), hashes (`hmset`, `hmget`, `hget`, `hincrby`, `hincrbyfloat`) and sets (`sadd`, `srem`, `sismember`, `smembers`, `srandmember`, `spop`). Every other command goes through `send(command, args)` — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25)
- Pub/Sub API: `publish`, `subscribe`, `unsubscribe`, `psubscribe`, `punsubscribe`, `pubsub` and `duplicate()`. A subscribed client accepts only subscription methods, `pubsub()` and `ping()`. The docs label Pub/Sub as experimental — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25)
- Limits under the heading "Limitations and Future Plans": "Transactions (MULTI/EXEC) require raw commands". Under "Unsupported features": "Redis Sentinel" and "Redis Cluster". The page does not document EVAL or Lua. MULTI, EXEC, DISCARD, WATCH, UNWATCH and SCRIPT disable auto-pipelining. The client uses RESP3 and supports Redis server 7.2 and newer — [Bun docs: Redis](https://bun.com/docs/runtime/redis) (accessed 2026-10-25)
- Bun 1.4: "A `rediss://` `RedisClient` checks the server certificate against the host in the URL." A bad database number in a URL now throws — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Open requests include Sentinel support (#38515, opened 2026-08-14), "Drop-in support for IORedis clients with Bun.redis" (#23630, opened 2025-10-14) and "Bun.RedisClient exposes no url or options" (#41417, opened 2026-09-05) — [oven-sh/bun issue #38515](https://github.com/oven-sh/bun/issues/38515); [#23630](https://github.com/oven-sh/bun/issues/23630); [#41417](https://github.com/oven-sh/bun/issues/41417) (accessed 2026-10-25)
- ioredis 6.0.0 was published 2026-07-31 and needs Node.js 20 or newer. Its README says "ioredis is a stable project and maintenance is done on a best-effort basis for relevant issues" and "For new projects, node-redis is the recommended client library." Features: Cluster, Sentinel, Streams, pipelining, MULTI/EXEC, Lua via `defineCommand`, Pub/Sub, TLS, RESP3 with RESP2 fallback, auto-reconnect and an offline queue — [ioredis README](https://github.com/redis/ioredis) (accessed 2026-10-25); [npm: ioredis](https://www.npmjs.com/package/ioredis)
- node-redis (`redis`) 6.3.0 was published 2026-09-30 and needs Node.js 20 or newer. Packages: `@redis/client`, `@redis/json`, `@redis/search`, `@redis/time-series`, `@redis/bloom`. Features: RESP3 with client-side caching, cluster, sentinel, Pub/Sub, MULTI/EXEC with `.watch()`, automatic same-tick pipelining, TLS and `createClientPool()` — [node-redis README](https://github.com/redis/node-redis) (accessed 2026-10-25); [npm: redis](https://www.npmjs.com/package/redis)

#### bun test: mocks, fetch, coverage
- Mocks: `mock()`, `jest.fn()` (which "behaves identically"), a `vi` alias and `spyOn`. `mock.module()` works for both `import` and `require`. To stop the original module from evaluating, load the mock with `--preload` or `preload` in `bunfig.toml`. `mock.restore()` "does not reset modules overridden with `mock.module()`". "Bun does not support the `__mocks__` directory or auto-mocking." — [Bun docs: Mocks](https://bun.com/docs/test/mocks) (accessed 2026-10-25)
- Fetch mocking: the docs have no dedicated helper. The common pattern is `spyOn(globalThis, "fetch")` that returns a real `Response`, followed by `mockRestore()`. Leaks happen because all test files share one process. Bun v1.3.9 (2026-02-08) added `Symbol.dispose` to `spyOn` and `mock`, so `using` restores a spy automatically. No built-in URL matcher exists — [Bun discussion #11169](https://github.com/oven-sh/bun/discussions/11169); [Bun discussion #19876](https://github.com/oven-sh/bun/discussions/19876); [Bun v1.3.9 blog](https://bun.com/blog/bun-v1.3.9) (search summary, 2026-10-25)
- Coverage: `bun test --coverage`. `bunfig.toml` `[test]` keys: `coverage`, `coverageReporter = ["text", "lcov"]` (default `["text"]`), `coverageDir` (default `coverage`), `coverageThreshold` (a number or `{ lines, functions }`), `coverageSkipTestFiles` and `coveragePathIgnorePatterns`. Documented metrics are functions and lines. Branch coverage is not mentioned — [Bun docs: Coverage](https://bun.com/docs/test/coverage) (accessed 2026-10-25)
- Coverage limits: the `statements` threshold key "is accepted but not enforced". Outside `--parallel`, the threshold check runs only when the `text` reporter is on, so lcov-only runs exit 0. Only loaded files are tracked — [Bun docs: Coverage](https://bun.com/docs/test/coverage) (accessed 2026-10-25)
- Bun 1.3 added `test.concurrent` and `describe.concurrent` (default maximum of 20 concurrent tests), VS Code Test Explorer integration and `expectTypeOf()` — [Bun 1.3 blog](https://bun.com/blog/bun-v1.3), 2025-10-10
- Bun 1.4 adds `--parallel`, `--isolate`, `--shard`, `--timings`, `--changed`, `retry`/`repeats` options and `jest.useFakeTimers()`. `jest.resetAllMocks()` now also drops implementations, and `toContain()` now compares with `===` — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20

#### Official Docker images and Dockerfile
- `oven/bun` tags updated 2026-10-22: `latest`, `1`, `1.4`, `1.4.4`, `debian`, `1.4.4-debian`, `slim`, `1.4.4-slim`, `alpine`, `1.4.4-alpine`, `distroless` and `1.4.4-distroless`. Canary tags (`canary`, `canary-slim`, `canary-debian`, `canary-alpine`, `canary-distroless`) were updated 2026-10-25 — [Docker Hub: oven/bun tags](https://hub.docker.com/r/oven/bun/tags) (accessed 2026-10-25)
- Base images on the `main` branch: `debian` uses `debian:trixie`, `debian-slim` uses `debian:trixie-slim`, `alpine` uses `alpine:3.24`, and `distroless` uses `gcr.io/distroless/base-nossl-debian13` with `ENTRYPOINT ["/usr/local/bin/bun"]`. The other images use `docker-entrypoint.sh` and `WORKDIR /home/bun/app` — [oven-sh/bun dockerhub/ Dockerfiles](https://github.com/oven-sh/bun/tree/main/dockerhub) (accessed 2026-10-25)
- Image history: Bun v1.2.10 (2025-04-17) moved the default image to Debian Bookworm, and Bun v1.3.2 (2025-11-08) moved Alpine images to Alpine 3.22 — [Bun blog index](https://bun.com/blog) (accessed 2026-10-25)
- Official multi-stage Dockerfile: `FROM oven/bun:1 AS base` with `WORKDIR /usr/src/app`. An `install` stage runs `bun install --frozen-lockfile` in `/temp/dev` and `bun install --frozen-lockfile --production` in `/temp/prod`. A `prerelease` stage copies dev `node_modules` and the source, sets `NODE_ENV=production`, and runs `bun test` and `bun run build`. A `release` stage copies the production `node_modules` and the app files, then sets `USER bun`, `EXPOSE 3000/tcp` and `ENTRYPOINT [ "bun", "run", "index.ts" ]`. The `.dockerignore` lists `node_modules`, `Dockerfile*`, `docker-compose*`, `.git`, `.env` and `coverage*`, among others — [Bun guide: Containerize with Docker](https://bun.com/guides/ecosystem/docker) (accessed 2026-10-25)
- Bun 1.4 adds `bun prune --production`. Its Dockerfile example runs `bun install --frozen-lockfile` and then `bun prune --production` — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20

#### Workspaces
- The root `package.json` declares `"workspaces": ["packages/*"]`, with full glob syntax and negative patterns. On publish, `workspace:*`, `workspace:^` and `workspace:~` become concrete versions. Catalogs use the `catalog:` protocol. `bun install --filter` and `--filter` for scripts select workspaces. The lockfile is `bun.lock` — [Bun docs: Workspaces](https://bun.com/docs/install/workspaces) (accessed 2026-10-25)
- Bun 1.3: isolated installs "prevent packages from accessing undeclared dependencies". The post says "if you use 'workspaces' in your package.json, we're making it the default behavior". Opt out with `--linker=hoisted` or `linker = "hoisted"` in `bunfig.toml` — [Bun 1.3 blog](https://bun.com/blog/bun-v1.3), 2025-10-10
- Bun 1.4: "New monorepos (projects with workspaces) now use `linker: "isolated"`", and existing lockfiles keep the hoisted linker. `bun.lock` is now `lockfileVersion: 2`. A plain `bun add x` writes `catalog:` when the default catalog lists `x`. "`workspace:` ranges are now honored only in the root and workspace `package.json` files." — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20

#### Windows support
- Windows support arrived in Bun 1.1 (2024-04-01) — [Bun blog index](https://bun.com/blog) (accessed 2026-10-25)
- "Bun requires Windows 10 version 1809 or later." Downloads exist for x64 and ARM64. Install with `powershell -c "irm bun.sh/install.ps1|iex"`, npm or Scoop. Upgrade with `bun upgrade`. Install a specific version with `iex "& {$(irm https://bun.com/install.ps1)} -Version 1.3.3"`. The x64 binary picks AVX2/AVX-512 paths at runtime, and the `-baseline` names remain as aliases — [Bun docs: Installation](https://bun.com/docs/installation) (accessed 2026-10-25)
- Bun 1.4: "Bun now builds natively for Windows on ARM64." `setTimeout(fn, 1)` fires in about 1.4 ms instead of 15.5 ms. Bun runs inside a Windows AppContainer — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Bun 1.3 uses `ReadDirectoryChangesW` for file watching on Windows — [Bun 1.3 blog](https://bun.com/blog/bun-v1.3), 2025-10-10

### Inferences
- The developer must upgrade from Bun 1.2.12 to 1.4.4 (`bun upgrade`) before work starts. `@sveltejs/adapter-bun` needs Bun 1.4 or newer, and Redis Pub/Sub needs 1.2.23 or newer. Starting on 1.4 also avoids a later migration through the 1.4 behavior changes.
- Bun.redis is sufficient for spot-mixer's needs on one Redis node: session hashes or strings with TTLs, API response caches and optional Pub/Sub. Atomic multi-key work must use `send("MULTI")`/`send("EXEC")` or `send("EVAL", ...)`. Because auto-pipelining shares one connection, a dedicated `RedisClient` for transactions is the safer design (not verified in the docs).
- To keep a later switch cheap (for example, to a managed Redis with Cluster or Sentinel), hide the client behind a small `SessionStore`/`Cache` interface. node-redis is the replacement that Redis itself recommends. ioredis is in best-effort maintenance.
- Bun 1.4 `bun init` writes TypeScript `^7`, but the SvelteKit toolchain needs TypeScript 6 (see questions 2 and 6). Pin TypeScript 6.0.x by hand after scaffolding.
- Server-side tests that call the Spotify Web API through `fetch` can use `spyOn(globalThis, "fetch")` with `using` (Bun 1.3.9+) so that spies do not leak across test files.
- The official Bun Dockerfile targets a single `index.ts` entry point. A SvelteKit build needs an adapted final stage (see question 2). The distroless image has no shell or curl, so a Compose healthcheck must call `bun` itself. Compose Watch cannot sync into a distroless image (see question 5).

### Gaps
- Sources disagree on Pub/Sub maturity. The Bun Redis docs say "experimental", but the Bun 1.3 blog says it is fully supported.
- Sources disagree on when the isolated linker became the workspace default. Bun 1.3 says it is the default for workspaces, while Bun 1.4 lists it as a 1.4 change for new monorepos. The safe reading: new monorepos created with Bun 1.4 get the isolated linker.
- I did not verify that the published `oven/bun:1.4.4-*` images use the `main`-branch bases (Debian trixie, Alpine 3.24, distroless Debian 13). I also did not verify whether the distroless image has a non-root user.
- The Bun docs have no Lua or EVAL example. Only the generic `send()` path is documented.
- The Anthropic acquisition facts come from a search summary. I did not open those pages.
- Open Bun issue titles mention `bun fmt` and `bun lint` (#45162, #45163, opened 2026-10-13). I did not verify these commands in the Bun docs.

## 2. Svelte and SvelteKit: versions, running on Bun in development and production, SPA mode, known issues

### Takeaway
Svelte 5.57.2 (2026-10-06) and SvelteKit 3.1.0 (2026-10-14) are current. SvelteKit 3.0.0 (2026-10-01) shipped an official `@sveltejs/adapter-bun` 1.0.0 that requires Bun 1.4 or newer. The community `svelte-adapter-bun` is deprecated, and its repository is archived. SvelteKit 3 needs Vite 8, vite-plugin-svelte 7 and TypeScript 6, and its config moved from `svelte.config.js` to the Vite config. Local plain-HTTP runs carry one important risk. The Kit 3 adapters dropped the runtime `ORIGIN` variable, and they assume `https` unless `paths.origin` or `PROTOCOL_HEADER` is set.

### Cited Findings

#### Current versions
| Package | Latest | Published (UTC) | Notes | Source |
|---|---|---|---|---|
| svelte | 5.57.2 | 2026-10-06 | 5.57.0 was 2026-08-28 | [GitHub release svelte@5.57.2](https://github.com/sveltejs/svelte/releases); [npm](https://www.npmjs.com/package/svelte) |
| @sveltejs/kit | 3.1.0 | 2026-10-14 | 3.0.0 was 2026-10-01; 3.0.1 was 2026-10-06 | [sveltejs/kit releases](https://github.com/sveltejs/kit/releases); [npm](https://www.npmjs.com/package/@sveltejs/kit) |
| @sveltejs/adapter-bun | 1.0.0 | 2026-10-01 | first prerelease 1.0.0-next.1 was 2026-08-21; `engines.bun >=1.4.0` | [npm](https://www.npmjs.com/package/@sveltejs/adapter-bun) |
| @sveltejs/adapter-node | 6.0.0 | 2026-10-01 | | [npm](https://www.npmjs.com/package/@sveltejs/adapter-node) |
| @sveltejs/adapter-static | 4.0.0 | 2026-10-01 | | [npm](https://www.npmjs.com/package/@sveltejs/adapter-static) |
| @sveltejs/vite-plugin-svelte | 7.3.1 | 2026-09-23 | peer `vite ^8`, `svelte ^5.46.4` | [npm](https://www.npmjs.com/package/@sveltejs/vite-plugin-svelte) |
| vite | 8.3.5 | 2026-10-21 | | [npm](https://www.npmjs.com/package/vite) |
| sv (Svelte CLI) | 1.1.1 | 2026-10-06 | | [npm](https://www.npmjs.com/package/sv) |
| svelte-check | 4.7.7 | 2026-10-16 | peer `typescript ^5.0.0 \|\| ^6.0.0` | [npm](https://www.npmjs.com/package/svelte-check) |
| typescript | 7.0.2 (latest) and 6.0.3 (newest 6.x) | 2026-07-08 and 2026-04-16 | | [npm](https://www.npmjs.com/package/typescript) |

- `@sveltejs/kit@3.1.0` peer dependencies: `vite ^8.0.12`, `svelte ^5.57.1`, `typescript ^6.0.0`, `@sveltejs/vite-plugin-svelte ^7.0.0`. Its `engines.node` is `>=22.17`. Its runtime dependencies include `@standard-schema/spec`, `cookie` and `devalue` — [npm registry: @sveltejs/kit/latest](https://registry.npmjs.org/@sveltejs%2Fkit/latest) (accessed 2026-10-25)
- "Version 3.0 of SvelteKit, the official application framework for Svelte, is now available." Migration: `npx sv migrate sveltekit-3 --tasks all --confirm`. Config moves from `svelte.config.js` to `vite.config.ts`, and the `$lib` alias becomes `#lib`. Remote functions are "not quite" ready and need Async Svelte, which "currently needs an `experimental` flag" — [Svelte blog: SvelteKit 3 is here](https://svelte.dev/blog/sveltekit-3-is-here), 2026-10-01
- Selected SvelteKit 3.0.0 breaking changes: "TypeScript 6 is now the minimum required version"; "require Node 22 or newer"; "require `@sveltejs/vite-plugin-svelte` v7"; "require Svelte 5.56.4 or newer"; "require Svelte config options to be passed through the Vite plugin"; "upgrade to `cookie` v2. Cookie names must now contain only ASCII characters"; "default the cookie `path` option to `'/'`"; "remove the deprecated CSRF `checkOrigin` option in favor of `trustedOrigins`"; "disallow cross-origin form submissions without a `Content-Type` header"; "remove `base`, `assets`, and `resolveRoute` from `$app/paths`"; "delete `$service-worker` module"; "run all errors through the `handleError` hook" — [GitHub release @sveltejs/kit@3.0.0](https://github.com/sveltejs/kit/releases/tag/%40sveltejs/kit%403.0.0), 2026-10-01

#### Development under Bun
- Bun's SvelteKit guide: create the app with `bunx sv create my-app`, then run the dev server with `bun --bun run dev`, which runs the project's `vite dev` script under Bun. "To use Node.js instead, omit the `--bun` flag." The app is served on port 5173 with hot reload — [Bun guide: SvelteKit](https://bun.com/guides/ecosystem/sveltekit) (accessed 2026-10-25)
- The same guide still recommends the community `svelte-adapter-bun` (`bun add -D svelte-adapter-bun`), configured in `vite.config.ts`. It builds with `bun --bun run build` and runs `bun ./build/index.js` on port 3000 (`PORT` overrides it) — [Bun guide: SvelteKit](https://bun.com/guides/ecosystem/sveltekit) (accessed 2026-10-25)
- "The `--bun` flag overrides Vite's Node.js shebang." — [SvelteKit docs: Bun servers (adapter-bun)](https://svelte.dev/docs/kit/adapter-bun) (accessed 2026-10-25)

#### Production on Bun: official @sveltejs/adapter-bun
- Install with `npx sv add sveltekit-adapter="adapter:bun"` or `npm i -D @sveltejs/adapter-bun`. "Bun 1.4 or newer is required." Build with `bun run --bun build`. "The adapter calls Bun's build API, so the production build itself must run in Bun." Start with `bun ./build`. At runtime the server needs the output directory, `package.json` and production dependencies. With `compile: true`, the build produces a single executable, `./build/server` — [SvelteKit docs: adapter-bun](https://svelte.dev/docs/kit/adapter-bun) (accessed 2026-10-25)
- Options: `out` (default `build`), `precompress` (brotli and gzip), `envPrefix`, `serverOptions` (defaults passed to `Bun.serve`) and `buildOptions` (executables only). Environment variables: `HOST`, `PORT` (default 3000), `SOCKET_PATH`, `REUSE_PORT`, `IPV6_ONLY`, `BODY_SIZE_LIMIT` (default 512K), `CONNECTION_IDLE_TIMEOUT` (0 to 255 seconds), `DEVELOPMENT`, `PROTOCOL_HEADER`, `HOST_HEADER`, `PORT_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH` (default 1) and `SHUTDOWN_TIMEOUT` (default 30 seconds) — [SvelteKit docs: adapter-bun](https://svelte.dev/docs/kit/adapter-bun) (accessed 2026-10-25)
- Static assets and prerendered pages are registered as native Bun routes for `GET` and `HEAD`, with build-time ETags and `immutable` caching for hashed files. On SIGINT or SIGTERM, the server calls `server.stop()`, waits for pending requests and emits `sveltekit:shutdown`. The generated server "does not expose `websocket`, `error`, TLS, HTTP/3, or HTTP/1 configuration through `serverOptions`." The adapter rejects file names that contain a literal `*` — [SvelteKit docs: adapter-bun](https://svelte.dev/docs/kit/adapter-bun) (accessed 2026-10-25)
- Origin handling: "If paths.origin is configured, that value is the trusted origin for every request." "Otherwise, the adapter derives the host from the Host header and assumes the scheme is https". "Configure paths.origin or PROTOCOL_HEADER if that assumption is wrong, for example when serving plain HTTP directly." "Only trust forwarded headers when requests can reach the server through a proxy you control." — [SvelteKit docs: adapter-bun](https://svelte.dev/docs/kit/adapter-bun) (accessed 2026-10-25)
- The adapter-bun 1.0.0 release says "require Bun 1.4, which routes `HEAD` to `GET` handlers and settles `stop()` after a force close". It also says "build the server with Vite instead of a second `Bun.build` pass, keeping production dependencies external; `buildOptions` now only applies to executables" — [GitHub release @sveltejs/adapter-bun@1.0.0](https://github.com/sveltejs/kit/releases/tag/%40sveltejs/adapter-bun%401.0.0), 2026-10-01
- Open issue #17328 ("Runtime origin setting for the server adapters, since ORIGIN is gone in Kit 3", opened 2026-10-04) says `paths.origin` "is inlined at build time". It reports that plain-HTTP self-hosted apps without a reverse proxy get `403 Cross-site POST form submissions are forbidden`, and that one Docker image deployed at many URLs needs one build per origin. A maintainer comment (2026-10-14) says build time was "a deliberate choice" — [sveltejs/kit issue #17328](https://github.com/sveltejs/kit/issues/17328) (accessed 2026-10-25)

#### adapter-node output, and the community adapter
- adapter-node 6.0.0: "require SvelteKit 3"; "require `vite@^8.0.12`"; "add `kit.paths.origin` config option, remove `kit.prerender.origin` and the `adapter-node` `ORIGIN` environment variable". It now serves static assets from build-time tables instead of sirv, uses content-hash ETags and serves assets only for `GET` and `HEAD` — [GitHub release @sveltejs/adapter-node@6.0.0](https://github.com/sveltejs/kit/releases/tag/%40sveltejs/adapter-node%406.0.0), 2026-10-01
- adapter-node docs: start with `node build`. `PORT`/`HOST` default to 3000 on 0.0.0.0. The protocol defaults to `https` "if no `PROTOCOL_HEADER` is set". `.env` files are not loaded in production (`node --env-file=.env build`). Bun appears only as a navigation link to the adapter-bun page, so the docs give no guidance for running adapter-node output under Bun — [SvelteKit docs: adapter-node](https://svelte.dev/docs/kit/adapter-node) (accessed 2026-10-25)
- Community `svelte-adapter-bun` (gornostay25): the latest npm version 1.0.2 (2026-10-20) is deprecated with "Package no longer supported". Older versions carry "Deprecated: use @sveltejs/adapter-bun — https://svelte.dev/docs/kit/adapter-bun". Earlier releases: 1.0.0 (2025-09-22), 1.0.1 (2025-10-22), 0.5.2 (2024-02-20). The 1.0.x peer range is `@sveltejs/kit ^2.4.0` — [npm: svelte-adapter-bun](https://www.npmjs.com/package/svelte-adapter-bun) (accessed 2026-10-25)
- The GitHub repository is archived. Its README says: "**Deprecated — unmaintained.** Use the official `@sveltejs/adapter-bun` instead ... This repository is archived; there will be no further updates." It also says "there is no `serveAssets` option on the official adapter" — [gornostay25/svelte-adapter-bun](https://github.com/gornostay25/svelte-adapter-bun) (accessed 2026-10-25)

#### adapter-static SPA mode
- Set `fallback: '200.html'` (the docs note this "may differ from host to host") in the Vite config, and set `export const ssr = false;` in the root layout. Individual pages can opt back in with `export const prerender = true;` and `export const ssr = true;`. adapter-static suits apps without `+page.server.js`, `+layout.server.js` or `+server.js` files. The docs advise against `index.html` as the fallback name — [SvelteKit docs: Single-page apps](https://svelte.dev/docs/kit/single-page-apps) (accessed 2026-10-25)
- Stated drawbacks: "SPA mode has a large negative performance impact by forcing multiple network round trips". SPA mode also risks SEO and fails when JavaScript is off. The docs recommend prerendering as many pages as possible — [SvelteKit docs: Single-page apps](https://svelte.dev/docs/kit/single-page-apps) (accessed 2026-10-25)

#### Known Bun issues relevant to SvelteKit
- On 2026-10-25, 26 open oven-sh/bun issues matched "sveltekit". Examples: #21679 "Bun crashes when starting SvelteKit" (opened 2025-08-07; Bun 1.2.19 on Raspberry Pi arm64 crashed while loading a rollup native module); #5541 "bun test cannot find module "$app/environment" in SvelteKit project" (2023-09-16); #7951 "Error with Sveltekit production builds" (2024-01-02); #7967 "Running `bun --bun vite build` inside Docker does not write files to system" (2024-01-03) — [GitHub search: oven-sh/bun open issues "sveltekit"](https://github.com/oven-sh/bun/issues?q=is%3Aissue+is%3Aopen+sveltekit) (accessed 2026-10-25)
- Open SvelteKit issue #17540 (2026-10-24): "adapter-bun: support `precompress` together with `buildOptions.compile`" — [sveltejs/kit issue #17540](https://github.com/sveltejs/kit/issues/17540) (accessed 2026-10-25)

### Inferences
- Use SvelteKit 3.1 with `@sveltejs/adapter-bun` for production. Do not use the deprecated community adapter, even though Bun's own guide still recommends it. That guide is out of date for Kit 3.
- For local Compose runs over plain HTTP (for example `http://localhost:3000`), set `paths.origin` at build time or send `PROTOCOL_HEADER` from a trusted reverse proxy. Otherwise, the https assumption can cause 403 errors on form POSTs. For a later deployment, either build per origin or put a TLS-terminating proxy in front and configure the forwarded headers.
- Running adapter-node output under Bun is undocumented. Prefer adapter-bun, or run adapter-node output with Node.
- Run development natively on Windows with `bun --bun run dev`, and run only Redis in Compose. That path is documented by Bun and avoids the WSL file-event limits (question 5).
- Pin TypeScript 6.0.x. Kit 3.1 peer-requires `^6.0.0`, and svelte-check 4.7.7 allows only TypeScript 5 or 6.
- SPA mode (adapter-static plus a separate Bun API) is viable but gives up SSR and server routes. Kit server routes or hooks can call the Spotify Web API directly and keep tokens server-side.

### Gaps
- No official source states that `bun --bun vite dev` works for SvelteKit 3 with Vite 8 on Windows. Bun's guide shows it in general terms only.
- The adapter-bun docs and its 1.0.0 release notes conflict. The docs say "The adapter calls Bun's build API, so the production build itself must run in Bun." The release says the server is now built "with Vite instead of a second `Bun.build` pass", and `buildOptions` applies only to executables.
- I did not re-verify the SvelteKit 3 `cookies.set` defaults (`httpOnly`, `secure`, `sameSite`). The 3.0.0 release confirms only the ASCII-name rule and the `path: '/'` default.
- I did not research the Svelte 5.5x feature changes. Many open Bun issues were bulk-updated on 2026-08-04, so their current relevance is unclear.

## 3. Backend framework on Bun: Hono vs Elysia, typed clients, static files, cookies and sessions, validation

### Takeaway
Hono 4.13.14 (2026-10-25) is stable, and Hono 5 is at release candidate (5.0.0-rc.1, 2026-10-10). Hono 5 is ESM-only and moves runtime adapters such as `hono/bun` to `@hono/*` packages. Elysia 1.4.30 (2026-08-26) is stable, and Elysia 2 is at 2.0.0-rc.0 (2026-10-19) with many breaking changes. Both frameworks offer end-to-end typed clients: Hono `hc` and Elysia Eden Treaty. Both offer signed cookies, but neither ships a built-in session store. Hono validates through `@hono/zod-validator` or `@hono/standard-validator`. Elysia uses TypeBox (`t`) and accepts Standard Schema since 1.4.

### Cited Findings

#### Versions and status
| Package | Latest stable | Pre-release | Source |
|---|---|---|---|
| hono | 4.13.14 (2026-10-25) | 5.0.0-rc.1 (2026-10-10, `next` tag); rc.0 on 2026-10-08 | [npm: hono](https://www.npmjs.com/package/hono); [hono releases](https://github.com/honojs/hono/releases) |
| @hono/bun | 1.0.1 (2026-10-08), peer `hono >=4.13.9 \|\| ^5.0.0-0` | | [npm: @hono/bun](https://www.npmjs.com/package/@hono/bun) |
| @hono/zod-validator | 0.9.1 (2026-08-31), peer `zod ^3.25.0 \|\| ^4.0.0`, `hono >=4.11.2` | | [npm](https://www.npmjs.com/package/@hono/zod-validator) |
| @hono/standard-validator | 0.4.1 (2026-10-26 00:12 UTC), peer `@standard-schema/spec ^1.0.0` | | [npm](https://www.npmjs.com/package/@hono/standard-validator) |
| elysia | 1.4.30 (2026-08-26) | 2.0.0-rc.0 (2026-10-19, `rc`); 2.0.0-beta.32 (2026-10-15, `next`) | [npm: elysia](https://www.npmjs.com/package/elysia); [elysia releases](https://github.com/elysiajs/elysia/releases) |
| @elysiajs/eden | 1.4.9 (2026-03-31), peer `elysia >=1.4.19` | | [npm](https://www.npmjs.com/package/@elysiajs/eden) |
| @elysia/eden | 1.4.10 (2026-04-23) | 2.0.0-rc.0 (2026-10-19) | [npm](https://www.npmjs.com/package/@elysia/eden) |
| @elysiajs/static | 1.4.10 (2026-04-23), peer `elysia >= 1.4.0` | | [npm](https://www.npmjs.com/package/@elysiajs/static) |
| zod | 4.6.7 (2026-10-12) | | [npm](https://www.npmjs.com/package/zod) |
| valibot | 1.5.0 (2026-09-09) | | [npm](https://www.npmjs.com/package/valibot) |
| typebox (TypeBox 1.x) | 1.4.3 (2026-10-22) | | [npm](https://www.npmjs.com/package/typebox) |
| @sinclair/typebox (0.34 line) | 0.34.52 (2026-07-11) | | [npm](https://www.npmjs.com/package/@sinclair/typebox) |

- `elysia@1.4.30` peer dependencies: `@sinclair/typebox >= 0.34.0 < 1`, `@types/bun >= 1.2.0`, `typescript >= 5.0.0`, `exact-mirror`, `file-type` and `openapi-types`. `hono@4.13.14` has no dependencies — [npm registry: elysia/latest](https://registry.npmjs.org/elysia/latest); [npm registry: hono/latest](https://registry.npmjs.org/hono/latest) (accessed 2026-10-25)
- Both repositories are MIT-licensed (GitHub license field) — [honojs/hono](https://github.com/honojs/hono); [elysiajs/elysia](https://github.com/elysiajs/elysia) (accessed 2026-10-25)

#### Hono 5 migration (release candidate)
- The v5 migration guide lists these changes: "ESM only" ("On Node.js, version 22.12 or later is required"); "`onError()` and `notFound()` register routable middleware" (`app.onError((c) => ...)` reads `c.error`); "Non-Error throws go to `onError`"; "`c.req.query()` may return `undefined` values"; "`c.req.json()` returns `unknown`"; "`c.json()` throws for a value that is not JSON serializable"; "Wildcard matching is the same in every router"; "Runtime adapters moved to `@hono/*` packages" (`hono/bun` becomes `@hono/bun`, so `import { serveStatic } from '@hono/bun'`); `hono/adapter` stays in `hono` — [Hono MIGRATION.md, v5 branch](https://github.com/honojs/hono/blob/v5/docs/MIGRATION.md) (accessed 2026-10-25)
- `hono@4.13.14` still exports `./bun`, `./client`, `./cookie` and `./validator`. `hono@5.0.0-rc.1` exports `./client`, `./cookie`, `./validator` and `./adapter`, but no `./bun`. Its `engines.node` is `>=22.12.0` — [npm registry: hono](https://registry.npmjs.org/hono) (accessed 2026-10-25)

#### Hono on Bun: static files, cookies, sessions
- The hono.dev Bun page now shows `bun add @hono/bun` and `import { serveStatic } from '@hono/bun'`. Options: `root`, `path`, `rewriteRequestPath`, `mimes`, `onFound`, `onNotFound` and `precompressed` (Brotli, then Zstd, then Gzip). Export the app with `export default app` or `export default { port: 3000, fetch: app.fetch }`. Create a project with `bun create hono@latest my-app`. Test with `bun:test` through `app.fetch(new Request(...))`. The page warns that Windows and macOS file systems may be case-insensitive, so path-scoped auth middleware can be bypassed for files in the served directory — [Hono docs: Bun](https://hono.dev/docs/getting-started/bun) (accessed 2026-10-25)
- Cookie helper (`hono/cookie`): `getCookie`, `setCookie`, `deleteCookie`, async `getSignedCookie`/`setSignedCookie` (HMAC SHA-256), `generateCookie` and `generateSignedCookie`. Options include `httpOnly`, `secure`, `sameSite`, `maxAge`, `expires`, `partitioned`, `priority` and `prefix: 'secure' | 'host'`. The helper throws for a `__Host-` cookie without `secure`, with a path other than `/`, or with a `domain`. It also throws for `maxAge` or `expires` beyond 400 days. The page does not mention a session middleware — [Hono docs: Cookie helper](https://hono.dev/docs/helpers/cookie) (accessed 2026-10-25)
- A community session package exists: `hono-sessions` 0.8.1 (2026-02-12) with peer `hono ^4.0.0` — [npm: hono-sessions](https://www.npmjs.com/package/hono-sessions) (accessed 2026-10-25)

#### Hono RPC client (`hc`)
- Export the type of the chained routes (`export type AppType = typeof route`) and create the client with `hc<AppType>('http://localhost:8787/')` from `hono/client`. Validator targets (`json`, `form`, `query`, `param`) type the request. A status passed to `c.json(data, 201)` types the response, and `res.status` checks narrow it. `InferRequestType` and `InferResponseType` extract types — [Hono docs: RPC](https://hono.dev/docs/guides/rpc) (accessed 2026-10-25)
- Monorepo requirements: set `"strict": true` in both the client and server `tsconfig.json`. Use the same Hono version on both sides, because mismatches can cause "Type instantiation is excessively deep and possibly infinite". Send cookies with `init: { credentials: 'include' }`. For IDE performance, compile the client type ahead of time (`hcWithType`), split sub-apps, or use TypeScript project references. Limits: handlers that return `.then()` chains lose response types, `c.notFound()` responses are untyped, and `hc` does not URL-encode `param` values — [Hono docs: RPC](https://hono.dev/docs/guides/rpc) (accessed 2026-10-25)

#### Elysia: Eden Treaty, cookies, static files, Elysia 2 status
- Eden Treaty: export `export type App = typeof app` on the server, and create the client with `treaty<App>('localhost:3000')`. Path segments become properties (`/deep/nested` becomes `.deep.nested`), and path parameters use a call (`.item({ name: 'Skadi' }).get()`). Results destructure as `{ data, error }`. The current docs import `treaty` from `@elysia/eden` — [Elysia docs: Eden Treaty overview](https://elysiajs.com/eden/treaty/overview) (accessed 2026-10-25)
- Cookies: a reactive API (`name.value = "New Value"`, `name.remove()`), schemas with `t.Cookie(...)`, and signing with `secrets` plus `sign: ['profile']`. An array of secrets enables rotation. Listed defaults: `httpOnly: false` and `path` equal to the handler path. The plugin list has no session plugin. Cookie signing and the JWT plugin are the documented options for session-like state — [Elysia docs: Cookie](https://elysiajs.com/patterns/cookie) (accessed 2026-10-25)
- Elysia 2 status: "Elysia 2 beta, is well, **beta**. It's not a stable release yet." The post moves TypeBox from 0.34 to 1.3 and confirms "Standard Schema support was added in 1.4". It adds Node.js support through `@elysia/node` and offers a codemod (`bunx @elysia/codemod@latest`) that automates "about 95%" of changes. Breaking changes include hooks and schema before the handler, hook names without the `on` prefix, RFC 9457 problem-details errors, opt-in WebSocket via `.use(websocket())`, and the removal of `resolve` — [Elysia blog: Elysia 2 beta - DayDream](https://elysiajs.com/blog/elysia-20), 2026-07-30
- Bundle sizes from the same post (un-minified): Elysia 2 alone is 344 KB, with Valibot 350 KB, and with Zod 868 KB — [Elysia blog: Elysia 2 beta](https://elysiajs.com/blog/elysia-20), 2026-07-30

#### Validation and Standard Schema
- Standard Schema implementers include "Zod (3.24.0+), Valibot (v1.0+), ArkType (v2.0+), Effect Schema (v3.13.0+, via adapter)". Tools that accept it include "Hono Middleware" and "Elysia". TypeBox and SvelteKit are not listed on the page — [Standard Schema: schema](https://standardschema.dev/schema) (accessed 2026-10-25)

### Inferences
- spot-mixer may not need a separate backend framework. SvelteKit server routes, form actions and hooks can hold the Spotify OAuth flow, keep tokens server-side and use Bun.redis. A separate Hono app is useful when the API must serve non-Svelte clients or when the frontend is an SPA.
- If a separate API is needed, Hono is the lower-risk choice. Its 4.x line is stable and runtime-neutral, and `@hono/bun` already works with Hono 4.13.9 or newer, which eases the v5 move. Elysia is Bun-optimized, but its 2.0 release candidate changes many APIs. Starting on 1.4 means a near-term migration, and starting on 2.0 means pre-release risk.
- Typed client in a Bun workspace: put the API in `apps/api` and export `type AppType`, then import it type-only in `apps/web`. Under Bun 1.4's isolated linker, `apps/web` must declare `hono` itself to import `hono/client`. A Bun catalog can pin one Hono version for both packages, which Hono's RPC guide requires.
- Use one Standard Schema library (Zod 4 or Valibot 1) for Hono validation, for Elysia 1.4+, and for SvelteKit code. `@sveltejs/kit` depends on `@standard-schema/spec`, which suggests that Kit features accept Standard Schema validators (not verified in the Kit docs). Valibot gives a smaller client bundle.
- For OAuth sessions, store an opaque session ID in a signed, `httpOnly`, `secure`, `SameSite=Lax` cookie, and store the token data in Redis with a TTL. No framework ships this store, so spot-mixer needs a small module of its own.

### Gaps
- Stable release dates for Hono 5 and Elysia 2 are unknown. Both are at release candidate as of 2026-10-25.
- hono.dev already documents `@hono/bun`, while npm `latest` is Hono 4.13.14. I could not confirm whether the site documents v4 or v5 by default.
- The scope situation for Elysia packages is unclear. `@elysia/eden` (1.4.10) is newer than `@elysiajs/eden` (1.4.9), but `@elysiajs/static` 1.4.10 is still under the old scope.
- I did not read the Eden Treaty install or response pages, so status-code typing and WebSocket support are unverified. I did not research `ioredis`/`node-redis` 6.x changes or how each runs under Bun 1.4.
- I did not verify Standard Schema support in SvelteKit's remote functions or form validation docs.

## 4. Redis: current version, Docker tags, Redis 8 license, persistence and healthchecks (Valkey in brief)

### Takeaway
Redis Open Source 8.10.2 (2026-09-17) is the newest stable release. The `redis:8.10.2-alpine` (Alpine 3.23) and `redis:8.10.2` (Debian trixie) images were rebuilt on 2026-10-22. Redis 8 is tri-licensed: the user picks RSALv2, SSPLv1 or AGPLv3. For durable sessions, the Redis docs recommend RDB plus AOF with the default `appendfsync everysec`. A `redis-cli ping` healthcheck matches the PING semantics. Valkey 9.1.2 (BSD-3-Clause) is a drop-in alternative, and Bun's client reads `VALKEY_URL`.

### Cited Findings
- Latest releases, all published 2026-09-17: 8.10.2 (newest line), plus maintenance releases 8.8.3, 8.6.7, 8.4.7 and 8.2.10. Redis 8.10.0 GA was published 2026-07-29 — [redis/redis releases](https://github.com/redis/redis/releases); [Redis 8.10.0 release](https://github.com/redis/redis/releases/tag/8.10.0) (accessed 2026-10-25)
- 8.10 highlights: compact hashes, `HIMPORT`, `LMOVEM`/`BLMOVEM`, `SUNIONCARD`, `SDIFFCARD`, the `BACKUP` command family, `XREAD`/`XREADGROUP` `MAXCOUNT`/`MAXSIZE`, and new `FT.*` and `TS.*` commands. Binary distributions include "Alpine and Debian Docker images". Test platforms include Debian 12 and 13 and Alpine 3.23 — [Redis 8.10.0 release](https://github.com/redis/redis/releases/tag/8.10.0), 2026-07-29
- Docker Hub tags updated 2026-10-22: `8.10.2-alpine`, `8.10.2-alpine3.23`, `8.10-alpine`, `8-alpine`, `alpine`, `8.10.2`, `8.10.2-trixie`, `8.10`, `8`, `latest` and `trixie`. The `8.2` line still uses Bookworm (`8.2.10-bookworm`, 2026-10-21). Older lines 7.4.11, 7.2.16 and 6.2.24 are also maintained — [Docker Hub: redis tags](https://hub.docker.com/_/redis/tags) (accessed 2026-10-25)
- License: "A user may select one of the following three license options to use Redis Open Source (starting with Redis 8) and subsequent versions: the Redis Source Available License v2 (RSALv2), the Server Side Public License v1 (SSPLv1), and the GNU Affero General Public License v3 (AGPLv3)." Redis 7.4 is "RSALv2 or SSPLv1", and 7.2 and earlier are BSD-3-Clause — [Redis licenses](https://redis.io/legal/licenses/) (accessed 2026-10-25; the page shows no last-updated date)
- RSALv2 forbids "Commercialize the software or provide it to others as a managed service in a way that provides the functionality of the Software available to third parties". "AGPLv3 is an OSI-approved open source license" with a duty to give source code to network users of modified versions. A quoted CEO statement says: "If you are building a solution that leverages Redis, but does not specifically compete with Redis itself, there is no impact." — [Redis licenses](https://redis.io/legal/licenses/) (accessed 2026-10-25)
- Persistence options: RDB (point-in-time snapshots), AOF (logs every write), no persistence ("sometimes used when caching") and RDB plus AOF. "The general indication you should use both persistence methods is if you want a degree of data safety comparable to what PostgreSQL can provide you." "If you care a lot about your data, but still can live with a few minutes of data loss in case of disasters, you can simply use RDB alone." "There are many users using AOF alone, but we discourage it" — [Redis docs: Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) (accessed 2026-10-25)
- AOF settings: `appendonly yes`. `appendfsync always` is "Very very slow, very safe". `appendfsync everysec` means "you may lose 1 second of data if there is a disaster". "The suggested (and default) policy is to `fsync` every second." Since 7.0, AOF uses a multi-part layout in the `appenddirname` directory. Since 8.10.0, the `BACKUP` commands produce restorable backups without stopping writes — [Redis docs: Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) (accessed 2026-10-25)
- Official image: `redis-server --save 60 1 --loglevel warning` saves a snapshot every 60 seconds if at least one write occurred. Data lives in `VOLUME /data`. A custom config goes to `/usr/local/etc/redis/redis.conf`. Protected mode is off by default, and a published port is "open without a password to anyone who can reach it". The image drops privileges to the `redis` user (`SKIP_DROP_PRIVS=1` and `SKIP_FIX_PERMS=1` exist since 8.0.2). The image docs give no password environment variable and no healthcheck guidance — [docker-library docs: redis content.md](https://github.com/docker-library/docs/blob/master/redis/content.md) (accessed 2026-10-25)
- PING "returns the simple string `PONG` if no argument is provided". It is useful for "Verifying the server's ability to serve data - an error is returned when this isn't the case (for example, during load from persistence data or accessing a stale replica)" — [Redis docs: PING](https://redis.io/docs/latest/commands/ping/) (accessed 2026-10-25)
- Valkey: latest stable 9.1.2 (2026-09-01), with 9.0.6, 8.1.10 and 8.0.11 maintained, and 9.2.0-rc1 (2026-09-16). License: BSD-3-Clause. Image tags include `valkey/valkey:9.1.2-alpine` (Alpine 3.24), `9.1-alpine` and `latest` (trixie), updated 2026-09-21 — [valkey-io/valkey releases](https://github.com/valkey-io/valkey/releases); [Docker Hub: valkey/valkey tags](https://hub.docker.com/r/valkey/valkey/tags) (accessed 2026-10-25)

### Inferences
- Use `redis:8.10.2-alpine` pinned by exact version. A Compose service could look like this (not tested):

  ```yaml
  redis:
    image: redis:8.10.2-alpine
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec", "--save", "300", "10"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep -q PONG"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s
  ```

- `grep -q PONG` makes the check fail on error replies such as `LOADING`, because the exit code of `redis-cli` on error replies is unverified. Do not publish port 6379 beyond `127.0.0.1`. Set a password or ACL through a mounted `redis.conf` (for example, from a Compose secret), because the image has no password variable.
- spot-mixer self-hosts Redis unmodified as a private cache and session store for its own app. Under the license summaries, that use does not provide Redis "as a managed service" to third parties (RSALv2), and it creates no AGPLv3 source duty, because the Redis code is not modified. This is not legal advice. Valkey (BSD-3-Clause) removes the question entirely and works with Bun.redis.
- Session data is login-critical, while the API cache is disposable. RDB plus AOF everysec gives at most about one second of loss. A cache-only Redis could run without persistence.

### Gaps
- I did not verify by image digest which version the floating tags `latest`, `8` and `alpine` point to on 2026-10-25.
- I did not verify which Redis 8 modules (Query Engine, JSON, TimeSeries, probabilistic) the Alpine image includes.
- The `redis-cli` exit code on an error reply (for example, during `LOADING`) is not documented in the sources I read.
- The license page gives no explicit ruling for "self-hosting for your own web app". The inference above comes from the license summaries and is not legal advice.

## 5. Docker Compose: current good practice

### Takeaway
The current release is Docker Compose v5.6.1 (2026-10-21). Compose v5.0.0 (2025-12-02) replaced the v2 line and removed the internal builder in favor of Docker Bake. The developer's Compose v2.38 (v2.38.0 released 2025-06-30) already supports everything spot-mixer needs: `depends_on` with `condition: service_healthy`, `restart` (2.17) and `required` (2.20); healthcheck durations including `start_interval` (2.20.2); `develop.watch` (2.22, with `restart` and `sync+exec` from 2.32); profiles; long-syntax `env_file`; and secrets. Omit the top-level `version:`. On Windows, Linux containers get file-change events only for files stored in the WSL file system.

### Cited Findings
- Compose releases: v5.6.1 (2026-10-21), v5.6.0 (2026-10-02), v5.0.0 (2025-12-02). The last v2 release was v2.40.3 (2025-10-30). v2.38.0 was released 2025-06-30 and v2.38.2 on 2025-07-08 — [docker/compose releases](https://github.com/docker/compose/releases) (accessed 2026-10-25)
- v5.0.0: "Compose can now officially be used as a SDK"; "Internal builder has been removed, build is delegated to Docker Bake". The v5 number skips 3.x and 4.x "to prevent (more) confusion with the obsolete docker-compose file versions `2.x` and `3.x`" — [Compose v5.0.0 release](https://github.com/docker/compose/releases/tag/v5.0.0), 2025-12-02
- v5.6.0 adds "partial support for jobs" and warns "on unsupported compose-file attributes". It also coalesces watch rebuilds triggered by a burst of file changes — [Compose v5.6.0 release](https://github.com/docker/compose/releases/tag/v5.6.0), 2026-10-02
- The docs.docker.com Compose release-notes URL now redirects (301) to the GitHub releases page — observed 2026-10-25 at [docs.docker.com/compose/releases/release-notes](https://docs.docker.com/compose/releases/release-notes/)
- Top-level `version`: "It is only informative and you'll receive a warning message that it is obsolete if used." "Compose always uses the most recent schema to validate the Compose file, regardless of the `version` field." The top-level `name` sets the project name and is exposed as `COMPOSE_PROJECT_NAME` — [Compose file reference: version and name](https://docs.docker.com/reference/compose-file/version-and-name/) (accessed 2026-10-25)
- `depends_on` long syntax: `condition` (`service_started`, `service_healthy`, `service_completed_successfully`). `restart: true` restarts the dependent service after Compose updates the dependency ("introduced in Docker Compose version 2.17.0"). `required` defaults to `true` and only warns when set to `false` ("introduced in Docker Compose version 2.20.0"). The short syntax does not wait for health. Example: `web` depends on `db` (`condition: service_healthy`, `restart: true`) and `redis` (`condition: service_started`) — [Compose file reference: services](https://docs.docker.com/reference/compose-file/services/) (accessed 2026-10-25)
- "On startup, Compose waits only until a container is running, not until it is ready" unless conditions are set. Removal follows reverse dependency order — [Compose docs: Control startup order](https://docs.docker.com/compose/how-tos/startup-order/) (accessed 2026-10-25)
- `healthcheck`: `test` is a string or a list that starts with `NONE`, `CMD` or `CMD-SHELL`. `interval`, `timeout`, `start_period` and `start_interval` are durations; the page says these were introduced in Compose 2.20.2. `disable: true` turns off an image healthcheck. Example: `interval: 1m30s`, `timeout: 10s`, `retries: 3`, `start_period: 40s`, `start_interval: 5s` — [Compose file reference: services](https://docs.docker.com/reference/compose-file/services/) (accessed 2026-10-25)
- `develop`: "It is available with Docker Compose version 2.22.0 and later." Actions: `sync`, `rebuild`, `restart` ("Available with Docker Compose version 2.32.0 and later"), `sync+restart` (2.23.0 and later) and `sync+exec` (2.32.0 and later). Attributes: `path`, `target`, `ignore`, `include`, `initial_sync` and `exec` — [Compose file reference: develop](https://docs.docker.com/reference/compose-file/develop/) (accessed 2026-10-25)
- Compose Watch runs with `docker compose up --watch` or `docker compose watch`. It applies to services built with `build`, not to prebuilt `image` services. The image must contain `stat`, `mkdir` and `rmdir`, and the container `USER` must be able to write to the target. "Don't sync `node_modules/`." Use `rebuild` for dependency manifest changes such as `package.json` — [Compose docs: Use Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) (accessed 2026-10-25)
- Profiles: `profiles: [debug]`. Services without `profiles` always start. Enable a profile with `--profile debug` or `COMPOSE_PROFILES=debug`, or enable all with `--profile "*"`. Naming a profiled service explicitly starts it and its `depends_on` dependencies. Profile names must match `[a-zA-Z0-9][a-zA-Z0-9_.-]+` — [Compose docs: Profiles](https://docs.docker.com/compose/how-tos/profiles/) (accessed 2026-10-25)
- `env_file` long syntax: `- path: ./override.env` with `required: false` ("Compose silently ignores the entry" if the file is missing). `format: raw` passes values without interpolation — [Compose file reference: services](https://docs.docker.com/reference/compose-file/services/) (accessed 2026-10-25)
- Secrets: the top-level `secrets` element takes `file:` or `environment:` sources. A service gets only the secrets it lists, mounted at `/run/secrets/<name>`. Secrets are preferred over environment variables because environment variables are visible to all processes and can leak into logs. The `_FILE` variable convention belongs to images, not to Compose. Build secrets go under `build: secrets:`. Secrets work only with Linux containers — [Compose docs: Secrets](https://docs.docker.com/compose/how-tos/use-secrets/) (accessed 2026-10-25)
- Long-syntax secret fields are `source`, `target`, `uid`, `gid` and `mode` (default `0444`). `uid`, `gid` and `mode` apply only to `environment` sources and are "silently ignored" for `file` sources — [Compose file reference: services](https://docs.docker.com/reference/compose-file/services/) (accessed 2026-10-25)
- Docker Desktop on WSL 2: store "source code and other data that is bind-mounted into Linux containers" in the Linux file system. "Linux containers only receive file change events" when the original files are on the Linux side. Avoid mounts such as `/mnt/c/...`. WSL VM memory and CPU limits go in `.wslconfig` — [Docker docs: WSL best practices](https://docs.docker.com/desktop/features/wsl/best-practices/) (accessed 2026-10-25)

### Inferences
- A suggested `compose.yaml` layout:
  - Use `name: spot-mixer` and no `version:` key.
  - Define a `redis` service with a healthcheck and a named volume.
  - Define a `web` service built from a multi-stage Dockerfile, with `depends_on: { redis: { condition: service_healthy, restart: true } }`.
  - Put Redis admin tools under `profiles: [tools]`.
  - Use `env_file` entries with `required: false` for an optional `.env.local`.
  - Mount the Spotify client secret as a Compose secret and read it from `/run/secrets/spotify_client_secret` in server code. SvelteKit `$env` modules read environment variables, not files, so the app needs a small file reader.
- The project lives on `E:\Projects` (a Windows drive). Bind-mounting it into a Vite dev container will not deliver file-change events. The best options are to run `bun --bun run dev` natively on Windows with only Redis in Compose, or to use Compose Watch `sync` to copy changes into the container. Watch needs a non-distroless dev image (`oven/bun:1.4.4-slim` or `debian`) because of the `stat`, `mkdir` and `rmdir` requirement.
- A production image for adapter-bun, adapted from Bun's guide (untested): install dependencies with `bun install --frozen-lockfile`, build with `bun run --bun build`, and install production dependencies with `--production` (or use `bun prune --production`). The final stage copies `build/`, `package.json` and the production `node_modules`, and runs `bun ./build`. The `distroless` image's entrypoint is `bun`, so `CMD ["./build"]` would suffice there. Its healthcheck must use `bun` (for example, `bun -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1))"`).
- No Compose v5-only feature is needed, so v2.38 is sufficient. Updating Docker Desktop is optional.

### Gaps
- The Docker Engine version that `start_interval` needs is not stated on the pages I read.
- The Compose version that introduced `env_file` `required` and `format` is not stated on the reference page.
- The dev machine's Docker Desktop version is unknown. I did not test whether Compose Watch from a Windows-drive project delivers changes reliably.

## 6. Tooling: lint and format, Svelte 5 component testing, Playwright with Bun

### Takeaway
ESLint 10 with eslint-plugin-svelte 3.23, typescript-eslint 8.72, Prettier 3.9 and prettier-plugin-svelte 4.1 is the mature path for Svelte 5. The `sv add` CLI scaffolds it. Biome 2.6.3 lints and formats `.svelte` files only experimentally, behind opt-in flags. Svelte's docs recommend Vitest for component tests (Vitest 5.0.5 with `vitest-browser-svelte` or `@testing-library/svelte`). Bun's own Svelte test guide targets Svelte 4 and is out of date. Playwright 1.64.1 does not officially support Bun, and its maintainers closed Bun requests as "not planned". Bun 1.4 claims that `playwright test` runs on Bun. TypeScript must stay on 6.0.x for this toolchain.

### Cited Findings

#### Lint and format
| Package | Latest | Published (UTC) | Compatibility | Source |
|---|---|---|---|---|
| eslint | 10.13.0 | 2026-10-16 | `maintenance` tag 9.39.5 (2026-07-10) | [npm](https://www.npmjs.com/package/eslint) |
| eslint-plugin-svelte | 3.23.1 | 2026-10-09 | peer `eslint ^8.57.1 \|\| ^9.0.0 \|\| ^10.0.0`, `svelte ^3 \|\| ^4 \|\| ^5` | [npm](https://www.npmjs.com/package/eslint-plugin-svelte) |
| typescript-eslint | 8.72.0 | 2026-10-19 | peer `eslint ^8.57.0 \|\| ^9 \|\| ^10`, `typescript >=4.8.4 <6.1.0` | [npm](https://www.npmjs.com/package/typescript-eslint) |
| prettier | 3.9.10 | 2026-10-10 | `next` is 4.0.0-alpha.13 | [npm](https://www.npmjs.com/package/prettier) |
| prettier-plugin-svelte | 4.1.1 | 2026-06-15 | peer `prettier ^3.0.0`, `svelte ^5.0.0`; Node >=20 | [npm](https://www.npmjs.com/package/prettier-plugin-svelte) |
| @biomejs/biome | 2.6.3 | 2026-10-24 | | [npm](https://www.npmjs.com/package/@biomejs/biome); [biome releases](https://github.com/biomejs/biome/releases) |

- Biome support for Svelte: parsing, formatting and linting are all "🟡 Experimental". Support for these files has existed out of the box since v2.3.0. "Since full support is still experimental, it must be enabled explicitly" through `html.experimentalFullSupportEnabled`, and the formatter needs `html.formatter.enabled`. Svelte control-flow syntax is supported since v2.4.0, and cross-language rules since v2.5.0 "may produce false positives". The page states "Biome supports TypeScript version 5.9" — [Biome: Language support](https://biomejs.dev/internals/language-support/) (accessed 2026-10-25)
- Official `sv add` add-ons: `ai-tools`, `better-auth`, `drizzle`, `enhanced-img`, `eslint`, `mdsvex`, `paraglide`, `playwright`, `prettier`, `storybook`, `sveltekit-adapter`, `tailwindcss` and `vitest`. No Biome add-on exists. `--install bun` selects Bun as the package manager — [Svelte CLI docs: sv add](https://svelte.dev/docs/cli/sv-add) (accessed 2026-10-25)

#### Testing Svelte 5 components
- The Svelte docs recommend Vitest for Vite projects. Tests can use runes when the file name includes `.svelte` (for example `multiplier.svelte.test.ts`), and effects need `$effect.root` and `flushSync`. Under Vitest, the config sets `resolve.conditions` to `['browser']`. The component testing example uses jsdom with `@testing-library/svelte`. Storybook tests run in Vitest browser mode. The page does not mention `bun test` — [Svelte docs: Testing](https://svelte.dev/docs/svelte/testing) (accessed 2026-10-25)
- `npx sv add vitest="usages:unit,component"` sets up a "client/server-aware testing setup for Svelte" with demo tests. The page does not list the packages it installs — [Svelte CLI docs: vitest](https://svelte.dev/docs/cli/vitest) (accessed 2026-10-25)
- Versions: vitest 5.0.5 (2026-10-15; 5.0.0 was 2026-09-03; the `V4` tag is 4.1.12), with `engines.node ^22.12.0 || ^24.0.0 || >=26.0.0` and peer `vite ^6.4.0 || ^7.0.0 || ^8.0.0`. vitest-browser-svelte 3.1.0 (2026-09-04) peers on `vitest ^4.0.0 || ^5.0.0`. @testing-library/svelte 5.4.2 (2026-06-23). happy-dom 21.0.4 (2026-10-20) — [npm: vitest](https://www.npmjs.com/package/vitest); [npm: vitest-browser-svelte](https://www.npmjs.com/package/vitest-browser-svelte); [npm: @testing-library/svelte](https://www.npmjs.com/package/@testing-library/svelte); [npm: happy-dom](https://www.npmjs.com/package/happy-dom) (accessed 2026-10-25)
- Bun 1.4: "vitest runs under Bun, including `--coverage`, with the threads and forks pools." — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20
- Bun's guide for testing Svelte with `bun test` installs `svelte@4`, `@testing-library/svelte` and `@happy-dom/global-registrator`. It preloads a custom plugin that compiles `.svelte` files with `svelte/compiler`, and its example reads Svelte 4 internals (`component.$$.ctx`) — [Bun guide: Svelte with bun test](https://bun.com/guides/test/svelte-test) (accessed 2026-10-25)
- Open Bun issue #5541 (2023-09-16): "bun test cannot find module "$app/environment" in SvelteKit project" — [oven-sh/bun issue #5541](https://github.com/oven-sh/bun/issues/5541) (accessed 2026-10-25)

#### Playwright with Bun
- `@playwright/test` 1.64.1 was published 2026-10-14 (1.64.0 on 2026-10-07) — [Playwright releases](https://github.com/microsoft/playwright/releases); [npm: @playwright/test](https://www.npmjs.com/package/@playwright/test) (accessed 2026-10-25)
- Playwright issue #27139 "[Feature] Compatibility with `bun`" (opened 2023-09-17) was closed as not planned on 2023-09-18. Issue #38095 "[Feature]: Add support for bun" (opened 2025-11-01) was closed as not planned on 2025-11-05 — [microsoft/playwright #27139](https://github.com/microsoft/playwright/issues/27139); [microsoft/playwright #38095](https://github.com/microsoft/playwright/issues/38095) (accessed 2026-10-25)
- Bun 1.4: "Playwright now runs on Bun: drive a browser with `connectOverCDP()`, run your suite with `playwright test`". A user comment on #27139 (2026-09-17) reports that CodeceptJS 4.1 with Playwright 1.62.1 on Bun 1.4.2 "works well" — [Bun 1.4 blog](https://bun.com/blog/bun-v1.4), 2026-08-20; [microsoft/playwright #27139](https://github.com/microsoft/playwright/issues/27139)
- The Svelte docs' Playwright example uses `webServer: { command: 'npm run build && npm run preview', port: 4173 }` with `testDir: 'tests'` — [Svelte docs: Testing](https://svelte.dev/docs/svelte/testing) (accessed 2026-10-25)

### Inferences
- Pin TypeScript to 6.0.x (6.0.3). typescript-eslint 8.72 accepts only `<6.1.0`, svelte-check accepts only TS 5 or 6, SvelteKit 3.1 peer-requires `^6.0.0`, and Biome documents TS 5.9. Bun 1.4 `bun init` writes `typescript ^7`, so this override is required.
- Use ESLint 10 with Prettier through `sv add eslint prettier` for `.svelte` files. Biome could still format and lint plain `.ts` server code, but two toolchains add config overhead. Biome's Svelte mode is experimental.
- Use two runners with a clear split. `bun test` covers server modules such as the Spotify client, Redis session store and mix logic, where it is fast and has `mock.module()`. Vitest 5 covers Svelte components, either in browser mode (`vitest-browser-svelte` with Playwright) or with jsdom and `@testing-library/svelte`. Using Vitest for everything is the simpler alternative. Do not build on Bun's Svelte 4 test guide.
- Run Playwright under Node.js 22.12 or newer (or 24 LTS) for reliability. Bun 1.4's claim is unofficial from Playwright's side. For adapter-bun, end-to-end tests should start the built server (`bun ./build`), not `vite preview`.

### Gaps
- I did not verify which packages `sv add vitest` installs (browser mode with Playwright, or jsdom).
- I did not research Vitest 5's breaking changes.
- The assignment does not state whether Node.js is installed on the developer machine. Vitest under Node needs Node 22.12 or newer, and Playwright officially needs Node.
- I found no statement in Playwright's own documentation about Bun. The evidence is two issues closed as not planned and Bun's own claim.
- The Biome page names TypeScript 5.9 support and does not mention TypeScript 6 syntax.
