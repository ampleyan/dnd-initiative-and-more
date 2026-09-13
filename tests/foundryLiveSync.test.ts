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

  it.each([
    ['stats', null],
    ['resistances', [1]],
    ['vulnerabilities', [{ type: 'cold' }]],
    ['damageImmunities', [false]],
    ['conditionImmunities', [{}]],
    ['actions', ['Staff']],
    ['abilities', [{ name: 7 }]],
    ['spells', [{}]],
  ])('rejects invalid derived %s payloads', async (field, value) => {
    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'actor', [field]: value, revision: 0 });

    expect(response.status).toBe(400);
  });

  it('round-trips optional Foundry provenance metadata', async () => {
    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization).send({
      actorId: 'actor',
      worldId: 'world',
      tokenId: 'token',
      sourceHash: 'snapshot-hash',
      lastSyncedAt: '2026-09-12T10:00:00.000Z',
      revision: 0,
    });

    expect(response.status).toBe(200);
    expect((await queued())[0]).toMatchObject({
      actorId: 'actor',
      worldId: 'world',
      tokenId: 'token',
      sourceHash: 'snapshot-hash',
      lastSyncedAt: '2026-09-12T10:00:00.000Z',
    });
  });

  it('prefers an explicit Foundry world and actor link', async () => {
    db.prepare('INSERT INTO players (id, name, foundryWorldId, foundryActorId) VALUES (?, ?, ?, ?)').run('exact-player', 'Different name', 'world', 'exact-actor');
    db.prepare('INSERT INTO combatants (id, encounterId, playerId, name, type, hp_current) VALUES (?, ?, ?, ?, ?, ?)').run('exact-combatant', 'enc', 'exact-player', 'Different name', 'player', 30);

    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'exact-actor', worldId: 'world', hp: 12, revision: 0 });

    expect(response.status).toBe(200);
    expect(db.prepare('SELECT hp_current FROM combatants WHERE id = ?').get('exact-combatant')).toEqual({ hp_current: 12 });
  });

  it('rejects ambiguous explicit Foundry actor links with candidate IDs', async () => {
    db.prepare('INSERT INTO players (id, name, foundryWorldId, foundryActorId) VALUES (?, ?, ?, ?)').run('exact-player-one', 'First', 'world', 'ambiguous-actor');
    db.prepare('INSERT INTO players (id, name, foundryWorldId, foundryActorId) VALUES (?, ?, ?, ?)').run('exact-player-two', 'Second', 'world', 'ambiguous-actor');

    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'ambiguous-actor', worldId: 'world', hp: 12, revision: 0 });

    expect(response.status).toBe(409);
    expect(response.body.candidateIds).toEqual(['exact-player-one', 'exact-player-two']);
  });

  it('uses an explicit Foundry token link when no actor link exists', async () => {
    db.prepare('INSERT INTO combatants (id, encounterId, name, type, hp_current, foundryTokenId) VALUES (?, ?, ?, ?, ?, ?)').run('token-combatant', 'enc', 'Different name', 'monster', 30, 'token');

    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'token-actor', tokenId: 'token', hp: 12, revision: 0 });

    expect(response.status).toBe(200);
    expect(db.prepare('SELECT hp_current FROM combatants WHERE id = ?').get('token-combatant')).toEqual({ hp_current: 12 });
  });

  it('updates only Foundry-derived fields and invalidates the affected encounter', async () => {
    db.prepare("UPDATE combatants SET initiative = ?, hidden = ?, waveId = ?, conditions = ?, conditionTimers = ?, concentratingOn = ? WHERE id = ?")
      .run(17, 1, 'wave-2', '["Blessed"]', '{"Blessed":3}', 'Bless', 'combat');

    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization).send({
      actorId: 'actor', hp: 25, maxHp: 40, ac: 18, speed: '35 ft.', stats: { str: 8, dex: 16 },
      resistances: ['fire'], vulnerabilities: ['cold'], damageImmunities: ['poison'], conditionImmunities: ['charmed'],
      actions: [{ name: 'Staff' }], abilities: [{ name: 'Arcane Recovery' }], spells: [{ name: 'Shield' }],
      initiative: 2, conditions: ['Poisoned'], revision: 0,
    });

    expect(response.status).toBe(200);
    expect(db.prepare('SELECT hp_current, hp_max, ac, speed, stats, resistances, vulnerabilities, damageImmunities, conditionImmunities, actions, abilities, spells, initiative, hidden, waveId, conditions, conditionTimers, concentratingOn FROM combatants WHERE id = ?').get('combat')).toEqual({
      hp_current: 25, hp_max: 40, ac: 18, speed: '35 ft.', stats: '{"str":8,"dex":16}', resistances: '["fire"]', vulnerabilities: '["cold"]', damageImmunities: '["poison"]', conditionImmunities: '["charmed"]', actions: '[{"name":"Staff"}]', abilities: '[{"name":"Arcane Recovery"}]', spells: '[{"name":"Shield"}]', initiative: 17, hidden: 1, waveId: 'wave-2', conditions: '["Blessed"]', conditionTimers: '{"Blessed":3}', concentratingOn: 'Bless',
    });
    expect(io.emit).toHaveBeenCalledWith('encounter-updated', { encounterId: 'enc' });
  });

  it('rejects ambiguous name-only links with candidate IDs', async () => {
    db.prepare('INSERT INTO combatants (id, encounterId, name, type) VALUES (?, ?, ?, ?)').run('goblin-one', 'enc', 'Goblin', 'monster');
    db.prepare('INSERT INTO combatants (id, encounterId, name, type) VALUES (?, ?, ?, ?)').run('goblin-two', 'enc', 'Goblin', 'monster');

    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'unlinked', name: 'Goblin', hp: 12, revision: 0 });

    expect(response.status).toBe(409);
    expect(response.body.candidateIds).toEqual(['goblin-one', 'goblin-two']);
  });

  it('rejects unlinked actors', async () => {
    const response = await request.post('/api/foundry/live-sync').set('Authorization', authorization)
      .send({ actorId: 'unlinked', revision: 0 });

    expect(response.status).toBe(404);
  });

  it('does not reverse-sync duplicate names without an explicit Foundry link', () => {
    db.prepare('INSERT INTO foundry_actor_sync (actorId, name, hp, pending) VALUES (?, ?, ?, ?)').run('unlinked-goblin', 'Goblin', 7, 0);
    db.prepare('INSERT INTO combatants (id, encounterId, name, type, hp_current) VALUES (?, ?, ?, ?, ?)').run('goblin-one', 'enc', 'Goblin', 'monster', 7);
    db.prepare('INSERT INTO combatants (id, encounterId, name, type, hp_current) VALUES (?, ?, ?, ?, ?)').run('goblin-two', 'enc', 'Goblin', 'monster', 7);

    db.prepare('UPDATE combatants SET hp_current = ? WHERE id = ?').run(3, 'goblin-one');

    expect(db.prepare('SELECT hp, pending FROM foundry_actor_sync WHERE actorId = ?').get('unlinked-goblin')).toEqual({ hp: 7, pending: 0 });
  });
});

