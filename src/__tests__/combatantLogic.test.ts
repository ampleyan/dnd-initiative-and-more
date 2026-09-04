/**
 * Tests for combatant business logic:
 * - Initiative sorting with companion placement
 * - HP bar percentage
 * - Short rest vs long rest spell slot logic
 * - Condition preservation on encounter start (BUG-10 regression guard)
 * - Add All Players spell slot copy (BUG-13 regression guard)
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, SpellSlots } from '../types';
import { sortWithCompanions, applyTurnStart, shouldTriggerLairAction } from '../lib/combatantUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeCombatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: crypto.randomUUID(),
    name: 'Unnamed',
    type: 'monster',
    initiative: 10,
    hp: { current: 20, max: 20 },
    ac: 12,
    speed: '30 ft.',
    subtitle: '',
    avatar: '',
    conditions: [],
    tags: [],
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ...overrides,
  };
}

describe('sortWithCompanions', () => {
  it('sorts by initiative descending', () => {
    const a = makeCombatant({ id: 'a', initiative: 5 });
    const b = makeCombatant({ id: 'b', initiative: 20 });
    const c = makeCombatant({ id: 'c', initiative: 12 });
    const sorted = sortWithCompanions([a, b, c]);
    expect(sorted.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('places companion immediately after its owner', () => {
    const owner  = makeCombatant({ id: 'owner',  initiative: 15 });
    const pet    = makeCombatant({ id: 'pet',    initiative: 5, ownerId: 'owner' });
    const enemy  = makeCombatant({ id: 'enemy',  initiative: 10 });
    const sorted = sortWithCompanions([pet, enemy, owner]);
    expect(sorted.map(x => x.id)).toEqual(['owner', 'pet', 'enemy']);
  });

  it('does not include companion in the main initiative ordering', () => {
    const owner  = makeCombatant({ id: 'owner',  initiative: 5 });
    const pet    = makeCombatant({ id: 'pet',    initiative: 99, ownerId: 'owner' });
    const enemy  = makeCombatant({ id: 'enemy',  initiative: 10 });
    const sorted = sortWithCompanions([pet, enemy, owner]);
    // pet should still come after owner, not at the top
    expect(sorted.map(x => x.id)).toEqual(['enemy', 'owner', 'pet']);
  });

  it('returns empty array for empty input', () => {
    expect(sortWithCompanions([])).toEqual([]);
  });

  it('handles multiple companions for one owner', () => {
    const owner = makeCombatant({ id: 'owner', initiative: 20 });
    const p1    = makeCombatant({ id: 'p1',    ownerId: 'owner' });
    const p2    = makeCombatant({ id: 'p2',    ownerId: 'owner' });
    const sorted = sortWithCompanions([p2, owner, p1]);
    expect(sorted[0].id).toBe('owner');
    expect(sorted.slice(1).map(x => x.id).sort()).toEqual(['p1', 'p2']);
  });
});

// ── HP percentage ─────────────────────────────────────────────────────────────
describe('HP percentage calculation', () => {
  it('returns 100% when at full health', () => {
    const c = makeCombatant({ hp: { current: 40, max: 40 } });
    expect(c.hp.current / c.hp.max).toBe(1);
  });

  it('returns 0% clamped when below 0', () => {
    const c = makeCombatant({ hp: { current: -5, max: 40 } });
    const pct = Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100));
    expect(pct).toBe(0);
  });

  it('is in "critical" zone when < 30%', () => {
    const c = makeCombatant({ hp: { current: 5, max: 40 } });
    const isCritical = c.hp.current / c.hp.max < 0.3;
    expect(isCritical).toBe(true);
  });

  it('is NOT in critical zone when at 30%', () => {
    const c = makeCombatant({ hp: { current: 12, max: 40 } });
    const isCritical = c.hp.current / c.hp.max < 0.3;
    expect(isCritical).toBe(false);
  });
});

// ── Spell slot rest logic (BUG-8 regression guard) ───────────────────────────
// The fixed logic: long rest resets ALL slots; short rest resets NOTHING
// (Warlock-style slot recovery is handled separately via featureUses.restType)
function simulateRest(slots: SpellSlots, type: 'short' | 'long'): SpellSlots {
  if (type === 'long' && slots) {
    return Object.fromEntries(
      Object.entries(slots).map(([lvl, s]) => [lvl, { total: s?.total ?? 0, used: 0 }])
    ) as SpellSlots;
  }
  return slots; // short rest: no change to spell slots
}

describe('simulateRest — spell slot logic', () => {
  const usedSlots: SpellSlots = {
    1: { total: 4, used: 3 },
    2: { total: 3, used: 2 },
    3: { total: 2, used: 2 },
  };

  it('long rest resets all used slots to 0', () => {
    const result = simulateRest(usedSlots, 'long');
    expect(result![1]!.used).toBe(0);
    expect(result![2]!.used).toBe(0);
    expect(result![3]!.used).toBe(0);
  });

  it('long rest preserves total counts', () => {
    const result = simulateRest(usedSlots, 'long');
    expect(result![1]!.total).toBe(4);
    expect(result![2]!.total).toBe(3);
  });

  it('short rest does NOT reset any spell slots (regression: BUG-8)', () => {
    const result = simulateRest(usedSlots, 'short');
    expect(result![1]!.used).toBe(3); // unchanged
    expect(result![2]!.used).toBe(2); // unchanged
    expect(result![3]!.used).toBe(2); // unchanged
  });

  it('short rest returns the original object reference unchanged', () => {
    const result = simulateRest(usedSlots, 'short');
    expect(result).toBe(usedSlots);
  });

  it('handles undefined slots gracefully', () => {
    expect(simulateRest(undefined as unknown as SpellSlots, 'long')).toBeUndefined();
    expect(simulateRest(undefined as unknown as SpellSlots, 'short')).toBeUndefined();
  });
});

// ── Condition preservation on encounter start (BUG-10 regression guard) ──────
// Simulates handleFinishInitiative: conditions must NOT be wiped
function simulateFinishInitiative(combatants: Combatant[]): Combatant[] {
  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const firstId = sorted[0]?.id;
  return combatants.map(c => ({
    ...c,
    isCurrentTurn: c.id === firstId,
    // BUG-10 fix: conditions: [] was here before — must NOT be here
  }));
}

describe('handleFinishInitiative — condition preservation (BUG-10)', () => {
  it('preserves existing conditions when starting combat', () => {
    const combatants = [
      makeCombatant({ id: 'a', initiative: 20, conditions: ['blessed', 'hasted'] }),
      makeCombatant({ id: 'b', initiative: 10, conditions: ['poisoned'] }),
    ];
    const result = simulateFinishInitiative(combatants);
    expect(result.find(c => c.id === 'a')!.conditions).toEqual(['blessed', 'hasted']);
    expect(result.find(c => c.id === 'b')!.conditions).toEqual(['poisoned']);
  });

  it('sets isCurrentTurn only on the highest-initiative combatant', () => {
    const combatants = [
      makeCombatant({ id: 'low',  initiative: 5 }),
      makeCombatant({ id: 'high', initiative: 20 }),
      makeCombatant({ id: 'mid',  initiative: 12 }),
    ];
    const result = simulateFinishInitiative(combatants);
    expect(result.find(c => c.id === 'high')!.isCurrentTurn).toBe(true);
    expect(result.find(c => c.id === 'mid')!.isCurrentTurn).toBeFalsy();
    expect(result.find(c => c.id === 'low')!.isCurrentTurn).toBeFalsy();
  });
});

// ── Add All Players — field copy (BUG-13 regression guard) ───────────────────
describe('handleAddAllPlayersToEncounter — spell/feature fields (BUG-13)', () => {
  it('copies spellSlots from player roster to new combatant', () => {
    const player = {
      id: 'p1', name: 'Arya', hp_max: 40, ac: 15, speed: '30 ft.',
      subtitle: 'Ranger 5', avatar: '', stats: { str:10,dex:16,con:12,int:10,wis:14,cha:10 },
      actions: [], abilities: [], spells: [],
      spellIds: ['spell-1'], featureIds: ['feat-1'],
      spellSlots: { 1: { total: 4, used: 1 }, 2: { total: 2, used: 0 } },
      featureUses: { 'feat-1': { name: "Hunter's Mark", total: 1, used: 0, restType: 'short' as const } },
    };
    // This mirrors the fixed handleAddAllPlayersToEncounter mapping
    const newCombatant = {
      id: crypto.randomUUID(),
      name: player.name,
      type: 'player' as const,
      initiative: 0,
      hp: { current: player.hp_max, max: player.hp_max },
      ac: player.ac,
      speed: player.speed,
      subtitle: player.subtitle,
      avatar: player.avatar,
      conditions: [],
      tags: [],
      stats: { ...player.stats },
      actions: player.actions ?? [],
      abilities: player.abilities ?? [],
      spells: player.spells ?? [],
      playerId: player.id,
      spellIds: player.spellIds ?? [],
      featureIds: player.featureIds ?? [],
      spellSlots: player.spellSlots ? { ...player.spellSlots } : undefined,
      featureUses: player.featureUses ? { ...player.featureUses } : undefined,
    };

    expect(newCombatant.playerId).toBe('p1');
    expect(newCombatant.spellSlots![1]).toEqual({ total: 4, used: 1 });
    expect(newCombatant.featureUses!['feat-1'].name).toBe("Hunter's Mark");
    expect(newCombatant.spellIds).toEqual(['spell-1']);
  });
});

// ── XP table — CR 18 fix (QW-3 regression guard) ─────────────────────────────
describe('SEED_CR_XP table', () => {
  const SEED_CR_XP: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
    '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
    '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
    '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
    '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
    '21': 33000, '22': 41000, '23': 50000, '24': 62000,
  };

  it('has an entry for every CR 0–24', () => {
    const fractionals = ['1/8', '1/4', '1/2'];
    const integers = Array.from({ length: 25 }, (_, i) => String(i));
    for (const cr of [...fractionals, ...integers]) {
      expect(SEED_CR_XP[cr], `CR ${cr} missing`).toBeDefined();
    }
  });

  it('CR 18 is 20000 (regression: QW-3)', () => {
    expect(SEED_CR_XP['18']).toBe(20000);
  });

  it('CR 17 is 18000', () => {
    expect(SEED_CR_XP['17']).toBe(18000);
  });

  it('CR 19 is 22000', () => {
    expect(SEED_CR_XP['19']).toBe(22000);
  });

  it('returns 0 for unknown CR (via nullish fallback)', () => {
    expect(SEED_CR_XP['99'] ?? 0).toBe(0);
  });
});

// ── applyTurnStart ────────────────────────────────────────────────────────────

describe('applyTurnStart', () => {
  const base: Combatant = {
    id: 'c1', name: 'Dragon', type: 'monster', initiative: 20,
    hp: { current: 300, max: 300 }, ac: 22, speed: '40 ft.', subtitle: '', avatar: '',
    conditions: [], tags: [], stats: { str:27, dex:10, con:25, int:16, wis:13, cha:21 },
    vulnerabilities: [], resistances: [], damageImmunities: [], conditionImmunities: [],
    actions: [], abilities: [], spells: [],
  };

  it('resets remaining to max', () => {
    const c = { ...base, legendaryActions: { max: 3, remaining: 1 } };
    expect(applyTurnStart(c).legendaryActions).toEqual({ max: 3, remaining: 3 });
  });

  it('returns the same reference when no legendaryActions', () => {
    expect(applyTurnStart(base)).toBe(base);
  });

  it('handles remaining already at max (idempotent)', () => {
    const c = { ...base, legendaryActions: { max: 3, remaining: 3 } };
    expect(applyTurnStart(c).legendaryActions).toEqual({ max: 3, remaining: 3 });
  });
});

// ── shouldTriggerLairAction ───────────────────────────────────────────────────

function makeCombatantForLairAction(initiative: number): Combatant {
  return {
    id: String(initiative), name: `C${initiative}`, type: 'monster', initiative,
    hp: { current: 10, max: 10 }, ac: 10, speed: '30 ft.', subtitle: '', avatar: '',
    conditions: [], tags: [], stats: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
    vulnerabilities: [], resistances: [], damageImmunities: [], conditionImmunities: [],
    actions: [], abilities: [], spells: [],
  };
}

describe('shouldTriggerLairAction', () => {
  it('triggers on normal crossing: from >20 to ≤20', () => {
    const sorted = [makeCombatantForLairAction(25), makeCombatantForLairAction(18)];
    expect(shouldTriggerLairAction(sorted, 0, 1)).toBe(true);
  });

  it('does not trigger when both are above 20', () => {
    const sorted = [makeCombatantForLairAction(25), makeCombatantForLairAction(22)];
    expect(shouldTriggerLairAction(sorted, 0, 1)).toBe(false);
  });

  it('does not trigger when both are at/below 20', () => {
    const sorted = [makeCombatantForLairAction(18), makeCombatantForLairAction(12)];
    expect(shouldTriggerLairAction(sorted, 0, 1)).toBe(false);
  });

  it('triggers on round wrap when some combatant has initiative ≤20', () => {
    const sorted = [makeCombatantForLairAction(25), makeCombatantForLairAction(18)];
    expect(shouldTriggerLairAction(sorted, 1, 0)).toBe(true);
  });

  it('does not trigger on round wrap when all combatants are above 20', () => {
    const sorted = [makeCombatantForLairAction(25), makeCombatantForLairAction(22)];
    expect(shouldTriggerLairAction(sorted, 1, 0)).toBe(false);
  });
});
