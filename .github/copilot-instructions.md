# Copilot Instructions

Initiative Tracker is a React 19/Vite frontend with an Express, Socket.IO, and SQLite backend.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Ownership boundaries

- `server.ts` composes the application; it does not own domain routes or schema.
- `db/init.ts` owns SQLite schema and additive migrations.
- `routes/` owns API domains and persistence serialization.
- `src/api/client.ts` owns reusable typed fetch calls.
- `src/hooks/useAppState.ts` coordinates focused domain hooks.
- Shared interfaces live in `src/types.ts`.

Use Tailwind v4 utilities and `cn()` from `src/lib/utils.ts` for conditional styles. Use `motion/react` for list reordering animations. Preserve the existing LAN authentication model and never commit secrets, `.env` files, personal host paths, runtime data, or generated output.
