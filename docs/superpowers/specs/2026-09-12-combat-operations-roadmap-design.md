# Combat Operations Roadmap Design

## Purpose

Evolve Initiative Tracker into a local-first combat operating system without becoming a virtual tabletop. The work is delivered in five independently shippable releases, in the order below. Existing Express, SQLite, React, Socket.IO, combat-action, player-view, Foundry, D&D Beyond, sound, and Hue seams remain authoritative.

## Product boundaries

- The application remains self-hosted, LAN-first, and usable without external APIs after data is imported.
- Combat automation assists the DM; it never resolves rolls or rules silently.
- A player client remains read-only. It may receive only encounter data already allowed by player-view disclosure.
- Foundry and D&D Beyond remain import sources. Local encounter edits are authoritative until an explicit reviewed refresh is accepted.
- No tactical map, tokens, fog of war, drawing tools, macro language, account system, or general VTT framework is in scope.
- Every persisted field uses an additive, duplicate-column-tolerant SQLite migration in `db/init.ts`; `routes/encounters.ts` owns its API mapping.

## Current seams to extend

| Concern | Existing owner | Required preservation |
|---|---|---|
| Turn changes | `src/hooks/useCombatActions.ts` | Timed condition expiry, legendary reset, reaction reset, undo/redo, bulk persistence remain authoritative. |
| Turn surface | `src/components/TurnCommandCenter.tsx` | Existing action modal and previous/next handlers remain the only command flow. |
| Visibility and waves | `CombatantRow`, `routes/encounters.ts` | `hidden`, `waveId`, player filtering, and Socket.IO invalidation remain the visibility mechanism. |
| Encounter state | `src/types.ts`, `db/init.ts`, `routes/encounters.ts` | Existing encounters load with safe defaults; unsupported JSON is normalized at the route boundary. |
| Player display | `PlayerView`, `useAppState` | Player clients reload only after `encounter-updated`; display settings never alter DM combat state. |
| Imports | `routes/foundry.ts`, D&D Beyond routes/components | Existing import remains available while review-first import is added. |

## Release 1 — Combat Operations

### Outcome

The DM can run a round from a compact turn ledger with visible obligations, resources, and keyboard-accessible commands. Waves can be revealed by a declared combat event as well as manually or by round.

### Turn ledger

Create a pure `deriveTurnLedger` helper. It accepts the sorted combatants, current index, round, and encounter wave rules. It returns display-only ledger items:

- start-turn: legendary charges restored, recharge prompt, regeneration/recurring effect prompts;
- current-turn: concentration, timed conditions expiring at turn end, reaction status, feature/spell resource summaries;
- crossing: lair-action initiative-20 crossing and event-triggered wave availability;
- end-turn: conditions whose existing timers will expire.

Ledger items have stable IDs derived from combatant/action/event IDs, a severity, label, and optional action target. They are not persisted and do not replace `handleNextTurn` logic. Acknowledge only dismisses an item in component state until the turn identity changes; it never changes the rules state.

### Keyboard/action bar

Extend the existing command palette and turn controls with a small fixed command registry: next/previous turn, quick damage/heal for selected actor, toggle reaction, hide/reveal active actor, open conditions, and action search. Store only user shortcut overrides in existing preferences. Reject duplicate active shortcuts and reserved browser keys. Preserve Space/Shift+Space behavior.

### Event-triggered waves

Extend `EncounterWave` with an optional trigger: `manual`, `round`, `boss-bloodied`, or `combatant-defeated`, plus an optional combatant target ID. A trigger makes a hidden wave *available*; it does not auto-reveal it. The DM confirms reveal using the existing waves endpoint, which preserves `hidden` and Socket.IO behavior. Legacy waves normalize to manual or their current `revealRound` behavior.

### Acceptance

- A turn ledger never changes timers/resources merely by rendering.
- Existing auto-expiry/reset behavior is unchanged.
- Keyboard invocation uses existing handlers, not duplicate mutation paths.
- Triggered waves appear only after the matching combat event and reveal through the existing endpoint.

