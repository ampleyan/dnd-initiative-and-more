import type { Combatant, Player } from '../types';

export const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000,
};

// [easy, medium, hard, deadly] XP per player at each level
export const THRESHOLDS: Record<number, [number, number, number, number]> = {
  1:[25,50,75,100], 2:[50,100,150,200], 3:[75,150,225,400], 4:[125,250,375,500],
  5:[250,500,750,1100], 6:[300,600,900,1400], 7:[350,750,1100,1700], 8:[450,900,1400,2100],
  9:[550,1100,1600,2400], 10:[600,1200,1900,2800], 11:[800,1600,2400,3600],
  12:[1000,2000,3000,4500], 13:[1100,2200,3400,5100], 14:[1250,2500,3800,5700],
  15:[1400,2800,4300,6400], 16:[1600,3200,4800,7200], 17:[2000,3900,5900,8800],
  18:[2100,4200,6300,9500], 19:[2400,4900,7300,10900], 20:[2800,5700,8500,12700],
};

// DMG "Monster Statistics by Challenge Rating" table (p. 274)
const CR_STATS: Record<string, { hp: number; ac: number }> = {
  '0':   { hp: 3,   ac: 13 }, '1/8': { hp: 21,  ac: 13 },
  '1/4': { hp: 42,  ac: 13 }, '1/2': { hp: 60,  ac: 13 },
  '1':   { hp: 78,  ac: 13 }, '2':   { hp: 93,  ac: 13 },
  '3':   { hp: 108, ac: 13 }, '4':   { hp: 123, ac: 14 },
  '5':   { hp: 138, ac: 15 }, '6':   { hp: 153, ac: 15 },
  '7':   { hp: 168, ac: 15 }, '8':   { hp: 183, ac: 16 },
  '9':   { hp: 198, ac: 16 }, '10':  { hp: 213, ac: 17 },
  '11':  { hp: 228, ac: 17 }, '12':  { hp: 243, ac: 17 },
  '13':  { hp: 258, ac: 18 }, '14':  { hp: 273, ac: 18 },
  '15':  { hp: 288, ac: 18 }, '16':  { hp: 303, ac: 18 },
  '17':  { hp: 318, ac: 19 }, '18':  { hp: 333, ac: 19 },
  '19':  { hp: 348, ac: 19 }, '20':  { hp: 378, ac: 19 },
  '21':  { hp: 423, ac: 19 }, '22':  { hp: 468, ac: 19 },
  '23':  { hp: 513, ac: 19 }, '24':  { hp: 558, ac: 19 },
};

// Ordered list of all CR keys ascending by XP value
const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20','21','22','23','24'];

export function crToXP(cr: string): number {
  return CR_XP[cr] ?? 0;
}

export function monsterMultiplier(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 1.5;
  if (n <= 6) return 2;
  if (n <= 10) return 2.5;
  if (n <= 14) return 3;
  return 4;
}

export function parseLevel(subtitle: string | undefined): number {
  const m = subtitle?.match(/level\s*(\d+)/i) ?? subtitle?.match(/(\d+)(?:st|nd|rd|th)\s+level/i);
  return m ? Math.min(20, Math.max(1, parseInt(m[1], 10))) : 1;
}

export function parseCR(subtitle: string | undefined): string | null {
  const m = subtitle?.match(/CR\s*([\d/]+)/i);
  return m ? m[1] : null;
}

/** Highest CR whose XP ≤ targetXP, never below minCR, capped at CR 24. */
export function xpToCR(targetXP: number, minCR?: string): string {
  const minIdx = minCR ? CR_ORDER.indexOf(minCR) : 0;
  let best = CR_ORDER[Math.max(0, minIdx)];
  for (const cr of CR_ORDER) {
    if (CR_XP[cr] <= targetXP) best = cr;
  }
  const bestIdx = CR_ORDER.indexOf(best);
  return CR_ORDER[Math.max(bestIdx, minIdx)];
}

export interface ScaledCombatant {
  id: string;
  name: string;
  currentCR: string | null;
  targetCR: string;
  currentHP: number;
  proposedHP: number;
  currentAC: number;
  proposedAC: number;
}

export function scaleToHard(
  combatants: Combatant[],
  players: Player[],
  overrideLevel?: number,
  difficultyIndex: 0 | 1 | 2 | 3 = 2,
  deadlyMultiplier: number = 1,
): ScaledCombatant[] {
  const monsters = combatants.filter(c => (c.type === 'monster' || c.type === 'npc') && !c.isFriendly);
  if (monsters.length === 0 || players.length === 0) return [];

  const partySize = players.length;
  const avgLevel = overrideLevel ?? Math.max(1, Math.round(
    players.reduce((s, p) => s + Math.max(p.level ?? 0, parseLevel(p.subtitle)), 0) / partySize,
  ));
  const level = Math.min(20, Math.max(1, avgLevel));
  const hardThreshold = (THRESHOLDS[level] ?? THRESHOLDS[1])[difficultyIndex] * partySize * deadlyMultiplier;

  const rawXP = monsters.reduce((s, m) => {
    const cr = parseCR(m.subtitle);
    // Known CR contributes its XP, unknown CR contributes baseline of 1 for scaling
    return s + (cr ? crToXP(cr) : 1); // nominal 1 XP keeps scaleFactor finite for homebrew-only groups
  }, 0);
  const multiplier = monsterMultiplier(monsters.length);
  const adjustedXP = rawXP * multiplier;
  const scaleFactor = adjustedXP > 0
    ? Math.min(5, Math.max(0.5, hardThreshold / adjustedXP))
    : 1;

  return monsters.map(m => {
    const currentCR = parseCR(m.subtitle);
    if (currentCR) {
      const targetXP = crToXP(currentCR) * scaleFactor;
      const targetCR = xpToCR(targetXP, currentCR);
      const stats = CR_STATS[targetCR];
      return {
        id: m.id, name: m.name, currentCR, targetCR,
        currentHP: m.hp.max, proposedHP: stats.hp,
        currentAC: m.ac, proposedAC: stats.ac,
      };
    }
    // Fallback: CR unknown — scale HP by factor, keep AC
    return {
      id: m.id, name: m.name, currentCR: null, targetCR: '?',
      currentHP: m.hp.max, proposedHP: Math.max(1, Math.round(m.hp.max * scaleFactor)),
      currentAC: m.ac, proposedAC: m.ac,
    };
  });
}
