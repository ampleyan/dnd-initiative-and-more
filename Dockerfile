# Stage 1: Build the frontend and prepare production dependencies
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Stage 2: Final runtime image
FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp --break-system-packages && \
    echo '--js-runtimes nodejs' > /etc/yt-dlp.conf && \
    rm -rf /var/lib/apt/lists/*
# Only copy what's necessary
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/db ./db
COPY --from=build /app/routes ./routes
COPY --from=build /app/scripts/update-monsters.ts ./scripts/update-monsters.ts

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the server using npx tsx
CMD ["npx", "tsx", "server.ts"]
