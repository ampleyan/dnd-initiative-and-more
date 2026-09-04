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
