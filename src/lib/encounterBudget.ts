import { THRESHOLDS, CR_XP, monsterMultiplier, parseCR } from './encounterScaling';
import type { Combatant, EncounterBudget } from '../types';

export type BudgetDifficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

export interface BudgetResult {
  totalXP: number;
  adjustedXP: number;
  threshold: number;
  difficulty: BudgetDifficulty;
  multiplier: number;
  monsterCount: number;
  explanations: string[];
  assumptions: string[];
}

const DIFF_INDEX: Record<EncounterBudget['targetDifficulty'], 0 | 1 | 2 | 3> = {
  easy: 0, medium: 1, hard: 2, deadly: 3,
};

const DIFF_ORDER: BudgetDifficulty[] = ['trivial', 'easy', 'medium', 'hard', 'deadly'];

const CR_TIER: Record<string, number> = {
  '0': 0, '1/8': 1, '1/4': 2, '1/2': 3,
  '1': 4, '2': 5, '3': 6, '4': 7, '5': 8,
  '6': 9, '7': 10, '8': 11, '9': 12, '10': 13,
  '11': 14, '12': 15, '13': 16, '14': 17, '15': 18,
  '16': 19, '17': 20, '18': 21, '19': 22, '20': 23,
  '21': 24, '22': 25, '23': 26, '24': 27,
};

export function calculateEncounterBudget(
  budget: EncounterBudget,
  combatants: Combatant[],
  options: { includeHiddenWaves?: boolean } = {},
): BudgetResult {
  const { partySize, partyLevels, targetDifficulty, dmAdjustment = 0 } = budget;
  const { includeHiddenWaves = true } = options;

  const monsters = combatants.filter(c =>
    (c.type === 'monster' || c.type === 'npc') &&
    !c.isFriendly &&
    (includeHiddenWaves || !c.hidden),
  );

  const hiddenCount = combatants.filter(c =>
    (c.type === 'monster' || c.type === 'npc') && !c.isFriendly && c.hidden,
  ).length;

  const diffIdx = DIFF_INDEX[targetDifficulty];

  const threshold = partyLevels.reduce((sum, lvl) => {
    const clamped = Math.min(20, Math.max(1, lvl));
    return sum + (THRESHOLDS[clamped] ?? THRESHOLDS[1])[diffIdx];
  }, 0);

  const assumptions: string[] = [];
  let totalXP = 0;
  const knownCrs: number[] = [];

  for (const m of monsters) {
    const cr = parseCR(m.subtitle);
    if (cr !== null) {
      totalXP += CR_XP[cr] ?? 0;
      const tier = CR_TIER[cr];
      if (tier !== undefined) knownCrs.push(tier);
    } else {
      assumptions.push(`CR unknown for "${m.name}" — excluded from XP total`);
    }
  }

  const multiplier = monsterMultiplier(monsters.length);
  const adjustedXP = monsters.length === 0 ? 0 : totalXP * multiplier + dmAdjustment;

  // Determine difficulty by comparing against all thresholds for the party
  let difficulty: BudgetDifficulty = 'trivial';
  if (adjustedXP > 0) {
    const easyThreshold = partyLevels.reduce((s, lvl) => {
      const c = Math.min(20, Math.max(1, lvl));
      return s + (THRESHOLDS[c] ?? THRESHOLDS[1])[0];
    }, 0);
    const mediumThreshold = partyLevels.reduce((s, lvl) => {
      const c = Math.min(20, Math.max(1, lvl));
      return s + (THRESHOLDS[c] ?? THRESHOLDS[1])[1];
    }, 0);
    const hardThreshold = partyLevels.reduce((s, lvl) => {
      const c = Math.min(20, Math.max(1, lvl));
      return s + (THRESHOLDS[c] ?? THRESHOLDS[1])[2];
    }, 0);
    const deadlyThreshold = partyLevels.reduce((s, lvl) => {
      const c = Math.min(20, Math.max(1, lvl));
      return s + (THRESHOLDS[c] ?? THRESHOLDS[1])[3];
    }, 0);

    if (adjustedXP >= deadlyThreshold) difficulty = 'deadly';
    else if (adjustedXP >= hardThreshold) difficulty = 'hard';
    else if (adjustedXP >= mediumThreshold) difficulty = 'medium';
    else if (adjustedXP >= easyThreshold) difficulty = 'easy';
    else difficulty = 'trivial';
  }

  const explanations: string[] = [];

  if (monsters.length === 1) {
    explanations.push('Solo monster — high swing potential; single bad roll can shift the fight.');
  }

  if (monsters.length > partySize) {
    explanations.push(`Outnumbered — ${monsters.length} monsters vs ${partySize} players increases action economy pressure.`);
  }

  if (knownCrs.length >= 2) {
    const spread = Math.max(...knownCrs) - Math.min(...knownCrs);
    if (spread >= 4) {
      explanations.push('Mixed CR — wide CR spread; weaker monsters will likely be dispatched quickly and may undercount threat.');
    }
  }

  if (hiddenCount > 0 && !includeHiddenWaves) {
    explanations.push(`Reinforcement pressure — ${hiddenCount} hidden monster(s) not included in XP; actual difficulty will be higher when they appear.`);
  }

  return {
    totalXP,
    adjustedXP,
    threshold,
    difficulty,
    multiplier,
    monsterCount: monsters.length,
    explanations,
    assumptions,
  };
}
