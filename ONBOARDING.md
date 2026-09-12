# DnD Initiative & More — Developer Onboarding

## What is this?

A full-stack D&D 5e combat tracker built with React 19, Express, Socket.IO, and SQLite. The DM runs it locally; players connect to `/player/<id>` from any device on the same network.

## Quick start

```bash
npm install
npm run dev        # starts Vite (frontend) + Express (backend) concurrently
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001  
Player view: http://localhost:5173/player/:id

## Stack at a glance

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Express, Socket.IO, `better-sqlite3`, ESM Node.js |
| Tests | Vitest — two projects: `jsdom` (frontend) and `node` (backend) |
| Styling | Tailwind v4 with container queries (`@container/settings`) |

## Project structure

```
db/
  init.ts            — SQLite schema + additive migrations
routes/
  encounters.ts      — REST + real-time for encounters
  monsters.ts        — monsters, players, spells, features
src/
  lib/
    importDiff.ts    — pure diff/preview helpers for import UI
    sceneStart.ts    — pure helpers for scene-start auto-apply
    playerViewSettings.ts
    useCombatActions.ts  — authoritative for turn flow, conditions, undo
  components/
    MainContent.tsx  — primary DM UI (tabs, settings, combat panel)
    OnboardingModal.tsx
    WhatsNewModal.tsx
  types.ts           — shared TypeScript interfaces
```

## Key architectural rules

**`useCombatActions.ts` is the single source of truth** for turn transitions, condition expiry, reaction reset, legendary reset, undo/redo, and persistence. Do not replicate this logic elsewhere.

**SQLite migrations are additive only.** Add new columns with:
```ts
try { db.exec(`ALTER TABLE foo ADD COLUMN bar TEXT DEFAULT NULL`) } catch {}
```
Use `migrations` for tables created at init time, `playerMigrations` for columns on the `players` table (created later in `db/init.ts` — ordering matters).

**Persist encounter fields through `routes/encounters.ts`** and surface them via `formatEncounter`. Add the field to the `Encounter` interface in `src/types.ts`.

**Pure helpers go in `src/lib/`** — no React, no DB, no side effects. Test them in isolation with Vitest.

**Socket.IO rooms** — each encounter has its own room (`encounter:<id>`). The player view subscribes; the DM broadcasts on every state change.

## Running tests

```bash
npm test            # all tests (Vitest)
npm run test:watch  # watch mode
```

Tests live in `src/__tests__/`. Backend tests use Supertest against a real in-memory SQLite instance (no mocks).

## Lint & build

```bash
npm run lint        # ESLint
npm run build       # tsc + Vite production build
```

CI gate: all three must pass before merging.

## What's New / Onboarding modals

- `WhatsNewModal.tsx` — bump `APP_VERSION` and prepend a new entry to `RELEASES` for each release
- `OnboardingModal.tsx` — edit `STEPS` to update the guided tour; key stored in `localStorage` as `onboarding-complete-v1`
- First-run logic lives in `App.tsx`: What's New fires on first load, onboarding triggers after it is dismissed

## Import system

`src/lib/importDiff.ts` computes `new / update / unchanged` diffs before the user confirms an import. `EntitySelector.tsx` renders the badge. Provenance (`imported_at`, `imported_from`) is stamped in `routes/monsters.ts`.

## Scene start auto-apply

`src/lib/sceneStart.ts` provides `normalizeSceneStartConfig` and `buildSceneStartCommands` (pure). `MainContent.tsx` watches the `false → true` transition of `isEncounterActive` via a `prevActiveRef` and calls `onUpdateEncounter` with the resolved values.

## Player view

`/player/:id` is a separate React route. Settings are stored in `playerViewSettings` on the encounter. Presets (Tactical, Cinematic, Mystery, Boss) and spotlight are toggled from the DM panel and broadcast via Socket.IO.

## Atmosphere integrations

- **Philips Hue** — toggle per-effect targets in the Connections settings tab
- **Foundry VTT** — REST import bridge; configure URL + API key in the Connections tab
- **Home Assistant** — optional scene trigger on combat events

Settings tab uses a single-column layout (no container-query grid) so each panel has full width.
