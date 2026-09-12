import { Router } from 'express';

export function createSettingsHelpers(db: any, dbAvailable: boolean) {
  function getSetting(key: string): string | undefined {
    if (!dbAvailable) return undefined;
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value;
  }

  function setSetting(key: string, value: string) {
    if (!dbAvailable) return;
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  return { getSetting, setSetting };
}

export function createPreferencesRouter(db: any, dbAvailable: boolean) {
  const router = Router();

  router.get('/preferences', (_req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const stored = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_preferences') as { value?: string } | undefined;
    if (!stored?.value) return res.json({});
    try {
      return res.json(JSON.parse(stored.value));
    } catch {
      return res.json({});
    }
  });

  router.put('/preferences', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const preferences = req.body;
    if (!preferences || Array.isArray(preferences) || Object.getPrototypeOf(preferences) !== Object.prototype) {
      return res.status(400).json({ error: 'Preferences must be an object' });
    }
    const value = JSON.stringify(preferences);
    if (value.length > 64_000) return res.status(413).json({ error: 'Preferences are too large' });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('app_preferences', value);
    return res.json({ ok: true });
  });

  return router;
}