describe('Foundry live-sync module', () => {
  function moduleHarness() {
    const handlers: Record<string, (...args: any[]) => any> = {};
    const timers: Array<() => Promise<void>> = [];
    const fetch = vi.fn();
    const actor = {
      id: 'actor', name: 'Wizard',
      system: { attributes: { hp: { value: 30, max: 30, temp: 0 }, ac: { value: 15 }, movement: { walk: 30 } } },
      items: [],
      effects: [],
      getActiveTokens: vi.fn(() => []),
      update: vi.fn(async (changes, options) => {
        actor.system.attributes.hp.value = changes['system.attributes.hp.value'];
        actor.system.attributes.hp.temp = changes['system.attributes.hp.temp'];
        await handlers.updateActor(actor, changes, options);
      }),
    };
    const game = {
      user: { id: 'gm', isGM: true }, users: { activeGM: { id: 'gm' } },
      world: { id: 'world' },
      settings: { register: vi.fn(), get: (_module: string, key: string) => key === 'appUrl' ? 'http://tracker' : 'test-token' },
      actors: new Map([['actor', actor]]),
    };
    vm.runInNewContext(fs.readFileSync(new URL('../foundry-module/live-sync.js', import.meta.url), 'utf8'), {
      Hooks: { once: (name, handler) => { handlers[name] = handler; }, on: (name, handler) => { handlers[name] = handler; } },
      game, fetch, console: { warn: vi.fn() }, AbortSignal,
      setTimeout: (fn, _delay) => { timers.push(fn); return timers.length; }, clearTimeout: vi.fn(),
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

  it('queues one derived snapshot when an equipped item changes', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateItem({ actor }, {}, {});
    expect(timers).toHaveLength(1);
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ actorId: 'actor', ac: 15 });
  });

  it('uses the sole active token when an item change has an unambiguous actor token', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    actor.getActiveTokens.mockImplementation(() => [{ document: { id: 'only-token' } }]);
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateItem({ actor }, {}, {});
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ tokenId: 'only-token' });
  });

  it('reads the derived snapshot after an item change has settled', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateItem({ actor }, {}, {});
    actor.system.attributes.ac.value = 13;
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ actorId: 'actor', ac: 13 });
  });

  it('sends the final AC for an equip then unequip sequence', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));
    handlers.updateItem({ actor }, {}, {});
    actor.system.attributes.ac.value = 17;
    await timers.shift()!();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fetch.mockResolvedValueOnce(response({ revision: 2 }));
    handlers.updateItem({ actor }, {}, {});
    actor.system.attributes.ac.value = 15;
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ ac: 17 });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ ac: 15 });
  });

  it('queues a derived snapshot when an active effect changes', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateActiveEffect({ actor }, {}, {});
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ actorId: 'actor', ac: 15 });
  });

  it('sends one final derived snapshot when an item update triggers an actor update', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateItem({ actor }, {}, {});
    actor.system.attributes.ac.value = 13;
    await handlers.updateActor(actor, {}, {});

    expect(fetch).not.toHaveBeenCalled();
    await timers.shift()!();
    expect(fetch).not.toHaveBeenCalled();
    await timers.shift()!();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ actorId: 'actor', ac: 13 });
  });

  it('preserves token conditions when an actor update folds into a token debounce', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateToken({ actor, id: 'token', statuses: new Set(['poisoned']) }, {}, {});
    actor.system.attributes.ac.value = 13;
    await handlers.updateActor(actor, {}, {});

    await timers.shift()!();
    await timers.shift()!();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ tokenId: 'token', conditions: ['poisoned'], ac: 13 });
  });

  it('sends Foundry-derived actions, abilities, spells, and formatted speed', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    actor.items = [
      { id: 'weapon', type: 'weapon', name: 'Staff', system: { description: { value: 'Arcane strike' } } },
      { id: 'feature', type: 'feat', name: 'Arcane Recovery', system: { description: { value: 'Recover magic' } } },
      { id: 'spell', type: 'spell', name: 'Shield', system: { description: { value: 'Protective ward' } } },
    ];
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    await handlers.updateActor(actor, {}, {});

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      speed: '30 ft.',
      actions: [{ name: 'Staff', description: 'Arcane strike', category: 'attack' }],
      abilities: [{ name: 'Arcane Recovery', description: 'Recover magic', category: 'ability' }],
      spells: [{ name: 'Shield', description: 'Protective ward', category: 'spell' }],
    });
  });

  it('uses a stable digest for equivalent Set and object snapshot inputs', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    actor.items = [{ id: 'weapon', type: 'weapon', name: 'Staff', system: { equipped: { label: 'Equipped', value: true } } }];
    actor.effects = [{ id: 'effect', disabled: false, statuses: new Set(['prone', 'blinded']) }];
    fetch.mockResolvedValueOnce(response({ revision: 1 }));
    await handlers.updateActor(actor, {}, {});
    const firstHash = JSON.parse(fetch.mock.calls[0][1].body).sourceHash;

    actor.items = [{ id: 'weapon', type: 'weapon', name: 'Staff', system: { equipped: { value: true, label: 'Equipped' } } }];
    actor.effects = [{ id: 'effect', disabled: false, statuses: new Set(['blinded', 'prone']) }];
    fetch.mockResolvedValueOnce(response({ revision: 2 }));
    await handlers.updateActor(actor, {}, {});
    const secondHash = JSON.parse(fetch.mock.calls[1][1].body).sourceHash;

    actor.effects = [{ id: 'effect', disabled: false, statuses: new Set(['prone']) }];
    fetch.mockResolvedValueOnce(response({ revision: 3 }));
    await handlers.updateActor(actor, {}, {});
    const changedHash = JSON.parse(fetch.mock.calls[2][1].body).sourceHash;

    expect(firstHash).toMatch(/^[a-f0-9]{8}$/);
    expect(secondHash).toBe(firstHash);
    expect(changedHash).not.toBe(firstHash);
  });

  it('omits a token link when an actor has multiple active tokens without a triggering token', async () => {
    const { handlers, fetch, actor } = moduleHarness();
    actor.getActiveTokens.mockImplementation(() => [{ document: { id: 'token-one' } }, { document: { id: 'token-two' } }]);
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    await handlers.updateActor(actor, {}, {});

    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('tokenId');
  });

  it('uses the triggering token link instead of another active token', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    actor.getActiveTokens.mockImplementation(() => [{ document: { id: 'token-one' } }, { document: { id: 'token-two' } }]);
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateToken({ actor, id: 'token-two' }, {}, {});
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ tokenId: 'token-two' });
  });

  it('omits a token link for embedded item changes with multiple active tokens', async () => {
    const { handlers, fetch, actor, timers } = moduleHarness();
    actor.getActiveTokens.mockImplementation(() => [{ document: { id: 'token-one' } }, { document: { id: 'token-two' } }]);
    fetch.mockResolvedValueOnce(response({ revision: 1 }));

    handlers.updateItem({ actor }, {}, {});
    await timers.shift()!();

    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('tokenId');
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

  it('does not acknowledge a stale tracker revision twice', async () => {
    const { handlers, fetch } = moduleHarness();
    fetch.mockResolvedValueOnce(response({ actors: [{ actorId: 'actor', hp: 8, tempHp: 0, revision: 1, pending: 1 }] }));
    fetch.mockResolvedValueOnce(response({}, 409));

    await handlers.ready();

    expect(fetch.mock.calls.map(call => call[0])).toEqual(['http://tracker/api/foundry/live-sync', 'http://tracker/api/foundry/live-sync/ack']);
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

it('preserves queued HP, existing PCs, and Foundry provenance when the database is reopened', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-sync-test-'));
  const originalPath = process.env.DB_PATH;
  let database: any;
  try {
    process.env.DB_PATH = path.join(directory, 'test.db');
    database = initDatabase().db;
    database.prepare('INSERT INTO players (id, name, dndBeyondId, hp_max) VALUES (?, ?, ?, ?)').run('pc', 'Wizard', 'foundry:actor', 30);
    database.prepare('INSERT INTO combatants (id, playerId, name, type, hp_current) VALUES (?, ?, ?, ?, ?)').run('combat', 'pc', 'Wizard', 'player', 30);
    database.prepare('UPDATE combatants SET hp_current = 7 WHERE id = ?').run('combat');
    database.prepare('INSERT INTO foundry_actor_sync (actorId, name, worldId, tokenId, sourceHash, lastSyncedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run('actor', 'Wizard', 'world', 'token', 'hash', '2026-09-12T10:00:00.000Z');
    database.close();
    database = initDatabase().db;
    expect(database.prepare('SELECT hp, revision, pending FROM foundry_hp_sync').get()).toEqual({ hp: 7, revision: 1, pending: 1 });
    expect(database.prepare('SELECT name, hp_max FROM players').get()).toEqual({ name: 'Wizard', hp_max: 30 });
    expect(database.prepare('SELECT worldId, tokenId, sourceHash, lastSyncedAt FROM foundry_actor_sync WHERE actorId = ?').get('actor'))
      .toEqual({ worldId: 'world', tokenId: 'token', sourceHash: 'hash', lastSyncedAt: '2026-09-12T10:00:00.000Z' });
  } finally {
    database?.close();
    process.env.DB_PATH = originalPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
