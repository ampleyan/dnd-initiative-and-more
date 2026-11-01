import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { createFoundryDataReader, DEFAULT_FOUNDRY_DATA_PATH } from './foundry-data';
export { readFoundryPlaylistSounds } from './foundry-data';

type FoundryLiveSnapshot = {
  actorId: string;
  name?: string;
  hp?: number;
  tempHp?: number;
  maxHp?: number;
  ac?: number;
  initiative?: number;
  conditions?: string[];
  spellSlots?: Record<string, unknown>;
  speed?: string;
  stats?: Record<string, unknown>;
  resistances?: unknown[];
  vulnerabilities?: unknown[];
  damageImmunities?: unknown[];
  conditionImmunities?: unknown[];
  actions?: Record<string, unknown>[];
  abilities?: Record<string, unknown>[];
  spells?: Record<string, unknown>[];
  worldId?: string;
  tokenId?: string;
  sourceHash?: string;
  lastSyncedAt?: string;
  revision?: number;
};

type FoundrySyncRecord = Required<Pick<FoundryLiveSnapshot, 'actorId'>> & Omit<FoundryLiveSnapshot, 'actorId'> & { name: string; revision: number };

type FoundryLinkedCombatant = {
  id: string;
  encounterId: string | null;
  hp_current: number;
  hp_max: number;
  tempHp: number;
  ac: number;
  initiative: number;
  conditions: string | null;
  spellSlots: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNamedDerivedEntry(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value)
    && typeof value.name === 'string'
    && !!value.name.trim()
    && (value.description === undefined || typeof value.description === 'string')
    && (value.category === undefined || typeof value.category === 'string');
}

