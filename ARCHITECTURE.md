# Architecture

Initiative Tracker is a single Node.js application: Express hosts the API and Vite in development (or static files in production), while Socket.IO carries live encounter notifications.

## Runtime boundaries

| Area | Owner |
|---|---|
| Application composition | `server.ts` initializes the database, sessions, Socket.IO, static assets, optional settings, and routers. |
| Persistence | `db/init.ts` creates SQLite tables and performs additive migrations. |
| HTTP API | `routes/` contains domain router factories: auth, encounters, campaigns, monsters/players, sounds, lighting, D&D Beyond, Foundry, and image/proxy services. |
| Shared frontend types | `src/types.ts` |
| API client | `src/api/client.ts` provides typed wrappers around `fetch`. |
| Frontend state | `src/hooks/useAppState.ts` composes focused combat, encounter-management, monster, player, campaign, and soundboard hooks. |

SQLite uses `better-sqlite3` synchronously. Structured combat data is encoded as JSON in TEXT columns and is parsed/serialized by the owning route. Migrations are additive only: there is no migration version table or rollback system.

## Authentication

`express-session` provides login sessions, and the session middleware is shared with Socket.IO. On trusted local networks (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`), requests bypass login as an administrator. This is intentional for LAN play and unsuitable for public exposure.

## Live updates

Clients join an encounter room and re-fetch data after a mutation notification. Socket.IO events are:

- Client to server: `join-encounter`, `leave-encounter`, `dm-log-sync`
- Server to client: `encounter-updated`, `player-log-updated`

`encounter-updated` is an invalidation message; the receiving client loads the updated encounter through the API. `player-log-updated` is the explicit combat-log payload sent from the DM to player clients.

## Deployment and integrations

The production Docker image runs `tsx server.ts`, serves `dist/`, and persists its database through `DB_PATH`. Foundry, local audio, Philips Hue, and Home Assistant are optional. They are configured through environment variables or the Settings UI and must not be committed as host paths or credentials.

## Verification

Vitest has separate frontend (jsdom) and backend (Node/Supertest) projects. `npm run lint`, `npm test`, and `npm run build` are the normal release checks.
