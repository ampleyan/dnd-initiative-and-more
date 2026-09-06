import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { initDatabase } from '../db/init';
import { createFoundryLiveRouter } from '../routes/foundry';
import { createEncountersRouter } from '../routes/encounters';

describe('two-way Foundry HP sync', () => {
  let db: any;
  let request: ReturnType<typeof supertest>;
  const token = 'test-foundry-sync-token';
  const authorization = `Bearer ${token}`;
  const io = { emit: vi.fn(), to: vi.fn().mockReturnValue({ emit: vi.fn() }) };

  beforeEach(() => {
    ({ db } = initDatabase());
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('foundry_sync_token', token);
    db.prepare('INSERT INTO players (id, name, dndBeyondId, hp_max) VALUES (?, ?, ?, ?)').run('pc', 'Wizard', 'foundry:actor', 30);
    db.prepare('INSERT INTO encounters (id, name) VALUES (?, ?)').run('enc', 'Test');
    db.prepare('INSERT INTO combatants (id, encounterId, playerId, name, type, hp_current, hp_max, tempHp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('combat', 'enc', 'pc', 'Wizard', 'player', 30, 30, 0);
    const app = express();
    app.use(express.json());
    app.use('/api', createFoundryLiveRouter(db, true, io));
    app.use('/api', createEncountersRouter(db, true, io as any));
    request = supertest(app);
  });

  afterEach(() => db.close());

  async function queued() {
    const result = await request.get('/api/foundry/live-sync').set('Authorization', authorization);
    expect(result.status).toBe(200);
    return result.body.actors;
  }

  async function changeHp(current: number, temp: number, bulk = false) {
    const combatant = (await request.get('/api/encounters/enc/combatants')).body[0];
    combatant.hp.current = current;
    combatant.tempHp = temp;
    const response = bulk
      ? await request.put('/api/encounters/enc/combatants/bulk').send({ combatants: [combatant] })
      : await request.put('/api/combatants/combat').send(combatant);
    expect(response.status).toBe(200);
  }

  it.each([false, true])('queues damage, healing and temporary HP from saves (bulk=%s)', async bulk => {
    await changeHp(0, 5, bulk);
    expect(await queued()).toEqual([{ actorId: 'actor', hp: 0, tempHp: 5, revision: 1, pending: 1 }]);
    await changeHp(20, 0, bulk);
    expect(await queued()).toEqual([{ actorId: 'actor', hp: 20, tempHp: 0, revision: 2, pending: 1 }]);
  });

  it('keeps updates until acknowledged and rejects stale acknowledgements', async () => {
    await changeHp(20, 0);
    expect(await queued()).toEqual(await queued());
    await changeHp(10, 0);
    expect((await request.post('/api/foundry/live-sync/ack').set('Authorization', authorization).send({ actorId: 'actor', revision: 1 })).status).toBe(409);
    expect((await queued())[0].pending).toBe(1);
    expect((await request.post('/api/foundry/live-sync/ack').set('Authorization', authorization).send({ actorId: 'actor', revision: 2 })).status).toBe(200);
    expect((await queued())[0].pending).toBe(0);
  });

  it('accepts Foundry HP and temp HP without queuing an echo', async () => {
    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization).send({ actorId: 'actor', hp: 0, tempHp: 7, revision: 0 });
    expect(response.status).toBe(200);
    expect(response.body.revision).toBeGreaterThan(0);
    expect(db.prepare('SELECT hp_current, tempHp FROM combatants WHERE id = ?').get('combat')).toEqual({ hp_current: 0, tempHp: 7 });
    expect((await queued())[0].pending).toBe(0);
    await changeHp(0, 7);
    expect((await queued())[0].revision).toBe(response.body.revision);
  });

  it('rejects stale Foundry state after damage in the tracker', async () => {
    await changeHp(8, 0);
    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization).send({ actorId: 'actor', hp: 30, tempHp: 0, revision: 0 });
    expect(response.status).toBe(409);
    expect(db.prepare('SELECT hp_current FROM combatants WHERE id = ?').get('combat').hp_current).toBe(8);
  });

  it('requires the sync token for reads, writes and acknowledgements', async () => {
    expect((await request.get('/api/foundry/live-sync')).status).toBe(401);
    expect((await request.post('/api/foundry/live-sync').send({ actorId: 'actor', hp: 2 })).status).toBe(401);
    expect((await request.post('/api/foundry/live-sync/ack').send({ actorId: 'actor', revision: 0 })).status).toBe(401);
  });

  it.each([-1, '20', null, 1.5])('rejects invalid HP %s', async hp => {
    expect((await request.post('/api/foundry/live-sync').set('Authorization', authorization).send({ actorId: 'actor', hp })).status).toBe(400);
    expect(db.prepare('SELECT hp_current FROM combatants WHERE id = ?').get('combat').hp_current).toBe(30);
  });
});

