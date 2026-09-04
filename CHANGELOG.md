# Changelog

All notable changes will be documented here. New entries go at the top.

## [1.9.0] - 2026-09-04

### Added

- Basic Mode: a sidebar toggle that hides everything except Encounters and Monsters for guests and new players
- Light theme, alongside the existing dark and pink themes
- Backup export/import: download a versioned JSON backup of tracker data and restore it with explicit confirmation
- Hidden monster waves that can be revealed mid-combat, plus condition timers on combatants
- Home Assistant lighting toggle, alongside Philips Hue
- Select/deselect all when importing encounters, and pick an existing Location / Group when editing an encounter
- New d20 application icon and favicon
- `DISABLE_LAN_AUTH_BYPASS` option to require login on every network when hosting publicly

### Changed

- Imported encounters now appear immediately without a page refresh

### Fixed

- Backup restore validates the complete backup file before overwriting existing data

## [1.8.0] - 2026-09-04

Initial public release.

### Features

- Combat tracking: initiative order, HP, temporary HP, conditions, concentration, death saves, spell slots, feature uses, legendary actions, lair actions, polymorph
- Undo/redo for combat state (up to 20 snapshots)
- Encounter management: create, save, scale, filter, favourite, and resume encounters
- Live player view shared via Socket.IO (read-only, updates in real time)
- Monster and spell reference library, seeded from 5etools data
- Campaign and session organisation with a configurable session board
- Soundboard with optional spatial audio
- D&D Beyond and Foundry VTT import
- PWA support for mobile and tablet use
- Docker deployment with SQLite persistence
- Optional integrations: Foundry VTT data path, Philips Hue, Home Assistant