export function createFoundryRouter(portraitsDir: string = '', getApprovedRoot: () => string = () => DEFAULT_FOUNDRY_DATA_PATH) {
  const foundryData = createFoundryDataReader({ portraitsDir, defaultDataPath: DEFAULT_FOUNDRY_DATA_PATH });
  const router = Router();

  router.get('/foundry/file', (req, res) => {
    const { p } = req.query as { p?: string };
    if (!p) return res.status(400).send('Missing path');
    const basePath = getApprovedRoot();
    const normalized = path.resolve(path.join(basePath, p));
    const approvedRoot = path.resolve(basePath);
    if (!normalized.startsWith(approvedRoot + path.sep)) {
      return res.status(403).send('Forbidden');
    }
    if (!fs.existsSync(normalized)) return res.status(404).send('Not found');
    const realPath = fs.realpathSync(normalized);
    if (!realPath.startsWith(approvedRoot + path.sep)) return res.status(403).send('Forbidden');
    res.sendFile(realPath);
  });

  router.get('/foundry/scenes', async (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      const scenes = await foundryData.readScenes(world, dataPath);
      if (!scenes) return res.status(404).json({ error: 'Scenes DB not found' });
      res.json(scenes);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/playlists', async (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      const playlists = await foundryData.readPlaylists(world, dataPath);
      if (!playlists) return res.status(404).json({ error: 'Playlist database not found' });
      res.json(playlists);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/worlds', (req, res) => {
    const { dataPath } = req.query as { dataPath?: string };
    try {
      res.json(foundryData.listWorlds(dataPath));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/packs', (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      res.json(foundryData.listPacks(world, dataPath));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/actors', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', full = '0', ids, dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });

    try {
      const result = await foundryData.readActors({ world, pack, search, offset, limit, full, ids, dataPath });
      if (!result) return res.status(404).json({ error: 'Pack database not found' });
      res.json(result);
    } catch (e: any) {
      console.error('[foundry] route error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/item-packs', (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      res.json(foundryData.listPacks(world, dataPath, ['Item']));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/spells', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      const result = await foundryData.readSpells({ world, pack, search, offset, limit, dataPath });
      if (!result) return res.status(404).json({ error: 'Pack database not found' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/characters', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', full = '0', ids, dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      const result = await foundryData.readActors({ world, pack, search, offset, limit, full, ids, dataPath }, 'character');
      if (!result) return res.status(404).json({ error: 'Actor database not found' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/journals', async (req, res) => {
    const { world, search, ids, full = '0', dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      const journals = await foundryData.readJournals({ world, search, ids, full, dataPath });
      res.json(journals);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

export function createFoundryConfigRouter(db: any, dbAvailable: boolean) {
  const router = Router();
  router.get('/foundry/config', (_req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const url = (db.prepare('SELECT value FROM settings WHERE key = ?').get('foundry_url') as { value?: string } | undefined)?.value ?? '';
    const dbPath = (db.prepare('SELECT value FROM settings WHERE key = ?').get('foundry_data_path') as { value?: string } | undefined)?.value ?? '';
    const dataPath = dbPath || process.env.FOUNDRY_DATA_PATH || '';
    const syncToken = (db.prepare('SELECT value FROM settings WHERE key = ?').get('foundry_sync_token') as { value?: string } | undefined)?.value ?? '';
    return res.json({ url, dataPath, configured: Boolean(dataPath), syncToken });
  });
  router.put('/foundry/config', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const dataPath = typeof req.body?.dataPath === 'string' ? req.body.dataPath.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Foundry URL must use HTTP or HTTPS' });
    if (url.length > 2_000 || dataPath.length > 4_000) return res.status(413).json({ error: 'Foundry configuration is too large' });
    const save = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    save.run('foundry_url', url);
    save.run('foundry_data_path', dataPath);
    return res.json({ ok: true });
  });
  router.get('/foundry/sync-config', (_req, res) => {
    const configured = dbAvailable && !!db.prepare('SELECT value FROM settings WHERE key = ?').get('foundry_sync_token');
    res.json({ configured });
  });
  router.post('/foundry/sync-config', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token.length < 16) return res.status(400).json({ error: 'Token must be at least 16 characters' });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('foundry_sync_token', token);
    res.json({ configured: true });
  });
  router.post('/foundry/sync-config/generate', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('foundry_sync_token', token);
    res.json({ token, configured: true });
  });
  return router;
}

export function createFoundryLiveRouter(db: any, dbAvailable: boolean, io: any) {
  const router = Router();
  router.use('/foundry/live-sync', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const configured = db.prepare('SELECT value FROM settings WHERE key = ?').get('foundry_sync_token') as { value?: string } | undefined;
    const tokenBuffer = Buffer.from(token ?? '');
    const configuredBuffer = Buffer.from(configured?.value ?? '');
    if (!token || !configured?.value || tokenBuffer.length !== configuredBuffer.length || !crypto.timingSafeEqual(tokenBuffer, configuredBuffer)) {
      return res.status(401).json({ error: 'Invalid sync token' });
    }
    next();
  });
  router.get('/foundry/live-sync', (_req, res) => {
    const syncedActors = db.prepare(`SELECT actorId, name, hp, tempHp, maxHp, ac, initiative, conditions, spellSlots, worldId, tokenId, sourceHash, lastSyncedAt, revision, pending
      FROM foundry_actor_sync`).all().map((actor: any) => ({
        ...actor,
        ...(actor.worldId ? { worldId: actor.worldId } : {}),
        ...(actor.tokenId ? { tokenId: actor.tokenId } : {}),
        ...(actor.sourceHash ? { sourceHash: actor.sourceHash } : {}),
        ...(actor.lastSyncedAt ? { lastSyncedAt: actor.lastSyncedAt } : {}),
        conditions: JSON.parse(actor.conditions || '[]'),
        spellSlots: JSON.parse(actor.spellSlots || '{}'),
      }));
    const legacyActors = db.prepare(`SELECT substr(p.dndBeyondId, 9) AS actorId, s.hp, s.tempHp, s.revision, s.pending
      FROM foundry_hp_sync s JOIN players p ON p.id = s.playerId WHERE p.dndBeyondId LIKE 'foundry:%'`).all().map((actor: any) => ({
        actorId: actor.actorId,
        hp: actor.hp,
        tempHp: actor.tempHp,
        revision: actor.revision,
        pending: actor.pending,
      }));
    const syncedIds = new Set(syncedActors.map((actor: any) => actor.actorId));
    const actors = [...syncedActors, ...legacyActors.filter((actor: any) => !syncedIds.has(actor.actorId))];
    res.json({ actors });
  });
  router.post('/foundry/live-sync/ack', (req, res) => {
    const { actorId, revision } = req.body ?? {};
    if (typeof actorId !== 'string' || !actorId || !Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ error: 'Valid actorId and revision required' });
    const result = db.prepare('UPDATE foundry_actor_sync SET pending = 0 WHERE actorId = ? AND revision = ?').run(actorId, revision);
    const legacy = result.changes ? result : db.prepare(`UPDATE foundry_hp_sync SET pending = 0 WHERE revision = ?
      AND playerId = (SELECT id FROM players WHERE dndBeyondId = ?)`).run(revision, `foundry:${actorId}`);
    if (!legacy.changes) return res.status(409).json({ error: 'Actor changed; fetch the latest update' });
    res.json({ updated: true });
  });
  router.post('/foundry/live-sync', (req, res) => {
    const snapshot = (req.body ?? {}) as Partial<FoundryLiveSnapshot>;
    const { actorId, name, hp, tempHp, maxHp, ac, initiative, conditions, spellSlots, speed, stats, resistances, vulnerabilities, damageImmunities, conditionImmunities, actions, abilities, spells, worldId, tokenId, sourceHash, lastSyncedAt } = snapshot;
    const revision = snapshot.revision ?? 0;
    if (typeof actorId !== 'string' || !actorId) return res.status(400).json({ error: 'actorId is required' });
    if ([hp, tempHp, maxHp, ac, initiative, revision].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 0))) return res.status(400).json({ error: 'Numeric sync values must be non-negative integers' });
    if (conditions !== undefined && (!Array.isArray(conditions) || conditions.some(value => typeof value !== 'string'))) return res.status(400).json({ error: 'conditions must be an array of strings' });
    if (spellSlots !== undefined && !isPlainObject(spellSlots)) return res.status(400).json({ error: 'spellSlots must be an object' });
    if (speed !== undefined && typeof speed !== 'string') return res.status(400).json({ error: 'speed must be a string' });
    if (stats !== undefined && !isPlainObject(stats)) return res.status(400).json({ error: 'stats must be an object' });
    if ([resistances, vulnerabilities, damageImmunities, conditionImmunities].some(value => value !== undefined && (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')))) return res.status(400).json({ error: 'Derived trait collections must be arrays of strings' });
    if ([actions, abilities, spells].some(value => value !== undefined && (!Array.isArray(value) || value.some(entry => !isNamedDerivedEntry(entry))))) return res.status(400).json({ error: 'Derived entries must be named objects' });
    if ([worldId, tokenId, sourceHash].some(value => value !== undefined && (typeof value !== 'string' || !value.trim()))) return res.status(400).json({ error: 'Foundry provenance values must be non-empty strings' });
    if (lastSyncedAt !== undefined && (typeof lastSyncedAt !== 'string' || Number.isNaN(Date.parse(lastSyncedAt)) || new Date(lastSyncedAt).toISOString() !== lastSyncedAt)) return res.status(400).json({ error: 'lastSyncedAt must be an ISO timestamp' });
    const current = db.prepare('SELECT * FROM foundry_actor_sync WHERE actorId = ?').get(actorId) as FoundrySyncRecord | undefined;
    const legacyCurrent = db.prepare('SELECT * FROM foundry_hp_sync WHERE playerId = (SELECT id FROM players WHERE dndBeyondId = ?)').get(`foundry:${actorId}`) as FoundrySyncRecord | undefined;
    const syncCurrent = current ?? legacyCurrent;
    if (syncCurrent && revision !== syncCurrent.revision) return res.status(409).json({ error: 'Actor changed; fetch the latest update' });
    const explicitPlayers = worldId
      ? db.prepare('SELECT id, hp_current, hp_max FROM players WHERE foundryWorldId = ? AND foundryActorId = ? ORDER BY id LIMIT 2').all(worldId, actorId) as { id: string; hp_current: number | null; hp_max: number }[]
      : [];
    const legacyPlayers = db.prepare('SELECT id, hp_current, hp_max FROM players WHERE dndBeyondId = ? ORDER BY id LIMIT 2').all(`foundry:${actorId}`) as { id: string; hp_current: number | null; hp_max: number }[];
    const playerCandidates = explicitPlayers.length ? explicitPlayers : legacyPlayers;
    if (playerCandidates.length > 1) return res.status(409).json({ error: 'Foundry actor link is ambiguous', candidateIds: playerCandidates.map(player => player.id) });
    const existingPlayer = playerCandidates[0];
    const tokenCombatants = !existingPlayer && tokenId
      ? db.prepare('SELECT * FROM combatants WHERE foundryTokenId = ? ORDER BY id LIMIT 2').all(tokenId) as FoundryLinkedCombatant[]
      : [];
    const nameCombatants = !existingPlayer && tokenCombatants.length === 0 && name
      ? db.prepare("SELECT * FROM combatants WHERE lower(name) = lower(?) AND type != 'player' ORDER BY id LIMIT 2").all(name) as FoundryLinkedCombatant[]
      : [];
    const candidates = tokenCombatants.length ? tokenCombatants : nameCombatants;
    if (candidates.length > 1) return res.status(409).json({ error: 'Foundry actor link is ambiguous', candidateIds: candidates.map(candidate => candidate.id) });
    const existingCombatant = existingPlayer
      ? db.prepare('SELECT * FROM combatants WHERE playerId = ? ORDER BY id LIMIT 1').get(existingPlayer.id) as FoundryLinkedCombatant | undefined
      : candidates[0];
    if (!existingPlayer && !existingCombatant) return res.status(404).json({ error: 'Foundry actor is not linked to a tracker combatant' });
    const slotJson = spellSlots && typeof spellSlots === 'object' ? JSON.stringify(spellSlots) : null;
    const jsonValue = (value: unknown) => value === undefined ? null : JSON.stringify(value);
    const statsJson = jsonValue(stats);
    const resistancesJson = jsonValue(resistances);
    const vulnerabilitiesJson = jsonValue(vulnerabilities);
    const damageImmunitiesJson = jsonValue(damageImmunities);
    const conditionImmunitiesJson = jsonValue(conditionImmunities);
    const actionsJson = jsonValue(actions);
    const abilitiesJson = jsonValue(abilities);
    const spellsJson = jsonValue(spells);
    const updatePlayer = existingPlayer && db.prepare('UPDATE players SET name = COALESCE(?, name), hp_max = COALESCE(?, hp_max), hp_current = COALESCE(?, hp_current), ac = COALESCE(?, ac), speed = COALESCE(?, speed), stats = COALESCE(?, stats), actions = COALESCE(?, actions), abilities = COALESCE(?, abilities), spells = COALESCE(?, spells), spell_slots = COALESCE(?, spell_slots), lastImported = ? WHERE id = ?');
    const updateCombatant = db.prepare(`UPDATE combatants SET name = COALESCE(?, name), hp_max = COALESCE(?, hp_max), hp_current = COALESCE(?, hp_current), tempHp = COALESCE(?, tempHp), ac = COALESCE(?, ac), speed = COALESCE(?, speed), stats = COALESCE(?, stats), resistances = COALESCE(?, resistances), vulnerabilities = COALESCE(?, vulnerabilities), damageImmunities = COALESCE(?, damageImmunities), conditionImmunities = COALESCE(?, conditionImmunities), actions = COALESCE(?, actions), abilities = COALESCE(?, abilities), spells = COALESCE(?, spells), spellSlots = COALESCE(?, spellSlots) WHERE ${existingPlayer ? 'playerId = ?' : 'id = ?'} AND (polymorph_form IS NULL OR polymorph_form = 'null')`);
    const rows = existingPlayer
      ? db.prepare('SELECT DISTINCT encounterId FROM combatants WHERE playerId = ? AND encounterId IS NOT NULL').all(existingPlayer.id) as { encounterId: string }[]
      : existingCombatant?.encounterId ? [{ encounterId: existingCombatant.encounterId }] : [];
    const nextRevision = (syncCurrent?.revision ?? 0) + 1;
    db.transaction(() => {
      if (updatePlayer) updatePlayer.run(name || null, maxHp ?? null, hp ?? null, ac ?? null, speed ?? null, statsJson, actionsJson, abilitiesJson, spellsJson, slotJson, new Date().toISOString(), existingPlayer!.id);
      updateCombatant.run(name || null, maxHp ?? null, hp ?? null, tempHp ?? null, ac ?? null, speed ?? null, statsJson, resistancesJson, vulnerabilitiesJson, damageImmunitiesJson, conditionImmunitiesJson, actionsJson, abilitiesJson, spellsJson, slotJson, existingPlayer?.id ?? existingCombatant.id);
      db.prepare(`INSERT INTO foundry_actor_sync (actorId, name, hp, tempHp, maxHp, ac, initiative, conditions, spellSlots, worldId, tokenId, sourceHash, lastSyncedAt, revision, pending)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(actorId) DO UPDATE SET name = excluded.name, hp = excluded.hp, tempHp = excluded.tempHp, maxHp = excluded.maxHp, ac = excluded.ac, initiative = excluded.initiative, conditions = excluded.conditions, spellSlots = excluded.spellSlots, worldId = excluded.worldId, tokenId = excluded.tokenId, sourceHash = excluded.sourceHash, lastSyncedAt = excluded.lastSyncedAt, revision = excluded.revision, pending = 0`)
        .run(actorId, name || syncCurrent?.name || actorId, hp ?? syncCurrent?.hp ?? existingPlayer?.hp_current ?? existingCombatant?.hp_current ?? 0, tempHp ?? syncCurrent?.tempHp ?? existingCombatant?.tempHp ?? 0, maxHp ?? syncCurrent?.maxHp ?? existingPlayer?.hp_max ?? existingCombatant?.hp_max ?? 0, ac ?? syncCurrent?.ac ?? existingCombatant?.ac ?? 0, syncCurrent?.initiative ?? existingCombatant?.initiative ?? 0, syncCurrent?.conditions ?? existingCombatant?.conditions ?? '[]', slotJson ?? syncCurrent?.spellSlots ?? existingCombatant?.spellSlots ?? '{}', worldId ?? syncCurrent?.worldId ?? null, tokenId ?? syncCurrent?.tokenId ?? null, sourceHash ?? syncCurrent?.sourceHash ?? null, lastSyncedAt ?? syncCurrent?.lastSyncedAt ?? null, nextRevision);
    })();
    for (const row of rows) io.emit('encounter-updated', { encounterId: row.encounterId });
    res.json({ updated: true, encounters: rows.length, revision: nextRevision });
  });
  return router;
}
