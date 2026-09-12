import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { insertMonsterIfMissing } from '../scripts/monster-update-db';

const databases: Database.Database[] = [];

function createDatabase() {
  const db = new Database(':memory:');
  databases.push(db);
  db.exec(`
    CREATE TABLE monsters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hp INTEGER,
      maxHp INTEGER,
      ac INTEGER,
      speed TEXT,
      avatar TEXT,
      xp INTEGER,
      description TEXT,
      cr TEXT,
      type TEXT,
      source TEXT,
      stats TEXT,
      actions TEXT,
      abilities TEXT,
      spells TEXT,
      tags TEXT
    )
  `);
  return db;
}

const libraryMonster = {
  id: 'goblin',
  name: 'Goblin',
  hp: 7,
  maxHp: 7,
  ac: 15,
  speed: '30 ft.',
  avatar: 'new-avatar',
  xp: 50,
  description: 'New source description',
  cr: '1/4',
  type: 'Small humanoid',
  source: 'MM',
  stats: '{"dex":14}',
  actions: '[{"name":"Scimitar"}]',
  abilities: '[]',
  spells: '[]',
};

afterEach(() => {
  databases.splice(0).forEach(db => db.close());
});

describe('insertMonsterIfMissing', () => {
  it('leaves an existing monster record unchanged', () => {
    const db = createDatabase();
    db.prepare(`INSERT INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, source, stats, actions, abilities, spells, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('goblin', 'My Goblin', 23, 23, 19, '40 ft.', 'my-avatar', 999, 'My notes', '9', 'Custom', 'custom', '{"dex":20}', '[]', '[]', '[]', '["boss"]');

    expect(insertMonsterIfMissing(db, libraryMonster)).toBe(false);
    expect(db.prepare('SELECT * FROM monsters WHERE id = ?').get('goblin')).toMatchObject({
      name: 'My Goblin', hp: 23, ac: 19, avatar: 'my-avatar', xp: 999,
      description: 'My notes', source: 'custom', tags: '["boss"]',
    });
  });

  it('adds a source monster when its id is absent', () => {
    const db = createDatabase();

    expect(insertMonsterIfMissing(db, libraryMonster)).toBe(true);
    expect(db.prepare('SELECT name, source, description FROM monsters WHERE id = ?').get('goblin')).toEqual({
      name: 'Goblin', source: 'MM', description: 'New source description',
    });
  });
});