## Release 2 — Encounter Intelligence

### Outcome

Encounter prep answers whether a fight matches the selected party and why, then lets the DM save intentional variants.

### Model

Add `EncounterBudget` and `EncounterVariant` JSON fields to encounters. Budget contains party size, party levels, target difficulty (`easy`, `medium`, `hard`, `deadly`), and an optional DM adjustment. Variants contain name, notes, and a complete encounter-composition snapshot; they do not fork campaigns or combat logs.

The calculation is a deterministic pure helper using a documented 2014/2024-compatible XP threshold table selected by ruleset. Output includes total adjusted XP, threshold, difficulty, and explanations (`outnumbered`, `solo swinginess`, `mixed CR`, `reinforcement pressure`). It is advisory and states its assumptions.

### Acceptance

- A missing budget leaves legacy encounters unchanged.
- Variants can be previewed and applied only after explicit confirmation.
- Calculation tests cover party size, mixed CR, absent XP, and wave inclusion choices.

## Release 3 — Player Display Polish

### Outcome

DMs choose a named player-display preset and can publish short-lived cinematic spotlight events without exposing hidden combat data.

### Model

Add per-encounter `playerViewPreset` (`tactical`, `cinematic`, `mystery`, `boss`) and `playerSpotlight` JSON. Selecting a preset copies its settings into the existing `playerViewSettings` object; later granular edits mark the preset `custom`. Spotlight has an ID, kind (`arrival`, `reinforcements`, `phase`, `lair`), player-safe title/body, and expiry turn/round. It is created by the DM and visible only on PlayerView.

Generate a QR code locally from the existing player URL using a small browser-only dependency only if one is already acceptable to the project; otherwise render a copyable URL and defer QR. Never contact an external QR service.

### Acceptance

- Presets never change combatant `hidden` or DM-only data.
- Player reconnect state is derived from socket connection status, not stored in the encounter.
- Spotlight expires without a background job and is omitted from player reloads after expiry.

## Release 4 — Import Confidence

### Outcome

Foundry and D&D Beyond refreshes become reviewable merges rather than opaque overwrites.

### Model

Store import provenance per combatant and encounter: source (`foundry` or `ddb`), stable source ID, source display name, last imported fingerprint, and last imported timestamp. An import preview calculates `add`, `update`, `unchanged`, and `conflict` field-level changes against current local data. Apply accepts only explicitly selected changes. The default policy preserves local HP, initiative, notes, visibility, wave membership, and active combat state.

No automatic polling or bidirectional sync is introduced.

### Acceptance

- Existing direct import remains available during migration.
- Preview has no writes.
- Applying a preview writes selected fields atomically and emits one encounter invalidation.

## Release 5 — Scene Start

### Outcome

A DM starts a prepared scene with one action: encounter, player-view atmosphere, audio, Hue preset, background, and notes are coordinated through existing owners.

### Model

Add `EncounterSceneStart` JSON to encounters. It references existing IDs/values only: background image, sound IDs, Hue preset, player-view weather/preset, opening readout, and optional session association. Starting a scene calls existing encounter update, soundboard, and Hue flows in a deterministic order; failures are reported per subsystem without rolling back the already-saved encounter state.

### Acceptance

- Scene start does not introduce a map/token model.
- Missing optional integrations leave the encounter/player display usable.
- Retrying is idempotent and does not duplicate sound playback requests.

## Rollout and rollback

Each release expands schema, normalizes reads, writes only new fields, then ships UI. No destructive migration or backfill is required. Removing a release means hiding its UI and ignoring its optional JSON fields; older rows continue to load.

## Test strategy

Every release adds pure-helper tests, route/API round-trip tests, and focused React component tests. Before each release handoff run `npm run lint`, `npm test`, and `npm run build`. Docker-dependent changes additionally require `docker compose build` and a container-start smoke test.
