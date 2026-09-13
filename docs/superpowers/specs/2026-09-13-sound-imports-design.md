# Sound imports and managed audio design

## Goal

Make the Soundboard import flow reliable and safe across local files, Foundry playlists, Tabletop Audio, YouTube downloads, uploads, and direct URLs. Preserve existing sound records and playback behavior while making the storage origin explicit.

## Current constraints

- SQLite is owned by `db/init.ts` and migrations are additive.
- `routes/sounds.ts` owns sound persistence and source discovery.
- Foundry data can be configured through environment settings or the Settings UI.
- Existing `sounds.url` values must continue to play after migration.
- Uploaded files and runtime databases are not included in backups.
- LAN authentication is intentionally permissive; filesystem endpoints must still enforce their own boundaries.

## Data model

Extend `sounds` with nullable columns:

| Column | Meaning |
|---|---|
| `sourceType` | `local`, `foundry`, `tabletopaudio`, `youtube`, `upload`, or `url` |
| `sourceReference` | Stable source identifier, original relative path, or source URL |
| `storageType` | `managed-file`, `mounted-file`, `external-stream`, or `proxied-stream` |
| `filePath` | Server-side file path, when applicable |
| `duration` | Duration in seconds, nullable when unknown |
| `fileSize` | Size in bytes, nullable when unknown |
| `checksum` | Content checksum for managed files, nullable for streams |
| `license` | Optional attribution or license label |

Existing rows are backfilled conservatively from their URL:

- `/uploads/sounds/` becomes `upload` and `managed-file`.
- `/audio/local/` becomes `local` and `mounted-file`.
- `/audio/ambiences/` becomes `local` and `mounted-file`.
- `/api/sound-proxy` becomes `tabletopaudio` and `proxied-stream`.
- Other URLs become `url` and `external-stream`.

No existing URL is rewritten during migration.

## Trust boundaries

The browser may submit source identifiers, but the server remains authoritative for names, paths, categories, and URLs.

Foundry paths must be resolved against a server-approved configured root. A request may select a configured Foundry installation, but may not provide an arbitrary filesystem root. Relative paths must remain beneath that root after normalization. The file endpoint must not accept an unrestricted `dataPath` query parameter.

## Import behavior

### Local and ambience files

The server scans configured directories and produces canonical catalog entries. Import accepts IDs from that catalog only. It reports `{ inserted, skipped, invalid }` and never trusts client-supplied file URLs or display metadata.

### Foundry

The server reads playlist metadata from an approved Foundry root. A batch import accepts selected sound IDs, copies files into `uploads/sounds`, computes metadata, and inserts records in one transaction. A failed database transaction removes files created by that import. Original Foundry paths remain in `sourceReference`.

### Tabletop Audio

Tabletop Audio remains a remote/proxied stream unless explicitly downloaded later. Catalog cache expiry and source attribution are retained as follow-up work; import stores the catalog ID and upstream URL.

### YouTube

YouTube remains optional and isolated behind `yt-dlp`. Downloads are managed files with the original URL as provenance. Domain policy, concurrency limits, and progress reporting are follow-up hardening work unless required by the implementation tests.

### Upload and direct URL

Uploads are managed files. Direct URLs remain external streams only after basic URL validation. Existing manual URL behavior stays compatible during this phase.

## API contract

Sound responses include the new metadata fields. Bulk imports return:

```json
{
  "inserted": 3,
  "skipped": 1,
  "invalid": 0
}
```

Foundry uses a batch import endpoint rather than one request per sound. Existing endpoints remain available while the frontend client transitions to the typed response.

## Frontend follow-up

The next UI phase will:

- rename source tabs to describe their storage behavior;
- show source and availability badges;
- display import counts and invalid items;
- show retryable source-load and playback errors;
- add filtered select-all behavior;
- persist loop/repeat/panning settings where appropriate.

This phase does not redesign the Soundboard layout or add a new external provider.

## Verification

Tests must prove:

1. Existing databases migrate when metadata columns already exist.
2. Existing sound URLs remain unchanged.
3. Local and ambience imports reject IDs not present in the current catalog.
4. Duplicate imports report skipped records accurately.
5. Foundry paths cannot escape the configured root.
6. Foundry imports copy files and preserve source provenance.
7. Failed imports clean up newly copied files.
8. The production type-check, build, and relevant test suites pass.

## Rollback

Rollback is code-only: the additive columns may remain unused, and existing `url` values continue to provide playback. Managed files created by the new importer can be removed using their `filePath` metadata if a later cleanup is required. No existing records or runtime files are deleted by the migration.

## Phasing

### Phase 1

Implement schema metadata, server-owned catalogs, secure Foundry roots, managed Foundry copying, typed import results, and regression tests.

### Phase 2

Implement source-aware Soundboard UI, import feedback, retry states, playback error states, and persistent live settings.

### Phase 3

Add one carefully selected external catalog, preferably Freesound or Internet Archive, with attribution and license handling.
