# syntax=docker/dockerfile:1

# Build stage: install the workspace, build the SPA, and bundle the API.
FROM oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --filter './apps/web' build \
	&& bun run --filter './apps/server' build

# Runtime stage: one bundled server file and the static SPA. No node_modules.
FROM oven/bun:1.4.4-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	STATIC_DIR=./public
COPY --from=build /app/apps/server/dist ./
COPY --from=build /app/apps/web/build ./public
USER bun
EXPOSE 3000
CMD ["bun", "index.js"]
