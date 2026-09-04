# Initiative Tracker

A self-hosted D&D 5e initiative and encounter tracker for Dungeon Masters. It combines encounter prep, live combat tracking, a read-only player view, monster/spell references, campaigns, sound, and optional Foundry VTT and lighting integrations.

## Features

- Create, save, filter, scale, and resume encounters.
- Track initiative, HP, temporary HP, conditions, concentration, death saves, spell slots, feature uses, polymorph, legendary actions, lair actions, and undo/redo.
- Share a live player view through Socket.IO.
- Import D&D Beyond and Foundry VTT data; parse adventure material into encounters.
- Organize campaigns and sessions, and use a configurable session board.
- Run a soundboard with optional spatial audio and lighting effects.

## Quick start

Requires Node.js 22 LTS (the Docker image uses Node 22).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On first startup, the server creates an `admin` account. Set `ADMIN_PASSWORD` before the first startup to choose its password; otherwise, use the generated password printed by the server.

Copy `.env.example` to `.env` to configure production credentials or optional integrations. Never commit `.env`.

## Docker

```bash
cp .env.example .env
# Set SESSION_SECRET and ADMIN_PASSWORD in .env.
docker compose up --build -d
```

The default deployment listens on <http://localhost:3001> and persists SQLite data in `./data`. The base Compose file does not mount personal audio libraries or Foundry data. To use either integration, mount a host directory into the container and set `AUDIO_SFX_DIR`, `AUDIO_AMBIENCES_DIR`, or `FOUNDRY_DATA_PATH` to its container path.

## Security and privacy

This application is intended for trusted self-hosted use. Requests from loopback and RFC-1918 private-network addresses receive administrator access without a login; do not expose it directly to the public internet. Use a strong `SESSION_SECRET` in production.

SQLite data, uploaded portraits, and uploaded sounds are local runtime data. They are ignored by Git. See [SECURITY.md](SECURITY.md) for vulnerability reporting and secret-handling guidance.

## Development

```bash
npm run lint       # TypeScript check
npm test           # frontend and backend Vitest projects
npm run build      # production Vite build
npm run seed       # populate the library from 5etools data
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for system design, [CONTRIBUTING.md](CONTRIBUTING.md) for collaboration guidelines, and [docs/README.md](docs/README.md) for the documentation index.

## License

This project is released under the [MIT License](LICENSE).
