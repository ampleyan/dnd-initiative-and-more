# Stage 1: Install all dependencies (cached unless package.json changes)
FROM node:26-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2: Prune to prod-only deps (cached unless package.json changes)
FROM deps AS prod-deps
RUN npm prune --omit=dev

# Stage 3: Build frontend (only re-runs when source changes)
FROM deps AS build
COPY . .
RUN npm run build

# Stage 4: Final runtime image
FROM node:26-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    echo '--js-runtimes nodejs' > /etc/yt-dlp.conf
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/db ./db
COPY --from=build /app/routes ./routes
COPY --from=build /app/src/lib/playerLog.ts ./src/lib/playerLog.ts
COPY --from=build /app/src/lib/playerViewSettings.ts ./src/lib/playerViewSettings.ts
COPY --from=build /app/scripts/update-monsters.ts ./scripts/update-monsters.ts
COPY --from=build /app/scripts/monster-update-db.ts ./scripts/monster-update-db.ts

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npx", "tsx", "server.ts"]
