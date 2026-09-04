import { imageProxy } from '../api/client';
import { LogEventType } from '../types';

export type HueEffectName =
  | 'heal' | 'damage' | 'creature_downed' | 'stabilized'
  | 'condition' | 'round_start' | 'death_save_fail' | 'death_save_pass'
  | 'encounter_end'
  | 'spell_cast'
  | 'spell_evocation' | 'spell_necromancy' | 'spell_conjuration' | 'spell_illusion'
  | 'spell_enchantment' | 'spell_abjuration' | 'spell_divination' | 'spell_transmutation'
  | 'concentration_start' | 'concentration_end';

export const SCHOOL_TO_EFFECT: Record<string, HueEffectName> = {
  Abjuration:   'spell_abjuration',
  Conjuration:  'spell_conjuration',
  Divination:   'spell_divination',
  Enchantment:  'spell_enchantment',
  Evocation:    'spell_evocation',
  Illusion:     'spell_illusion',
  Necromancy:   'spell_necromancy',
  Transmutation:'spell_transmutation',
};

export const LOG_TYPE_TO_EFFECT: Partial<Record<LogEventType, HueEffectName>> = {
  heal:                 'heal',
  damage:               'damage',
  creature_downed:      'creature_downed',
  creature_stabilized:  'stabilized',
  condition_applied:    'condition',
  round_start:          'round_start',
  death_save_fail:      'death_save_fail',
  death_save_nat1:      'death_save_fail',
  death_save_pass:      'death_save_pass',
  death_save_nat20:     'death_save_pass',
  encounter_end:        'encounter_end',
  spell_cast:           'spell_cast',
  concentration_start:  'concentration_start',
  concentration_end:    'concentration_end',
};

export interface HueEffectTargets {
  players: boolean;
  monsters: boolean;
}

export interface HueEffectMeta {
  name: HueEffectName;
  label: string;
  description: string;
  color: string;
}

export async function extractPalette(imgUrl: string, count: number = 8): Promise<string[]> {
  // For external URLs: fetch via proxy → blob URL (avoids canvas CORS taint entirely)
  const isExternal = /^https?:\/\//.test(imgUrl) && !imgUrl.startsWith(window.location.origin);
  let src = imgUrl;
  let blobUrl: string | null = null;

  if (isExternal) {
    try {
      const res = await imageProxy.fetchBlob(imgUrl);
      if (!res.ok) return [];
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return [];
      blobUrl = URL.createObjectURL(blob);
      src = blobUrl;
    } catch {
      return [];
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const cleanup = () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { cleanup(); return resolve([]); }

      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      try {
        const data = ctx.getImageData(0, 0, 100, 100).data;
        const palette: string[] = [];
        const gridSide = Math.ceil(Math.sqrt(count));
        const cellW = Math.floor(100 / gridSide);
        const cellH = Math.floor(100 / gridSide);

        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / gridSide);
          const col = i % gridSide;
          const x = col * cellW + Math.floor(cellW / 2);
          const y = row * cellH + Math.floor(cellH / 2);
          const idx = (y * 100 + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          palette.push('#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1));
        }
        cleanup();
        resolve(palette);
      } catch {
        cleanup();
        resolve([]);
      }
    };
    img.onerror = () => { cleanup(); resolve([]); };
    img.src = src;
  });
}

export const EFFECT_CONFIGS: HueEffectMeta[] = [
  { name: 'heal',                label: 'Healing',              description: 'Green pulse when HP is restored',                    color: '#34d399' },
  { name: 'damage',              label: 'Damage',               description: 'Red flash when damage is dealt',                     color: '#f87171' },
  { name: 'creature_downed',     label: 'Downed',               description: 'Deep red loop when creature hits 0 HP',              color: '#dc2626' },
  { name: 'stabilized',          label: 'Stabilized',           description: 'Green glow when a creature stabilizes',              color: '#86efac' },
  { name: 'condition',           label: 'Condition Applied',    description: 'Blue flash when a condition is applied',             color: '#60a5fa' },
  { name: 'round_start',         label: 'Round Start',          description: 'Subtle indigo pulse at each new round',              color: '#818cf8' },
  { name: 'death_save_fail',     label: 'Death Save Fail',      description: 'Harsh red warning on a failed death save',           color: '#ef4444' },
  { name: 'death_save_pass',     label: 'Death Save Pass',      description: 'Green on a successful death save',                   color: '#4ade80' },
  { name: 'encounter_end',       label: 'Victory',              description: 'Golden celebration pulse when encounter ends',       color: '#fbbf24' },
  { name: 'spell_cast',          label: 'Spell Cast',           description: 'Violet flash for any spell (fallback)',              color: '#a78bfa' },
  { name: 'spell_evocation',     label: 'Evocation',            description: 'Orange burst — Fireball, Lightning Bolt, Magic Missile', color: '#f97316' },
  { name: 'spell_necromancy',    label: 'Necromancy',           description: 'Deep purple pulse — Inflict Wounds, Animate Dead',  color: '#a855f7' },
  { name: 'spell_conjuration',   label: 'Conjuration',          description: 'Teal flash — Misty Step, Summon spells, Fog Cloud',  color: '#2dd4bf' },
  { name: 'spell_illusion',      label: 'Illusion',             description: 'Fuchsia shimmer — Mirror Image, Invisibility, Hypnotic Pattern', color: '#e879f9' },
  { name: 'spell_enchantment',   label: 'Enchantment',          description: 'Rose glow — Hold Person, Charm, Suggestion',        color: '#f472b6' },
  { name: 'spell_abjuration',    label: 'Abjuration',           description: 'Sky blue shield — Shield, Counterspell, Dispel Magic', color: '#7dd3fc' },
  { name: 'spell_divination',    label: 'Divination',           description: 'Pale gold — Guidance, Detect Magic, True Seeing',   color: '#fef08a' },
  { name: 'spell_transmutation', label: 'Transmutation',        description: 'Lime flash — Haste, Polymorph, Enlarge/Reduce',     color: '#a3e635' },
  { name: 'concentration_start', label: 'Concentration Start',  description: 'Violet glow when concentration begins',             color: '#c084fc' },
  { name: 'concentration_end',   label: 'Concentration Broken', description: 'Gray fade when concentration is lost',              color: '#9ca3af' },
];
