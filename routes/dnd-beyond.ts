import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_FETCH_HOSTS = new Set([
  '5e.tools', 'www.5e.tools', 'raw.githubusercontent.com',
  'api.github.com', 'raw.5e.tools',
]);

export function createDndBeyondRouter(
  db: any,
  dbAvailable: boolean,
  ensureMonstersInDb: (creatures: Array<{ name: string; source?: string }>) => Promise<number>,
) {
  const router = Router();

  // ── Generic fetch proxy ──
  router.get('/fetch', async (req, res) => {
    const { url } = req.query as { url?: string };
    if (!url) return res.status(400).json({ error: 'url required' });
    let parsedHost: string;
    try { parsedHost = new URL(url).hostname.toLowerCase(); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!ALLOWED_FETCH_HOSTS.has(parsedHost)) return res.status(403).json({ error: `Fetch host not allowed: ${parsedHost}` });
    try {
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      const text = await upstream.text();
      let data: any;
      try { data = JSON.parse(text); } catch { return res.status(502).json({ error: 'Response is not valid JSON' }); }
      res.json(data);
    } catch (e: any) { res.status(502).json({ error: e.message ?? 'Fetch failed' }); }
  });

  // ── D&D Beyond character import ──
  router.get('/dnd-beyond/character/:id', async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid character ID.' });
    const cobaltSession = req.headers['x-cobalt-session'] as string | undefined;

    try {
      const browserHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.dndbeyond.com',
        'Referer': 'https://www.dndbeyond.com/',
      };

      let bearerToken: string | undefined;
      let authDebug = '';
      if (cobaltSession) {
        for (const endpoint of ['https://auth-service.dndbeyond.com/v1/cobalt-token', 'https://auth-service.dndbeyond.com/v2/cobalt-token', 'https://auth-service.dndbeyond.com/auth/token']) {
          try {
            const authRes = await fetch(endpoint, { method: 'POST', headers: { ...browserHeaders, 'Content-Type': 'application/json', 'Cookie': `CobaltSession=${cobaltSession}` } });
            const authBody = await authRes.text();
            authDebug += `${endpoint} → ${authRes.status}: ${authBody.slice(0, 300)}\n`;
            if (authRes.ok) {
              const authJson = JSON.parse(authBody);
              bearerToken = authJson?.token ?? authJson?.data?.token ?? authJson?.access_token ?? authJson?.jwt ?? undefined;
              if (bearerToken) break;
            }
          } catch (e: any) { authDebug += `${endpoint} → error: ${e.message}\n`; }
        }
      }

      const headers: Record<string, string> = { ...browserHeaders };
      if (cobaltSession) headers['Cookie'] = `CobaltSession=${cobaltSession}`;
      if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

      const response = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${id}`, { headers });
      if (response.status === 401 || response.status === 403) {
        const detail = bearerToken ? 'Token exchange succeeded but character-service still rejected.' : 'No bearer token obtained from auth exchange.';
        return res.status(401).json({ error: `Character is private or auth failed. ${detail} Auth debug: ${authDebug}` });
      }
      if (response.status === 404) return res.status(404).json({ error: 'Character not found.' });
      if (!response.ok) return res.status(502).json({ error: 'Could not reach D&D Beyond.' });

      const json = await response.json() as any;
      const data = json.data;
      if (!data) return res.status(502).json({ error: 'Unexpected response format from D&D Beyond.' });

      const statKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      const stats: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const base = (data.stats || []).find((s: any) => s.id === i + 1)?.value ?? 10;
        const bonus = (data.bonusStats || []).find((s: any) => s.id === i + 1)?.value ?? 0;
        const override = (data.overrideStats || []).find((s: any) => s.id === i + 1)?.value;
        stats[statKeys[i]] = (override !== null && override !== undefined) ? override : base + bonus;
      }

      const hp_max = data.overrideHitPoints ?? ((data.baseHitPoints ?? 0) + (data.bonusHitPoints ?? 0));
      const dexMod = Math.floor(((stats.dex ?? 10) - 10) / 2);
      let ac = 10 + dexMod;
      try {
        const equippedArmor = (data.inventory || []).filter((item: any) => item.equipped && item.definition?.armorClass);
        if (equippedArmor.length > 0) {
          const hasShield = equippedArmor.some((i: any) => i.definition?.type === 'Shield' || String(i.definition?.armorTypeId) === '4');
          const bodyArmor = equippedArmor.filter((i: any) => i.definition?.type !== 'Shield' && String(i.definition?.armorTypeId) !== '4');
          if (bodyArmor.length > 0) {
            const best = bodyArmor.reduce((a: any, b: any) => (a.definition.armorClass ?? 0) > (b.definition.armorClass ?? 0) ? a : b);
            const isHeavy = (best.definition.type ?? '').toLowerCase().includes('heavy') || String(best.definition.armorTypeId ?? '') === '3';
            const isMedium = (best.definition.type ?? '').toLowerCase().includes('medium') || String(best.definition.armorTypeId ?? '') === '2';
            const dexBonus = isHeavy ? 0 : isMedium ? Math.min(dexMod, 2) : dexMod;
            ac = best.definition.armorClass + dexBonus + (hasShield ? 2 : 0);
          } else { ac = (10 + dexMod) + (hasShield ? 2 : 0); }
        }
      } catch {}

      const speedVal = data.race?.weightSpeeds?.normal?.walk ?? 30;
      const totalLevel = (data.classes || []).reduce((sum: number, cls: any) => sum + (cls.level ?? 0), 0) || 1;
      const subtitle = (data.classes || []).map((cls: any) => `${cls.definition?.name ?? 'Unknown'} ${cls.level}`).join(' / ');
      const wisMod = Math.floor(((stats.wis ?? 10) - 10) / 2);
      const profBonus = totalLevel >= 17 ? 6 : totalLevel >= 13 ? 5 : totalLevel >= 9 ? 4 : totalLevel >= 5 ? 3 : 2;
      const allMods = [...(data.modifiers?.class ?? []), ...(data.modifiers?.race ?? []), ...(data.modifiers?.background ?? []), ...(data.modifiers?.item ?? []), ...(data.modifiers?.feat ?? [])];
      const hasPercExpertise = allMods.some((m: any) => m.subType === 'perception' && m.type === 'expertise');
      const hasPercProf = allMods.some((m: any) => m.subType === 'perception' && m.type === 'proficiency');
      const passivePerception = 10 + wisMod + (hasPercExpertise ? profBonus * 2 : hasPercProf ? profBonus : 0);

      const dec = data.decorations ?? {};
      const normalizeAvatarUrl = (url: string | null | undefined): string | null => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `https://www.dndbeyond.com${url}`;
        return null;
      };
      const avatar = normalizeAvatarUrl(dec.avatarUrl) ?? normalizeAvatarUrl(dec.frameAvatarUrl) ?? normalizeAvatarUrl(dec.decorativeFrameAvatarUrl) ?? normalizeAvatarUrl(dec.smallBackdropAvatarUrl) ?? normalizeAvatarUrl(dec.largeBackdropAvatarUrl) ?? normalizeAvatarUrl(dec.backdropAvatarUrl) ?? normalizeAvatarUrl(dec.thumbnailBackdropAvatarUrl) ?? '';

      const seenActions = new Set<string>();
      const ddbActions = (data.inventory ?? [])
        .filter((item: any) => item.equipped && item.definition?.filterType === 'Weapon')
        .map((item: any) => ({ name: item.definition.name, description: item.definition.snippet ?? item.definition.description ?? '', category: 'attack' }))
        .filter((a: any) => { if (seenActions.has(a.name)) return false; seenActions.add(a.name); return true; });

      const classSpellEntries: any[] = (data.classSpells ?? []).flatMap((cs: any) => cs.spells ?? []);
      const rawSpells = [...(data.spells?.class ?? []), ...(data.spells?.race ?? []), ...(data.spells?.feat ?? []), ...(data.spells?.item ?? []), ...(data.spells?.background ?? []), ...classSpellEntries];
      const seenSpells = new Set<string>();
      const ddbSpells = rawSpells.filter((s: any) => { if (!s.definition?.name || seenSpells.has(s.definition.name)) return false; seenSpells.add(s.definition.name); return true; })
        .map((s: any) => ({ name: s.definition.name, description: s.definition.description ?? s.definition.snippet ?? '', category: 'spell' }));

      const ABILITY_NOISE = /^(circle spell:|initiate a circle spell)/i;
      const rawAbilityActions = [...(data.actions?.class ?? []), ...(data.actions?.race ?? []), ...(data.actions?.feat ?? []), ...(data.actions?.background ?? [])];
      const seenAbilities = new Set<string>();
      const ddbAbilities = rawAbilityActions.filter((a: any) => { if (!a.name || ABILITY_NOISE.test(a.name) || seenAbilities.has(a.name)) return false; seenAbilities.add(a.name); return true; })
        .map((a: any) => ({ name: a.name, description: a.snippet ?? a.description ?? '', category: 'ability' }));

      res.json({ name: data.name, avatar, hp_max, ac, speed: `${speedVal} ft.`, subtitle, stats, dndBeyondId: String(id), level: totalLevel, passivePerception, actions: ddbActions, spells: ddbSpells, abilities: ddbAbilities });
    } catch { res.status(502).json({ error: 'Could not import character — D&D Beyond may have changed their format.' }); }
  });

  // ── DDB debug endpoint ──
  router.get('/dnd-beyond/debug/:id', async (req, res) => {
    const { id } = req.params;
    const cobaltSession = req.headers['x-cobalt-session'] as string | undefined;
    try {
      const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
      if (cobaltSession) headers['Cookie'] = `CobaltSession=${cobaltSession}`;
      const response = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${id}`, { headers });
      if (!response.ok) return res.status(response.status).json({ error: `DDB returned ${response.status}` });
      const data = (await response.json() as any).data;
      if (!data) return res.status(502).json({ error: 'No data field' });
      res.json({
        actions: Object.fromEntries(Object.keys(data.actions ?? {}).map(k => [k, (data.actions[k] ?? []).map((a: any) => ({ name: a.name, attackTypeRange: a.attackTypeRange, actionType: a.actionType, displayAsAttack: a.displayAsAttack }))])),
        spells: Object.fromEntries(Object.keys(data.spells ?? {}).map(k => [k, (data.spells[k] ?? []).map((s: any) => s.definition?.name ?? s.name).filter(Boolean)])),
        classSpells: (data.classSpells ?? []).map((cs: any) => ({ characterClassId: cs.characterClassId, spellCount: (cs.spells ?? []).length, spellNames: (cs.spells ?? []).map((s: any) => s.definition?.name).filter(Boolean) })),
        inventoryWeapons: (data.inventory ?? []).filter((item: any) => item.definition?.filterType === 'Weapon').map((item: any) => ({ name: item.definition.name, equipped: item.equipped, filterType: item.definition.filterType })),
        classFeatureCount: (data.classFeatures ?? []).length,
        classFeatureNames: (data.classFeatures ?? []).map((f: any) => f.definition?.name).filter(Boolean),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── DDB campaign characters ──
  router.post('/ddb/campaign-characters', async (req, res) => {
    let { joinCode, cobaltToken } = req.body as { joinCode: string; cobaltToken?: string };
    const urlMatch = joinCode?.match(/campaigns\/join\/(\d+)/);
    if (urlMatch) joinCode = urlMatch[1];
    if (!joinCode) return res.status(400).json({ error: 'joinCode required' });

    const headers: Record<string, string> = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
    if (cobaltToken) headers['Cookie'] = `CobaltSession=${cobaltToken}`;

    try {
      const campaignRes = await fetch(`https://www.dndbeyond.com/api/campaign/stt/active-campaigns/${joinCode}`, { headers });
      if (campaignRes.status === 401 || campaignRes.status === 403) return res.json({ requiresAuth: true });
      if (!campaignRes.ok) throw new Error(`DDB campaign fetch failed: ${campaignRes.status}`);
      const rawText = await campaignRes.text();
      let campaign: any;
      try { campaign = JSON.parse(rawText); } catch { return res.json({ requiresAuth: true }); }
      const characterLinks: Array<{ characterId: number }> = campaign?.data?.characters ?? campaign?.characters ?? [];
      if (characterLinks.length === 0) return res.json({ characters: [] });

      const characters = await Promise.all(characterLinks.map(async ({ characterId }) => {
        try {
          const charRes = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${characterId}`, { headers });
          if (!charRes.ok) return null;
          const json = await charRes.json();
          const data = json?.data ?? json;
          const cls = data.classes?.[0];
          return {
            id: `ddb-${characterId}`, name: data.name ?? 'Unknown', dndBeyondId: String(characterId),
            level: cls?.level ?? 1, class: cls?.definition?.name ?? '', hp_max: data.hitPoints?.maximum ?? 10,
            ac: data.armorClass ?? 10, speed: `${data.speed?.walk ?? 30} ft`,
            subtitle: `${cls?.definition?.name ?? 'Adventurer'} ${cls?.level ?? 1}`,
            stats: { str: data.stats?.find((s: any) => s.id === 1)?.value ?? 10, dex: data.stats?.find((s: any) => s.id === 2)?.value ?? 10, con: data.stats?.find((s: any) => s.id === 3)?.value ?? 10, int: data.stats?.find((s: any) => s.id === 4)?.value ?? 10, wis: data.stats?.find((s: any) => s.id === 5)?.value ?? 10, cha: data.stats?.find((s: any) => s.id === 6)?.value ?? 10 },
            avatar: (data.decorations?.avatarUrl ?? data.decorations?.frameAvatarUrl ?? data.decorations?.decorativeFrameAvatarUrl ?? data.decorations?.smallBackdropAvatarUrl ?? data.decorations?.largeBackdropAvatarUrl ?? data.decorations?.backdropAvatarUrl ?? data.avatarUrl ?? ''),
            source: 'ddb' as const, lastImported: new Date().toISOString(),
          };
        } catch { return null; }
      }));
      res.json({ characters: characters.filter(Boolean) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Adventure import helpers ──
  function extractCreatureRefs(text: string): Array<{ rawName: string; source?: string }> {
    const refs: Array<{ rawName: string; source?: string }> = [];
    const re = /\{@creature ([^|}]+)(?:\|([^|}]*))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) refs.push({ rawName: m[1].trim(), source: m[2]?.trim() || undefined });
    return refs;
  }

  function cleanTags(text: string): string {
    return text.replace(/\{@[a-z]+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1');
  }

  // ── Adventure parse-url ──
  router.post('/adventures/parse-url', async (req, res) => {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url required' });
    const hashMatch = url.match(/#([a-z0-9]+)(?:,(\d+[a-z]*))?/i);
    if (!hashMatch) return res.status(400).json({ error: 'Invalid 5etools URL. Expected format: https://5e.tools/adventure.html#wbtw,4c' });
    const adventureId = hashMatch[1].toLowerCase();
    const chapterFilter = hashMatch[2] ?? null;

    let adventureJson: any;
    try {
      const resp = await fetch(`https://5e.tools/data/adventure/adventure-${adventureId}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      adventureJson = await resp.json();
    } catch (e: any) { return res.status(502).json({ error: `Failed to fetch adventure data: ${e.message}` }); }

    const encounters: Array<{ name: string; chapter: string; creatures: Array<{ rawName: string; count: number }> }> = [];

    function walkEntries(entries: any[], chapterName: string, sectionName: string) {
      if (!Array.isArray(entries)) return;
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type === 'encounter' && Array.isArray(entry.encounter)) {
          encounters.push({ name: entry.name ?? sectionName, chapter: chapterName, creatures: entry.encounter.map((c: any) => ({ rawName: c.name ?? c, count: c.count ?? 1 })) });
          continue;
        }
        const entryName: string = entry.name ?? '';
        const isEncounterSection = /encounter/i.test(entryName);
        const creatureRefs: Array<{ rawName: string; source?: string }> = [];
        if (isEncounterSection) {
          creatureRefs.push(...extractCreatureRefs([entry.caption, entry.colLabels].flat().filter(Boolean).join(' ')));
          if (Array.isArray(entry.entries)) {
            for (const sub of entry.entries) {
              if (typeof sub === 'string') creatureRefs.push(...extractCreatureRefs(sub));
              else if (sub?.entries) { for (const s of [sub.entries].flat()) { if (typeof s === 'string') creatureRefs.push(...extractCreatureRefs(s)); } }
            }
          }
          if (creatureRefs.length > 0) {
            const unique = Array.from(new Map(creatureRefs.map(r => [r.rawName, r])).values());
            encounters.push({ name: entryName, chapter: chapterName, creatures: unique.map(r => ({ rawName: r.rawName, count: 1 })) });
            continue;
          }
        }
        if (Array.isArray(entry.entries)) walkEntries(entry.entries, chapterName, entryName || sectionName);
        if (Array.isArray(entry.rows)) { for (const row of entry.rows) walkEntries(row, chapterName, sectionName); }
      }
    }

    const adventureData = adventureJson.adventureData ?? [];
    for (const block of adventureData) {
      const chapters: any[] = block.data?.chapter ?? block.chapter ?? [];
      for (let i = 0; i < chapters.length; i++) {
        const chap = chapters[i];
        if (chapterFilter) { const chapNum = parseInt(chapterFilter); if (!isNaN(chapNum) && i + 1 !== chapNum) continue; }
        walkEntries(chap.entries ?? [], chap.name ?? `Chapter ${i + 1}`, chap.name ?? `Chapter ${i + 1}`);
      }
    }

    const seen = new Set<string>();
    const deduped = encounters.filter(e => { const key = `${e.chapter}::${e.name}`; if (seen.has(key)) return false; seen.add(key); return e.creatures.length > 0; });
    const allRefs = extractCreatureRefs(JSON.stringify(adventureJson));
    const uniqueCreatures = Array.from(new Map(allRefs.map(r => [r.rawName.toLowerCase(), r])).values());
    await ensureMonstersInDb(uniqueCreatures.map(r => ({ name: r.rawName, source: r.source })));
    res.json({ encounters: deduped });
  });

  // ── 5etools adventure list ──
  router.get('/adventures/5etools/list', async (_req, res) => {
    try {
      const resp = await fetch('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/adventures.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as any;
      res.json({ adventures: (data.adventure || []).map((a: any) => ({ id: a.id, name: a.name, level: a.level, author: a.author, published: a.published, storyline: a.storyline, chapters: (a.contents || []).filter((c: any) => c.ordinal?.type === 'chapter').map((c: any) => ({ name: c.name, identifier: c.ordinal?.identifier })) })) });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  // ── 5etools adventure meta ──
  router.get('/adventures/5etools/meta', async (req, res) => {
    const rawId = ((req.query.id as string) || '').trim();
    if (!rawId) return res.status(400).json({ error: 'id required' });
    const id = rawId.toLowerCase();

    function extractText(entries: any[], limit = 4): string {
      const texts: string[] = [];
      for (const e of entries) {
        if (texts.length >= limit) break;
        if (typeof e === 'string') texts.push(cleanTags(e));
        else if (e?.entries) { for (const sub of e.entries) { if (typeof sub === 'string') { texts.push(cleanTags(sub)); if (texts.length >= limit) break; } } }
      }
      return texts.join('\n\n');
    }

    try {
      const [indexResp, contentResp] = await Promise.all([
        fetch('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/adventures.json'),
        fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/adventure/adventure-${id}.json`),
      ]);
      if (!indexResp.ok) throw new Error(`Adventures index HTTP ${indexResp.status}`);
      if (!contentResp.ok) throw new Error(`Adventure data HTTP ${contentResp.status} — check the adventure ID`);
      const [indexData, contentData] = await Promise.all([indexResp.json(), contentResp.json()]) as any[];
      const meta = (indexData.adventure || []).find((a: any) => a.id.toLowerCase() === id || a.source.toLowerCase() === id);
      const chapters: any[] = contentData.data || [];
      let summary = '';
      if (chapters[0]) {
        const introEntries = chapters[0].entries || [];
        const summarySection = introEntries.find((e: any) => e?.name === 'Adventure Summary');
        summary = summarySection ? extractText(summarySection.entries || []) : extractText(introEntries);
      }
      res.json({
        meta: meta ? { id: meta.id, name: meta.name, author: meta.author, level: meta.level, published: meta.published, storyline: meta.storyline } : { id, name: id.toUpperCase() },
        summary,
        chapters: chapters.map((ch: any, idx: number) => {
          const metaEntry = (meta?.contents || [])[idx];
          return { index: idx, name: ch.name, chapterNum: metaEntry?.ordinal?.identifier ?? null, type: metaEntry?.ordinal?.type ?? 'section' };
        }),
      });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  // ── 5etools chapter encounters ──
  router.get('/adventures/5etools/chapter', async (req, res) => {
    const rawId = ((req.query.id as string) || '').trim();
    const chapterIndex = parseInt((req.query.chapterIndex as string) || '0');
    if (!rawId) return res.status(400).json({ error: 'id required' });
    const id = rawId.toLowerCase();

    function extractCreatureRefsFromObj(obj: any): Array<{ rawName: string; source?: string }> {
      return extractCreatureRefs(typeof obj === 'string' ? obj : JSON.stringify(obj));
    }

    function extractEncounters(
      entries: any[], chapterName: string, sectionName: string,
      out: Array<{ name: string; chapter: string; creatures: Array<{ rawName: string; count: number }> }>
    ) {
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type === 'encounter' && Array.isArray(entry.encounter)) {
          out.push({ name: entry.name ?? sectionName, chapter: sectionName !== chapterName ? `${chapterName} — ${sectionName}` : chapterName, creatures: entry.encounter.map((c: any) => ({ rawName: c.name ?? c, count: c.count ?? 1 })) });
          continue;
        }
        const entryName: string = entry.name ?? '';
        const subEntries: any[] = entry.entries ?? [];
        if (entryName && (entry.type === 'entries' || entry.type === 'section')) {
          const skipNames = new Set(['development', 'character advancement', 'story tracker', 'introduction', 'credits', 'conclusion', 'aftermath']);
          const skipPrefixes = ["where's ", 'from ', 'leaving ', 'approaching ', 'guide from ', 'endelyn\'s escape', 'bargaining with', 'a tragedy', 'preparing for', 'meeting ', 'talking with ', 'encounter with ', 'dealing with '];
          const nameLow = entryName.toLowerCase();
          if (skipNames.has(nameLow) || skipPrefixes.some(p => nameLow.startsWith(p))) continue;
          const creatureRefs = extractCreatureRefsFromObj(subEntries);
          if (creatureRefs.length > 0) {
            const isLikelyFight = creatureRefs.length > 1 || /encounter|random|boss|fight|combat/i.test(entryName) || /^[A-Z]\d+\./i.test(entryName);
            if (!isLikelyFight) continue;
            const hasNamedChildren = subEntries.some((s: any) => s?.name && extractCreatureRefsFromObj([s]).length > 0);
            if (!hasNamedChildren || /^[A-Z]\d+\./i.test(entryName) || /encounter|random/i.test(entryName)) {
              const unique = Array.from(new Map(creatureRefs.map(r => [r.rawName, r])).values());
              out.push({ name: entryName, chapter: sectionName !== chapterName ? `${chapterName} — ${sectionName}` : chapterName, creatures: unique.map(r => ({ rawName: r.rawName, count: 1 })) });
              continue;
            }
          }
          extractEncounters(subEntries, chapterName, entryName || sectionName, out);
        }
      }
    }

    try {
      const resp = await fetch(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/adventure/adventure-${id}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const chapters: any[] = data.data || [];
      const chapter = chapters[chapterIndex];
      if (!chapter) return res.status(404).json({ error: `Chapter index ${chapterIndex} not found` });

      const overviewParts: string[] = [];
      for (const e of chapter.entries || []) {
        if (typeof e === 'string') overviewParts.push(cleanTags(e));
        else if (e?.type === 'section' && /Running This Chapter/i.test(e?.name || '')) {
          for (const sub of (e.entries || []).slice(0, 2)) { if (typeof sub === 'string') overviewParts.push(cleanTags(sub)); }
        }
        if (overviewParts.length >= 4) break;
      }

      const rawEncounters: Array<{ name: string; chapter: string; creatures: Array<{ rawName: string; count: number }> }> = [];
      extractEncounters(chapter.entries || [], chapter.name, chapter.name, rawEncounters);
      const seen = new Set<string>();
      const deduped = rawEncounters.filter(e => { const key = `${e.chapter}::${e.name}`; if (seen.has(key)) return false; seen.add(key); return e.creatures.length > 0; });

      const chapterRefs = extractCreatureRefsFromObj(chapter);
      const uniqueCreatures = Array.from(new Map(chapterRefs.map(r => [r.rawName.toLowerCase(), r])).values());
      await ensureMonstersInDb(uniqueCreatures.map(r => ({ name: r.rawName, source: r.source })));
      res.json({ name: chapter.name, overview: overviewParts.join('\n\n'), encounters: deduped });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  // ── Journal encounters ──
  router.get('/journal/encounters', (req, res) => {
    const journalDir = path.join(__dirname, '..', 'journal');
    if (!fs.existsSync(journalDir)) return res.json([]);
    const encountersByLocation: Record<string, { name: string; creatures: any[] }> = {};
    for (const file of fs.readdirSync(journalDir).filter(f => !f.startsWith('.') && f.endsWith('.json'))) {
      let data: any;
      try { data = JSON.parse(fs.readFileSync(path.join(journalDir, file), 'utf-8')); }
      catch (e) { console.warn(`[journal] Skipping corrupted file ${file}:`, e); continue; }
      for (const page of data.pages || []) {
        const html = page.text?.content || '';
        for (const table of (html.match(/<table[\s\S]*?<\/table>/g) || [])) {
          if (!table.includes('Creature') || !table.includes('Count')) continue;
          for (const row of (table.match(/<tr[\s\S]*?<\/tr>/g) || [])) {
            const cells = row.match(/<td[\s\S]*?<\/td>/g);
            if (!cells || cells.length < 4) continue;
            const creatureRaw = cells[0].replace(/<[^>]*>/g, '').trim();
            const countMatch = cells[3].replace(/<[^>]*>/g, '').trim().match(/(\d+)/);
            const count = countMatch ? parseInt(countMatch[1]) : 1;
            const locationRaw = cells[4]?.replace(/<[^>]*>/g, '').trim() || 'Unknown';
            for (const loc of locationRaw.split(/[,&]+/).map((l: string) => l.trim()).filter(Boolean)) {
              const cleanLoc = loc.split(' ')[0].trim();
              if (!encountersByLocation[cleanLoc]) encountersByLocation[cleanLoc] = { name: `Motherhorn: ${cleanLoc}`, creatures: [] };
              const existing = encountersByLocation[cleanLoc].creatures.find((c: any) => c.rawName === creatureRaw);
              if (existing) existing.count = Math.max(existing.count, count);
              else encountersByLocation[cleanLoc].creatures.push({ rawName: creatureRaw, count });
            }
          }
        }
      }
    }
    res.json(Object.values(encountersByLocation));
  });

  return router;
}
