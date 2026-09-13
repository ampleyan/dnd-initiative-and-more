# Combat Operations Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver five self-contained releases that make Initiative Tracker a faster local combat operator without becoming a VTT.

**Architecture:** Extend existing combat, encounter, player-view, import, sound, and Hue ownership boundaries. Persist only additive encounter/combatant metadata in SQLite; derive transient prompts from combat state and use `encounter-updated` for live refresh.

**Tech Stack:** React 19, TypeScript, Vite, Express, Socket.IO, SQLite/better-sqlite3, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-12-combat-operations-roadmap-design.md`

## Global Constraints

- Do not create a tactical map, token engine, fog-of-war system, macro language, cloud account dependency, or bidirectional Foundry sync.
- Preserve existing `handleNextTurn`, `ActionExecutionModal`, `hidden`, `waveId`, player filtering, and Socket.IO invalidation paths.
- Put schema additions only in `db/init.ts` and encounter persistence mapping only in `routes/encounters.ts`.
- Migrations are additive and tolerate an existing column.
- Do not edit runtime databases, uploads, credentials, or `.env` files.
- Run `npm run lint`, `npm test`, and `npm run build` before each release handoff.

---

## File map

| Release | Primary files |
|---|---|
| Combat Operations | `src/lib/combatantUtils.ts`, `useCombatActions.ts`, `TurnCommandCenter.tsx`, `CommandPalette.tsx`, `CombatantRow.tsx`, `types.ts`, `db/init.ts`, `routes/encounters.ts` |
| Encounter Intelligence | `src/lib/encounterBudget.ts`, `EncounterCreator.tsx`, `EncounterVault.tsx`, `types.ts`, `db/init.ts`, `routes/encounters.ts` |
| Player Display Polish | `src/lib/playerViewSettings.ts`, `PlayerView.tsx`, `MainContent.tsx`, `types.ts`, `db/init.ts`, `routes/encounters.ts` |
| Import Confidence | `routes/foundry.ts`, D&D Beyond route/component owners, `src/lib/importDiff.ts`, import UI, `types.ts`, `db/init.ts` |
| Scene Start | `src/lib/sceneStart.ts`, `MainContent.tsx`, sound/Hue hooks, `types.ts`, `db/init.ts`, `routes/encounters.ts` |

## Release 1: Combat Operations

### Task 1: Define and test the pure turn ledger

**Files:**
- Modify: `src/lib/combatantUtils.ts`
- Modify: `src/types.ts`
- Test: `src/__tests__/combatantLogic.test.ts`

**Interfaces:**
- Produces `deriveTurnLedger(input: TurnLedgerInput): TurnLedgerItem[]`.
- `TurnLedgerInput` contains `combatants`, `currentTurnIndex`, `currentRound`, and `waves`.
- `TurnLedgerItem` contains `id`, `phase`, `severity`, `label`, and optional `combatantId`/`waveId`.

- [ ] Write failing tests for concentration, expiring timers, legendary restoration, reaction state, lair crossing, and no-op turns.
- [ ] Run `npm test -- src/__tests__/combatantLogic.test.ts`; confirm the helper is missing.
- [ ] Implement the helper with no writes and reuse `shouldTriggerLairAction`.
- [ ] Run the focused test; confirm all ledger cases pass.
- [ ] Commit `test: cover derived combat turn ledger`.

### Task 2: Add event-triggered wave eligibility

**Files:**
- Modify: `src/types.ts`
- Modify: `db/init.ts`
- Modify: `routes/encounters.ts`
- Modify: `src/hooks/useCombatActions.ts`
- Test: `tests/api.test.ts`, `src/__tests__/waves.test.tsx`

**Interfaces:**
- Extend `EncounterWave` with `trigger?: { kind: 'manual' | 'round' | 'boss-bloodied' | 'combatant-defeated'; combatantId?: string }` and `available?: boolean`.
- Produces `evaluateWaveAvailability(waves, combatants, round): EncounterWave[]` as a pure helper.

- [ ] Write failing API tests proving legacy waves load and trigger metadata survives encounter create/update/bulk round trips.
- [ ] Write failing UI/helper tests proving a hidden wave only becomes available after its declared event and still calls `api.encounters.revealWave` to reveal.
- [ ] Add the migration and route normalization/persistence mapping.
- [ ] Call the pure evaluator after the existing turn transition computes updated combatants; do not reveal or mutate `hidden` there.
- [ ] Add the available-wave confirmation affordance to the existing wave controls.
- [ ] Run focused backend/frontend tests; confirm they pass.
- [ ] Commit `feat: add event-triggered wave availability`.

### Task 3: Render ledger and command shortcuts through existing actions

**Files:**
- Modify: `src/components/TurnCommandCenter.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/MainContent.tsx`
- Modify: `src/App.tsx`
- Test: `src/__tests__/TurnCommandCenter.test.tsx`, command-palette test file

**Interfaces:**
- `TurnCommandCenter` receives ledger items and existing action/turn callbacks.
- `CombatCommand` is `{ id, label, shortcut?, run(): void }`; it wraps existing callbacks only.

- [ ] Write failing component tests for ledger visibility, acknowledgement reset on active-turn change, and keyboard command dispatch.
- [ ] Verify tests fail because no acknowledgement/command registry exists.
- [ ] Implement component-local acknowledgements keyed by active combatant ID and a fixed command registry.
- [ ] Add preference-backed shortcut overrides with duplicate/reserved-key validation in the existing preferences flow.
- [ ] Run focused tests, then `npm run lint`, `npm test`, and `npm run build`.
- [ ] Commit `feat: add combat turn ledger and keyboard commands`.

## Release 2: Encounter Intelligence

### Task 4: Implement deterministic encounter budget calculation

**Files:**
- Create: `src/lib/encounterBudget.ts`
- Modify: `src/types.ts`
- Test: `src/__tests__/encounterBudget.test.ts`

- [ ] Write failing tests for empty party, thresholds by difficulty, mixed-CR explanation, absent XP, and reinforcement inclusion.
- [ ] Run the focused test; confirm the module is missing.
- [ ] Implement `calculateEncounterBudget(party, combatants, options)` returning totals, difficulty, assumptions, and explanations.
- [ ] Run the focused test; confirm it passes.
- [ ] Commit `feat: calculate explainable encounter budgets`.

### Task 5: Persist party budgets and encounter variants

**Files:**
- Modify: `src/types.ts`
- Modify: `db/init.ts`
- Modify: `routes/encounters.ts`
- Modify: `src/api/client.ts`
- Test: `tests/api.test.ts`

- [ ] Write failing API tests for absent legacy fields, valid budget/variant round trips, and malformed JSON normalization.
- [ ] Add additive columns and normalized route mapping.
- [ ] Ensure a variant is a composition snapshot and does not copy runtime active-turn/log state.
- [ ] Run API tests; confirm pass.
- [ ] Commit `feat: persist encounter budgets and variants`.

### Task 6: Add prep UI with explicit apply confirmation

**Files:**
- Modify: `src/components/EncounterCreator.tsx`
- Modify: `src/components/EncounterVault.tsx`
- Modify: `src/components/MainContent.tsx`
- Test: encounter creator/vault component tests

- [ ] Write failing tests for explanation display, saving a named variant, previewing it, and canceling apply without combatant changes.
- [ ] Implement the budget panel and variant controls in existing prep surfaces.
- [ ] Use an explicit confirmation before replacing encounter composition.
- [ ] Run focused tests and full release checks.
- [ ] Commit `feat: add encounter intelligence and variants`.

## Release 3: Player Display Polish

### Task 7: Add named presets and player-safe spotlight data

**Files:**
- Modify: `src/lib/playerViewSettings.ts`
- Modify: `src/types.ts`
- Modify: `db/init.ts`
- Modify: `routes/encounters.ts`
- Test: `src/__tests__/playerViewSettings.test.ts`, `tests/api.test.ts`

- [ ] Write failing tests for tactical/cinematic/mystery/boss presets, custom-setting detection, legacy normalization, and spotlight expiry filtering.
- [ ] Add pure preset and spotlight helpers.
- [ ] Add route persistence and normalization without exposing DM-only data in player endpoints.
- [ ] Run focused tests; confirm pass.
- [ ] Commit `feat: persist player display presets and spotlights`.

### Task 8: Add player-display controls, spotlight, and join status

**Files:**
- Modify: `src/components/MainContent.tsx`
- Modify: `src/components/PlayerView.tsx`
- Modify: socket/app state owner
- Test: `src/__tests__/PlayerView.test.tsx`

- [ ] Write failing tests for preset selection, player-visible spotlight, expired spotlight absence, reduced-motion behavior, and reconnect indicator.
- [ ] Implement controls in the existing DM player-view area and presentation in PlayerView.
- [ ] Render a copyable player URL; add QR only if a local dependency is explicitly selected.
- [ ] Run focused tests and full release checks.
- [ ] Commit `feat: polish player display presets and spotlight events`.

## Release 4: Import Confidence

### Task 9: Define provenance and import diff helpers

**Files:**
- Create: `src/lib/importDiff.ts`
- Modify: `src/types.ts`
- Test: `src/__tests__/importDiff.test.ts`

- [ ] Write failing tests for add/update/unchanged/conflict classification and preservation of local HP, initiative, notes, hidden, and wave fields.
- [ ] Implement `buildImportPreview(current, incoming, provenance)` and `applyImportSelections(current, preview, selections)` as pure functions.
- [ ] Run focused tests; confirm pass.
- [ ] Commit `feat: calculate reviewable import diffs`.

### Task 10: Persist provenance and add reviewed Foundry/DDB refresh

**Files:**
- Modify: `db/init.ts`
- Modify: `routes/foundry.ts`
- Modify: D&D Beyond route owner
- Modify: import UI owner
- Test: `tests/foundryLiveSync.test.ts`, D&D Beyond/API tests

- [ ] Write failing route tests proving preview writes nothing and selected apply performs one atomic update plus one invalidation.
- [ ] Add additive provenance storage and preview/apply endpoints.
- [ ] Add preview review UI; keep existing direct import available until accepted replacement is verified.
- [ ] Run focused tests and full release checks.
- [ ] Commit `feat: add reviewed Foundry and DDB refreshes`.

## Release 5: Scene Start

### Task 11: Define scene-start configuration and orchestration helper

**Files:**
- Create: `src/lib/sceneStart.ts`
- Modify: `src/types.ts`
- Modify: `db/init.ts`
- Modify: `routes/encounters.ts`
- Test: `src/__tests__/sceneStart.test.ts`, `tests/api.test.ts`

- [ ] Write failing tests for valid references, missing optional integration configuration, and idempotent retry ordering.
- [ ] Implement a pure command list from `EncounterSceneStart`; it references existing background/sound/Hue/player-view fields only.
- [ ] Persist normalized configuration through encounter APIs.
- [ ] Run focused tests; confirm pass.
- [ ] Commit `feat: persist scene-start configuration`.

### Task 12: Execute scene start through existing UI owners

**Files:**
- Modify: `src/components/MainContent.tsx`
- Modify: soundboard hook/component owner
- Modify: Hue encounter control/hook owner
- Test: focused MainContent/sound/Hue integration tests

- [ ] Write failing tests for ordered encounter save, player-view update, sound request, Hue request, and per-subsystem error display.
- [ ] Implement one Start Scene command that invokes existing owners in order and reports failures without undoing saved encounter state.
- [ ] Verify retry does not add duplicate UI state or duplicate sound commands.
- [ ] Run `npm run lint`, `npm test`, `npm run build`, and `docker compose build` followed by a container-start smoke test.
- [ ] Commit `feat: orchestrate scene start`.

## Plan self-review

- All five releases in the design spec map to one or more tasks above.
- All new persisted data has an explicit type, migration, route mapping, and API round-trip test.
- All transient combat guidance is pure/component-local and does not compete with `useCombatActions`.
- No task introduces a tactical map, cloud dependency, automatic roll resolution, or bidirectional sync.
