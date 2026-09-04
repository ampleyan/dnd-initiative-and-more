/**
 * Safe monster updater — refreshes spells, actions, abilities, stats and HP from 5etools
 * WITHOUT wiping encounters, combatants, or any other game data.
 *
 * Usage:  npx tsx update-monsters.ts
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Helpers (copied from seed-5etools.ts) ───────────────────────────────────

const CR_TO_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

const SIZE_MAP: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Variable',
};

function getCR(cr: any): string {
  if (!cr) return '0';
  if (typeof cr === 'string') return cr;
  if (typeof cr === 'number') return String(cr);
  if (cr.cr) return getCR(cr.cr);
  return '0';
}

function getAC(ac: any): number {
  if (!ac || !ac.length) return 10;
  const first = ac[0];
  if (typeof first === 'number') return first;
  return first.ac ?? 10;
}

function getHP(hp: any): number {
  if (!hp) return 1;
  return hp.average || 1;
}

function formatSpeed(speed: any): string {
  if (!speed) return '30 ft.';
  if (typeof speed === 'number') return `${speed} ft.`;
  const parts: string[] = [];
  if (speed.walk !== undefined) parts.push(`${speed.walk} ft.`);
  if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
  if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
  if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
  if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
  return parts.join(', ') || '30 ft.';
}

function cleanTags(text: string): string {
  return text
    .replace(/\{@atk [^}]+\}/g, '')
    .replace(/\{@h\}/g, '')
    .replace(/\{@dc (\d+)\}/g, 'DC $1')
    .replace(/\{@hit (\d+)\}/g, '+$1')
    .replace(/\{@damage ([^}]+)\}/g, '$1')
    .replace(/\{@dice ([^}|]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenEntries(entries: any[]): string {
  if (!entries || !Array.isArray(entries)) return '';
  return entries.map(e => {
    if (typeof e === 'string') return cleanTags(e);
    if (typeof e !== 'object' || !e) return '';
    if (e.entries) return flattenEntries(e.entries);
    if (e.items) return flattenEntries(e.items);
    if (e.entry) return flattenEntries([e.entry]);
    if (e.type === 'list') return flattenEntries(e.items || []);
    if (e.type === 'table') return '';
    return '';
  }).filter(Boolean).join(' ');
}

function getImageUrl(name: string, source: string, hasToken: boolean): string {
  if (!hasToken) return '';
  const safeName = name.replace(/[/\\]/g, '');
  return `https://5e.tools/img/bestiary/tokens/${source}/${safeName}.webp`;
}

function getType(m: any): string {
  const sizeStr = (m.size || ['M']).map((s: string) => SIZE_MAP[s] || s).join('/');
  const typeStr = typeof m.type === 'string' ? m.type : (m.type?.type || 'unknown');
  const tags = m.type?.tags?.length ? ` (${m.type.tags.join(', ')})` : '';
  return `${sizeStr} ${typeStr}${tags}`;
}

function stripSpellTag(tag: string): string {
  return tag.replace(/\{@spell ([^|}]+)[^}]*\}/g, '$1').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseSpellcasting(m: any): any[] {
  if (!m.spellcasting || !Array.isArray(m.spellcasting)) return [];
  const result: any[] = [];
  for (const sc of m.spellcasting) {
    if (sc.spells) {
      for (const [level, entry] of Object.entries(sc.spells as Record<string, any>)) {
        const spellList: string[] = (entry as any).spells || [];
        const label = level === '0' ? 'Cantrip' : `Level ${level}`;
        for (const s of spellList) {
          result.push({ name: stripSpellTag(s), category: 'spell', description: label });
        }
      }
    }
    if (sc.will) {
      for (const s of sc.will) {
        result.push({ name: stripSpellTag(s), category: 'spell', description: 'At will' });
      }
    }
    if (sc.daily) {
      for (const [key, spells] of Object.entries(sc.daily as Record<string, any[]>)) {
        const times = key.replace('e', '');
        const label = `${times}/day`;
        for (const s of spells as string[]) {
          result.push({ name: stripSpellTag(s), category: 'spell', description: label });
        }
      }
    }
  }
  return result;
}

function transformMonster(m: any, fluff?: any) {
  const cr = getCR(m.cr);
  const xp = CR_TO_XP[cr] ?? 0;
  const hp = getHP(m.hp);
  const id = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const actions = (m.action || []).map((a: any) => ({
    name: a.name || 'Action',
    description: flattenEntries(a.entries || []),
    category: 'attack',
  })).filter((a: any) => a.name && a.description);

  const abilities = (m.trait || []).map((t: any) => ({
    name: t.name || 'Trait',
    description: flattenEntries(t.entries || []),
    category: 'ability',
  })).filter((a: any) => a.name && a.description);

  const reactions = (m.reaction || []).map((r: any) => ({
    name: r.name || 'Reaction',
    description: flattenEntries(r.entries || []),
    category: 'ability',
  })).filter((a: any) => a.name && a.description);

  const spells = parseSpellcasting(m);

  let description = getType(m);
  let avatar = getImageUrl(m.name, m.source || 'MM', !!m.hasToken);

  if (fluff) {
    if (fluff.entries && fluff.entries.length > 0) {
      description = flattenEntries(fluff.entries).slice(0, 500) + '...';
    }
    if (fluff.images && fluff.images.length > 0 && fluff.images[0].href && fluff.images[0].href.type === 'external') {
      avatar = fluff.images[0].href.url;
    }
  }

  return {
    id, name: m.name, hp, maxHp: hp,
    ac: getAC(m.ac), speed: formatSpeed(m.speed),
    avatar,
    xp, description, cr, type: getType(m),
    source: m.source || 'MM',
    stats: { str: m.str ?? 10, dex: m.dex ?? 10, con: m.con ?? 10, int: m.int ?? 10, wis: m.wis ?? 10, cha: m.cha ?? 10 },
    actions, abilities: [...abilities, ...reactions], spells,
  };
}

const SOURCES_TO_IMPORT = new Set(['MM', 'VGM', 'MTF', 'XMM', 'WBtW', 'MPMM']);

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

async function main() {
  const dbPath = process.env.DB_PATH ?? path.join(__dirname, 'data', 'dnd_tracker.db');
  const fallbackPath = path.join(__dirname, 'dnd_tracker.db');
  const db = new Database(fs.existsSync(dbPath) ? dbPath : fallbackPath);

  // Ensure spells column exists
  try { db.exec("ALTER TABLE monsters ADD COLUMN spells TEXT DEFAULT '[]'"); } catch {}
  // Ensure tags column exists
  try { db.exec("ALTER TABLE monsters ADD COLUMN tags TEXT DEFAULT '[]'"); } catch {}

  const upsert = db.prepare(`
    INSERT INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, source, stats, actions, abilities, spells, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, hp=excluded.hp, maxHp=excluded.maxHp, ac=excluded.ac,
      speed=excluded.speed, avatar=excluded.avatar, xp=excluded.xp,
      description=excluded.description, cr=excluded.cr, type=excluded.type,
      source=excluded.source, stats=excluded.stats,
      actions=excluded.actions, abilities=excluded.abilities, spells=excluded.spells
  `);

  console.log('Fetching bestiary data...');
  const files = ['bestiary-wbtw.json', 'bestiary-vgm.json', 'bestiary-mtf.json', 'bestiary-mm.json', 'bestiary-xmm.json', 'bestiary-mpmm.json'];
  let allMonsters: any[] = [];
  for (const file of files) {
    const data = await fetchJson(`https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/${file}`);
    if (data && data.monster) {
      console.log(`  Fetched ${file}: ${data.monster.length} monsters`);
      allMonsters = allMonsters.concat(data.monster);
    }
  }

  console.log('Fetching fluff data...');
  const vgmFluff = await fetchJson('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/refs/heads/main/data/bestiary/fluff-bestiary-vgm.json');
  const mmFluff = await fetchJson('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/refs/heads/main/data/bestiary/fluff-bestiary-mm.json');
  
  const fluffMap = new Map();
  [vgmFluff, mmFluff].forEach(data => {
    if (data && data.monsterFluff) {
      data.monsterFluff.forEach((f: any) => fluffMap.set(`${f.name}-${f.source}`, f));
    }
  });

  const eligible = allMonsters.filter(m => SOURCES_TO_IMPORT.has(m.source || ''));
  console.log(`\nProcessing ${eligible.length} eligible monsters...`);

  let updated = 0, errors = 0;
  const batch = db.transaction((list: any[]) => {
    for (const m of list) {
      try {
        const fluff = fluffMap.get(`${m.name}-${m.source}`);
        const t = transformMonster(m, fluff);
        upsert.run(
          t.id, t.name, t.hp, t.maxHp, t.ac, t.speed, t.avatar,
          t.xp, t.description, t.cr, t.type, t.source,
          JSON.stringify(t.stats), JSON.stringify(t.actions),
          JSON.stringify(t.abilities), JSON.stringify(t.spells)
        );
        updated++;
      } catch (e: any) {
        console.error(`  Error on ${m.name}: ${e.message}`);
        errors++;
      }
    }
  });
  batch(eligible);

  const total = (db.prepare('SELECT COUNT(*) as n FROM monsters').get() as any).n;
  const withSpells = (db.prepare("SELECT COUNT(*) as n FROM monsters WHERE spells != '[]'").get() as any).n;
  console.log(`\nDone. ${updated} upserted (${errors} errors).`);
  console.log(`DB: ${total} total monsters, ${withSpells} with spells.`);

  db.close();
}

main().catch(console.error);
