import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { insertSounds } from '../routes/sounds';
import { initDatabase } from '../db/init';

describe('sound imports', () => {
  it('runs the sound metadata migration without changing existing URLs', () => {
    const { db } = initDatabase();
    db.prepare('INSERT INTO sounds (id, name, url) VALUES (?, ?, ?)').run('legacy', 'Legacy', '/legacy.mp3');
    const columns = new Set((db.prepare('PRAGMA table_info(sounds)').all() as Array<{ name: string }>).map(column => column.name));

    for (const column of [
      'sourceType', 'sourceReference', 'storageType', 'filePath',
      'duration', 'fileSize', 'checksum', 'license',
    ]) expect(columns.has(column)).toBe(true);
    expect(db.prepare('SELECT url FROM sounds WHERE id = ?').get('legacy')).toEqual({ url: '/legacy.mp3' });
    db.close();
  });

  it('reports inserted and skipped records', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE sounds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      spellId TEXT,
      volume REAL
    )`);

    const first = insertSounds(db, [{ id: 'one', name: 'One', url: '/one.mp3', category: 'ambient', tags: [], volume: 0.8 }]);
    const second = insertSounds(db, [
      { id: 'one', name: 'One', url: '/one.mp3', category: 'ambient', tags: [], volume: 0.8 },
      { id: 'two', name: 'Two', url: '/two.mp3', category: 'ambient', tags: [], volume: 0.8 },
    ]);

    expect(first).toEqual({ inserted: 1, skipped: 0 });
    expect(second).toEqual({ inserted: 1, skipped: 1 });
    db.close();
  });
});