describe('Foundry live-sync module', () => {
  function moduleHarness() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    const timers: Array<() => Promise<void>> = [];
    const fetch = vi.fn();
    const actor = {
      id: 'actor', name: 'Wizard',
      system: { attributes: { hp: { value: 30, max: 30, temp: 0 }, ac: { value: 15 } } },
      update: vi.fn(async (changes, options) => {
        actor.system.attributes.hp.value = changes['system.attributes.hp.value'];
        actor.system.attributes.hp.temp = changes['system.attributes.hp.temp'];
        await handlers.updateActor(actor, changes, options);
      }),
    };
    const game = {
      user: { id: 'gm', isGM: true }, users: { activeGM: { id: 'gm' } },
      settings: { register: vi.fn(), get: (_module: string, key: string) => key === 'appUrl' ? 'http://tracker' : 'test-token' },
      actors: new Map([['actor', actor]]),
    };
    vm.runInNewContext(fs.readFileSync(new URL('../foundry-module/live-sync.js', import.meta.url), 'utf8'), {
      Hooks: { once: (name, handler) => { handlers[name] = handler; }, on: (name, handler) => { handlers[name] = handler; } },
      game, fetch, console: { warn: vi.fn() }, AbortSignal,
      setTimeout: (fn, _delay) => { timers.push(fn); },
    });
    return { handlers, timers, fetch, actor, game };
  }

  const response = (body: any, status = 200) => ({ ok: status < 400, status, json: async () => body });

  it('applies tracker HP and acknowledges it without echoing the actor hook', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 0, tempHp: 5, revision: 1, pending: 1 }] }));
    fetch.mockResolvedValueOnce(response({ updated: true }));
    await handlers.ready();
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 0, 'system.attributes.hp.temp': 5 }, { 'initiative-tracker-live-sync': true });
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['http://tracker/api/foundry/live-sync', 'http://tracker/api/foundry/live-sync/ack']);
  });

  it('sends Foundry damage with its revision and temporary HP', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 30, tempHp: 0, revision: 4, pending: 0 }] }));
    await handlers.ready();
    fetch.mockResolvedValueOnce(response({ updated: true, revision: 5 }));
    actor.system.attributes.hp.value = 8;
    actor.system.attributes.hp.temp = 2;
    await handlers.updateActor(actor, {}, {});
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ actorId: 'actor', hp: 8, tempHp: 2, revision: 4 });
  });

  it('retries delivery after a disconnect', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockRejectedValueOnce(new Error('Offline'));
    await handlers.ready();
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 12, tempHp: 0, revision: 1, pending: 1 }] }));
    fetch.mockResolvedValueOnce(response({ updated: true }));
    await timers.shift()!();
    expect(actor.system.attributes.hp.value).toBe(12);
  });

  it('only syncs from the active GM client', async () => {
    const { handlers, fetch, actor, game } = moduleHarness();
    game.users.activeGM.id = 'other-gm';
    await handlers.ready();
    await handlers.updateActor(actor, {}, {});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries Foundry damage after a failed outbound request', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [] }));
    await handlers.ready();
    actor.system.attributes.hp.value = 9;
    fetch.mockRejectedValueOnce(new Error('Offline'));
    await handlers.updateActor(actor, {}, {});
    fetch.mockResolvedValueOnce(response({ revision: 1 }));
    fetch.mockResolvedValueOnce(response({ actors: [] }));
    await timers.shift()!();
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ hp: 9, revision: 0 });
  });

  it('does not acknowledge an update that Foundry failed to apply', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 8, tempHp: 0, revision: 1, pending: 1 }] }));
    actor.update.mockRejectedValueOnce(new Error('Update failed'));
    await handlers.ready();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('applies newer tracker HP after rejecting a stale Foundry write', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [] }));
    await handlers.ready();
    fetch.mockResolvedValueOnce(response({}, 409));
    actor.system.attributes.hp.value = 20;
    await handlers.updateActor(actor, {}, {});
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 6, tempHp: 0, revision: 1, pending: 1 }] }));
    fetch.mockResolvedValueOnce(response({ updated: true }));
    await timers.shift()!();
    expect(actor.system.attributes.hp.value).toBe(6);
  });
});

it('preserves queued HP and existing PCs when the database is reopened', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-sync-test-'));
  const originalPath = process.env.DB_PATH;
  let database: any;
  try {
    process.env.DB_PATH = path.join(directory, 'test.db');
    database = initDatabase().db;
    database.prepare('INSERT INTO players (id, name, dndBeyondId, hp_max) VALUES (?, ?, ?, ?)').run('pc', 'Wizard', 'foundry:actor', 30);
    database.prepare('INSERT INTO combatants (id, playerId, name, type, hp_current) VALUES (?, ?, ?, ?, ?)').run('combat', 'pc', 'Wizard', 'player', 30);
    database.prepare('UPDATE combatants SET hp_current = 7 WHERE id = ?').run('combat');
    database.close();
    database = initDatabase().db;
    expect(database.prepare('SELECT hp, revision, pending FROM foundry_hp_sync').get()).toEqual({ hp: 7, revision: 1, pending: 1 });
    expect(database.prepare('SELECT name, hp_max FROM players').get()).toEqual({ name: 'Wizard', hp_max: 30 });
  } finally {
    database?.close();
    process.env.DB_PATH = originalPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
