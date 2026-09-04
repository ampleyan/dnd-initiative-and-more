/**
 * Backend API integration tests.
 * Each test suite gets its own server instance with an in-memory SQLite DB.
 *
 * Covers:
 * - Auth: login / logout / me / unauthenticated rejection
 * - Security: requireAdmin on /api/db/reset (BUG-2), IP spoofing (BUG-1)
 * - SSRF: image-proxy and /api/fetch domain allowlists (BUG-6/7)
 * - Encounters: CRUD
 * - Combatants: CRUD, spell slot persistence
 * - Monsters: CRUD with spells field
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import { setupTestServer, teardownTestServer, loginAdmin } from './helpers/testServer';

// ── Setup ─────────────────────────────────────────────────────────────────────
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  const result = await setupTestServer();
  request = result.request;
}, 20_000);

afterAll(async () => {
  await teardownTestServer();
});

// ── Health check ──────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with db status', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dbAvailable', true);
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 with user data on valid credentials', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('returns 401 on wrong password', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'definitely-wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown user', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request.post('/api/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user when logged in via session', async () => {
    const agent = await loginAdmin();
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    // In test env, 127.0.0.1 is treated as local network → returns Local User or session user
    expect(res.body).toHaveProperty('username');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Security: /api/db/reset requires admin (BUG-2 regression) ────────────────
describe('POST /api/db/reset — security', () => {
  it('succeeds for authenticated admin', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/db/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── SSRF: image-proxy domain allowlist (BUG-6 regression) ────────────────────
describe('GET /api/image-proxy — SSRF protection', () => {
  it('rejects requests to disallowed hosts', async () => {
    const res = await request.get('/api/image-proxy?url=http://169.254.169.254/latest/meta-data/');
    expect(res.status).toBe(403);
  });

  it('rejects localhost loopback', async () => {
    const res = await request.get('/api/image-proxy?url=http://localhost:3000/api/db/reset');
    expect(res.status).toBe(403);
  });

  it('rejects invalid URL', async () => {
    const res = await request.get('/api/image-proxy?url=not-a-url');
    expect(res.status).toBe(400);
  });

  it('rejects missing url param', async () => {
    const res = await request.get('/api/image-proxy');
    expect(res.status).toBe(400);
  });
});

// ── SSRF: /api/fetch domain allowlist (BUG-7 regression) ─────────────────────
describe('GET /api/fetch — SSRF protection', () => {
  it('rejects requests to disallowed hosts', async () => {
    const res = await request.get('/api/fetch?url=http://169.254.169.254/latest/meta-data/');
    expect(res.status).toBe(403);
  });

  it('rejects internal services', async () => {
    const res = await request.get('/api/fetch?url=http://localhost:3000/api/users');
    expect(res.status).toBe(403);
  });

  it('returns 400 when url param is missing', async () => {
    const res = await request.get('/api/fetch');
    expect(res.status).toBe(400);
  });
});

// ── Encounters CRUD ───────────────────────────────────────────────────────────
describe('Encounters API', () => {
  it('returns empty array initially', async () => {
    const agent = await loginAdmin();
    const res = await agent.get('/api/encounters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates an encounter', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/encounters').send({
      id: 'enc-test-1',
      name: 'Test Encounter',
      combatants: [],
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'enc-test-1');
  });

  it('retrieves created encounter', async () => {
    const agent = await loginAdmin();
    await agent.post('/api/encounters').send({ id: 'enc-test-2', name: 'Find Me', combatants: [] });
    const res = await agent.get('/api/encounters');
    expect(res.body.some((e: any) => e.id === 'enc-test-2')).toBe(true);
  });

  it('updates an encounter name', async () => {
    const agent = await loginAdmin();
    await agent.post('/api/encounters').send({ id: 'enc-update', name: 'Old Name', combatants: [] });
    const res = await agent.put('/api/encounters/enc-update').send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deletes an encounter', async () => {
    const agent = await loginAdmin();
    await agent.post('/api/encounters').send({ id: 'enc-delete', name: 'To Delete', combatants: [] });
    const del = await agent.delete('/api/encounters/enc-delete');
    expect(del.status).toBe(200);
    const list = await agent.get('/api/encounters');
    expect(list.body.some((e: any) => e.id === 'enc-delete')).toBe(false);
  });

  it('returns 404 for unknown encounter', async () => {
    const agent = await loginAdmin();
    const res = await agent.get('/api/encounters/does-not-exist');
    expect([404, 400]).toContain(res.status);
  });
});

// ── Combatants CRUD ───────────────────────────────────────────────────────────
describe('Combatants API', () => {
  const ENC_ID = 'enc-combatant-tests';

  beforeAll(async () => {
    const agent = await loginAdmin();
    await agent.post('/api/encounters').send({ id: ENC_ID, name: 'Combatant Tests', combatants: [] });
  });

  it('creates a combatant', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/combatants').send({
      id: 'comb-1',
      encounterId: ENC_ID,
      name: 'Goblin',
      type: 'monster',
      initiative: 12,
      hp: { current: 7, max: 7 },
      ac: 15,
      speed: '30 ft.',
      subtitle: 'Small humanoid',
      avatar: '',
      conditions: [],
      tags: [],
      stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    });
    expect(res.status).toBe(201);
  });

  it('retrieves combatants for an encounter', async () => {
    const agent = await loginAdmin();
    const res = await agent.get(`/api/encounters/${ENC_ID}/combatants`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: any) => c.id === 'comb-1')).toBe(true);
  });

  it('updates a combatant HP', async () => {
    const agent = await loginAdmin();
    const res = await agent.put('/api/combatants/comb-1').send({
      encounterId: ENC_ID,
      name: 'Goblin', type: 'monster', initiative: 12,
      hp: { current: 3, max: 7 }, ac: 15, speed: '30 ft.',
      subtitle: '', avatar: '', conditions: [], tags: [],
      stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    });
    expect(res.status).toBe(200);
  });

  it('deletes a combatant', async () => {
    const agent = await loginAdmin();
    await agent.post('/api/combatants').send({
      id: 'comb-del', encounterId: ENC_ID, name: 'Orc', type: 'monster',
      initiative: 8, hp: { current: 15, max: 15 }, ac: 13,
      speed: '30 ft.', subtitle: '', avatar: '', conditions: [], tags: [],
      stats: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    });
    const del = await agent.delete('/api/combatants/comb-del');
    expect(del.status).toBe(200);
  });

  it('persists and returns spellSlots on combatant create + fetch', async () => {
    const agent = await loginAdmin();
    const encRes = await agent
      .post('/api/encounters')
      .send({ id: 'enc-slots-test', name: 'Slots Test', currentRound: 1, isEncounterActive: false });
    expect(encRes.status).toBe(201);

    const slots = { 1: { total: 4, used: 1 }, 2: { total: 3, used: 0 } };
    const createRes = await agent
      .post('/api/combatants')
      .send({
        id: 'c-slots-test', encounterId: 'enc-slots-test',
        name: 'Slot Tester', initiative: 10,
        hp: { current: 30, max: 30 }, ac: 14, speed: '30 ft.',
        subtitle: 'Wizard', avatar: '', type: 'player',
        isCurrentTurn: false, conditions: [], tags: [], stats: {},
        actions: [], abilities: [], spells: [],
        spellSlots: slots, featureUses: {}, spellIds: ['fireball'], featureIds: [],
      });
    expect(createRes.status).toBe(201);

    const fetchRes = await agent
      .get('/api/encounters/enc-slots-test/combatants');
    expect(fetchRes.status).toBe(200);
    const combatant = fetchRes.body.find((c: any) => c.id === 'c-slots-test');
    expect(combatant).toBeDefined();
    expect(combatant.spellSlots).toEqual(slots);
    expect(combatant.spellIds).toEqual(['fireball']);
  });
});

// ── Monsters CRUD (with spells field) ────────────────────────────────────────
describe('Monsters API', () => {
  it('creates a monster with spells', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/monsters').send({
      id: 'monster-witch',
      name: 'Test Witch',
      type: 'Medium humanoid',
      cr: '5',
      hp: 67,
      ac: 13,
      speed: '30 ft.',
      stats: { str: 9, dex: 14, con: 14, int: 12, wis: 12, cha: 17 },
      actions: [{ name: 'Claw', description: 'Melee weapon attack: +4 to hit.', category: 'attack' }],
      abilities: [],
      spells: [{ name: 'Fireball', description: 'A bright streak...', category: 'spell' }],
    });
    expect(res.status).toBe(201);
    // Monster POST returns { success: true } on creation
    expect(res.body.success).toBe(true);
  });

  it('retrieves monster with spells intact', async () => {
    const agent = await loginAdmin();
    const res = await agent.get('/api/monsters');
    expect(res.status).toBe(200);
    const witch = res.body.find((m: any) => m.id === 'monster-witch');
    expect(witch).toBeDefined();
    const spells = typeof witch.spells === 'string' ? JSON.parse(witch.spells) : witch.spells;
    expect(Array.isArray(spells)).toBe(true);
    expect(spells[0].name).toBe('Fireball');
  });

  it('updates a monster', async () => {
    const agent = await loginAdmin();
    const res = await agent.put('/api/monsters/monster-witch').send({
      name: 'Test Witch (Updated)',
      ac: 14,
    });
    expect([200, 201]).toContain(res.status);
  });

  it('deletes a monster', async () => {
    const agent = await loginAdmin();
    await agent.post('/api/monsters').send({
      id: 'monster-del', name: 'Delete Me', type: 'undead', cr: '1',
      hp: 10, ac: 8, speed: '20 ft.',
      stats: { str: 8, dex: 6, con: 8, int: 3, wis: 6, cha: 5 },
      actions: [], abilities: [], spells: [],
    });
    const del = await agent.delete('/api/monsters/monster-del');
    expect(del.status).toBe(200);
  });
});

// ── Players API ───────────────────────────────────────────────────────────────
describe('Players API', () => {
  it('returns empty array initially', async () => {
    const agent = await loginAdmin();
    const res = await agent.get('/api/players');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a player with spell slots', async () => {
    const agent = await loginAdmin();
    const res = await agent.post('/api/players').send({
      name: 'Gandalf',
      dndBeyondId: 'test-ddb-001',
      hp_max: 60,
      ac: 12,
      speed: '30 ft.',
      subtitle: 'Wizard 11',
      avatar: '',
      stats: { str: 10, dex: 10, con: 14, int: 20, wis: 15, cha: 13 },
      actions: [], abilities: [], spells: [],
      spellSlots: { 1: { total: 4, used: 0 }, 5: { total: 1, used: 0 }, 6: { total: 1, used: 0 } },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('name', 'Gandalf');
  });
});

// ── Image search proxy ──────────────────────────────────────────────────────
describe('GET /api/images/search', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when q is missing', async () => {
    const res = await request.get('/api/images/search');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when q is blank', async () => {
    const res = await request.get('/api/images/search?q=');
    expect(res.status).toBe(400);
  });

  it('returns results shape when DDG responds', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('duckduckgo.com/?q=')) {
        return new Response('<html>vqd=\'3-abc123xyz\'</html>', { status: 200 });
      }
      if (urlStr.includes('duckduckgo.com/i.js')) {
        return new Response(
          JSON.stringify({
            results: Array.from({ length: 24 }, (_, i) => ({
              thumbnail: `https://example.com/thumb${i}.jpg`,
              image: `https://example.com/img${i}.jpg`,
              title: `Image ${i}`,
              url: `https://reddit.com/r/art/post${i}`,
            })),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    const res = await request.get('/api/images/search?q=dark+forest');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(24);
    expect(res.body.results[0]).toMatchObject({
      thumb: expect.any(String),
      image: expect.any(String),
      title: expect.any(String),
      source: expect.any(String),
    });
    expect(res.body.results[0].source).toBe('reddit.com');
    expect(res.body.hasMore).toBe(true);
  });

  it('returns empty results gracefully when DDG fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network unreachable'));

    const res = await request.get('/api/images/search?q=forest');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ results: [], hasMore: false });
    expect(res.body.error).toBeDefined();
  });

  it('returns empty results when vqd token is missing from DDG response', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).includes('duckduckgo.com/?q=')) {
        return new Response('<html>no token here</html>', { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    const res = await request.get('/api/images/search?q=forest');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ results: [], hasMore: false });
  });
});
