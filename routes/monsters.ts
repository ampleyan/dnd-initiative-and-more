import { Router } from 'express';
import type { RequestHandler } from 'express';

function serializePlayer(p: any) {
  const safeJson = (val: string, fallback: any) => { try { return JSON.parse(val); } catch { return fallback; } };
  return {
    ...p,
    stats: safeJson(p.stats, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    passivePerception: p.passive_perception ?? 10,
    level: p.level ?? 1,
    actions: safeJson(p.actions ?? '[]', []),
    abilities: safeJson(p.abilities ?? '[]', []),
    spells: safeJson(p.spells ?? '[]', []),
    spellIds: safeJson(p.spell_ids ?? '[]', []),
    featureIds: safeJson(p.feature_ids ?? '[]', []),
    spellSlots: safeJson(p.spell_slots ?? '{}', {}),
    featureUses: safeJson(p.feature_uses ?? '{}', {}),
  };
}

export function createMonstersRouter(db: any, dbAvailable: boolean, requireAdmin: RequestHandler) {
  const router = Router();
  const safeJson = (val: string, fallback: any) => { try { return JSON.parse(val || JSON.stringify(fallback)); } catch { return fallback; } };

  // ── Monsters ──
  router.get('/monsters', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare('SELECT * FROM monsters').all().map((m: any) => ({
      ...m, image: m.avatar,
      stats: safeJson(m.stats, {}), actions: safeJson(m.actions, []),
      abilities: safeJson(m.abilities, []), tags: safeJson(m.tags, []), spells: safeJson(m.spells, []),
      vulnerabilities: safeJson(m.vulnerabilities, []),
      resistances: safeJson(m.resistances, []),
      damageImmunities: safeJson(m.damageImmunities, []),
      conditionImmunities: safeJson(m.conditionImmunities, []),
    })));
  });

  router.post('/monsters', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, stats, actions, abilities, source, tags, spells, vulnerabilities, resistances, damageImmunities, conditionImmunities } = req.body;
    const existing = db.prepare('SELECT id FROM monsters WHERE LOWER(name) = LOWER(?)').get(name) as { id: string } | undefined;
    if (existing) {
      db.prepare(`UPDATE monsters SET name = ?, hp = ?, maxHp = ?, ac = ?, speed = ?, avatar = ?, xp = ?, description = ?, cr = ?, type = ?, stats = ?, actions = ?, abilities = ?, source = ?, tags = ?, spells = ?, vulnerabilities = ?, resistances = ?, damageImmunities = ?, conditionImmunities = ? WHERE id = ?`)
        .run(name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, JSON.stringify(stats || {}), JSON.stringify(actions || []), JSON.stringify(abilities || []), source || 'custom', JSON.stringify(tags || []), JSON.stringify(spells || []), JSON.stringify(vulnerabilities || []), JSON.stringify(resistances || []), JSON.stringify(damageImmunities || []), JSON.stringify(conditionImmunities || []), existing.id);
      return res.json({ success: true });
    }
    db.prepare(`INSERT INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, stats, actions, abilities, source, tags, spells, vulnerabilities, resistances, damageImmunities, conditionImmunities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, JSON.stringify(stats || {}), JSON.stringify(actions || []), JSON.stringify(abilities || []), source || 'custom', JSON.stringify(tags || []), JSON.stringify(spells || []), JSON.stringify(vulnerabilities || []), JSON.stringify(resistances || []), JSON.stringify(damageImmunities || []), JSON.stringify(conditionImmunities || []));
    res.status(201).json({ success: true });
  });

  router.put('/monsters/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, stats, actions, abilities, source, tags, spells, vulnerabilities, resistances, damageImmunities, conditionImmunities } = req.body;
    db.prepare(`UPDATE monsters SET name = ?, hp = ?, maxHp = ?, ac = ?, speed = ?, avatar = ?, xp = ?, description = ?, cr = ?, type = ?, stats = ?, actions = ?, abilities = ?, source = ?, tags = ?, spells = ?, vulnerabilities = ?, resistances = ?, damageImmunities = ?, conditionImmunities = ? WHERE id = ?`)
      .run(name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, JSON.stringify(stats || {}), JSON.stringify(actions || []), JSON.stringify(abilities || []), source || 'custom', JSON.stringify(tags || []), JSON.stringify(spells || []), JSON.stringify(vulnerabilities || []), JSON.stringify(resistances || []), JSON.stringify(damageImmunities || []), JSON.stringify(conditionImmunities || []), req.params.id);
    res.json({ success: true });
  });

  router.delete('/monsters', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM monsters').run();
    res.json({ success: true });
  });

  router.delete('/monsters/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM monsters WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ── Spells ──
  router.get('/spells', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare('SELECT * FROM spells ORDER BY level, name').all().map((s: any) => ({
      ...s, classes: s.classes ? JSON.parse(s.classes) : undefined,
    })));
  });

  router.post('/spells', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { id, name, level, school, time, range, components, duration, description, higherLevels, classes, source } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const spellId = id || crypto.randomUUID();
    db.prepare(`INSERT OR REPLACE INTO spells (id, name, level, school, time, range, components, duration, description, higherLevels, classes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(spellId, name, level ?? 0, school ?? null, time ?? null, range ?? null, components ?? null, duration ?? null, description ?? null, higherLevels ?? null, classes ? JSON.stringify(classes) : null, source ?? null);
    res.status(201).json({ success: true, id: spellId });
  });

  router.delete('/spells/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM spells WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ── Class Features ──
  router.get('/class-features', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare('SELECT * FROM class_features ORDER BY className, level, name').all().map((f: any) => ({ ...f, isSubclass: !!f.isSubclass })));
  });

  router.post('/class-features/bulk', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    const features: any[] = req.body;
    if (!Array.isArray(features)) return res.status(400).json({ error: 'Array expected' });
    const insert = db.prepare(`INSERT OR REPLACE INTO class_features (id, name, className, classSource, level, source, description, subclassName, isSubclass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction((feats: any[]) => {
      for (const f of feats) insert.run(f.id, f.name, f.className, f.classSource, f.level ?? 1, f.source ?? null, f.description ?? null, f.subclassName ?? null, f.isSubclass ? 1 : 0);
    })(features);
    res.status(201).json({ success: true, count: features.length });
  });

  router.delete('/class-features', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    db.prepare('DELETE FROM class_features').run();
    res.json({ success: true });
  });

  // ── Players ──
  router.get('/players', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare('SELECT * FROM players').all().map(serializePlayer));
  });

  router.post('/players', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { name, dndBeyondId, hp_max, ac, speed, subtitle, avatar, stats, passivePerception, level, actions, abilities, spells, spellIds, featureIds, spellSlots, featureUses } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const effectiveDndBeyondId = dndBeyondId || `foundry:${crypto.randomUUID()}`;
    const id = crypto.randomUUID();
    const lastImported = new Date().toISOString();
    db.prepare(`
      INSERT INTO players (id, name, dndBeyondId, hp_max, ac, speed, subtitle, avatar, stats, lastImported, passive_perception, level, actions, abilities, spells, spell_ids, feature_ids, spell_slots, feature_uses)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dndBeyondId) DO UPDATE SET
        name=excluded.name, hp_max=excluded.hp_max, ac=excluded.ac,
        speed=excluded.speed, subtitle=excluded.subtitle, avatar=excluded.avatar,
        stats=excluded.stats, lastImported=excluded.lastImported,
        passive_perception=excluded.passive_perception, level=excluded.level,
        actions=excluded.actions, abilities=excluded.abilities, spells=excluded.spells,
        spell_ids=excluded.spell_ids, feature_ids=excluded.feature_ids,
        spell_slots=excluded.spell_slots, feature_uses=excluded.feature_uses
    `).run(id, name, effectiveDndBeyondId, hp_max ?? 0, ac ?? 10, speed ?? '30 ft.', subtitle ?? '', avatar ?? '', JSON.stringify(stats ?? {}), lastImported, passivePerception ?? 10, level ?? 1, JSON.stringify(actions ?? []), JSON.stringify(abilities ?? []), JSON.stringify(spells ?? []), JSON.stringify(spellIds ?? []), JSON.stringify(featureIds ?? []), JSON.stringify(spellSlots ?? {}), JSON.stringify(featureUses ?? {}));
    const player = db.prepare('SELECT * FROM players WHERE dndBeyondId = ?').get(effectiveDndBeyondId) as any;
    res.json(serializePlayer(player));
  });

  router.put('/players/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { name, hp_max, ac, speed, subtitle, avatar, stats, passivePerception, level, actions, abilities, spells, spellIds, featureIds, spellSlots, featureUses } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (spells !== undefined || spellIds !== undefined || featureIds !== undefined || spellSlots !== undefined || featureUses !== undefined) {
      db.prepare(`UPDATE players SET name=?, hp_max=?, ac=?, speed=?, subtitle=?, avatar=?, stats=?, passive_perception=?, level=?, actions=?, abilities=?, spells=?, spell_ids=?, feature_ids=?, spell_slots=?, feature_uses=? WHERE id=?`)
        .run(name, hp_max ?? 0, ac ?? 10, speed ?? '30 ft.', subtitle ?? '', avatar ?? '', JSON.stringify(stats ?? {}), passivePerception ?? 10, level ?? 1, JSON.stringify(actions ?? []), JSON.stringify(abilities ?? []), JSON.stringify(spells ?? []), JSON.stringify(spellIds ?? []), JSON.stringify(featureIds ?? []), JSON.stringify(spellSlots ?? {}), JSON.stringify(featureUses ?? {}), req.params.id);
    } else {
      db.prepare(`UPDATE players SET name=?, hp_max=?, ac=?, speed=?, subtitle=?, avatar=?, stats=?, passive_perception=?, level=?, actions=?, abilities=?, spell_slots=?, feature_uses=? WHERE id=?`)
        .run(name, hp_max ?? 0, ac ?? 10, speed ?? '30 ft.', subtitle ?? '', avatar ?? '', JSON.stringify(stats ?? {}), passivePerception ?? 10, level ?? 1, JSON.stringify(actions ?? []), JSON.stringify(abilities ?? []), JSON.stringify(spellSlots ?? {}), JSON.stringify(featureUses ?? {}), req.params.id);
    }
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id) as any;
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(serializePlayer(player));
  });

  router.patch('/players/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id) as any;
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { hp_current, ac, speed, subtitle, stats, spellSlots, featureUses } = req.body;

    const setClauses: string[] = [];
    const values: any[] = [];

    if (hp_current !== undefined) { setClauses.push('hp_current = ?'); values.push(hp_current); }
    if (ac !== undefined) { setClauses.push('ac = ?'); values.push(ac); }
    if (speed !== undefined) { setClauses.push('speed = ?'); values.push(speed); }
    if (subtitle !== undefined) { setClauses.push('subtitle = ?'); values.push(subtitle); }
    if (stats !== undefined) { setClauses.push('stats = ?'); values.push(JSON.stringify(stats)); }
    if (spellSlots !== undefined) { setClauses.push('spell_slots = ?'); values.push(JSON.stringify(spellSlots)); }
    if (featureUses !== undefined) { setClauses.push('feature_uses = ?'); values.push(JSON.stringify(featureUses)); }

    if (setClauses.length === 0) return res.json(serializePlayer(player));

    values.push(req.params.id);
    db.prepare(`UPDATE players SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id) as any;
    res.json(serializePlayer(updated));
  });

  router.delete('/players/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ── DB Reset (admin only) ──
  router.post('/db/reset', requireAdmin, (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    try {
      db.exec(`
        DELETE FROM combatants;
        DELETE FROM encounters;
        DELETE FROM monsters;
        DELETE FROM spells;
        DELETE FROM players;
        DELETE FROM sounds;
        DELETE FROM campaigns;
        DELETE FROM sessions;
        DELETE FROM class_features;
        DELETE FROM folder_settings;
      `);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  return router;
}
