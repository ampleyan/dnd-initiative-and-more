# Initiative Tracker

**A self-hosted, open-source D&D 5e combat tracker for Dungeon Masters — an alternative to Improved Initiative and D&D Beyond's encounter tools that you own end to end.**

Prep encounters, run initiative, and share a live player view — no subscription, no account, your data stays on your machine.

![CI](https://github.com/ampleyan/dnd-initiative-and-more/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node 22](https://img.shields.io/badge/node-22_LTS-green.svg)

<!-- Drop a screenshot or demo GIF at docs/demo.gif (a 20–30s clip of a real combat converts best) -->
![Initiative Tracker in action](docs/demo.gif)

## Why

Most combat trackers are either cloud-locked, subscription-gated, or tied to a single VTT. Initiative Tracker runs on your own hardware, works at the table without internet, and hands players a read-only view of the fight — all from one Docker command.

## Features

- **Encounter prep** — create, save, filter, scale to party size, and resume encounters.
- **Full 5e combat** — initiative, HP/temp HP, conditions, concentration, death saves, spell slots, feature uses, polymorph, legendary & lair actions, and undo/redo.
- **Live player view** — share the fight in real time over Socket.IO; players see what they should, nothing they shouldn't.
- **Basic Mode** — a one-click toggle that strips the UI down to just Encounters and Monsters for guests and new players.
- **Import anything** — pull in D&D Beyond and Foundry VTT data, or parse adventure text straight into encounters.
- **Campaigns & sessions** — organize your table with a configurable session board.
- **Soundboard** — optional spatial audio and smart-lighting effects for ambiance.

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
