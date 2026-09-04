# Changelog

All notable changes will be documented here. New entries go at the top.

## [1.0.0] - 2026-09-04

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
