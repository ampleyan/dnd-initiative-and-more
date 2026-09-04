import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const DB_CACHE_DIR = '/tmp/foundry-db-cache';
const DB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedDbPath(originalPath: string): string {
  const hash = originalPath.replace(/[^a-z0-9]/gi, '_');
  return path.join(DB_CACHE_DIR, hash);
}

function refreshDbCache(originalPath: string): string {
  const cachePath = getCachedDbPath(originalPath);
  const stampFile = cachePath + '.stamp';

  if (fs.existsSync(stampFile)) {
    const age = Date.now() - parseInt(fs.readFileSync(stampFile, 'utf-8') || '0');
    if (age < DB_CACHE_TTL_MS) {
      console.log(`[foundry] using cached DB (${Math.round(age / 1000)}s old): ${cachePath}`);
      return cachePath;
    }
  }

  console.log(`[foundry] copying DB to cache: ${originalPath} → ${cachePath}`);
  fs.mkdirSync(DB_CACHE_DIR, { recursive: true });
  if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true });

  // Copy SSTable (.ldb) and manifest files only — skip LOCK and active WAL (.log)
  // files which may be mid-write and cause recovery failures when opened by a
  // second process.
  fs.mkdirSync(cachePath, { recursive: true });
  for (const file of fs.readdirSync(originalPath)) {
    if (file === 'LOCK') continue;
    if (file.endsWith('.log')) continue; // skip active WAL logs
    const srcFile = path.join(originalPath, file);
    if (!fs.statSync(srcFile).isFile()) continue; // skip sockets, dirs, etc.
    fs.copyFileSync(srcFile, path.join(cachePath, file));
  }
  // Write an empty CURRENT-compatible log so LevelDB doesn't complain about
  // missing log files referenced in the MANIFEST.
  // (LevelDB opens fine with no .log as long as the MANIFEST is consistent.)

  fs.writeFileSync(stampFile, String(Date.now()));
  console.log(`[foundry] DB cache ready: ${cachePath}`);
  return cachePath;
}

const FOUNDRY_DATA_PATH = process.env.FOUNDRY_DATA_PATH || path.join(process.cwd(), 'foundry');
let PORTRAITS_DIR = '';

function resolveFoundryPath(p: string | undefined): string {
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
  return `/api/foundry/file?p=${encodeURIComponent(p)}`;
}

/** Copy a Foundry portrait to the local uploads/portraits dir and return its stable URL. */
function copyFoundryPortrait(imgPath: string | undefined, dataPathOverride: string | undefined): string {
  if (!imgPath) return '';
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:')) return imgPath;

  const basePath = dataPathOverride || FOUNDRY_DATA_PATH;
  const srcAbs = path.resolve(path.join(basePath, imgPath));
  if (!srcAbs.startsWith(path.resolve(basePath) + path.sep)) return resolveFoundryPath(imgPath); // path-traversal guard

  if (!fs.existsSync(srcAbs)) return resolveFoundryPath(imgPath);

  try {
    if (!fs.existsSync(PORTRAITS_DIR)) fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
    const ext = path.extname(imgPath) || '.webp';
    // Use a stable filename based on the relative path so re-imports overwrite the same file
    const safeName = imgPath.replace(/[^a-z0-9._-]/gi, '_').slice(-100);
    const dest = path.join(PORTRAITS_DIR, safeName);
    fs.copyFileSync(srcAbs, dest);
    return `/uploads/portraits/${safeName}`;
  } catch (e) {
    console.warn('[foundry] portrait copy failed, using proxy:', (e as Error).message);
    return resolveFoundryPath(imgPath);
  }
}

async function readScenes(dbPath: string): Promise<any[]> {
  const db = await openLevel(dbPath);
  try {
    const scenes: any[] = [];
    for await (const [key, value] of db.iterator()) {
      if (!key.startsWith('!scenes!')) continue;
      const v = value as any;
      if (!v.name) continue;
      scenes.push({
        id: v._id,
        name: v.name,
        active: v.active ?? false,
        backgroundImg: resolveFoundryPath(v.background?.src ?? v.img ?? ''),
        playlistSound: v.playlist?.sound?.path ? resolveFoundryPath(v.playlist.sound.path) : null,
        width: v.width,
        height: v.height,
      });
    }
    await db.close();
    return scenes.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || a.name.localeCompare(b.name));
  } catch (e) {
    try { await db.close(); } catch {}
    throw e;
  }
}

