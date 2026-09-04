import { ClassFeature } from '../types';

export interface ParsedFeatureUse {
  total: number;
  restType: 'short' | 'long';
}

function profBonus(level: number): number {
  return Math.ceil(1 + level / 4);
}

function modifier(score: number): number {
  return Math.max(1, Math.floor((score - 10) / 2));
}

/**
 * Tries to detect trackable uses from a class feature description.
 * Returns null if the feature is unlimited or undetectable.
 */
export function parseFeatureUses(
  feature: ClassFeature,
  level: number,
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number },
): ParsedFeatureUse | null {
  const desc = feature.description.toLowerCase();

  const detectRest = (): 'short' | 'long' | null => {
    // Check for short rest mention before long rest (some features allow both — treat as short)
    const shortIdx = desc.indexOf('short rest');
    const longIdx = desc.indexOf('long rest');
    if (shortIdx === -1 && longIdx === -1) return null;
    if (shortIdx === -1) return 'long';
    if (longIdx === -1) return 'short';
    return shortIdx < longIdx ? 'short' : 'long';
  };

  const rest = detectRest();
  if (!rest) return null;

  // Pattern: explicit number "X times" (captures first digit sequence near "time")
  const timesMatch = desc.match(/(\d+)\s*times?/);
  if (timesMatch) {
    const total = parseInt(timesMatch[1], 10);
    if (total > 0) return { total, restType: rest };
  }

  // Pattern: "equal to your proficiency bonus"
  if (desc.includes('proficiency bonus')) {
    return { total: profBonus(level), restType: rest };
  }

  // Pattern: ability modifier
  const abilityMap: Array<[string, number]> = [
    ['charisma modifier', modifier(stats.cha)],
    ['wisdom modifier', modifier(stats.wis)],
    ['constitution modifier', modifier(stats.con)],
    ['intelligence modifier', modifier(stats.int)],
    ['strength modifier', modifier(stats.str)],
    ['dexterity modifier', modifier(stats.dex)],
  ];
  for (const [pattern, value] of abilityMap) {
    if (desc.includes(pattern)) {
      return { total: Math.max(1, value), restType: rest };
    }
  }

  return null;
}
