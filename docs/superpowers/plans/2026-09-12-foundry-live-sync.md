# Foundry Live Sync Implementation Plan

> **For agentic workers:** Read `docs/superpowers/specs/2026-09-12-foundry-live-sync-design.md` first. Execute one task at a time and run its focused tests before continuing.

**Goal:** Reliably synchronize Foundry-derived actor statistics, including equipment-driven AC changes, into linked Initiative Tracker combatants.

**Architecture:** Extend the existing Foundry module and `/api/foundry/live-sync` route. Foundry calculates derived values; SQLite stores provenance/revisions; the tracker preserves encounter-owned state and invalidates clients through existing Socket.IO events.

**Tech Stack:** Foundry v14 JavaScript module, Express/TypeScript, better-sqlite3, Socket.IO, Vitest, Supertest.

**Spec:** `docs/superpowers/specs/2026-09-12-foundry-live-sync-design.md`

## Global Constraints

- Do not create a second sync, combat, damage, dice, or spell system.
- Keep `db/init.ts` as the schema owner and `routes/foundry.ts` as the persistence mapping owner.
- Additive migrations must tolerate existing columns and preserve old rows.
- Do not edit runtime databases, uploads, or `.env`.
- Foundry owns derived stats; the tracker owns encounter runtime fields.
- Keep the existing bearer-token, revision, acknowledgement, retry, and active-GM behavior.

### Task 1: Establish provenance and snapshot types

**Files:**
- Modify: `db/init.ts`
- Modify: `routes/foundry.ts`
- Modify: `src/types.ts` only if shared API types are needed
- Test: `tests/foundryLiveSync.test.ts`

- [ ] Add nullable additive columns to `foundry_actor_sync` for `worldId`, `tokenId`, `sourceHash`, and `lastSyncedAt`; make initialization tolerate old databases.
- [ ] Define a focused snapshot shape for actor identity, derived fields, and revision metadata. Do not use `any` for new route logic.
- [ ] Validate IDs, numeric fields, arrays, objects, source hash, and ISO timestamps at the route boundary.
- [ ] Preserve legacy payloads that omit new fields.
- [ ] Add tests proving a reopened database preserves old rows and new metadata round-trips.
- [ ] Run: `& 'C:\ProgramData\nvm\v22.21.1\node.exe' node_modules/vitest/vitest.mjs run tests/foundryLiveSync.test.ts --project backend`

### Task 2: Add explicit stable linking

**Files:**
- Modify: `db/init.ts`
- Modify: `routes/foundry.ts`
- Modify: encounter/combatant route only if an existing link endpoint is the responsible owner
- Test: `tests/foundryLiveSync.test.ts`

- [ ] Add a nullable Foundry provenance field to the responsible player/combatant record, following existing schema conventions.
- [ ] Resolve live writes by exact provenance first, then the existing `foundry:<actorId>` player link.
- [ ] Reject ambiguous name matches with `409` and return candidate IDs; retain name matching only for one-candidate compatibility.
- [ ] Add tests for exact match, legacy match, ambiguous duplicate names, and unlinked actors.
- [ ] Run the focused API tests before moving on.

### Task 3: Expand the API snapshot without changing ownership

**Files:**
- Modify: `routes/foundry.ts`
- Modify: `db/init.ts` if additional JSON columns are required
- Test: `tests/foundryLiveSync.test.ts`

- [ ] Add allowlisted derived fields: ability stats, speed, resistances, vulnerabilities, immunities, actions, abilities, and spells.
- [ ] Update only Foundry-managed columns from those fields.
- [ ] Keep initiative, hidden, waves, conditions/timers, concentration, reactions, legendary charges, notes, and player-view settings out of the Foundry write path unless an existing explicit sync rule already owns them.
- [ ] Keep current HP revision semantics unchanged.
- [ ] Emit `encounter-updated` for every affected encounter after a successful transaction.
- [ ] Add tests for field filtering, stale revisions, transaction persistence, and Socket.IO invalidation.

### Task 4: Make the Foundry module observe item/effect changes

**Files:**
- Modify: `foundry-module/live-sync.js`
- Modify: `foundry-module/module.json` only if the version must be incremented
- Test: `tests/foundryLiveSync.test.ts`

- [ ] Refactor snapshot creation into one actor snapshot function that includes actor/world/token provenance and a deterministic source hash.
- [ ] Add hooks for item and active-effect create/update/delete events.
- [ ] Resolve the owning actor from the embedded document and enqueue one snapshot per actor.
- [ ] Debounce bursts from one actor so an item update followed by derived actor recalculation produces one final payload.
- [ ] Keep active-GM gating and the existing tracker-originated update suppression.
- [ ] Add module harness tests for equip/unequip, active effects, debounce behavior, offline retry, and stale acknowledgement.
- [ ] Run: `& 'C:\ProgramData\nvm\v22.21.1\node.exe' node_modules/vitest/vitest.mjs run tests/foundryLiveSync.test.ts --project backend`

### Task 5: Add DM-facing sync status

**Files:**
- Modify: existing combatant row/edit component responsible for source metadata
- Modify: `src/api/client.ts` only if a typed read is needed
- Test: focused component test near the owning component

- [ ] Display Foundry-managed status and last-sync time for linked combatants.
- [ ] Display a clear warning for stale, ambiguous, rejected, or disconnected sync state.
- [ ] Keep manual override explicit and preserve the existing overflow/action patterns.
- [ ] Test that source status renders without leaking the bearer token.

### Task 6: Verification and handoff

- [ ] Re-read every modified file top-to-bottom in chunks for files over 500 lines.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the focused Foundry test suite again.
- [ ] Check `git diff --check` and `git status --short`.
- [ ] Report changed files, command output, and unresolved risks. Do not claim completion if any required command fails.

## Codex CLI execution command

Start from the repository root and paste the following prompt:

```text
Read AGENTS.md, then read docs/superpowers/specs/2026-09-12-foundry-live-sync-design.md and docs/superpowers/plans/2026-09-12-foundry-live-sync.md. Implement the plan task-by-task. Do not edit runtime databases, uploads, or .env. Before each edit, trace the existing owner and re-read the target file. Keep the existing Foundry bearer-token, active-GM, revision, retry, acknowledgement, and Socket.IO behavior. Run the focused Foundry tests after each task, then npm run lint, npm test, and npm run build. Stop and report the exact failure if a gate fails; do not paper over it. At the end, re-read every modified file and report changed files, verification output, and remaining risks.
```

## Useful CLI commands

```powershell
Set-Location 'C:\Users\ample\Documents\workspace\projects\dnd-initiative-and-more'
& 'C:\ProgramData\nvm\v22.21.1\node.exe' --version
git status --short
git diff -- docs/superpowers/specs/2026-09-12-foundry-live-sync-design.md docs/superpowers/plans/2026-09-12-foundry-live-sync.md
```
