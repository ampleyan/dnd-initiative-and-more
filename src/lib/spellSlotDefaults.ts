export type SpellSlots = Partial<Record<number, { total: number; used: number }>>;

const FULL_CASTER: Record<number, number[]> = {
  1:  [2],
  2:  [3,2],
  3:  [4,3,2],
  4:  [4,3,3,1],
  5:  [4,3,3,2,1],
  6:  [4,3,3,3,1,1],
  7:  [4,3,3,3,2,1,1],
  8:  [4,3,3,3,2,2,1,1],
  9:  [4,3,3,3,2,2,1,1,1],
  10: [4,3,3,3,2,2,2,1,1],
  11: [4,3,3,3,2,2,2,1,1],
  12: [4,3,3,3,2,2,2,1,1],
  13: [4,3,3,3,2,2,2,1,1,1],
  14: [4,3,3,3,2,2,2,1,1,1],
  15: [4,3,3,3,2,2,2,1,1,2],
  16: [4,3,3,3,2,2,2,1,1,2],
  17: [4,3,3,3,2,2,2,1,1,2],
  18: [4,3,3,3,3,2,2,1,1,2],
  19: [4,3,3,3,3,2,2,2,1,2],
  20: [4,3,3,3,3,2,2,2,2,2],
};

const HALF_CASTER: Record<number, number[]> = {
  2:  [2],
  3:  [3],
  4:  [3],
  5:  [4,2],
  6:  [4,2],
  7:  [4,3,2],
  8:  [4,3,2],
  9:  [4,3,3,1],
  10: [4,3,3,1],
  11: [4,3,3,2,1],
  12: [4,3,3,2,1],
  13: [4,3,3,2,1,1],
  14: [4,3,3,2,1,1],
  15: [4,3,3,2,1,1,1],
  16: [4,3,3,2,1,1,1],
  17: [4,3,3,2,1,1,1,1],
  18: [4,3,3,2,1,1,1,1],
  19: [4,3,3,2,1,1,1,1,1],
  20: [4,3,3,2,1,1,1,1,1,1],
};

const WARLOCK: Record<number, { slots: number; level: number }> = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 },
};

const FULL_CASTER_CLASSES = ['bard','cleric','druid','sorcerer','wizard','artificer'];
const HALF_CASTER_CLASSES = ['paladin','ranger'];
const WARLOCK_CLASSES = ['warlock'];

function detectCasterType(subtitle: string): 'full' | 'half' | 'warlock' | null {
  const s = subtitle.toLowerCase();
  if (FULL_CASTER_CLASSES.some(c => s.includes(c))) return 'full';
  if (HALF_CASTER_CLASSES.some(c => s.includes(c))) return 'half';
  if (WARLOCK_CLASSES.some(c => s.includes(c))) return 'warlock';
  return null;
}

export function defaultSpellSlots(level: number, subtitle: string): SpellSlots {
  const casterType = detectCasterType(subtitle);
  if (!casterType) return {};

  const slots: SpellSlots = {};

  if (casterType === 'warlock') {
    const w = WARLOCK[Math.min(level, 20)];
    if (w) slots[w.level] = { total: w.slots, used: 0 };
    return slots;
  }

  const table = casterType === 'full' ? FULL_CASTER : HALF_CASTER;
  const row = table[Math.min(level, 20)];
  if (!row) return {};
  row.forEach((total, i) => {
    if (total > 0) slots[i + 1] = { total, used: 0 };
  });
  return slots;
}
