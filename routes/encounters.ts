import { Router } from 'express';
import type { Server } from 'socket.io';

export function createEncountersRouter(db: any, dbAvailable: boolean, io: Server) {
  const router = Router();
  const formatEncounter = (encounter: any, view: 'list' | 'detail' | 'session') => {
    const formatted = {
      ...encounter,
      lastModified: encounter.createdAt,
      isEncounterActive: !!encounter.isEncounterActive,
      showSummary: !!encounter.showSummary,
      encounterStats: encounter.encounterStats ? JSON.parse(encounter.encounterStats) : null,
    };

    if (view === 'session') return formatted;

    const collection = {
      ...formatted,
      soundIds: encounter.soundIds ? JSON.parse(encounter.soundIds) : [],
      notes: encounter.notes ? JSON.parse(encounter.notes) : { general: '', rounds: [] },
      waves: encounter.waves ? JSON.parse(encounter.waves) : [],
    };

    return view === 'list' ? collection : {
      ...collection,
      lairActionsEnabled: !!encounter.lairActionsEnabled,
      trackingData: encounter.trackingData ? JSON.parse(encounter.trackingData) : null,
    };
  };
  const combatantValues = (combatant: any) => {
    const hp = combatant.hp && typeof combatant.hp === 'object' ? combatant.hp : {};
    return [
      combatant.name, combatant.initiative, hp.current ?? 0, hp.max ?? 0, combatant.tempHp ?? 0,
      combatant.ac, combatant.speed, combatant.subtitle, combatant.avatar, combatant.type,
      combatant.isCurrentTurn ? 1 : 0, combatant.isFriendly ? 1 : 0,
      JSON.stringify(combatant.conditions || []), JSON.stringify(combatant.tags || []), JSON.stringify(combatant.customTagDescriptions || {}),
      JSON.stringify(combatant.conditionTimers || {}), combatant.concentratingOn ?? null, combatant.concentrationTargets ? JSON.stringify(combatant.concentrationTargets) : null,
      combatant.deathSaves ? JSON.stringify(combatant.deathSaves) : null,
      JSON.stringify(combatant.stats || {}), JSON.stringify(combatant.actions || []), JSON.stringify(combatant.abilities || []), JSON.stringify(combatant.spells || []),
      combatant.ownerId ?? null, combatant.playerId ?? null,
      JSON.stringify(combatant.vulnerabilities || []), JSON.stringify(combatant.resistances || []), JSON.stringify(combatant.damageImmunities || []), JSON.stringify(combatant.conditionImmunities || []),
      combatant.spellSlots ? JSON.stringify(combatant.spellSlots) : null, combatant.featureUses ? JSON.stringify(combatant.featureUses) : null,
      JSON.stringify(combatant.spellIds || []), JSON.stringify(combatant.featureIds || []),
      combatant.legendaryActions ? JSON.stringify(combatant.legendaryActions) : null,
      combatant.polymorphForm ? JSON.stringify(combatant.polymorphForm) : null,
    ];
  };
  const formatCombatants = (combatants: any[]) => {
    const safeJson = (val: string, fallback: any) => { try { return JSON.parse(val || JSON.stringify(fallback)); } catch { return fallback; } };
    const monstersByName = new Map<string, any>();
    (db.prepare('SELECT name, vulnerabilities, resistances, damageImmunities, conditionImmunities FROM monsters').all() as any[])
      .forEach(monster => monstersByName.set(monster.name.toLowerCase(), monster));

    return combatants.map((combatant: any) => {
      const vulnerabilities = safeJson(combatant.vulnerabilities, []);
      const resistances = safeJson(combatant.resistances, []);
      const damageImmunities = safeJson(combatant.damageImmunities, []);
      const conditionImmunities = safeJson(combatant.conditionImmunities, []);
      const libraryMonster = combatant.type === 'monster' && !vulnerabilities.length && !resistances.length && !damageImmunities.length && !conditionImmunities.length
        ? monstersByName.get((combatant.name ?? '').toLowerCase())
        : null;

      return {
        ...combatant,
        hp: { current: combatant.hp_current, max: combatant.hp_max },
        tempHp: combatant.tempHp ?? 0,
        isCurrentTurn: !!combatant.isCurrentTurn,
        isFriendly: !!combatant.isFriendly,
        conditions: safeJson(combatant.conditions, []),
        tags: safeJson(combatant.tags, []),
        customTagDescriptions: safeJson(combatant.customTagDescriptions, {}),
        conditionTimers: safeJson(combatant.conditionTimers, {}),
        concentratingOn: combatant.concentratingOn ?? undefined,
        concentrationTargets: combatant.concentrationTargets ? safeJson(combatant.concentrationTargets, undefined) : undefined,
        deathSaves: combatant.deathSaves ? safeJson(combatant.deathSaves, undefined) : undefined,
        stats: safeJson(combatant.stats, {}),
        actions: safeJson(combatant.actions, []),
        abilities: safeJson(combatant.abilities, []),
        spells: safeJson(combatant.spells, []),
        spellSlots: combatant.spellSlots ? safeJson(combatant.spellSlots, null) : undefined,
        featureUses: combatant.featureUses ? safeJson(combatant.featureUses, null) : undefined,
        spellIds: safeJson(combatant.spellIds, []),
        featureIds: safeJson(combatant.featureIds, []),
        legendaryActions: safeJson(combatant.legendaryActions, undefined),
        polymorphForm: combatant.polymorph_form ? safeJson(combatant.polymorph_form, undefined) : undefined,
        hidden: !!combatant.hidden,
        waveId: combatant.waveId ?? 'default',
        vulnerabilities: libraryMonster ? safeJson(libraryMonster.vulnerabilities, []) : vulnerabilities,
        resistances: libraryMonster ? safeJson(libraryMonster.resistances, []) : resistances,
        damageImmunities: libraryMonster ? safeJson(libraryMonster.damageImmunities, []) : damageImmunities,
        conditionImmunities: libraryMonster ? safeJson(libraryMonster.conditionImmunities, []) : conditionImmunities,
      };
    });
  };

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', dbAvailable, mode: dbAvailable ? 'persistent' : 'ephemeral' });
  });

  router.get('/folder-settings', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const settings = db.prepare('SELECT * FROM folder_settings').all();
    res.json(settings);
  });

  router.post('/folder-settings', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { folder, backgroundImage, musicUrl } = req.body;
    db.prepare('INSERT INTO folder_settings (folder, backgroundImage, musicUrl) VALUES (?, ?, ?) ON CONFLICT(folder) DO UPDATE SET backgroundImage = excluded.backgroundImage, musicUrl = excluded.musicUrl')
      .run(folder, backgroundImage || '', musicUrl || '');
    res.status(201).json({ success: true });
  });

  router.get('/session-stats', (req, res) => {
    if (!dbAvailable) return res.json({ encounters: [] });
    const rows = db.prepare(
      'SELECT id, name, completedAt, encounterStats FROM encounters WHERE completedAt IS NOT NULL ORDER BY completedAt DESC LIMIT 500'
    ).all() as any[];
    res.json({
      encounters: rows.map(e => ({
        id: e.id,
        name: e.name,
        completedAt: e.completedAt,
        stats: e.encounterStats ? JSON.parse(e.encounterStats) : null,
      })),
    });
  });

  router.get('/encounters', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const encounters = db.prepare(`
      SELECT e.*, s.name as sessionName, c.name as campaignName, c.id as campaignId 
      FROM encounters e
      LEFT JOIN sessions s ON e.sessionId = s.id
      LEFT JOIN campaigns c ON s.campaignId = c.id
      ORDER BY e.createdAt DESC
    `).all();
    const allCombatants = db.prepare('SELECT encounterId, type, subtitle, name, avatar FROM combatants').all() as any[];
    const combatantsByEncounter: Record<string, { type: string; subtitle: string; name: string; avatar: string }[]> = {};
    for (const c of allCombatants) {
      (combatantsByEncounter[c.encounterId] ??= []).push({ type: c.type, subtitle: c.subtitle, name: c.name, avatar: c.avatar });
    }
    res.json(encounters.map((e: any) => ({
      ...formatEncounter(e, 'list'),
      combatants: combatantsByEncounter[e.id] ?? [],
    })));
  });

  router.get('/encounters/find-by-name/:name', (req, res) => {
    if (!dbAvailable) return res.status(404).json({ error: 'DB not available' });
    const e = db.prepare('SELECT id FROM encounters WHERE LOWER(name) = LOWER(?) OR LOWER(folder) = LOWER(?) ORDER BY createdAt DESC LIMIT 1').get(req.params.name, req.params.name) as any;
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json({ id: e.id });
  });

  router.get('/encounters/:id', (req, res) => {
    if (!dbAvailable) return res.status(404).json({ error: 'DB not available' });
    const e = db.prepare(`
      SELECT e.*, s.name as sessionName, c.name as campaignName, c.id as campaignId 
      FROM encounters e
      LEFT JOIN sessions s ON e.sessionId = s.id
      LEFT JOIN campaigns c ON s.campaignId = c.id
      WHERE e.id = ?
    `).get(req.params.id) as any;
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(formatEncounter(e, 'detail'));
  });

  router.post('/encounters', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { id, name, currentRound, isEncounterActive, showSummary, backgroundImage, youtubeUrl, musicUrl, folder, difficulty, backgroundOpacity, panelOpacity, sessionId, soundIds, animationLevel, waves } = req.body;
    db.prepare('INSERT INTO encounters (id, name, currentRound, isEncounterActive, showSummary, backgroundImage, youtubeUrl, musicUrl, folder, difficulty, backgroundOpacity, panelOpacity, sessionId, soundIds, animationLevel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, currentRound || 1, isEncounterActive ? 1 : 0, showSummary ? 1 : 0, backgroundImage || '', youtubeUrl || '', musicUrl || '', folder || '', difficulty || '', backgroundOpacity ?? 0.22, panelOpacity ?? 0.92, sessionId || null, soundIds ? JSON.stringify(soundIds) : null, animationLevel ?? 'minimal');
    io.emit('encounter-updated', { encounterId: id });
    if (waves) db.prepare('UPDATE encounters SET waves = ? WHERE id = ?').run(JSON.stringify(waves), id);
    res.status(201).json({ id, name });
  });

  router.put('/encounters/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const existing = db.prepare('SELECT * FROM encounters WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Encounter not found' });
    const {
      name = existing.name, currentRound = existing.currentRound,
      currentTurnIndex = existing.currentTurnIndex, isEncounterActive = existing.isEncounterActive,
      showSummary = existing.showSummary, backgroundImage = existing.backgroundImage,
      youtubeUrl = existing.youtubeUrl, musicUrl = existing.musicUrl,
      encounterStats = existing.encounterStats, folder = existing.folder,
      completedAt = existing.completedAt, difficulty = existing.difficulty,
      backgroundOpacity = existing.backgroundOpacity, panelOpacity = existing.panelOpacity,
      soundIds = undefined, animationLevel = existing.animationLevel ?? 'minimal',
      trackingData = undefined, favorite = existing.favorite ?? 0,
      lairActionsEnabled = existing.lairActionsEnabled ?? 0,
      notes = undefined,
      waves = undefined,
    } = req.body;
    const statsJson = typeof encounterStats === 'string' ? encounterStats : (encounterStats ? JSON.stringify(encounterStats) : existing.encounterStats);
    const soundIdsJson = soundIds !== undefined ? JSON.stringify(soundIds) : existing.soundIds;
    const trackingJson = trackingData !== undefined ? (typeof trackingData === 'string' ? trackingData : JSON.stringify(trackingData)) : existing.trackingData;
    const notesJson = notes !== undefined ? JSON.stringify(notes) : existing.notes;
    const wavesJson = waves !== undefined ? JSON.stringify(waves) : existing.waves;
    db.prepare(`
      UPDATE encounters
      SET name = ?, currentRound = ?, currentTurnIndex = ?, isEncounterActive = ?,
          showSummary = ?, backgroundImage = ?, youtubeUrl = ?, musicUrl = ?,
          encounterStats = ?, folder = ?, completedAt = ?, difficulty = ?,
          backgroundOpacity = ?, panelOpacity = ?, soundIds = ?, animationLevel = ?,
          trackingData = ?, favorite = ?, lairActionsEnabled = ?, notes = ?, waves = ?
      WHERE id = ?
    `).run(
      name, currentRound, currentTurnIndex, isEncounterActive ? 1 : 0,
      showSummary ? 1 : 0, backgroundImage, youtubeUrl, musicUrl,
      statsJson, folder, completedAt, difficulty,
      backgroundOpacity, panelOpacity, soundIdsJson, animationLevel,
      trackingJson, favorite ? 1 : 0, lairActionsEnabled ? 1 : 0, notesJson, wavesJson, req.params.id
    );
    io.to(`encounter:${req.params.id}`).emit('encounter-updated', { encounterId: req.params.id });
    res.json({ success: true });
  });

  router.delete('/encounters/bulk', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    const del = db.transaction((list: string[]) => {
      for (const id of list) db.prepare('DELETE FROM encounters WHERE id = ?').run(id);
    });
    del(ids);
    res.json({ success: true, deleted: ids.length });
  });

  router.delete('/encounters/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM encounters WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Sessions → encounters (nested route)
  router.get('/sessions/:sessionId/encounters', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const rows = db.prepare('SELECT * FROM encounters WHERE sessionId = ? ORDER BY createdAt DESC').all(req.params.sessionId);
    res.json(rows.map((e: any) => formatEncounter(e, 'session')));
  });

  // Combatants
  router.delete('/encounters/:id/combatants', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    db.prepare('DELETE FROM combatants WHERE encounterId = ?').run(req.params.id);
    res.json({ success: true });
  });

  router.get('/encounters/:id/combatants', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const combatants = db.prepare('SELECT * FROM combatants WHERE encounterId = ?').all(req.params.id);
    res.json(formatCombatants(combatants));
  });

  router.get('/encounters/:id/player-combatants', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const combatants = db.prepare('SELECT * FROM combatants WHERE encounterId = ? AND (hidden = 0 OR hidden IS NULL)').all(req.params.id);
    res.json(formatCombatants(combatants));
  });

  router.post('/encounters/:id/waves/:waveId/reveal', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const encounterId = req.params.id;
    const waveId = req.params.waveId;
    const result = db.prepare('UPDATE combatants SET hidden = 0 WHERE encounterId = ? AND waveId = ?').run(encounterId, waveId);
    const existing = db.prepare('SELECT waves FROM encounters WHERE id = ?').get(encounterId) as any;
    if (existing) {
      let waves: any[] = [];
      try { waves = JSON.parse(existing.waves || '[]'); } catch { waves = []; }
      waves = waves.map(w => w.id === waveId ? { ...w, revealed: true } : w);
      db.prepare('UPDATE encounters SET waves = ? WHERE id = ?').run(JSON.stringify(waves), encounterId);
    }
    io.to(`encounter:${encounterId}`).emit('encounter-updated', { encounterId });
    res.json({ success: true, revealed: result.changes });
  });

  router.post('/combatants', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { id, encounterId, name } = req.body;

    // Ensure the parent encounter row exists (FK constraint). If the encounter
    // was created in-memory but not yet saved, create a minimal stub now.
    if (encounterId) {
      const exists = db.prepare('SELECT id FROM encounters WHERE id = ?').get(encounterId);
      if (!exists) {
        db.prepare(`INSERT OR IGNORE INTO encounters (id, name) VALUES (?, ?)`).run(encounterId, name ?? 'Encounter');
      }
    }

    db.prepare(`
      INSERT OR REPLACE INTO combatants (id, encounterId, name, initiative, hp_current, hp_max, tempHp, ac, speed, subtitle, avatar, type, isCurrentTurn, isFriendly, conditions, tags, customTagDescriptions, conditionTimers, concentratingOn, concentrationTargets, deathSaves, stats, actions, abilities, spells, ownerId, playerId, vulnerabilities, resistances, damageImmunities, conditionImmunities, spellSlots, featureUses, spellIds, featureIds, legendaryActions, polymorph_form)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, encounterId, ...combatantValues(req.body)
    );
    db.prepare('UPDATE combatants SET hidden = ?, waveId = ? WHERE id = ?').run(req.body.hidden ? 1 : 0, req.body.waveId ?? 'default', id);
    io.to(`encounter:${encounterId}`).emit('encounter-updated', { encounterId });
    res.status(201).json({ success: true });
  });

  router.put('/combatants/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { encounterId } = req.body;
    db.prepare(`
      UPDATE combatants
      SET name = ?, initiative = ?, hp_current = ?, hp_max = ?, tempHp = ?, ac = ?, speed = ?, subtitle = ?, avatar = ?, type = ?, isCurrentTurn = ?, isFriendly = ?, conditions = ?, tags = ?, customTagDescriptions = ?, conditionTimers = ?, concentratingOn = ?, concentrationTargets = ?, deathSaves = ?, stats = ?, actions = ?, abilities = ?, spells = ?, ownerId = ?, playerId = ?, vulnerabilities = ?, resistances = ?, damageImmunities = ?, conditionImmunities = ?, spellSlots = ?, featureUses = ?, spellIds = ?, featureIds = ?, legendaryActions = ?, polymorph_form = ?
      WHERE id = ?
    `).run(
      ...combatantValues(req.body), req.params.id
    );
    if (req.body.hidden !== undefined || req.body.waveId !== undefined) {
      const current = db.prepare('SELECT hidden, waveId FROM combatants WHERE id = ?').get(req.params.id) as any;
      db.prepare('UPDATE combatants SET hidden = ?, waveId = ? WHERE id = ?').run(req.body.hidden === undefined ? current?.hidden ?? 0 : (req.body.hidden ? 1 : 0), req.body.waveId ?? current?.waveId ?? 'default', req.params.id);
    }
    if (encounterId) io.to(`encounter:${encounterId}`).emit('encounter-updated', { encounterId });
    res.json({ success: true });
  });

  router.put('/encounters/:id/combatants/bulk', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const encounterId = req.params.id;
    const { combatants: combatantList, encounter } = req.body;
    if (!Array.isArray(combatantList)) return res.status(400).json({ success: false, message: 'combatants must be an array' });

    const bulkUpdate = db.transaction(() => {
      if (encounter) {
        const existing = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as any;
        if (existing) {
          const {
            name = existing.name, currentRound = existing.currentRound,
            currentTurnIndex = existing.currentTurnIndex, isEncounterActive = existing.isEncounterActive,
            showSummary = existing.showSummary, backgroundImage = existing.backgroundImage,
            youtubeUrl = existing.youtubeUrl, musicUrl = existing.musicUrl,
            encounterStats = existing.encounterStats, folder = existing.folder,
            completedAt = existing.completedAt, difficulty = existing.difficulty,
            backgroundOpacity = existing.backgroundOpacity, panelOpacity = existing.panelOpacity,
            soundIds = undefined, trackingData = undefined,
            lairActionsEnabled = existing.lairActionsEnabled,
          } = encounter;
          const statsJson = typeof encounterStats === 'string' ? encounterStats : (encounterStats ? JSON.stringify(encounterStats) : existing.encounterStats);
          const soundIdsJson = soundIds !== undefined ? JSON.stringify(soundIds) : existing.soundIds;
          const trackingJson = trackingData !== undefined ? (typeof trackingData === 'string' ? trackingData : JSON.stringify(trackingData)) : existing.trackingData;
          db.prepare(`
            UPDATE encounters
            SET name = ?, currentRound = ?, currentTurnIndex = ?, isEncounterActive = ?,
                showSummary = ?, backgroundImage = ?, youtubeUrl = ?, musicUrl = ?,
                encounterStats = ?, folder = ?, completedAt = ?, difficulty = ?,
                backgroundOpacity = ?, panelOpacity = ?, soundIds = ?, trackingData = ?,
                lairActionsEnabled = ?
            WHERE id = ?
          `).run(
            name, currentRound, currentTurnIndex, isEncounterActive ? 1 : 0,
            showSummary ? 1 : 0, backgroundImage, youtubeUrl, musicUrl,
            statsJson, folder, completedAt, difficulty,
            backgroundOpacity, panelOpacity, soundIdsJson, trackingJson,
            lairActionsEnabled ? 1 : 0, encounterId
          );
        }
      }

      const stmt = db.prepare(`
        UPDATE combatants
        SET name = ?, initiative = ?, hp_current = ?, hp_max = ?, tempHp = ?, ac = ?, speed = ?, subtitle = ?, avatar = ?, type = ?, isCurrentTurn = ?, isFriendly = ?, conditions = ?, tags = ?, customTagDescriptions = ?, conditionTimers = ?, concentratingOn = ?, concentrationTargets = ?, deathSaves = ?, stats = ?, actions = ?, abilities = ?, spells = ?, ownerId = ?, playerId = ?, vulnerabilities = ?, resistances = ?, damageImmunities = ?, conditionImmunities = ?, spellSlots = ?, featureUses = ?, spellIds = ?, featureIds = ?, legendaryActions = ?, polymorph_form = ?
        WHERE id = ?
      `);

      let updated = 0;
      for (const c of combatantList) {
        if (!c.id) { console.warn('Skipping combatant without id in bulk update'); continue; }
        stmt.run(
          ...combatantValues(c), c.id
        );
        updated++;
      }
      return updated;
    });

    try {
      const updated = bulkUpdate();
      io.to(`encounter:${encounterId}`).emit('encounter-updated', { encounterId });
      res.json({ success: true, updated });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.delete('/combatants/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const deleteCombatant = db.transaction((id: string) => {
      const combatant = db.prepare('SELECT encounterId FROM combatants WHERE id = ?').get(id) as any;
      db.prepare('DELETE FROM combatants WHERE id = ?').run(id);
      return combatant;
    });
    const combatant = deleteCombatant(req.params.id);
    if (combatant) io.to(`encounter:${combatant.encounterId}`).emit('encounter-updated', { encounterId: combatant.encounterId });
    res.json({ success: true });
  });

  return router;
}
