import { afterEach, describe, expect, it } from 'vitest';
import { ClassicLevel } from 'classic-level';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFoundryDataReader } from '../routes/foundry-data';

let fixtureRoot = '';

afterEach(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fixtureRoot = '';
});

describe('Foundry data reader', () => {
  it('maps an actor and embedded weapon from a world database', async () => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-reader-'));
    const actorDbPath = path.join(fixtureRoot, 'worlds', 'test-world', 'data', 'actors');
    fs.mkdirSync(path.dirname(actorDbPath), { recursive: true });
    const db = new ClassicLevel<string, string>(actorDbPath, { valueEncoding: 'json' });

    await db.open();
    await db.put('!actors!actor-one', {
      _id: 'actor-one',
      name: 'Ash Wolf',
      type: 'npc',
      system: {
        abilities: { str: { value: 12 }, dex: { value: 14 } },
        attributes: { hp: { max: 18 }, ac: { value: 13 }, movement: { walk: 30 } },
        details: { cr: 1 },
        traits: {},
      },
    } as unknown as string);
    await db.put('!actors.items!actor-one.bite', {
      _id: 'bite',
      name: 'Bite',
      type: 'weapon',
      system: { equipped: true, description: { value: '[[/r 1d20+4]]{+4} piercing damage' } },
    } as unknown as string);
    await db.compactRange('', '\uffff');
    await db.close();

    const reader = createFoundryDataReader({ defaultDataPath: fixtureRoot });
    const result = await reader.readActors({ world: 'test-world', full: '1' });

    expect(result).toMatchObject({
      total: 1,
      actors: [{
        id: 'ash-wolf',
        name: 'Ash Wolf',
        hp: 18,
        maxHp: 18,
        ac: 13,
        speed: '30 ft.',
        actions: [{ name: 'Bite', description: '+4 piercing damage', category: 'attack' }],
      }],
    });
  });
});
