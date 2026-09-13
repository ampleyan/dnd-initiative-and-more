import Database from 'better-sqlite3';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createSoundsRouter, insertSounds } from '../routes/sounds';
import { createFoundryRouter } from '../routes/foundry';
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
      volume REAL,
      sourceType TEXT,
      sourceReference TEXT,
      storageType TEXT,
      filePath TEXT,
      duration REAL,
      fileSize INTEGER,
      checksum TEXT,
      license TEXT
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

  it('rejects local IDs that are not in the current catalog', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-import-'));
    const pack = path.join(root, 'Pack');
    fs.mkdirSync(pack);
    fs.writeFileSync(path.join(pack, 'one.mp3'), 'audio');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE sounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, category TEXT, tags TEXT, spellId TEXT, volume REAL, sourceType TEXT, sourceReference TEXT, storageType TEXT, filePath TEXT, duration REAL, fileSize INTEGER, checksum TEXT, license TEXT)');
    const app = express();
    app.use(express.json());
    app.use(createSoundsRouter(db, true, root, path.join(root, 'ambiences')).router);

    const response = await supertest(app).post('/sounds/local/import').send({ ids: ['local-pack-one-mp3', 'missing'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ inserted: 1, skipped: 0, invalid: 1 });
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects ambience URLs that are not in the current catalog', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-import-'));
    fs.writeFileSync(path.join(root, 'Rain.mp3'), 'audio');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE sounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, category TEXT, tags TEXT, spellId TEXT, volume REAL, sourceType TEXT, sourceReference TEXT, storageType TEXT, filePath TEXT, duration REAL, fileSize INTEGER, checksum TEXT, license TEXT)');
    const app = express();
    app.use(express.json());
    app.use(createSoundsRouter(db, true, path.join(root, 'sfx'), root).router);

    const response = await supertest(app).post('/sounds/ambiences/import').send({
      items: [{ id: 'ambience-rain', name: 'Rain', url: 'https://attacker.invalid/audio.mp3', genre: 'Adventure' }],
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ inserted: 0, skipped: 0, invalid: 1 });
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('serves Foundry files only from the approved root', async () => {
    const approvedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-approved-'));
    const attackerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-attacker-'));
    fs.writeFileSync(path.join(approvedRoot, 'sound.mp3'), 'approved');
    fs.writeFileSync(path.join(attackerRoot, 'sound.mp3'), 'attacker');
    const app = express();
    app.use(createFoundryRouter('', () => approvedRoot));

    const response = await supertest(app).get('/foundry/file').query({ p: 'sound.mp3', dataPath: attackerRoot });

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe('approved');
    fs.rmSync(approvedRoot, { recursive: true, force: true });
    fs.rmSync(attackerRoot, { recursive: true, force: true });
  });

  it('copies selected Foundry sounds into managed storage with provenance', async () => {
    const foundryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-sounds-'));
    const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-uploads-'));
    fs.mkdirSync(path.join(foundryRoot, 'music'), { recursive: true });
    fs.writeFileSync(path.join(foundryRoot, 'music', 'battle.mp3'), 'battle audio');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE sounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, category TEXT, tags TEXT, spellId TEXT, volume REAL, sourceType TEXT, sourceReference TEXT, storageType TEXT, filePath TEXT, duration REAL, fileSize INTEGER, checksum TEXT, license TEXT)');
    const app = express();
    app.use(express.json());
    app.use(createSoundsRouter(db, true, path.join(foundryRoot, 'sfx'), path.join(foundryRoot, 'ambiences'), uploadRoot, () => foundryRoot, async () => [{ id: 'sound-1', name: 'Battle', path: 'music/battle.mp3', volume: 0.5, playlist: 'Combat' }]).router);

    const response = await supertest(app).post('/sounds/foundry/import').send({ world: 'world-1', ids: ['sound-1'] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ inserted: 1, skipped: 0, invalid: 0 });
    const record = db.prepare('SELECT * FROM sounds WHERE id = ?').get('foundry-world-1-sound-1') as any;
    expect(record.sourceType).toBe('foundry');
    expect(record.sourceReference).toBe('music/battle.mp3');
    expect(record.storageType).toBe('managed-file');
    expect(fs.existsSync(record.filePath)).toBe(true);
    expect(record.fileSize).toBe(Buffer.byteLength('battle audio'));
    db.close();
    fs.rmSync(foundryRoot, { recursive: true, force: true });
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  });

  it('removes managed copies when the database insert fails', async () => {
    const foundryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-sounds-'));
    const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-uploads-'));
    fs.writeFileSync(path.join(foundryRoot, 'battle.mp3'), 'battle audio');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE sounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, category TEXT, tags TEXT, spellId TEXT, volume REAL)');
    const app = express();
    app.use(express.json());
    app.use(createSoundsRouter(db, true, path.join(foundryRoot, 'sfx'), path.join(foundryRoot, 'ambiences'), uploadRoot, () => foundryRoot, async () => [{ id: 'sound-1', name: 'Battle', path: 'battle.mp3', volume: 0.5, playlist: 'Combat' }]).router);

    const response = await supertest(app).post('/sounds/foundry/import').send({ world: 'world-1', ids: ['sound-1'] });

    expect(response.status).toBe(500);
    expect(fs.readdirSync(uploadRoot)).toEqual([]);
    db.close();
    fs.rmSync(foundryRoot, { recursive: true, force: true });
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  });
});