async function readPlaylists(dbPath: string): Promise<any[]> {
  const db = await openLevel(dbPath);
  try {
    const playlists: any[] = [];
    const playlistMap = new Map<string, any>();

    for await (const [key, value] of db.iterator()) {
      if (!key.startsWith('!playlists!')) continue;
      const v = value as any;
      if (!v.name) continue;
      playlistMap.set(v._id, {
        id: v._id,
        name: v.name,
        description: v.description ?? '',
        sounds: []
      });
    }

    // Load embedded sounds
    for (const [id, playlist] of playlistMap.entries()) {
      const prefix = `!playlists.sounds!${id}.`;
      for await (const [, sound] of db.iterator({ gte: prefix, lte: prefix + '~' })) {
        const s = sound as any;
        if (!s.path) continue;
        playlist.sounds.push({
          id: s._id,
          name: s.name,
          path: s.path,
          url: resolveFoundryPath(s.path),
          volume: s.volume ?? 0.5,
          repeat: s.repeat ?? false
        });
      }
      if (playlist.sounds.length > 0) {
        playlists.push(playlist);
      }
    }

    await db.close();
    return playlists.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    try { await db.close(); } catch {}
    throw e;
  }
}

const SIZE_MAP: Record<string, string> = {
  tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large',
  huge: 'Huge', grg: 'Gargantuan',
};

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const SCHOOL_MAP: Record<string, string> = {
  abj: 'Abjuration', con: 'Conjuration', div: 'Divination', enc: 'Enchantment',
  evo: 'Evocation', ill: 'Illusion', nec: 'Necromancy', trs: 'Transmutation',
};

/** Strip HTML and convert Foundry inline-roll syntax to plain readable text.
 *  [[/r 1d20+6]]{+6}                    → +6
 *  [[/r 1d20+6]]                         → 1d20+6
 *  [[/damage 4d6 + 3 type=necrotic]]     → 4d6 + 3 necrotic
 *  [[/damage 4d6 + 3]]                   → 4d6 + 3
 *  Any remaining [[...]]                 → stripped
 */
function cleanFoundryDesc(html: string): string {
  return (html ?? '')
    // Labelled inline rolls: [[...]]{ label } → label
    .replace(/\[\[[^\]]*\]\]\{([^}]+)\}/g, '$1')
    // /damage with type: [[/damage FORMULA type=TYPE]] → FORMULA TYPE
    .replace(/\[\[\/damage\s+(.*?)\s+type=(\w+)\]\]/gi, (_, formula, type) => `${formula.trim()} ${type}`)
    // /damage without type: [[/damage FORMULA]] → FORMULA
    .replace(/\[\[\/damage\s+(.*?)\]\]/gi, (_, formula) => formula.trim())
    // /r or /roll: [[/r FORMULA]] → FORMULA
    .replace(/\[\[\/r(?:oll)?\s+(.*?)\]\]/gi, (_, formula) => formula.trim())
    // Any remaining [[...]] inline content
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    // Strip HTML tags
    .replace(/<[^>]+>/g, ' ')
    // HTML entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Convert a Foundry embedded spell item into a MonsterAction for the spells array.
 *  Prepends "[Nth-level / Cantrip] [School]." so the description is self-contained. */
function spellItemToAction(item: any): { name: string; description: string; category: 'spell' } {
  const sys = item.system ?? {};
  const level: number = sys.level ?? 0;
  const schoolKey: string = sys.school ?? '';
  const school = SCHOOL_MAP[schoolKey] ?? (schoolKey ? schoolKey.charAt(0).toUpperCase() + schoolKey.slice(1) : '');
  const levelLabel = level === 0 ? 'Cantrip' : `${ordinal(level)}-level`;
  const prefix = school ? `${levelLabel} ${school}.` : `${levelLabel} spell.`;
  const body = cleanFoundryDesc(sys.description?.value ?? '');
  const description = body ? `${prefix} ${body}` : prefix;
  return { name: item.name, description, category: 'spell' };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatCR(cr: number | string): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr ?? '0');
}

function formatSpeed(movement: any): string {
  if (!movement) return '30 ft.';
  const parts: string[] = [];
  if (movement.walk) parts.push(`${movement.walk} ft.`);
  if (movement.fly) parts.push(`fly ${movement.fly} ft.`);
  if (movement.swim) parts.push(`swim ${movement.swim} ft.`);
  if (movement.burrow) parts.push(`burrow ${movement.burrow} ft.`);
  if (movement.climb) parts.push(`climb ${movement.climb} ft.`);
  return parts.join(', ') || '30 ft.';
}

function getTypeStr(details: any, traits: any): string {
  const size = SIZE_MAP[traits?.size ?? 'med'] ?? 'Medium';
  const type = details?.type?.value ?? 'unknown';
  const sub = details?.type?.subtype ? ` (${details.type.subtype})` : '';
  return `${size} ${type}${sub}`;
}

