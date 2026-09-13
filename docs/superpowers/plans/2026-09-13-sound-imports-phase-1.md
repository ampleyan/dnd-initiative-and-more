# Sound Imports Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compatible sound provenance metadata, server-owned source validation, secure Foundry file handling, and managed Foundry imports without breaking existing playback.

**Architecture:** Keep the existing `sounds` table and `url` field as the compatibility surface. Add nullable metadata columns, centralize catalog-to-record conversion and insert accounting in the sounds route, and make Foundry file access resolve only against server-approved roots. Foundry imports copy files into managed storage before inserting records, while remote streams remain remote.

**Tech Stack:** ESM Node.js, Express, TypeScript, SQLite via `better-sqlite3`, LevelDB via `classic-level`, Vitest, Supertest, React API client.

**Spec:** `docs/superpowers/specs/2026-09-13-sound-imports-design.md`

## Global Constraints

- SQLite schema changes are additive and must tolerate already-existing columns.
- Existing `sounds.url` values must not be rewritten by migration.
- The browser may submit source identifiers, but the server owns source metadata and file paths.
- Foundry relative paths must remain beneath a server-approved root after normalization.
- Runtime databases, uploads, credentials, and personal filesystem paths must not be committed.
- Do not add inline code comments.
- Python is not used for this TypeScript work.
- Each task ends with a focused test run and a separate commit.

## File Map

- Modify `db/init.ts` to add sound metadata columns and conservative backfill logic.
- Modify `routes/sounds.ts` to define canonical sound metadata, validate source IDs, calculate insert results, and manage copied files.
- Modify `routes/foundry.ts` to resolve files against approved server roots and provide batch playlist import data.
- Modify `src/types.ts` to expose optional sound provenance fields.
- Modify `src/api/client.ts` to type bulk import responses and the Foundry sound import call.
- Modify `tests/soundsImport.test.ts` for database migration, source validation, duplicate accounting, and managed-copy behavior.
- Modify `tests/foundryLiveSync.test.ts` only if the existing Foundry router harness is the smallest reliable place for path-boundary coverage.

### Task 1: Add compatible sound metadata

**Files:**
- Modify: `db/init.ts` near the `sounds` table creation and existing sound migration.
- Modify: `src/types.ts` at the `Sound` interface.
- Test: `tests/soundsImport.test.ts`.

**Interfaces:**
- Produces optional `Sound` fields: `sourceType`, `sourceReference`, `storageType`, `filePath`, `duration`, `fileSize`, `checksum`, and `license`.
- Produces an additive database migration that can run against both a fresh and an existing `sounds` table.

- [ ] **Step 1: Write the failing migration test**

Create an in-memory database with the pre-metadata `sounds` schema, run the database initializer against it, and assert that every metadata column exists. Add a second assertion that a pre-existing sound keeps its original URL.

Use the existing test database setup and `PRAGMA table_info(sounds)` rather than testing implementation-specific SQL strings.

- [ ] **Step 2: Run the migration test and verify it fails**

Run:

```bash
cmd /c npm test -- --run tests/soundsImport.test.ts --project backend -t "sound metadata migration"
```

Expected: FAIL because the metadata columns and migration behavior do not yet exist.

- [ ] **Step 3: Add the additive migration and type fields**

Add each column with `ALTER TABLE sounds ADD COLUMN ...` inside the existing duplicate-column-tolerant migration pattern. Keep all new columns nullable. Add matching optional fields to `Sound` with the exact names from the spec.

Do not rewrite existing URLs or delete any files.

- [ ] **Step 4: Run the focused migration test**

Run the command from Step 2.

Expected: PASS with the original URL unchanged.

- [ ] **Step 5: Commit**

```bash
git add db/init.ts src/types.ts tests/soundsImport.test.ts
git commit -m "feat: add sound provenance metadata"
```

### Task 2: Make source catalogs authoritative

**Files:**
- Modify: `routes/sounds.ts` around local and ambience catalog discovery and bulk import handlers.
- Test: `tests/soundsImport.test.ts`.

**Interfaces:**
- Consumes the metadata columns from Task 1.
- Produces canonical catalog records with `sourceType`, `storageType`, and `sourceReference`.
- Produces `{ inserted: number; skipped: number; invalid: number }` for bulk imports.

- [ ] **Step 1: Write failing source-validation tests**

Test that a local import only inserts IDs currently returned by the configured local catalog. Test that an ambience import rejects a client-provided URL that is not one of the server-discovered files. Test that duplicate records increase `skipped` rather than `inserted`.

