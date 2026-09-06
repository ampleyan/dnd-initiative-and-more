import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { initDatabase } from '../db/init';
import { createMonstersRouter } from '../routes/monsters';
import { defaultSpellSlots } from '../src/lib/spellSlotDefaults';
import { usePlayerActions, PlayerActionsParams } from '../src/hooks/usePlayerActions';
import { api } from '../src/api/client';
import { Combatant, Player } from '../src/types';

const fullCasterRows = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

describe('spell-slot progression', () => {
  it.each(fullCasterRows.map((row, index) => [index + 1, row] as const))('gives a level %i wizard the correct slots', (level, row) => {
    expect(Object.values(defaultSpellSlots(level, 'Wizard')).map(slot => slot?.total)).toEqual(row);
  });

  it.each(Array.from({ length: 19 }, (_, index) => index + 2))('gives a level %i ranger the correct slots', level => {
    expect(Object.values(defaultSpellSlots(level, 'Ranger')).map(slot => slot?.total)).toEqual(fullCasterRows[Math.ceil(level / 2) - 1]);
  });
});

describe('Foundry player reimport', () => {
  let db: any;
  let request: ReturnType<typeof supertest>;

  beforeEach(() => {
    ({ db } = initDatabase());
    const app = express();
    app.use(express.json());
    app.use('/api', createMonstersRouter(db, true, (_req, _res, next) => next()));
    request = supertest(app);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it('updates the same actor after a rename and preserves tracker stats and resource usage', async () => {
    const original = { name: 'Wizard', dndBeyondId: 'foundry:actor-1', hp_max: 32, ac: 17, speed: '40 ft.', stats: { int: 18 }, spellSlots: { 1: { total: 4, used: 2 } }, featureUses: { ward: 1 } };
    const created = await request.post('/api/players').send(original);
    await request.patch(`/api/players/${created.body.id}`).send({ hp_current: 0 });
    const imported = await request.post('/api/players').send({ ...original, name: 'Renamed Wizard', hp_max: 1, ac: 10, speed: '30 ft.', stats: { int: 10 }, spells: [{ name: 'Shield', description: 'Protection' }], spellSlots: { 1: { total: 3, used: 0 } }, featureUses: {} });
    expect(imported.status).toBe(200);
    expect(imported.body).toMatchObject({ id: created.body.id, name: 'Renamed Wizard', hp_current: 0, hp_max: 32, ac: 17, speed: '40 ft.', stats: { int: 18 }, spellSlots: { 1: { total: 3, used: 2 } }, featureUses: { ward: 1 }, spells: [{ name: 'Shield' }] });
    expect((await request.get('/api/players')).body).toHaveLength(1);
  });

  it('preserves active combat stats while refreshing Foundry spells and slot totals', async () => {
    const saved = { id: 'pc-1', name: 'Wizard', dndBeyondId: 'foundry:actor-1', hp_max: 32, ac: 17, stats: { int: 18 }, spellSlots: { 1: { total: 3, used: 1 } }, spells: [{ name: 'Shield' }] } as unknown as Player;
    let combatants = [{ id: 'combat-1', playerId: saved.id, name: saved.name, type: 'player', hp: { current: 0, max: 40, temp: 5 }, ac: 21, speed: '50 ft.', stats: { int: 20 }, conditions: ['Prone'], spellSlots: { 1: { total: 4, used: 4 } } }] as unknown as Combatant[];
    const original = combatants[0];
    vi.spyOn(api.players, 'create').mockResolvedValue(saved);
    const actions = usePlayerActions({ players: [saved], playersRef: { current: [saved] }, setPlayers: vi.fn(), setCombatants: update => { combatants = typeof update === 'function' ? update(combatants) : update; }, isDbAvailable: false } as unknown as PlayerActionsParams);
    await actions.handleCreatePlayer(saved);
    expect(combatants[0]).toMatchObject({ hp: original.hp, ac: 21, speed: '50 ft.', stats: { int: 20 }, conditions: ['Prone'], spellSlots: { 1: { total: 3, used: 3 } }, spells: saved.spells });
  });

  it('reuses a uniquely named PC when its Foundry actor ID changes', async () => {
    const created = await request.post('/api/players').send({ name: 'Unique Ranger', hp_max: 40, ac: 18 });
    const imported = await request.post('/api/players').send({ name: 'Unique Ranger', dndBeyondId: 'foundry:new-actor', hp_max: 1, ac: 10 });
    expect(imported.body).toMatchObject({ id: created.body.id, dndBeyondId: 'foundry:new-actor', hp_max: 40, ac: 18 });
    expect((await request.get('/api/players')).body).toHaveLength(1);
  });

  it('uses a shared name as identity even when older duplicate records exist', async () => {
    const first = await request.post('/api/players').send({ name: 'Shared Name', hp_max: 38 });
    await request.post('/api/players').send({ name: 'Shared Name' });
    const imported = await request.post('/api/players').send({ name: ' shared NAME ', dndBeyondId: 'foundry:new-actor' });
    expect(imported.status).toBe(200);
    expect(imported.body).toMatchObject({ id: first.body.id, hp_max: 38 });
    expect((await request.get('/api/players')).body).toHaveLength(2);
  });
});
