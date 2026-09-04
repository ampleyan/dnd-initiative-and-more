const SEED_CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000,
};
const SEED_SIZE: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Variable' };
const SEED_SCHOOL: Record<string, string> = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation', P: 'Conjuration' };

function seedClean(text: string): string {
  return text
    .replace(/\{@atk [^}]+\}/g, '').replace(/\{@h\}/g, '')
    .replace(/\{@dc (\d+)\}/g, 'DC $1').replace(/\{@hit (\d+)\}/g, '+$1')
    .replace(/\{@damage ([^}]+)\}/g, '$1').replace(/\{@dice ([^}|]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1').replace(/\s+/g, ' ').trim();
}

function seedEntries(entries: any[]): string {
  if (!entries || !Array.isArray(entries)) return '';
  return entries.map(e => {
    if (typeof e === 'string') return seedClean(e);
    if (typeof e !== 'object' || !e) return '';
    if (e.entries) return seedEntries(e.entries);
    if (e.items) return seedEntries(e.items);
    if (e.entry) return seedEntries([e.entry]);
    return '';
  }).filter(Boolean).join(' ');
}

function seedCR(cr: any): string {
  if (!cr) return '0';
  if (typeof cr === 'string') return cr;
  if (typeof cr === 'number') return String(cr);
  if (cr.cr) return seedCR(cr.cr);
  return '0';
}

function seedTransformMonster(m: any): any {
  const cr = seedCR(m.cr);
  const hp = m.hp?.average || 1;
  const ac = (() => { const a = m.ac?.[0]; if (!a) return 10; return typeof a === 'number' ? a : (a.ac ?? 10); })();
  const speedParts: string[] = [];
  if (m.speed?.walk !== undefined) speedParts.push(`${m.speed.walk} ft.`);
  if (m.speed?.fly) speedParts.push(`fly ${m.speed.fly} ft.`);
  if (m.speed?.swim) speedParts.push(`swim ${m.speed.swim} ft.`);
  if (m.speed?.burrow) speedParts.push(`burrow ${m.speed.burrow} ft.`);
  const sizeStr = (m.size || ['M']).map((s: string) => SEED_SIZE[s] || s).join('/');
  const typeStr = typeof m.type === 'string' ? m.type : (m.type?.type || 'unknown');
  const tags = m.type?.tags?.length ? ` (${m.type.tags.join(', ')})` : '';
  const id = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Spell parsing logic (reused)
  const stripSpellTag = (tag: string) => tag.replace(/\{@spell ([^|}]+)[^}]*\}/g, '$1').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const spells: any[] = [];
  if (m.spellcasting && Array.isArray(m.spellcasting)) {
    for (const sc of m.spellcasting) {
      if (sc.spells) {
        for (const [level, entry] of Object.entries(sc.spells as Record<string, any>)) {
          const spellList: string[] = (entry as any).spells || [];
          const label = level === '0' ? 'Cantrip' : `Level ${level}`;
          for (const s of spellList) spells.push({ name: stripSpellTag(s), category: 'spell', description: label });
        }
      }
      if (sc.will) {
        for (const s of sc.will) spells.push({ name: stripSpellTag(s), category: 'spell', description: 'At will' });
      }
      if (sc.daily) {
        for (const [key, dailySpells] of Object.entries(sc.daily as Record<string, any[]>)) {
          const times = key.replace('e', '');
          for (const s of dailySpells) spells.push({ name: stripSpellTag(s), category: 'spell', description: `${times}/day` });
        }
      }
    }
  }

  return {
    id, name: m.name, hp, maxHp: hp, ac, speed: speedParts.join(', ') || '30 ft.',
    avatar: m.hasToken ? `https://5e.tools/img/bestiary/tokens/${m.source || 'MM'}/${m.name.replace(/[/\\]/g, '')}.webp` : '',
    xp: SEED_CR_XP[cr] ?? 0, description: `${sizeStr} ${typeStr}${tags}`, cr, type: `${sizeStr} ${typeStr}${tags}`,
    source: m.source || 'MM',
    stats: { str: m.str ?? 10, dex: m.dex ?? 10, con: m.con ?? 10, int: m.int ?? 10, wis: m.wis ?? 10, cha: m.cha ?? 10 },
    actions: (m.action || []).map((a: any) => ({ name: a.name || 'Action', description: seedEntries(a.entries || []) })).filter((a: any) => a.name && a.description),
    abilities: (m.trait || []).map((t: any) => ({ name: t.name || 'Trait', description: seedEntries(t.entries || []) })).filter((a: any) => a.name && a.description),
    spells,
  };
}

