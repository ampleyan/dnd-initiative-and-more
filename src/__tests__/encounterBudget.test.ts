import { describe, expect, it } from 'vitest';
import { calculateEncounterBudget } from '../lib/encounterBudget';
import type { Combatant, EncounterBudget } from '../types';

function makeMonster(overrides: Partial<Combatant> & { cr?: string } = {}): Combatant {
  const { cr, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    name: 'Monster',
    type: 'monster',
    initiative: 10,
    hp: { current: 30, max: 30 },
    ac: 12,
    speed: '30 ft.',
    subtitle: cr ? `CR ${cr}` : 'Monster',
    avatar: '',
    conditions: [],
    tags: [],
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ...rest,
  };
}

function budget(overrides: Partial<EncounterBudget> = {}): EncounterBudget {
  return {
    partySize: 4,
    partyLevels: [4, 4, 4, 4],
    targetDifficulty: 'medium',
    ...overrides,
  };
}

describe('calculateEncounterBudget', () => {
  it('returns trivial difficulty for an empty monster list', () => {
    const result = calculateEncounterBudget(budget(), []);
    expect(result.difficulty).toBe('trivial');
    expect(result.totalXP).toBe(0);
    expect(result.adjustedXP).toBe(0);
  });

  it('calculates threshold from per-player levels', () => {
    // 4 players at level 4: easy threshold is 125 each → 500 total
    const result = calculateEncounterBudget(budget({ partyLevels: [4, 4, 4, 4], targetDifficulty: 'easy' }), []);
    expect(result.threshold).toBe(500);
  });

  it('sums thresholds from mixed party levels', () => {
    // level 1 easy=25, level 5 easy=250 → total 275
    const result = calculateEncounterBudget(budget({ partyLevels: [1, 5], partySize: 2, targetDifficulty: 'easy' }), []);
    expect(result.threshold).toBe(275);
  });

  it('classifies difficulty by comparing adjustedXP to thresholds', () => {
    // 4×level-5 party: easy=1000, medium=2000, hard=3000, deadly=4400
    // One CR6 monster: 2300 xp raw, ×1 multiplier (1 monster)=2300 → medium
    const oneMonster = [makeMonster({ cr: '6' })];
    const result = calculateEncounterBudget(budget({ partyLevels: [5, 5, 5, 5] }), oneMonster);
    expect(result.difficulty).toBe('medium');
    expect(result.adjustedXP).toBe(2300);
  });

  it('applies the monster multiplier for group encounters', () => {
    // 5 monsters → multiplier 2
    const monsters = Array.from({ length: 5 }, () => makeMonster({ cr: '1' }));
    const result = calculateEncounterBudget(budget(), monsters);
    expect(result.multiplier).toBe(2);
    expect(result.totalXP).toBe(5 * 200);
    expect(result.adjustedXP).toBe(5 * 200 * 2);
  });

  it('handles monsters with no CR (absent XP) gracefully', () => {
    const noCrMonster = makeMonster({ subtitle: 'Custom creature' });
    const result = calculateEncounterBudget(budget(), [noCrMonster]);
    expect(result.totalXP).toBe(0);
    expect(result.assumptions.some(a => /CR unknown/i.test(a))).toBe(true);
  });

  it('adds outnumbered explanation when monster count exceeds party size', () => {
    const monsters = Array.from({ length: 6 }, () => makeMonster({ cr: '1/4' }));
    const result = calculateEncounterBudget(budget({ partySize: 4 }), monsters);
    expect(result.explanations.some(e => /outnumbered/i.test(e))).toBe(true);
  });

  it('adds solo swinginess explanation for single-monster encounters', () => {
    const result = calculateEncounterBudget(budget(), [makeMonster({ cr: '5' })]);
    expect(result.explanations.some(e => /solo|swing/i.test(e))).toBe(true);
  });

  it('adds mixed CR explanation when CR spread is wide (>3 tiers apart)', () => {
    const monsters = [makeMonster({ cr: '1' }), makeMonster({ cr: '10' })];
    const result = calculateEncounterBudget(budget(), monsters);
    expect(result.explanations.some(e => /mixed CR/i.test(e))).toBe(true);
  });

  it('adds reinforcement pressure explanation when hidden combatants are present', () => {
    const hidden = makeMonster({ cr: '1', hidden: true });
    const visible = makeMonster({ cr: '1', hidden: false });
    const result = calculateEncounterBudget(budget(), [visible, hidden], { includeHiddenWaves: false });
    expect(result.explanations.some(e => /reinforcement/i.test(e))).toBe(true);
  });

  it('includes hidden monsters in XP when includeHiddenWaves is true', () => {
    const hidden = makeMonster({ cr: '1', hidden: true });
    const withHidden = calculateEncounterBudget(budget(), [hidden], { includeHiddenWaves: true });
    const withoutHidden = calculateEncounterBudget(budget(), [hidden], { includeHiddenWaves: false });
    expect(withHidden.totalXP).toBeGreaterThan(withoutHidden.totalXP);
  });

  it('applies dmAdjustment to adjustedXP', () => {
    const result = calculateEncounterBudget(budget({ dmAdjustment: 500 }), [makeMonster({ cr: '1' })]);
    expect(result.adjustedXP).toBe(200 + 500);
  });

  it('is deterministic — same input produces same output', () => {
    const monsters = [makeMonster({ id: 'fixed', cr: '3' })];
    const a = calculateEncounterBudget(budget(), monsters);
    const b = calculateEncounterBudget(budget(), monsters);
    expect(a).toEqual(b);
  });
});
