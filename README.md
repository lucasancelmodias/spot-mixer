# spot-mixer

A personal web app that mixes two or more artists into one Spotify playlist.
The plan and the Spotify API research are in [docs/PLAN.md](docs/PLAN.md).

## Requirements

- Bun 1.4.4
- Node.js 22.12 or later (Vitest runs on Node)
- Docker Desktop with Compose v2.38 or later
- A Spotify app in Development Mode. The app owner needs an active Premium subscription.

## Spotify app setup

1. In the Spotify Developer Dashboard, open the settings of your app.
2. Add these redirect URIs:
   - `http://127.0.0.1:5173/auth/callback` (development)
   - `http://127.0.0.1:3000/auth/callback` (Docker)
3. In **User Management**, add each user with the email of their Spotify account. The limit is 5 users.
4. Copy `.env.example` to `.env`. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REDIRECT_URI`.

Use `127.0.0.1`, not `localhost`. Spotify rejects `localhost` in redirect URIs.

## Development

```sh
bun install
docker compose -f compose.yaml -f compose.dev.yaml up -d   # Redis only, on 127.0.0.1:6380
bun run dev                                                # API on :3000, web on :5173
```

Open http://127.0.0.1:5173.

The development Redis uses host port 6380, because another local Redis (for example one in WSL) often holds port 6379.

## Checks

```sh
bun run check   # type checks, Prettier, ESLint
bun run test    # bun test (server) and Vitest (web)
```

## Production-like run

```sh
docker compose up -d --build
```

Open http://127.0.0.1:3000. Stop the stack with `docker compose down`.