const bestiaryCache = new Map<string, any[]>();

const SOURCE_TO_FILE: Record<string, string> = {
  mm: 'bestiary-mm.json', xmm: 'bestiary-xmm.json', wbtw: 'bestiary-wbtw.json',
  vgm: 'bestiary-vgm.json', mtf: 'bestiary-mtf.json', mpmm: 'bestiary-mpmm.json',
  bgdia: 'bestiary-bgdia.json', cos: 'bestiary-cos.json', dmg: 'bestiary-dmg.json',
  erlw: 'bestiary-erlw.json', ggr: 'bestiary-ggr.json', idrotf: 'bestiary-idrotf.json',
  mot: 'bestiary-mot.json', oota: 'bestiary-oota.json', pota: 'bestiary-pota.json',
  rot: 'bestiary-rot.json', skt: 'bestiary-skt.json', toa: 'bestiary-toa.json',
  tobd: 'bestiary-tobd.json', vrgr: 'bestiary-vrgr.json',
};
const BESTIARY_FALLBACK_ORDER = ['bestiary-mm.json', 'bestiary-xmm.json', 'bestiary-wbtw.json', 'bestiary-vgm.json', 'bestiary-mtf.json', 'bestiary-mpmm.json'];

async function fetchBestiaryFile(filename: string): Promise<any[]> {
  if (bestiaryCache.has(filename)) return bestiaryCache.get(filename)!;
  const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/${filename}`;
  try {
    const res = await fetch(url);
    if (!res.ok) { bestiaryCache.set(filename, []); return []; }
    const monsters: any[] = ((await res.json() as any).monster) || [];
    bestiaryCache.set(filename, monsters);
    return monsters;
  } catch { bestiaryCache.set(filename, []); return []; }
}

function seedSpellTime(time: any[]): string {
  if (!time?.length) return '1 action';
  const t = time[0];
  const unit = t.unit === 'bonus' ? 'bonus action' : t.unit;
  return `${t.number} ${unit}${t.number > 1 && !unit.endsWith('s') ? 's' : ''}${t.condition ? `, ${t.condition}` : ''}`;
}

function seedSpellRange(range: any): string {
  if (!range) return 'Self';
  if (range.type === 'special') return 'Special';
  if (range.type === 'sight') return 'Sight';
  if (range.type === 'unlimited') return 'Unlimited';
  const d = range.distance;
  if (!d) return 'Self';
  if (d.type === 'self') return 'Self';
  if (d.type === 'touch') return 'Touch';
  if (d.type === 'feet') return `${d.amount} ft.`;
  if (d.type === 'miles') return `${d.amount} mile${d.amount !== 1 ? 's' : ''}`;
  return d.type || 'Self';
}

function seedSpellComponents(c: any): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) parts.push(`M (${typeof c.m === 'string' ? c.m : c.m.text || 'material'})`);
  return parts.join(', ');
}

function seedSpellDuration(duration: any[]): string {
  if (!duration?.length) return 'Instantaneous';
  const d = duration[0];
  if (d.type === 'instant') return 'Instantaneous';
  if (d.type === 'permanent') return 'Until dispelled';
  if (d.type === 'special') return 'Special';
  if (d.type === 'timed') {
    const amt = d.duration?.amount ?? 1;
    const unit = d.duration?.type ?? 'round';
    const str = `${amt} ${unit}${amt > 1 ? 's' : ''}`;
    return d.concentration ? `Concentration, up to ${str}` : str;
  }
  return 'Instantaneous';
}

function seedTransformSpell(s: any): any {
  const id = `${s.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-${(s.source || 'PHB').toLowerCase()}`;
  const higherLevels = s.entriesHigherLevel?.[0]?.entries ? seedEntries(s.entriesHigherLevel[0].entries) : null;
  const classes = (s.classes?.fromClassList || []).map((c: any) => c.name).filter(Boolean);
  return {
    id, name: s.name, level: s.level ?? 0,
    school: SEED_SCHOOL[s.school] || s.school || 'Unknown',
    time: seedSpellTime(s.time), range: seedSpellRange(s.range),
    components: seedSpellComponents(s.components), duration: seedSpellDuration(s.duration),
    description: seedEntries(s.entries || []), higherLevels,
    classes: classes.length ? JSON.stringify(classes) : null, source: s.source || 'PHB',
  };
}

const CLASS_FILES = [
  'class-artificer.json', 'class-barbarian.json', 'class-bard.json',
  'class-cleric.json', 'class-druid.json', 'class-fighter.json',
  'class-monk.json', 'class-paladin.json', 'class-ranger.json',
  'class-rogue.json', 'class-sorcerer.json', 'class-warlock.json',
  'class-wizard.json',
];
const CLASS_CDN = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class/';

function flattenEntries(entries: any[]): string {
  if (!entries) return '';
  return entries.map((e: any) => {
    if (typeof e === 'string') return e.replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1');
    if (typeof e !== 'object' || !e) return '';
    const name = e.name ? `${e.name}: ` : '';
    if (e.entries) return name + flattenEntries(e.entries);
    if (e.items) return name + flattenEntries(e.items);
    if (e.entry) return name + flattenEntries([e.entry]);
    if (e.rows) return name + (e.rows as any[][]).map(r => r.join(' | ')).join('\n');
    return '';
  }).filter(Boolean).join(' ');
}

function parseClassFile(json: any): any[] {
  const PRIORITY = ['XPHB', 'XMM'];
  const seen = new Map<string, any>();
  const processFeature = (f: any, isSubclass: boolean) => {
    if (!f.name || !f.className || f.isClassFeatureVariant) return;
    const feature = {
      id: `${f.className}-${f.subclassShortName ?? ''}-${f.name}-${f.level ?? 1}-${f.source ?? 'PHB'}`.replace(/\s+/g, '_').toLowerCase(),
      name: f.name, className: f.className, classSource: f.classSource ?? f.source ?? 'PHB',
      level: f.level ?? 1, source: f.source ?? 'PHB', description: flattenEntries(f.entries ?? []),
      subclassName: f.subclassShortName ?? null, isSubclass: isSubclass ? 1 : 0,
    };
    const key = `${f.className}|${f.subclassShortName ?? ''}|${f.name}|${f.level ?? 1}`;
    const existing = seen.get(key);
    if (!existing || (PRIORITY.includes(feature.source) && !PRIORITY.includes(existing.source))) seen.set(key, feature);
  };
  (json.classFeature ?? []).forEach((f: any) => processFeature(f, false));
  (json.subclassFeature ?? []).forEach((f: any) => processFeature(f, true));
  return Array.from(seen.values());
}

export function createSeedFunctions(db: any, dbAvailable: boolean) {
  async function seedClassFeatures() {
    if (!dbAvailable) return;
    const count = (db.prepare('SELECT COUNT(*) as c FROM class_features').get() as any)?.c ?? 0;
    if (count > 0) return;
    console.log('[seed] No class features found — fetching from 5etools CDN…');
    const insert = db.prepare(`INSERT OR REPLACE INTO class_features (id, name, className, classSource, level, source, description, subclassName, isSubclass) VALUES (@id, @name, @className, @classSource, @level, @source, @description, @subclassName, @isSubclass)`);
    const tx = db.transaction((features: any[]) => { for (const f of features) insert.run(f); });
    let total = 0;
    for (const file of CLASS_FILES) {
      try {
        const res = await fetch(`${CLASS_CDN}${file}`);
        if (!res.ok) { console.warn(`[seed] Skipped ${file}: HTTP ${res.status}`); continue; }
        const features = parseClassFile(await res.json());
        tx(features);
        total += features.length;
        console.log(`[seed] ${file}: ${features.length} features`);
      } catch (e) { console.warn(`[seed] Failed to fetch ${file}:`, e); }
    }
    console.log(`[seed] Class features seeded: ${total} total`);
  }
  async function ensureMonstersInDb(creatures: Array<{ name: string; source?: string }>): Promise<number> {
    if (!dbAvailable || creatures.length === 0) return 0;
    const ins = db.prepare(`INSERT OR IGNORE INTO monsters (id,name,hp,maxHp,ac,speed,avatar,xp,description,cr,type,source,stats,actions,abilities) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const toFind = creatures.map(c => ({
      name: c.name, source: c.source,
      id: c.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
    })).filter(c => !db.prepare('SELECT 1 FROM monsters WHERE id = ? OR name = ?').get(c.id, c.name));
    if (toFind.length === 0) return 0;

    const byFile = new Map<string, typeof toFind>();
    const unknownSource: typeof toFind = [];
    for (const c of toFind) {
      const fileKey = c.source ? SOURCE_TO_FILE[c.source.toLowerCase()] : undefined;
      if (fileKey) { const list = byFile.get(fileKey) ?? []; list.push(c); byFile.set(fileKey, list); }
      else unknownSource.push(c);
    }

    let inserted = 0;
    const insertMonster = (raw: any) => {
      try {
        const t = seedTransformMonster(raw);
        ins.run(t.id, t.name, t.hp, t.maxHp, t.ac, t.speed, t.avatar, t.xp, t.description, t.cr, t.type, t.source, JSON.stringify(t.stats), JSON.stringify(t.actions), JSON.stringify(t.abilities));
        inserted++;
        return true;
      } catch { return false; }
    };

    for (const [filename, needed] of byFile) {
      const monsters = await fetchBestiaryFile(filename);
      const byName = new Map(monsters.map((m: any) => [m.name.toLowerCase(), m]));
      for (const c of needed) { const raw = byName.get(c.name.toLowerCase()); if (raw) insertMonster(raw); }
    }

    if (unknownSource.length > 0) {
      const stillMissing = unknownSource.filter(c => !db.prepare('SELECT 1 FROM monsters WHERE id = ? OR name = ?').get(c.id, c.name));
      if (stillMissing.length > 0) {
        for (const filename of BESTIARY_FALLBACK_ORDER) {
          if (stillMissing.every(c => !!db.prepare('SELECT 1 FROM monsters WHERE id = ? OR name = ?').get(c.id, c.name))) break;
          const monsters = await fetchBestiaryFile(filename);
          const byName = new Map(monsters.map((m: any) => [m.name.toLowerCase(), m]));
          for (const c of stillMissing) {
            if (db.prepare('SELECT 1 FROM monsters WHERE id = ? OR name = ?').get(c.id, c.name)) continue;
            const raw = byName.get(c.name.toLowerCase());
            if (raw) insertMonster(raw);
          }
        }
      }
    }

    if (inserted > 0) console.log(`[ensureMonsters] Auto-imported ${inserted} missing monster(s)`);
    return inserted;
  }

  async function autoSeedIfEmpty() {
    if (!dbAvailable) return;
    const monsterCount = (db.prepare('SELECT COUNT(*) as n FROM monsters').get() as any).n;
    if (monsterCount === 0) {
      console.log('[seed] Importing monsters from MM, MM 2025, and WBTW...');
      const ins = db.prepare(`INSERT OR REPLACE INTO monsters (id,name,hp,maxHp,ac,speed,avatar,xp,description,cr,type,source,stats,actions,abilities) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const file of ['bestiary-mm.json', 'bestiary-xmm.json', 'bestiary-wbtw.json']) {
        const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/${file}`;
        const res = await fetch(url).catch(() => null);
        if (!res?.ok) { console.log(`[seed] Skipped ${file} (${res?.status ?? 'network error'})`); continue; }
        const data = await res.json() as any;
        const eligible = (data.monster || []).filter((m: any) => ['MM', 'XMM', 'WBtW'].includes(m.source || ''));
        let count = 0;
        db.transaction((list: any[]) => {
          for (const m of list) {
            try { const t = seedTransformMonster(m); ins.run(t.id, t.name, t.hp, t.maxHp, t.ac, t.speed, t.avatar, t.xp, t.description, t.cr, t.type, t.source, JSON.stringify(t.stats), JSON.stringify(t.actions), JSON.stringify(t.abilities)); count++; } catch {}
          }
        })(eligible);
        console.log(`[seed]   ${count} monsters from ${file}`);
      }
    }

    const spellCount = (db.prepare('SELECT COUNT(*) as n FROM spells').get() as any).n;
    if (spellCount === 0) {
      console.log('[seed] Importing spells (2024 XPHB preferred, PHB 2014 fallback for missing)...');
      const ins = db.prepare(`INSERT OR REPLACE INTO spells (id,name,level,school,time,range,components,duration,description,higherLevels,classes,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
      const SPELL_CDN = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/';

      const fetchSpellFile = async (file: string): Promise<any[]> => {
        const res = await fetch(`${SPELL_CDN}${file}`).catch(() => null);
        if (!res?.ok) { console.log(`[seed] Skipped ${file} (${res?.status ?? 'network error'})`); return []; }
        return ((await res.json() as any).spell || []);
      };

      // Build a name→spell map: load PHB first, then overwrite with XPHB (2024 preferred)
      const byName = new Map<string, any>();
      for (const spell of await fetchSpellFile('spells-phb.json')) byName.set(spell.name.toLowerCase(), spell);
      for (const spell of await fetchSpellFile('spells-xphb.json')) byName.set(spell.name.toLowerCase(), spell);

      let count = 0;
      db.transaction((list: any[]) => {
        for (const s of list) {
          try { const t = seedTransformSpell(s); ins.run(t.id, t.name, t.level, t.school, t.time, t.range, t.components, t.duration, t.description, t.higherLevels, t.classes, t.source); count++; } catch {}
        }
      })([...byName.values()]);
      console.log(`[seed]   ${count} spells (deduplicated: 2024 versions preferred)`);
    }

    const DEFAULT_PARTY_IDS = ['153118837', '153118241', '153117278', '153116510', '155606059'];
    const playerIds = process.env.SEED_PLAYER_IDS
      ? process.env.SEED_PLAYER_IDS.split(',').map(s => s.trim()).filter(Boolean)
      : DEFAULT_PARTY_IDS;
    const cobalt = process.env.SEED_DDB_COBALT || '';
    if (cobalt) {
      const playerCount = (db.prepare('SELECT COUNT(*) as n FROM players').get() as any).n;
      if (playerCount === 0) {
        console.log(`[seed] Importing ${playerIds.length} player(s) from D&D Beyond...`);
        for (const charId of playerIds) {
          try {
            const charRes = await fetch(`http://localhost:3000/api/dnd-beyond/character/${charId}`, { headers: { 'x-cobalt-session': cobalt } });
            if (!charRes.ok) { console.log(`[seed]   Skipped character ${charId} (${charRes.status})`); continue; }
            const charData = await charRes.json();
            const saveRes = await fetch('http://localhost:3000/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(charData) });
            if (saveRes.ok) console.log(`[seed]   Imported: ${charData.name}`);
            else console.log(`[seed]   Failed to save ${charData.name}: ${saveRes.status}`);
          } catch (e: any) { console.log(`[seed]   Error importing character ${charId}: ${e.message}`); }
        }
      }
    }
  }

  return { ensureMonstersInDb, autoSeedIfEmpty, seedClassFeatures };
}
