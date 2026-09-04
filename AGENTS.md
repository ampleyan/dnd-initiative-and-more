# Agent Context — Initiative Tracker

## Current architecture

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Motion, and Socket.IO client.
- Backend: ESM Node.js, Express, Socket.IO, and SQLite via `better-sqlite3`.
- `server.ts` is the composition root. `db/init.ts` owns schema and additive migrations. `routes/` owns API domains.
- `src/hooks/useAppState.ts` coordinates global state through focused domain hooks. `src/api/client.ts` is the shared typed fetch layer.
- User runtime data lives in SQLite and `uploads/`; do not edit, inspect, or commit it unless the task explicitly requires it.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm run seed
```

## Working conventions

- Work on a feature branch; this repository does not use Git worktrees.
- Keep backend persistence mapping in the responsible route and put schema changes in `db/init.ts`.
- Additive migrations must tolerate an already-existing column.
- Reuse `api.*` from `src/api/client.ts` for shared frontend requests.
- Preserve LAN authentication behavior: private-network clients bypass login by design, so do not describe the app as safe to expose publicly.
- Never commit `.env`, databases, uploads, credentials, private network names, or personal filesystem paths.

## Optional integrations

Foundry VTT, local audio, Philips Hue, and Home Assistant are opt-in through environment variables or the Settings UI. Copy `.env.example` to `.env` for deployment values. The repository has no implemented Gemini or other AI feature.

## Documentation

`README.md` and `ARCHITECTURE.md` describe current behavior. `docs/superpowers/` and `.superpowers/sdd/` are historical design and execution records; current code wins when they differ.
