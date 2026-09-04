import { Router } from 'express';
import type { RequestHandler } from 'express';

const TABLES = ['encounters', 'combatants', 'monsters', 'players', 'campaigns', 'sessions', 'folder_settings', 'spells', 'class_features', 'sounds', 'settings'] as const;
const CLEAR_ORDER = ['combatants', 'encounters', 'sessions', 'campaigns', 'folder_settings', 'monsters', 'players', 'spells', 'class_features', 'sounds', 'settings'] as const;
const FORMAT_VERSION = 1;

function buildBackup(db: any) {
  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
  return { format: 'dnd-initiative-backup', version: FORMAT_VERSION, exportedAt: new Date().toISOString(), tables };
}

function validateBackup(db: any, value: any): string[] {
  if (!value || value.format !== 'dnd-initiative-backup') return ['format must be dnd-initiative-backup'];
  if (value.version !== FORMAT_VERSION) return [`unsupported backup version: ${String(value.version)}`];
  if (!value.tables || typeof value.tables !== 'object' || Array.isArray(value.tables)) return ['tables must be an object'];
  const errors: string[] = [];
  for (const table of TABLES) {
    if (!Object.hasOwn(value.tables, table)) {
      errors.push(`${table} is missing`);
      continue;
    }
    if (!Array.isArray(value.tables[table])) {
      errors.push(`${table} must be an array`);
      continue;
    }
    const columns = new Set((db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(column => column.name));
    for (const row of value.tables[table]) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) errors.push(`${table} contains an invalid row`);
      else {
        const unknownColumns = Object.keys(row).filter(column => !columns.has(column));
        if (unknownColumns.length) errors.push(`${table} contains unknown columns: ${unknownColumns.join(', ')}`);
      }
    }
  }
  return errors;
}

export function createBackupsRouter(db: any, dbAvailable: boolean, requireAdmin: RequestHandler) {
  const router = Router();
  router.get('/backups/export', requireAdmin, (_req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    res.setHeader('Content-Disposition', 'attachment; filename="dnd-initiative-backup.json"');
    res.json(buildBackup(db));
  });

  router.post('/backups/import', requireAdmin, (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const errors = validateBackup(db, req.body);
    if (errors.length) return res.status(400).json({ error: 'Invalid backup', details: errors });
    try {
      db.transaction(() => {
        for (const table of CLEAR_ORDER) db.prepare(`DELETE FROM ${table}`).run();
        for (const table of TABLES) {
          const rows = req.body.tables[table] ?? [];
          for (const row of rows) {
            const columns = Object.keys(row).filter(k => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
            if (!columns.length) continue;
            const quoted = columns.map(k => `"${k}"`).join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            db.prepare(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`).run(...columns.map(k => row[k]));
          }
        }
      })();
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Restore failed' });
    }
  });
  return router;
}
