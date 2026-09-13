# Foundry Live Derived-Stat Sync Design

## Goal

When a Foundry actor's equipped item, active effect, actor data, token condition, or combatant initiative changes, the linked Initiative Tracker combatant receives the resulting derived values reliably and without overwriting tracker-owned encounter state.

## Current behavior and invariants

- `foundry-module/live-sync.js` is the live bridge and runs on the active GM client.
- `routes/foundry.ts` authenticates the bridge with a bearer token, performs revision checks, persists the latest snapshot, and emits `encounter-updated`.
- `db/init.ts` owns SQLite schema and existing sync triggers.
- Foundry already supplies derived values such as AC; the tracker must not reimplement Foundry's rules engine.
- Existing HP retry, acknowledgement, and stale-write behavior must remain compatible.
- Encounter-only fields remain tracker-owned: current turn, hidden state, waves, concentration timers, reaction state, legendary charges, notes, and player-view settings.

## Problem

The bridge listens mainly to `updateActor`, `updateCombatant`, and `updateToken`. Embedded item and active-effect changes are not a complete or reliable signal for derived actor changes. The API also permits name-based matching, which is unsafe for duplicate actors.

## Chosen approach

Extend the existing bridge and endpoint rather than adding polling or a second sync system.

### Foundry bridge

Observe `createItem`, `updateItem`, `deleteItem`, `createActiveEffect`, `updateActiveEffect`, `deleteActiveEffect`, `updateActor`, `updateToken`, and `updateCombatant`. Debounce updates per actor, read one current actor snapshot after the event, and send it through the existing revision queue.

### Stable identity

Use explicit provenance in this order: linked Foundry world/actor ID, existing `foundry:<actorId>` player link, explicit token link, then a review-only name suggestion. Live writes must never silently select by name when multiple candidates exist.

### Field ownership

Foundry-managed fields: AC, max HP, ability scores, speed, resistances, vulnerabilities, immunities, spell slots, actions, abilities, and imported spells.

Tracker-managed fields: current turn, initiative by default, hidden/revealed state, wave membership, concentration/timers, reactions, legendary charges, encounter notes, and player-view settings.

Current HP remains bidirectional using the existing revision mechanism. Derived max HP and AC are accepted from Foundry. Initiative remains tracker-authoritative by default, with a future per-encounter authority switch.

### API and persistence

Keep `/api/foundry/live-sync`, `/ack`, and the existing Socket.IO invalidation. Expand the validated snapshot and store source metadata, revision, and last-sync timestamp. Use additive migrations only. Preserve old rows and support mixed-version module/server operation by making new fields optional during rollout.

### Conflict behavior

Reject stale revisions with `409`. Never overwrite tracker-owned fields from a Foundry snapshot. Expose source and last-sync status in the DM UI. A manual override must be explicit and visible.

## Non-goals

- No map, token movement, fog-of-war, or full VTT replacement.
- No LevelDB polling for live state.
- No duplicate damage, dice, spell, or combat execution systems.
- No runtime database, upload, or `.env` edits.

## Acceptance criteria

1. Equipping and unequipping an AC-changing item in Foundry updates the linked tracker combatant's AC without a page reload.
2. Active-effect changes update derived stats using the same path.
3. Duplicate actor names cannot cause an unintended live update.
4. Stale revisions are rejected and retried using the existing queue semantics.
5. Tracker-owned encounter fields remain unchanged after Foundry updates.
6. Existing HP sync tests continue to pass.
7. API round-trip tests cover new fields, validation, persistence, and Socket.IO invalidation.
8. Module tests cover item/effect hooks, debouncing, retries, active-GM gating, and tracker-originated update suppression.
