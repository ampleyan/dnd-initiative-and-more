import { clean5eTags } from '../../lib/utils';
import { MonsterTemplate, MonsterAction, Spell, Combatant, CombatantType, Encounter, ClassFeature } from '../../types';

export const CR_TO_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

export const SIZE_MAP: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Variable',
};

export function getCR(cr: any): string {
  if (!cr) return '0';
  if (typeof cr === 'string') return cr;
  if (typeof cr === 'number') return String(cr);
  if (cr.cr) return getCR(cr.cr);
  return '0';
}

export function getAC(ac: any): number {
  if (!ac || !ac.length) return 10;
  const first = ac[0];
  if (typeof first === 'number') return first;
  return first.ac ?? 10;
}

export function formatSpeed(speed: any): string {
  if (!speed) return '30 ft.';
  if (typeof speed === 'number') return `${speed} ft.`;
  if (typeof speed === 'string') return speed;
  const parts: string[] = [];
  if (speed.walk !== undefined) parts.push(`${speed.walk} ft.`);
  if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
  if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
  if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
  if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
  return parts.join(', ') || '30 ft.';
}

export function cleanTags(text: string): string {
  return clean5eTags(text);
}

export function flattenEntries(entries: any[]): string {
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

export function get5etoolsType(m: any): string {
  const sizeStr = (m.size || ['M']).map((s: string) => SIZE_MAP[s] || s).join('/');
  const typeStr = typeof m.type === 'string' ? m.type : (m.type?.type || 'unknown');
  const tags = m.type?.tags?.length ? ` (${m.type.tags.join(', ')})` : '';
  return `${sizeStr} ${typeStr}${tags}`;
}

export function get5etoolsAvatar(name: string, source: string, hasToken: boolean): string {
  if (!hasToken) return '';
  const safeName = name.replace(/[/\\]/g, '');
  return `https://5e.tools/img/bestiary/tokens/${source}/${safeName}.webp`;
}

export interface MappedEntity {
  id: string;
  name: string;
  type: string;
  format: string;
  status: 'detected' | 'conflict' | 'awaiting';
  data: any;
}

export function processImprovedInitiativeCreature(c: any): MonsterTemplate {
  const cleanContent = (s: any): string => {
    if (!s) return '';
    return cleanTags(String(s));
  };
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: c.Name || 'Unknown',
    cr: String(c.Challenge ?? '0'),
    type: c.Type || 'unknown',
    description: c.Description || '',
    image: c.ImageURL || '',
    hp: c.HP?.Value ?? 10,
    ac: c.AC?.Value ?? 10,
    speed: Array.isArray(c.Speed) ? c.Speed.join(', ') : String(c.Speed ?? '30 ft.'),
    stats: {
      str: c.Abilities?.Str ?? 10,
      dex: c.Abilities?.Dex ?? 10,
      con: c.Abilities?.Con ?? 10,
      int: c.Abilities?.Int ?? 10,
      wis: c.Abilities?.Wis ?? 10,
      cha: c.Abilities?.Cha ?? 10,
    },
    actions: (c.Actions ?? []).map((a: any) => ({ name: a.Name, description: cleanContent(a.Content) })),
    abilities: [
      ...(c.Traits ?? []).map((t: any) => ({ name: t.Name, description: cleanContent(t.Content) })),
      ...(c.BonusActions ?? []).map((a: any) => ({ name: a.Name, description: cleanContent(a.Content) })),
      ...(c.Reactions ?? []).map((r: any) => ({ name: r.Name, description: cleanContent(r.Content) })),
      ...(c.LegendaryActions ?? []).map((l: any) => ({ name: l.Name, description: cleanContent(l.Content) })),
    ],
    source: 'imported',
    tags: c.Source ? [c.Source] : [],
  };
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

export function process5etoolsMonster(m: any): MonsterTemplate {
  const cr = getCR(m.cr);
  const hp = m.hp?.average || 1;
  const source = m.source || 'MM';
  const typeStr = get5etoolsType(m);

  const actions: MonsterAction[] = [
    ...(m.action || []).map((a: any) => ({
      name: a.name || 'Action',
      description: flattenEntries(a.entries || []),
      category: 'attack' as const,
    })),
    ...(m.reaction || []).map((r: any) => ({
      name: r.name || 'Reaction',
      description: flattenEntries(r.entries || []),
      category: 'ability' as const,
    })),
    ...(m.legendary || []).map((l: any) => ({
      name: l.name || 'Legendary Action',
      description: flattenEntries(l.entries || []),
      category: 'ability' as const,
    })),
  ].filter(a => a.name && a.description);

  const abilities: MonsterAction[] = (m.trait || []).map((t: any) => ({
    name: t.name || 'Trait',
    description: flattenEntries(t.entries || []),
    category: 'ability' as const,
  })).filter((a: any) => a.name && a.description);

  const spells = parseSpellcasting(m);
  const id = (m.name as string).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return {
    id,
    name: m.name || 'Unknown Monster',
    cr,
    type: typeStr,
    description: typeStr,
    image: '',
    avatar: get5etoolsAvatar(m.name, source, !!m.hasToken),
    hp,
    maxHp: hp,
    ac: getAC(m.ac),
    speed: formatSpeed(m.speed),
    stats: {
      str: m.str ?? 10,
      dex: m.dex ?? 10,
      con: m.con ?? 10,
      int: m.int ?? 10,
      wis: m.wis ?? 10,
      cha: m.cha ?? 10,
    },
    xp: CR_TO_XP[cr] ?? 0,
    source,
    skills: m.skill ? Object.entries(m.skill).map(([k, v]) => `${k} ${v}`).join(', ') : undefined,
    actions,
    abilities,
    spells,
  };
}

export function process5etoolsSpell(s: any): Spell {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: s.name || 'Unknown Spell',
    level: s.level || 0,
    school: s.school || 'A',
    time: s.time?.[0]?.number + ' ' + s.time?.[0]?.unit || '1 action',
    range: s.range?.distance?.amount + ' ' + s.range?.distance?.type || 'Self',
    components: Object.entries(s.components || {}).map(([k, v]) => k.toUpperCase()).join(', '),
    duration: s.duration?.[0]?.type === 'instant' ? 'Instantaneous' : (s.duration?.[0]?.duration?.amount + ' ' + s.duration?.[0]?.duration?.unit || 'Instantaneous'),
    description: Array.isArray(s.entries) ? s.entries.join('\n') : (s.entries || ''),
    higherLevels: Array.isArray(s.entriesHigherLevel) ? s.entriesHigherLevel[0]?.entries?.join('\n') : undefined,
    source: s.source
  };
}

