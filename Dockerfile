# Stage 1: Build the frontend
FROM node:22-slim AS build-frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Install production dependencies (including native modules)
FROM node:22-slim AS prod-deps
WORKDIR /app
# Install build essentials for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev

# Stage 3: Final runtime image
FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp --break-system-packages && \
    echo '--js-runtimes nodejs' > /etc/yt-dlp.conf && \
    rm -rf /var/lib/apt/lists/*
# Only copy what's necessary
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build-frontend /app/dist ./dist
COPY --from=build-frontend /app/server.ts ./
COPY --from=build-frontend /app/package.json ./
COPY --from=build-frontend /app/tsconfig.json ./
COPY --from=build-frontend /app/db ./db
COPY --from=build-frontend /app/routes ./routes
COPY --from=build-frontend /app/update-monsters.ts ./

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the server using npx tsx
CMD ["npx", "tsx", "server.ts"]