Use temporary directories created inside the test temporary directory and an in-memory SQLite `sounds` table. Do not read repository runtime audio folders.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cmd /c npm test -- --run tests/soundsImport.test.ts --project backend -t "source validation|duplicate records"
```

Expected: FAIL because the import handlers do not yet return invalid counts or fully reject client-controlled source metadata.

- [ ] **Step 3: Centralize canonical catalog conversion**

Extract the repeated local scan into one function used by both `GET /api/sounds/local` and `POST /api/sounds/local/import`. Extract equivalent ambience catalog construction so import validates IDs and selected variant URLs against the current filesystem.

For every imported record, derive name, URL, category, tags, source type, storage type, and source reference from the server catalog. Keep local files as `mounted-file` and remote Tabletop Audio entries as `proxied-stream`.

- [ ] **Step 4: Centralize insert accounting**

Use one transaction helper that serializes tags, counts SQLite changes, and returns `inserted` and `skipped`. Add `invalid` for requested IDs or items not found in the authoritative catalog. Do not report a skipped duplicate as newly imported.

- [ ] **Step 5: Run the focused tests and nearby API coverage**

Run:

```bash
cmd /c npm test -- --run tests/soundsImport.test.ts --project backend
cmd /c npm test -- --run tests/api.test.ts --project backend -t "Sounds"
```

Expected: PASS. If the second command has no matching test name, run the complete backend API file and record unrelated failures separately.

- [ ] **Step 6: Commit**

```bash
git add routes/sounds.ts tests/soundsImport.test.ts
git commit -m "feat: validate sound imports on the server"
```

### Task 3: Secure Foundry roots and managed copying

**Files:**
- Modify: `routes/foundry.ts` around Foundry path resolution, file serving, and playlist reading.
- Modify: `routes/sounds.ts` around managed-file insertion and the Foundry import endpoint.
- Modify: `src/api/client.ts` with the typed Foundry batch import method.
- Test: `tests/soundsImport.test.ts`.

**Interfaces:**
- Produces a server-side Foundry root resolver that accepts only configured roots.
- Produces a batch import operation accepting Foundry sound identifiers and returning inserted/skipped/invalid counts.
- Produces managed records with `storageType: 'managed-file'`, `filePath`, `sourceType: 'foundry'`, and `sourceReference`.

- [ ] **Step 1: Write failing path-boundary and copy tests**

Test that a path within the configured Foundry root is accepted, a normalized `..` escape is rejected, and a copy creates a file beneath `uploads/sounds` with provenance pointing to the original relative Foundry path. Test that a failed insert removes files newly created by the import.

Use temporary directories and a small fake playlist/catalog boundary. Avoid the user’s actual Foundry path and repository uploads.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cmd /c npm test -- --run tests/soundsImport.test.ts --project backend -t "Foundry"
```

Expected: FAIL because file serving currently accepts a browser-supplied root and playlist imports store a proxy URL instead of copying the file.

- [ ] **Step 3: Replace browser-selected roots with approved server roots**

Define the approved Foundry root from server configuration. If multiple roots are needed, assign server-side identifiers and resolve the identifier to a configured path. Remove arbitrary `dataPath` use from file serving. Normalize the requested relative path and require the result to remain beneath the approved root before reading it.

Preserve existing Foundry discovery behavior for the configured default root.

- [ ] **Step 4: Add batch managed-file import**

Resolve selected playlist sound IDs from the server-side playlist catalog, copy each existing file to a generated safe filename under `uploads/sounds`, compute file size and checksum, and insert all records in one transaction. Track created paths and remove them if copying or insertion fails. Keep the original Foundry relative path in `sourceReference`.

- [ ] **Step 5: Add typed client response**

Define a reusable bulk import result type in `src/api/client.ts` and expose a Foundry batch import wrapper. Remove the UI’s one-request-per-sound assumption only when the endpoint is available; the UI migration belongs to Phase 2.

- [ ] **Step 6: Run focused and full type verification**

Run:

```bash
cmd /c npm test -- --run tests/soundsImport.test.ts --project backend
cmd /c npm run lint
cmd /c npm run build
```

Expected: PASS. Confirm no test writes to repository runtime data.

- [ ] **Step 7: Commit**

```bash
git add routes/foundry.ts routes/sounds.ts src/api/client.ts tests/soundsImport.test.ts
git commit -m "feat: securely import Foundry audio files"
```

### Task 4: Phase 1 gate and handoff

**Files:**
- Modify only files already listed in Tasks 1–3 if a verified defect requires a correction.
- Test: all affected backend tests.

- [ ] **Step 1: Re-read every modified file**

Check that all new fields are optional at the API boundary, existing URL playback remains intact, every filesystem read is root-bound, and every created managed file has cleanup ownership.

- [ ] **Step 2: Run the required gates**

Run:

```bash
cmd /c npm run lint
cmd /c npm test
cmd /c npm run build
```

Expected: type-check and build pass. Full tests must pass; any pre-existing failure must be isolated with its exact assertion and excluded from completion claims.

- [ ] **Step 3: Commit only verified corrections**

```bash
git add db/init.ts routes/sounds.ts routes/foundry.ts src/types.ts src/api/client.ts tests/soundsImport.test.ts
git commit -m "test: verify sound import phase one"
```

- [ ] **Step 4: Stop at the phase boundary**

Report changed files, verification output, unresolved risks, and the exact UI work remaining for Phase 2. Do not modify Soundboard layout, persistent live settings, or add an external provider in this phase.