function transformFoundryActor(actor: any, items: any[], dataPathOverride?: string): any {
  const sys = actor.system ?? {};
  const abilities = sys.abilities ?? {};
  const attrs = sys.attributes ?? {};
  const details = sys.details ?? {};
  const traits = sys.traits ?? {};

  const dex = abilities.dex?.value ?? 10;
  const dexMod = Math.floor((dex - 10) / 2);

  // AC: flat override → Foundry-calculated value (PCs) → equipped armor base + dex → dex fallback
  let ac = 10 + dexMod;
  if (attrs.ac?.flat != null) {
    ac = attrs.ac.flat;
  } else if (attrs.ac?.value != null) {
    ac = attrs.ac.value;
  } else {
    const armorItem = items.find(i => i.type === 'equipment' && i.system?.equipped && i.system?.armor?.value);
    if (armorItem) ac = (armorItem.system.armor.value as number) + (armorItem.system.armor.dex !== false ? dexMod : 0);
  }

  const hp = attrs.hp?.max ?? attrs.hp?.value ?? 1;
  const cr = formatCR(details.cr ?? 0);
  const typeStr = getTypeStr(details, traits);

  // Extract damage vulnerabilities / resistances / immunities + condition immunities
  const extractTraitList = (traitObj: any): string[] => {
    if (!traitObj) return [];
    const vals: string[] = Array.isArray(traitObj.value) ? traitObj.value : [];
    const custom: string = traitObj.custom ?? '';
    const fromCustom = custom.split(';').map((s: string) => s.trim()).filter(Boolean);
    return [...vals, ...fromCustom];
  };

  const vulnerabilities = extractTraitList(traits.dv);
  const resistances = extractTraitList(traits.dr);
  const damageImmunities = extractTraitList(traits.di);
  const conditionImmunities = extractTraitList(traits.ci);

  // Actions from embedded items — weapons/feats only; spells go in their own array below
  const actions = items
    .filter(i => (i.type === 'weapon' || i.type === 'feat') && i.name)
    .map(i => ({
      name: i.name,
      description: cleanFoundryDesc(i.system?.description?.value ?? ''),
      category: (i.type === 'weapon' ? 'attack' : 'ability') as 'attack' | 'ability',
    }))
    .filter(a => a.description);

  const spells = items
    .filter(i => i.type === 'spell' && i.name)
    .map(i => spellItemToAction(i))
    .filter(s => s.description);

  // Class info for PCs: build subtitle ("Ranger 5") and extract total level
  const classItems = items.filter(i => i.type === 'class' && i.name && i.system?.levels);
  const classSubtitle = classItems.length > 0
    ? classItems.map((c: any) => `${c.name} ${c.system.levels}`).join(' / ')
    : undefined;
  const totalLevel = classItems.length > 0
    ? classItems.reduce((sum: number, c: any) => sum + (c.system.levels ?? 0), 0)
    : undefined;

  // Spell slots: try Foundry sys.spells first, fall back to class-based computation
  const sysSpells = sys.spells ?? {};
  const foundrySlotEntries = Object.entries(sysSpells)
    .map(([key, slot]: [string, any]) => {
      const match = key.match(/^spell(\d+)$/);
      if (!match || !(slot?.max > 0)) return null;
      return [Number(match[1]), { total: slot.max as number, used: Math.max(0, (slot.max - (slot.value ?? slot.max)) as number) }] as const;
    })
    .filter((e): e is [number, { total: number; used: number }] => e !== null);
  const spellSlots = foundrySlotEntries.length > 0
    ? Object.fromEntries(foundrySlotEntries)
    : (totalLevel != null ? computeSpellSlots(totalLevel, classItems.map((c: any) => c.name)) : undefined);

  const id = (actor.name as string).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const source = actor.flags?.plutonium?.source ?? actor.flags?.['scene-packer']?.name ?? 'foundry';

  return {
    id,
    name: actor.name,
    hp,
    maxHp: hp,
    ac,
    speed: formatSpeed(attrs.movement),
    avatar: copyFoundryPortrait(actor.img, dataPathOverride),
    description: classSubtitle ?? typeStr,
    subtitle: classSubtitle,
    level: totalLevel,
    cr,
    type: typeStr,
    source,
    stats: {
      str: abilities.str?.value ?? 10,
      dex,
      con: abilities.con?.value ?? 10,
      int: abilities.int?.value ?? 10,
      wis: abilities.wis?.value ?? 10,
      cha: abilities.cha?.value ?? 10,
    },
    vulnerabilities,
    resistances,
    damageImmunities,
    conditionImmunities,
    actions,
    abilities: [],
    spells: spells.length > 0 ? spells : undefined,
    spellSlots,
  };
}