export async function processJson(json: any): Promise<MappedEntity[]> {
  const newEntities: MappedEntity[] = [];

  // Detect Improved Initiative backup format
  const iiCreatureKeys = Object.keys(json).filter(k => k.startsWith('Creatures.'));
  if (iiCreatureKeys.length > 0 || 'ImprovedInitiative.SavedEncounters' in json) {
    iiCreatureKeys.forEach(key => {
      const c = json[key];
      if (c && c.Name) {
        newEntities.push({
          id: Math.random().toString(36).substr(2, 9),
          name: c.Name,
          type: 'Monster',
          format: 'Improved Initiative',
          status: 'detected',
          data: processImprovedInitiativeCreature(c),
        });
      }
    });

    // Parse SavedEncounters.* individual keys
    const iiEncounterKeys = Object.keys(json).filter(k => k.startsWith('SavedEncounters.'));
    iiEncounterKeys.forEach(key => {
      const enc = json[key];
      if (!enc || !enc.Name) return;
      const combatants: Combatant[] = (enc.Combatants ?? []).map((c: any) => {
        const sb = c.StatBlock ?? {};
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: sb.Name || c.Alias || 'Unknown',
          type: 'monster' as CombatantType,
          initiative: c.Initiative ?? 0,
          hp: { current: c.CurrentHP ?? sb.HP?.Value ?? 10, max: sb.HP?.Value ?? 10 },
          ac: sb.AC?.Value ?? 10,
          speed: Array.isArray(sb.Speed) ? sb.Speed.join(', ') : String(sb.Speed ?? '30 ft.'),
          subtitle: sb.Type || '',
          avatar: sb.ImageURL || '',
          conditions: [],
          tags: c.Tags ?? [],
          stats: {
            str: sb.Abilities?.Str ?? 10,
            dex: sb.Abilities?.Dex ?? 10,
            con: sb.Abilities?.Con ?? 10,
            int: sb.Abilities?.Int ?? 10,
            wis: sb.Abilities?.Wis ?? 10,
            cha: sb.Abilities?.Cha ?? 10,
          },
          actions: (sb.Actions ?? []).map((a: any) => ({ name: a.Name, description: String(a.Content ?? '') })),
          abilities: (sb.Traits ?? []).map((t: any) => ({ name: t.Name, description: String(t.Content ?? '') })),
        };
      });
      const encId = enc.Id || Math.random().toString(36).substr(2, 9);
      newEntities.push({
        id: encId,
        name: enc.Name,
        type: 'Encounter',
        format: 'Improved Initiative',
        status: 'detected',
        data: {
          id: encId,
          name: enc.Name,
          combatants,
          folder: (enc.Path || '').replace(/\/$/, ''),
          lastModified: new Date().toISOString(),
        } as Encounter,
      });
    });

    return newEntities;
  }

  // Detect 5etools Monster format
  if (json.monster && Array.isArray(json.monster)) {
    json.monster.forEach((m: any) => {
      newEntities.push({
        id: Math.random().toString(36).substr(2, 9),
        name: m.name,
        type: 'Monster',
        format: 'JSON (5etools)',
        status: 'detected',
        data: process5etoolsMonster(m)
      });
    });
  }

  // Detect 5etools Spell format
  if (json.spell && Array.isArray(json.spell)) {
    json.spell.forEach((s: any) => {
      newEntities.push({
        id: Math.random().toString(36).substr(2, 9),
        name: s.name,
        type: 'Spell',
        format: 'JSON (5etools)',
        status: 'detected',
        data: process5etoolsSpell(s)
      });
    });
  }

  // Detect 5etools class file
  if (json.classFeature || json.subclassFeature) {
    const { parse5etoolsClassFile } = await import('../../lib/classFeatureParser');
    const features = parse5etoolsClassFile(json);
    if (features.length > 0) {
      features.forEach(f => {
        newEntities.push({
          id: f.id,
          name: `${f.className}: ${f.name}`,
          type: 'Feature',
          format: 'JSON (5etools)',
          status: 'detected',
          data: f
        });
      });
    }
  }

  // Generic array format
  if (Array.isArray(json)) {
    json.forEach((item: any) => {
      if (item.name) {
        newEntities.push({
          id: Math.random().toString(36).substr(2, 9),
          name: item.name,
          type: item.level !== undefined ? 'Spell' : 'Monster',
          format: 'JSON (Generic)',
          status: 'detected',
          data: item
        });
      }
    });
  }

  return newEntities;
}
