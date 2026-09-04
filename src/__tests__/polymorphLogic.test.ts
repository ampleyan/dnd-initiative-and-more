import { describe, it, expect } from 'vitest';
import type { Combatant, MonsterTemplate, PolymorphForm } from '../types';

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c1',
    name: 'Thorn',
    type: 'player',
    initiative: 14,
    hp: { current: 30, max: 40 },
    ac: 16,
    speed: '30 ft.',
    subtitle: 'Level 5 Druid',
    avatar: '/avatars/thorn.png',
    conditions: [],
    tags: [],
    stats: { str: 10, dex: 14, con: 12, int: 8, wis: 18, cha: 10 },
    ...overrides,
  };
}

function makeMonster(overrides: Partial<MonsterTemplate> = {}): MonsterTemplate {
  return {
    id: 'm1',
    name: 'Giant Ape',
    cr: '7',
    type: 'beast',
    description: '',
    image: '',
    hp: 157,
    ac: 12,
    speed: '40 ft., climb 40 ft.',
    stats: { str: 23, dex: 14, con: 18, int: 7, wis: 12, cha: 7 },
    ...overrides,
  };
}

function buildPolymorphed(combatant: Combatant, monster: MonsterTemplate): Combatant {
  const polymorphForm: PolymorphForm = {
    originalHp: combatant.hp,
    originalAc: combatant.ac,
    originalStats: combatant.stats,
    originalName: combatant.name,
    originalSubtitle: combatant.subtitle,
    originalAvatar: combatant.avatar,
    originalSpeed: combatant.speed,
  };
  return {
    ...combatant,
    name: monster.name,
    subtitle: `${combatant.name} (Polymorphed)`,
    avatar: monster.avatar ?? combatant.avatar,
    ac: monster.ac,
    stats: monster.stats,
    speed: monster.speed,
    hp: { current: monster.hp, max: monster.hp },
    polymorphForm,
  };
}

function buildReverted(combatant: Combatant): Combatant {
  const f = combatant.polymorphForm!;
  return {
    ...combatant,
    name: f.originalName,
    subtitle: f.originalSubtitle,
    avatar: f.originalAvatar ?? combatant.avatar,
    ac: f.originalAc,
    stats: f.originalStats,
    speed: f.originalSpeed ?? combatant.speed,
    hp: f.originalHp,
    polymorphForm: undefined,
  };
}

describe('buildPolymorphed', () => {
  it('swaps name, ac, stats, hp with monster values', () => {
    const pc = makeCombatant();
    const monster = makeMonster();
    const result = buildPolymorphed(pc, monster);
    expect(result.name).toBe('Giant Ape');
    expect(result.ac).toBe(12);
    expect(result.hp).toEqual({ current: 157, max: 157 });
    expect(result.stats.str).toBe(23);
  });

  it('sets subtitle to original name + (Polymorphed)', () => {
    const result = buildPolymorphed(makeCombatant(), makeMonster());
    expect(result.subtitle).toBe('Thorn (Polymorphed)');
  });

  it('stores original values in polymorphForm', () => {
    const pc = makeCombatant();
    const result = buildPolymorphed(pc, makeMonster());
    expect(result.polymorphForm).toBeDefined();
    expect(result.polymorphForm!.originalName).toBe('Thorn');
    expect(result.polymorphForm!.originalHp).toEqual({ current: 30, max: 40 });
    expect(result.polymorphForm!.originalAc).toBe(16);
  });

  it('preserves non-stat fields (id, initiative, conditions, tags)', () => {
    const pc = makeCombatant({ conditions: ['prone'], tags: ['custom'] });
    const result = buildPolymorphed(pc, makeMonster());
    expect(result.id).toBe('c1');
    expect(result.initiative).toBe(14);
    expect(result.conditions).toEqual(['prone']);
    expect(result.tags).toEqual(['custom']);
  });

  it('falls back to original avatar if monster has no avatar', () => {
    const pc = makeCombatant({ avatar: '/orig.png' });
    const monster = makeMonster({ avatar: undefined });
    const result = buildPolymorphed(pc, monster);
    expect(result.avatar).toBe('/orig.png');
  });
});

describe('buildReverted', () => {
  it('restores original name, ac, stats, hp', () => {
    const pc = makeCombatant();
    const polymorphed = buildPolymorphed(pc, makeMonster());
    const reverted = buildReverted(polymorphed);
    expect(reverted.name).toBe('Thorn');
    expect(reverted.ac).toBe(16);
    expect(reverted.hp).toEqual({ current: 30, max: 40 });
    expect(reverted.stats.str).toBe(10);
  });

  it('clears polymorphForm after revert', () => {
    const reverted = buildReverted(buildPolymorphed(makeCombatant(), makeMonster()));
    expect(reverted.polymorphForm).toBeUndefined();
  });

  it('preserves non-stat fields unchanged through polymorph/revert cycle', () => {
    const pc = makeCombatant({ conditions: ['poisoned'] });
    const reverted = buildReverted(buildPolymorphed(pc, makeMonster()));
    expect(reverted.conditions).toEqual(['poisoned']);
    expect(reverted.id).toBe('c1');
  });
});