function transformFoundrySpell(item: any): any {
  const sys = item.system ?? {};
  const comps = sys.components ?? {};
  const hasV = comps.vocal ?? false;
  const hasS = comps.somatic ?? false;
  const hasM = comps.material ?? false;
  const materialValue = comps.value ?? sys.materials?.value ?? '';

  const compParts: string[] = [];
  if (hasV) compParts.push('V');
  if (hasS) compParts.push('S');
  if (hasM) compParts.push('M');
  const components = compParts.join(', ') + (materialValue ? ` (${materialValue})` : '');

  const rangeVal = sys.range?.value;
  const rangeUnit = sys.range?.units;
  let range = 'Self';
  if (rangeUnit === 'touch') range = 'Touch';
  else if (rangeUnit === 'spec') range = 'Special';
  else if (rangeVal && rangeUnit === 'ft') range = `${rangeVal} ft.`;
  else if (rangeVal) range = `${rangeVal} ${rangeUnit ?? ''}`.trim();

  const activationType = sys.activation?.type ?? 'action';
  const activationCost = sys.activation?.cost ?? 1;
  const time = activationType === 'action' ? '1 action' :
    activationType === 'bonus' ? '1 bonus action' :
    activationType === 'reaction' ? '1 reaction' :
    `${activationCost} ${activationType}`;

  const durVal = sys.duration?.value;
  const durUnit = sys.duration?.units;
  let duration = 'Instantaneous';
  if (durUnit === 'inst' || !durUnit) duration = 'Instantaneous';
  else if (durUnit === 'perm') duration = 'Until dispelled';
  else if (durUnit === 'spec') duration = 'Special';
  else if (durVal && durUnit) duration = `${durVal} ${durUnit}`;

  const id = `foundry-${(item._id ?? item.name ?? 'spell').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;

  const school = SCHOOL_MAP[sys.school] ?? (sys.school ? sys.school.charAt(0).toUpperCase() + sys.school.slice(1) : 'Unknown');

  return {
    id,
    name: item.name,
    level: sys.level ?? 0,
    school,
    time,
    range,
    components: components || '—',
    duration,
    description: cleanFoundryDesc(sys.description?.value ?? ''),
    higherLevels: sys.scaling?.formula ? cleanFoundryDesc(sys.scaling.formula) : undefined,
    source: item.flags?.plutonium?.source ?? item.flags?.['scene-packer']?.name ?? 'Foundry',
  };
}

const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1:[2],2:[3,2],3:[4,3,2],4:[4,3,3,1],5:[4,3,3,2,1],6:[4,3,3,3,1,1],7:[4,3,3,3,2,1,1],
  8:[4,3,3,3,2,2,1,1],9:[4,3,3,3,2,2,1,1,1],10:[4,3,3,3,2,2,2,1,1],
  11:[4,3,3,3,2,2,2,1,1],12:[4,3,3,3,2,2,2,1,1],13:[4,3,3,3,2,2,2,1,1,1],
  14:[4,3,3,3,2,2,2,1,1,1],15:[4,3,3,3,2,2,2,1,1,2],16:[4,3,3,3,2,2,2,1,1,2],
  17:[4,3,3,3,2,2,2,1,1,2],18:[4,3,3,3,3,2,2,1,1,2],19:[4,3,3,3,3,2,2,2,1,2],20:[4,3,3,3,3,2,2,2,2,2],
};
const HALF_CASTER_SLOTS: Record<number, number[]> = {
  2:[2],3:[3],4:[3],5:[4,2],6:[4,2],7:[4,3,2],8:[4,3,2],9:[4,3,3,1],10:[4,3,3,1],
  11:[4,3,3,2,1],12:[4,3,3,2,1],13:[4,3,3,2,1,1],14:[4,3,3,2,1,1],15:[4,3,3,2,1,1,1],
  16:[4,3,3,2,1,1,1],17:[4,3,3,2,1,1,1,1],18:[4,3,3,2,1,1,1,1],19:[4,3,3,2,1,1,1,1,1],20:[4,3,3,2,1,1,1,1,1,1],
};
const WARLOCK_SLOTS: Record<number, { slots: number; level: number }> = {
  1:{slots:1,level:1},2:{slots:2,level:1},3:{slots:2,level:2},4:{slots:2,level:2},
  5:{slots:2,level:3},6:{slots:2,level:3},7:{slots:2,level:4},8:{slots:2,level:4},
  9:{slots:2,level:5},10:{slots:2,level:5},11:{slots:3,level:5},12:{slots:3,level:5},
  13:{slots:3,level:5},14:{slots:3,level:5},15:{slots:3,level:5},16:{slots:3,level:5},
  17:{slots:4,level:5},18:{slots:4,level:5},19:{slots:4,level:5},20:{slots:4,level:5},
};

function computeSpellSlots(level: number, classNames: string[]): Record<number, { total: number; used: number }> | undefined {
  const names = classNames.map(n => n.toLowerCase());
  const classLevels: Record<string, number> = {};
  // classNames may include level, e.g. ["Barbarian", "Warlock"] from items
  // but we get actual levels from class items separately — here level = total level passed in
  const isFullCaster = names.some(n => ['bard','cleric','druid','sorcerer','wizard'].includes(n));
  const isHalfCaster = names.some(n => ['paladin','ranger'].includes(n));
  const isWarlock = names.some(n => n === 'warlock');
  if (!isFullCaster && !isHalfCaster && !isWarlock) return undefined;

  const slots: Record<number, { total: number; used: number }> = {};

  if (isWarlock) {
    // Use warlock class level specifically if we can, else total level
    const w = WARLOCK_SLOTS[Math.min(level, 20)];
    if (w) slots[w.level] = { total: w.slots, used: 0 };
  }
  if (isFullCaster || isHalfCaster) {
    const table = isFullCaster ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS;
    const row = table[Math.min(level, 20)];
    if (row) row.forEach((total, i) => { if (total > 0) slots[i + 1] = { total, used: 0 }; });
  }
  return Object.keys(slots).length > 0 ? slots : undefined;
}

function transformFoundryCharacter(actor: any, items: any[], dataPathOverride?: string): any {
  const sys = actor.system ?? {};
  const abilities = sys.abilities ?? {};
  const attrs = sys.attributes ?? {};
  const details = sys.details ?? {};

  const dex = abilities.dex?.value ?? 10;
  const wis = abilities.wis?.value ?? 10;

  const dexMod = Math.floor((dex - 10) / 2);
  let ac = 10 + dexMod;
  const acFlat = attrs.ac?.flat;
  const acValue = attrs.ac?.value;
  if (acFlat != null && acFlat >= 8) ac = acFlat;
  else if (acValue != null && acValue >= 8) ac = acValue;
  else {
    const armorItem = items.find(i => i.type === 'equipment' && i.system?.equipped && i.system?.armor?.value);
    if (armorItem) ac = (armorItem.system.armor.value as number) + (armorItem.system.armor.dex !== false ? dexMod : 0);
  }

  const hpObj = attrs.hp ?? {};
  const hp = (hpObj.max && hpObj.max > 0) ? hpObj.max
    : (hpObj.value && hpObj.value > 0) ? hpObj.value
    : (hpObj.effectiveMax && hpObj.effectiveMax > 0) ? hpObj.effectiveMax
    : (hpObj._max && hpObj._max > 0) ? hpObj._max
    : 1;
  const speed = formatSpeed(attrs.movement ?? {});

  const classItems = items.filter(i => i.type === 'class');
  const className = classItems.map((i: any) => i.name).join('/') || details.class || '';
  const level = details.level
    ?? details.totalLevel
    ?? (classItems.reduce((sum: number, i: any) => sum + (i.system?.levels ?? i.system?.level ?? 0), 0) || 1);

  const actions = items
    .filter(i => i.type === 'weapon' && i.name && i.system?.equipped)
    .map(i => ({
      name: i.name,
      description: cleanFoundryDesc(i.system?.description?.value ?? ''),
      category: 'attack' as const,
    }))
    .filter((a: any) => a.description);

  const abilitiesList = items
    .filter(i => i.type === 'feat' && i.name)
    .map(i => ({
      name: i.name,
      description: cleanFoundryDesc(i.system?.description?.value ?? ''),
      category: 'ability' as const,
    }))
    .filter((a: any) => a.description);

  const spellsList = items
    .filter(i => i.type === 'spell' && i.name)
    .map(i => spellItemToAction(i))
    .filter((a: any) => a.description);

  // Spell slots: try Foundry sys.spells first (persisted usage), fall back to class-based computation
  const sysSpells = sys.spells ?? {};
  const foundrySlotEntries = Object.entries(sysSpells)
    .map(([key, slot]: [string, any]) => {
      const match = key.match(/^spell(\d+)$/);
      if (!match || !(slot?.max > 0)) return null;
      return [Number(match[1]), { total: slot.max as number, used: Math.max(0, (slot.max - (slot.value ?? slot.max)) as number) }] as const;
    })
    .filter((e): e is [number, { total: number; used: number }] => e !== null);
  const spellSlots = foundrySlotEntries.length > 0
    ? Object.fromEntries(foundrySlotEntries)
    : computeSpellSlots(level, classItems.map((c: any) => c.name));

  return {
    name: actor.name,
    dndBeyondId: `foundry:${actor._id}`,
    hp_max: hp,
    ac,
    speed,
    level,
    subtitle: className ? `Level ${level} ${className}` : `Level ${level}`,
    avatar: copyFoundryPortrait(actor.img, dataPathOverride),
    class: className,
    source: 'manual',
    stats: {
      str: abilities.str?.value ?? 10,
      dex,
      con: abilities.con?.value ?? 10,
      int: abilities.int?.value ?? 10,
      wis,
      cha: abilities.cha?.value ?? 10,
    },
    passivePerception: 10 + Math.floor((wis - 10) / 2),
    actions,
    abilities: abilitiesList,
    spells: spellsList,
    spellSlots,
  };
}

async function readSpells(dbPath: string, opts: {
  search?: string;
  offset: number;
  limit: number;
}): Promise<{ spells: any[]; total: number }> {
  const db = await openLevel(dbPath);
  try {
    const allSpells: any[] = [];
    for await (const [key, value] of db.iterator()) {
      if (!key.startsWith('!items!')) continue;
      const v = value as any;
      if (v.type !== 'spell') continue;
      if (!v.name) continue;
      if (opts.search && !v.name.toLowerCase().includes(opts.search.toLowerCase())) continue;
      allSpells.push(v);
    }
    allSpells.sort((a, b) => (a.system?.level ?? 0) - (b.system?.level ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));
    const total = allSpells.length;
    const page = allSpells.slice(opts.offset, opts.offset + opts.limit);
    await db.close();
    return { spells: page.map(transformFoundrySpell), total };
  } catch (e) {
    try { await db.close(); } catch {}
    throw e;
  }
}

async function readJournals(dbPath: string, opts: {
  search?: string;
  ids?: string[];
  full: boolean;
}): Promise<any[]> {
  const db = await openLevel(dbPath);
  try {
    const idSet = opts.ids && opts.ids.length > 0 ? new Set(opts.ids) : null;
    const journals = new Map<string, any>();

    for await (const [key, value] of db.iterator()) {
      const v = value as any;

      if (key.startsWith('!journal!') && !key.includes('.', 9)) {
        // Top-level journal entry: !journal!<id>
        if (!v.name) continue;
        if (idSet && !idSet.has(v._id)) continue;
        if (opts.search && !v.name.toLowerCase().includes(opts.search.toLowerCase())) continue;
        journals.set(v._id, { _id: v._id, name: v.name, folder: v.folder, pages: [] });

      } else if (opts.full && key.startsWith('!journal.pages!')) {
        // Page entry: !journal.pages!<journalId>.<pageId>
        const after = key.slice('!journal.pages!'.length);
        const dot = after.indexOf('.');
        if (dot === -1) continue;
        const journalId = after.slice(0, dot);
        if (idSet && !idSet.has(journalId)) continue;
        if (!journals.has(journalId)) {
          // Journal entry not loaded yet (may come later); stash for second pass
          journals.set(journalId, { _id: journalId, name: '', pages: [] });
        }
        if (v.type === 'text') {
          journals.get(journalId)!.pages.push({
            _id: v._id,
            name: v.name,
            sort: v.sort ?? 0,
            text: { content: v.text?.content ?? '', format: v.text?.format ?? 1 },
          });
        }
      }
    }

    await db.close();
    const result = [...journals.values()]
      .filter(j => j.name) // drop stubs with no journal entry loaded
      .map(j => ({ ...j, pages: j.pages.sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0)) }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return result;
  } catch (e) {
    try { await db.close(); } catch {}
    throw e;
  }
}


async function openLevel(dbPath: string) {
  const { ClassicLevel } = await import('classic-level');
  const effectivePath = refreshDbCache(dbPath);
  const db = new ClassicLevel(effectivePath, { valueEncoding: 'json' });
  try {
    await db.open();
  } catch (e: any) {
    console.error('[foundry] db.open() failed:', e.message);
    // If open failed, invalidate cache so next request rebuilds it
    const stampFile = effectivePath + '.stamp';
    try { fs.unlinkSync(stampFile); } catch {}
    throw e;
  }
  return db;
}

function getWorldsDir(dataPathOverride?: string) {
  const base = dataPathOverride || FOUNDRY_DATA_PATH;
  const worldsDirect = path.join(base, 'worlds');
  if (!fs.existsSync(worldsDirect)) {
    const worldsWithData = path.join(base, 'Data', 'worlds');
    if (fs.existsSync(worldsWithData)) return worldsWithData;
  }
  return worldsDirect;
}

function listWorlds(dataPath?: string): Array<{ id: string; title: string; system: string; lastPlayed: string }> {
  const worldsDir = getWorldsDir(dataPath);
  if (!fs.existsSync(worldsDir)) return [];
  return fs.readdirSync(worldsDir)
    .filter(name => {
      const jsonPath = path.join(worldsDir, name, 'world.json');
      return fs.existsSync(jsonPath);
    })
    .map(name => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(worldsDir, name, 'world.json'), 'utf-8'));
        return { id: name, title: meta.title ?? name, system: meta.system ?? '', lastPlayed: meta.lastPlayed ?? '' };
      } catch { return { id: name, title: name, system: '', lastPlayed: '' }; }
    });
}

function listPacks(worldId: string, dataPath?: string, types: string[] = ['Actor']): Array<{ id: string; label: string; type: string }> {
  const packsDir = path.join(getWorldsDir(dataPath), worldId, 'packs');
  if (!fs.existsSync(packsDir)) return [];
  const worldJson = path.join(getWorldsDir(dataPath), worldId, 'world.json');
  let packMeta: Record<string, { label: string; type: string }> = {};
  try {
    const meta = JSON.parse(fs.readFileSync(worldJson, 'utf-8'));
    for (const p of meta.packs ?? []) packMeta[p.name] = { label: p.label, type: p.type };
  } catch {}
  return fs.readdirSync(packsDir)
    .filter(name => fs.statSync(path.join(packsDir, name)).isDirectory())
    .map(name => ({ id: name, label: packMeta[name]?.label ?? name, type: packMeta[name]?.type ?? 'Actor' }))
    .filter(p => types.includes(p.type));
}

async function readActors(dbPath: string, opts: {
  search?: string;
  ids?: string[];
  offset: number;
  limit: number;
  withItems: boolean;
  actorType?: 'npc' | 'character';
  dataPathOverride?: string;
}): Promise<{ actors: any[]; total: number }> {
  console.log(`[foundry] readActors dbPath=${dbPath} opts=${JSON.stringify({ ...opts, ids: opts.ids?.length })}`);
  const db = await openLevel(dbPath);
  try {
    const idSet = opts.ids && opts.ids.length > 0 ? new Set(opts.ids) : null;
    const allActors: any[] = [];
    const allowedTypes = opts.actorType ? [opts.actorType] : ['npc', 'character'];

    for await (const [key, value] of db.iterator()) {
      if (!key.startsWith('!actors!')) continue;
      const v = value as any;
      if (!allowedTypes.includes(v.type)) continue;
      if (!v.name) continue;

      if (idSet) {
        if (!idSet.has(v._id)) continue;
      } else {
        if (opts.search && !v.name.toLowerCase().includes(opts.search.toLowerCase())) continue;
      }
      allActors.push(v);
    }

    console.log(`[foundry] scanned DB — matched ${allActors.length} actors${idSet ? ` (id-filter: wanted ${idSet.size}, got ${allActors.length})` : ''}`);

    if (idSet && allActors.length !== idSet.size) {
      const foundIds = new Set(allActors.map(a => a._id));
      const missing = [...idSet].filter(id => !foundIds.has(id));
      console.warn(`[foundry] missing ids: ${missing.join(', ')}`);
    }

    allActors.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    const total = allActors.length;
    const page = idSet ? allActors : allActors.slice(opts.offset, opts.offset + opts.limit);

    if (!opts.withItems) {
      await db.close();
      return { actors: page, total };
    }

    // Load embedded items for each actor
    const transformed: any[] = [];
    for (const actor of page) {
      const items: any[] = [];
      const prefix = `!actors.items!${actor._id}.`;
      for await (const [, item] of db.iterator({ gte: prefix, lte: prefix + '~' })) {
        items.push(item as any);
      }
      console.log(`[foundry] actor "${actor.name}" (_id=${actor._id}) — ${items.length} embedded items`);
      const t = opts.actorType === 'character' ? transformFoundryCharacter(actor, items, opts.dataPathOverride) : transformFoundryActor(actor, items, opts.dataPathOverride);
      console.log(`[foundry]   → transformed: hp=${t.hp ?? t.hp_max} ac=${t.ac} actions=${t.actions?.length ?? 0}`);
      transformed.push(t);
    }
    await db.close();
    console.log(`[foundry] returning ${transformed.length} transformed actors`);
    return { actors: transformed, total };
  } catch (e) {
    console.error('[foundry] readActors error:', e);
    try { await db.close(); } catch {}
    throw e;
  }
}

/** Read actors from all available DBs (world + every actor pack) and merge. */
async function readActorsAll(worldId: string, dataPathOverride: string | undefined, opts: {
  search?: string;
  ids?: string[];
  offset: number;
  limit: number;
  withItems: boolean;
  actorType?: 'npc' | 'character';
}): Promise<{ actors: any[]; total: number }> {
  const worldsDir = getWorldsDir(dataPathOverride);
  const dbPaths: string[] = [];

  const worldDb = path.join(worldsDir, worldId, 'data', 'actors');
  if (fs.existsSync(worldDb)) dbPaths.push(worldDb);

  const packTypes = opts.actorType === 'character' ? ['Actor'] : ['Actor', 'NPC'];
  for (const p of listPacks(worldId, dataPathOverride, packTypes)) {
    const packDb = path.join(worldsDir, worldId, 'packs', p.id);
    if (fs.existsSync(packDb)) dbPaths.push(packDb);
  }

  const seen = new Set<string>();
  const allActors: any[] = [];

  await Promise.all(dbPaths.map(async dbPath => {
    try {
      // Fetch everything (big limit), pagination applied after merge
      const result = await readActors(dbPath, { ...opts, offset: 0, limit: 10000, dataPathOverride });
      for (const a of result.actors) {
        const key = a._id ?? a.name;
        if (!seen.has(key)) { seen.add(key); allActors.push(a); }
      }
    } catch (e) {
      console.warn(`[foundry] skipping DB ${dbPath}:`, (e as any).message);
    }
  }));

  allActors.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const total = allActors.length;
  const page = opts.ids ? allActors : allActors.slice(opts.offset, opts.offset + opts.limit);
  return { actors: page, total };
}

/** Read spells from all item packs + world items DB and merge. */
async function readSpellsAll(worldId: string, dataPathOverride: string | undefined, opts: {
  search?: string;
  offset: number;
  limit: number;
}): Promise<{ spells: any[]; total: number }> {
  const worldsDir = getWorldsDir(dataPathOverride);
  const dbPaths: string[] = [];

  const worldItemsDb = path.join(worldsDir, worldId, 'data', 'items');
  if (fs.existsSync(worldItemsDb)) dbPaths.push(worldItemsDb);

  for (const p of listPacks(worldId, dataPathOverride, ['Item'])) {
    const packDb = path.join(worldsDir, worldId, 'packs', p.id);
    if (fs.existsSync(packDb)) dbPaths.push(packDb);
  }

  const seen = new Set<string>();
  const allSpells: any[] = [];

  await Promise.all(dbPaths.map(async dbPath => {
    try {
      const result = await readSpells(dbPath, { ...opts, offset: 0, limit: 10000 });
      for (const s of result.spells) {
        const key = s.id ?? s.name;
        if (!seen.has(key)) { seen.add(key); allSpells.push(s); }
      }
    } catch (e) {
      console.warn(`[foundry] skipping spells DB ${dbPath}:`, (e as any).message);
    }
  }));

  allSpells.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));
  const total = allSpells.length;
  return { spells: allSpells.slice(opts.offset, opts.offset + opts.limit), total };
}

export function createFoundryRouter(portraitsDir: string = '') {
  PORTRAITS_DIR = portraitsDir;
  const router = Router();

  router.get('/foundry/file', (req, res) => {
    const { p } = req.query as { p?: string };
    if (!p) return res.status(400).send('Missing path');
    const basePath = FOUNDRY_DATA_PATH;
    const normalized = path.resolve(path.join(basePath, p));
    if (!normalized.startsWith(path.resolve(basePath) + path.sep)) {
      return res.status(403).send('Forbidden');
    }
    if (!fs.existsSync(normalized)) return res.status(404).send('Not found');
    res.sendFile(normalized);
  });

  router.get('/foundry/scenes', async (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    const dbPath = path.join(getWorldsDir(dataPath), world, 'data', 'scenes');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Scenes DB not found' });
    try {
      const scenes = await readScenes(dbPath);
      res.json(scenes);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/playlists', async (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    const dbPath = path.join(getWorldsDir(dataPath), world, 'data', 'playlists');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Playlist database not found' });
    try {
      const playlists = await readPlaylists(dbPath);
      res.json(playlists);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/worlds', (req, res) => {
    const { dataPath } = req.query as { dataPath?: string };
    try {
      res.json(listWorlds(dataPath));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/packs', (req, res) => {
    const { world, dataPath } = req.query as { world?: string; dataPath?: string };
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      res.json(listPacks(world, dataPath));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/actors', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', full = '0', ids, dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });

    const parsedIds = ids ? ids.split(',').filter(Boolean) : undefined;
    console.log(`[foundry] GET /foundry/actors world=${world} pack=${pack ?? '(all)'} search=${search ?? ''} full=${full} ids=${parsedIds?.join(',') ?? 'none'} offset=${offset} limit=${limit}`);

    try {
      let result: { actors: any[]; total: number };
      if (pack) {
        const dbPath = path.join(getWorldsDir(dataPath), world, 'packs', pack);
        if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Pack database not found' });
        result = await readActors(dbPath, {
          search, ids: parsedIds, offset: parseInt(offset),
          limit: Math.min(parseInt(limit), 200), withItems: full === '1',
        });
      } else {
        result = await readActorsAll(world, dataPath, {
          search, ids: parsedIds, offset: parseInt(offset),
          limit: Math.min(parseInt(limit), 200), withItems: full === '1',
        });
      }
      console.log(`[foundry] responding with ${result.actors.length} actors (total=${result.total})`);
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
      res.json(listPacks(world, dataPath, ['Item']));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/spells', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    try {
      let result: { spells: any[]; total: number };
      if (pack) {
        const dbPath = path.join(getWorldsDir(dataPath), world, 'packs', pack);
        if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Pack database not found' });
        result = await readSpells(dbPath, { search, offset: parseInt(offset), limit: Math.min(parseInt(limit), 200) });
      } else {
        result = await readSpellsAll(world, dataPath, { search, offset: parseInt(offset), limit: Math.min(parseInt(limit), 200) });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/characters', async (req, res) => {
    const { world, pack, search, offset = '0', limit = '50', full = '0', ids, dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    const parsedIds = ids ? ids.split(',').filter(Boolean) : undefined;
    try {
      let result: { actors: any[]; total: number };
      if (pack) {
        const dbPath = path.join(getWorldsDir(dataPath), world, 'packs', pack);
        if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Actor database not found' });
        result = await readActors(dbPath, {
          search, ids: parsedIds, offset: parseInt(offset),
          limit: Math.min(parseInt(limit), 200), withItems: full === '1', actorType: 'character',
        });
      } else {
        result = await readActorsAll(world, dataPath, {
          search, ids: parsedIds, offset: parseInt(offset),
          limit: Math.min(parseInt(limit), 200), withItems: full === '1', actorType: 'character',
        });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/foundry/journals', async (req, res) => {
    const { world, search, ids, full = '0', dataPath } = req.query as Record<string, string>;
    if (!world) return res.status(400).json({ error: 'world required' });
    const dbPath = path.join(getWorldsDir(dataPath), world, 'data', 'journal');
    if (!fs.existsSync(dbPath)) return res.json([]);
    try {
      const parsedIds = ids ? ids.split(',').filter(Boolean) : undefined;
      const journals = await readJournals(dbPath, { search, ids: parsedIds, full: full === '1' });
      res.json(journals);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
