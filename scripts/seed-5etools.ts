import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/** Flatten a 5etools damage/condition trait array into readable strings.
 *  Entries can be plain strings or objects like { resist: [...], note: '...' }. */
function flattenTraitList(list: any[]): string[] {
  if (!list || !Array.isArray(list)) return [];
  const out: string[] = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      out.push(entry);
    } else if (typeof entry === 'object' && entry !== null) {
      // { resist/immune/vulnerable: string[], note?: string, preNote?: string }
      const raw = entry.resist ?? entry.immune ?? entry.vulnerable ?? entry.special ?? [];
      const subList: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
      const note = [entry.preNote, entry.note].filter(Boolean).join(' ');
      if (subList.length) {
        const label = subList.join(', ') + (note ? ` (${note})` : '');
        out.push(label);
      } else if (note) {
        out.push(note);
      }
    }
  }
  return out;
}

function parseSpellcasting(m: any): any[] {
  if (!m.spellcasting || !Array.isArray(m.spellcasting)) return [];
  const result: any[] = [];
  for (const sc of m.spellcasting) {
    // Standard spellcasting: has `spells` object keyed by level
    if (sc.spells) {
      for (const [level, entry] of Object.entries(sc.spells as Record<string, any>)) {
        const spellList: string[] = entry.spells || [];
        const label = level === '0' ? 'Cantrip' : `Level ${level}`;
        for (const s of spellList) {
          result.push({ name: stripSpellTag(s), category: 'spell', description: label });
        }
      }
    }
    // Innate spellcasting: has `will` and/or `daily`
    if (sc.will) {
      for (const s of sc.will) {
        result.push({ name: stripSpellTag(s), category: 'spell', description: 'At will' });
      }
    }
    if (sc.daily) {
      for (const [key, spells] of Object.entries(sc.daily as Record<string, any[]>)) {
        const times = key.replace('e', '');
        const label = `${times}/day`;
        for (const s of spells) {
          result.push({ name: stripSpellTag(s), category: 'spell', description: label });
        }
      }
    }
  }
  return result;
}

function transformMonster(m: any): any {
  const cr = getCR(m.cr);
  const xp = CR_TO_XP[cr] ?? 0;
  const hp = getHP(m.hp);

  const actions = (m.action || []).map((a: any) => ({
    name: a.name || 'Action',
    description: flattenEntries(a.entries || []),
  })).filter((a: any) => a.name && a.description);

  const abilities = (m.trait || []).map((t: any) => ({
    name: t.name || 'Trait',
    description: flattenEntries(t.entries || []),
  })).filter((a: any) => a.name && a.description);

  const id = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return {
    id,
    name: m.name,
    hp,
    maxHp: hp,
    ac: getAC(m.ac),
    speed: formatSpeed(m.speed),
    avatar: getImageUrl(m.name, m.source || 'MM', !!m.hasToken),
    xp,
    description: getType(m),
    cr,
    type: getType(m),
    source: m.source || 'MM',
    stats: {
      str: m.str ?? 10,
      dex: m.dex ?? 10,
      con: m.con ?? 10,
      int: m.int ?? 10,
      wis: m.wis ?? 10,
      cha: m.cha ?? 10,
    },
    vulnerabilities: flattenTraitList(m.vulnerable ?? []),
    resistances: flattenTraitList(m.resist ?? []),
    damageImmunities: flattenTraitList(m.immune ?? []),
    conditionImmunities: flattenTraitList(m.conditionImmune ?? []),
    actions,
    abilities,
    spells: parseSpellcasting(m),
  };
}

const SOURCES_TO_IMPORT = new Set(['MM', 'VGM', 'MTF', 'XMM', 'WBtW']);

async function fetchBestiary(filename: string): Promise<any[]> {
  const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/${filename}`;
  console.log(`Fetching ${filename}...`);
  const res = await fetch(url);
  if (!res.ok) { console.log(`  Skipped (${res.status})`); return []; }
  const data = await res.json() as any;
  return data.monster || [];
}

async function main() {
  const db = new Database(path.join(__dirname, 'dnd_tracker.db'));

  // Only clear monsters — preserve user encounters and combatants
  db.prepare('DELETE FROM monsters').run();
  console.log('Monster library cleared.\n');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, source, stats, actions, abilities, spells, vulnerabilities, resistances, damageImmunities, conditionImmunities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Process 2014 sources first, 2024 (XMM) last — XMM overwrites MM entries via INSERT OR REPLACE
  const files = ['bestiary-wbtw.json', 'bestiary-vgm.json', 'bestiary-mtf.json', 'bestiary-mm.json', 'bestiary-xmm.json'];
  let total = 0;
  let errors = 0;

  for (const file of files) {
    const monsters = await fetchBestiary(file);
    const eligible = monsters.filter(m => SOURCES_TO_IMPORT.has(m.source || ''));

    let count = 0;
    const batch = db.transaction((list: any[]) => {
      for (const m of list) {
        try {
          const t = transformMonster(m);
          insert.run(
            t.id, t.name, t.hp, t.maxHp, t.ac, t.speed, t.avatar,
            t.xp, t.description, t.cr, t.type, t.source,
            JSON.stringify(t.stats), JSON.stringify(t.actions), JSON.stringify(t.abilities), JSON.stringify(t.spells),
            JSON.stringify(t.vulnerabilities), JSON.stringify(t.resistances), JSON.stringify(t.damageImmunities), JSON.stringify(t.conditionImmunities)
          );
          count++;
        } catch (e: any) {
          console.error(`  Error on ${m.name}: ${e.message}`);
          errors++;
        }
      }
    });

    batch(eligible);
    console.log(`  Imported ${count} monsters from ${file}`);
    total += count;
  }

  const finalCount = (db.prepare('SELECT COUNT(*) as n FROM monsters').get() as any).n;
  console.log(`\nDone. ${total} monsters inserted (${errors} errors). DB total: ${finalCount}`);
  db.close();
}

main().catch(console.error);
