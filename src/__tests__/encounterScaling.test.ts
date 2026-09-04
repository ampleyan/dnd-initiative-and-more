import { describe, it, expect } from 'vitest';
import {
  parseCR, crToXP, xpToCR, monsterMultiplier, parseLevel, scaleToHard,
} from '../lib/encounterScaling';
import type { Combatant, Player } from '../types';

// ── parseCR ───────────────────────────────────────────────────────────────────

describe('parseCR', () => {
  it('parses integer CR from subtitle', () => {
    expect(parseCR('Medium humanoid, CR 5')).toBe('5');
  });
  it('parses fractional CR from subtitle', () => {
    expect(parseCR('Small beast, CR 1/2')).toBe('1/2');
  });
  it('returns null when no CR in subtitle', () => {
    expect(parseCR('Commoner')).toBeNull();
    expect(parseCR(undefined)).toBeNull();
  });
});

// ── xpToCR ────────────────────────────────────────────────────────────────────

describe('xpToCR', () => {
  it('returns CR 1 for exactly 200 XP', () => {
    expect(xpToCR(200)).toBe('1');
  });
  it('returns CR 1 for 449 XP (rounds down, not up to CR 2)', () => {
    expect(xpToCR(449)).toBe('1');
  });
  it('returns CR 2 for 450 XP', () => {
    expect(xpToCR(450)).toBe('2');
  });
  it('caps at CR 24 when targetXP exceeds max', () => {
    expect(xpToCR(999999)).toBe('24');
  });
  it('never returns a CR below minCR', () => {
    expect(xpToCR(10, '5')).toBe('5');
  });
});

// ── monsterMultiplier ─────────────────────────────────────────────────────────

describe('monsterMultiplier', () => {
  it('returns 1 for 1 monster', () => expect(monsterMultiplier(1)).toBe(1));
  it('returns 1.5 for 2 monsters', () => expect(monsterMultiplier(2)).toBe(1.5));
  it('returns 2 for 3 monsters', () => expect(monsterMultiplier(3)).toBe(2));
  it('returns 4 for 15+ monsters', () => expect(monsterMultiplier(15)).toBe(4));
});

// ── parseLevel ────────────────────────────────────────────────────────────────

describe('parseLevel', () => {
  it('parses "level 5" from subtitle', () => expect(parseLevel('Rogue, level 5')).toBe(5));
  it('parses "3rd level" from subtitle', () => expect(parseLevel('3rd level wizard')).toBe(3));
  it('returns 1 when nothing parseable', () => expect(parseLevel('Commoner')).toBe(1));
  it('returns 1 for undefined', () => expect(parseLevel(undefined)).toBe(1));
});

// ── scaleToHard ───────────────────────────────────────────────────────────────

function makeMonster(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c1', name: 'Goblin', type: 'monster', initiative: 10,
    hp: { current: 7, max: 7 }, ac: 15, speed: '30 ft.',
    avatar: '',
    conditions: [], tags: [],
    stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    vulnerabilities: [], resistances: [], damageImmunities: [], conditionImmunities: [],
    actions: [], abilities: [], spells: [],
    subtitle: 'Small humanoid (goblinoid), CR 1/4',
    ...overrides,
  };
}

function makePlayer(level: number): Player {
  return {
    id: `p${level}`, name: `Player${level}`, subtitle: `Fighter, level ${level}`,
    level, hp_max: level * 10, ac: 16, speed: '30 ft.',
    avatar: '',
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    actions: [], abilities: [], spells: [],
  };
}

describe('scaleToHard', () => {
  it('returns one row per non-player combatant', () => {
    const combatants = [
      makeMonster({ id: 'c1' }),
      makeMonster({ id: 'c2', type: 'player' }),
    ];
    const result = scaleToHard(combatants, [makePlayer(5)]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('proposes a higher CR when encounter is below Hard', () => {
    // 4 level-5 players: Hard threshold = 4 × 750 = 3000 XP
    // 1 CR 1/4 goblin: raw 50 XP × 1 multiplier = 50 XP → way below Hard
    const result = scaleToHard(
      [makeMonster()],
      [makePlayer(5), makePlayer(5), makePlayer(5), makePlayer(5)],
    );
    expect(crToXP(result[0].targetCR)).toBeGreaterThan(crToXP('1/4'));
  });

  it('proposes same or nearby CR when encounter is already Hard', () => {
    // 1 level-1 player: Hard threshold = 75 XP
    // 1 CR 1 monster: raw 200 XP → above Hard, scale factor < 1 → should clamp to current CR
    const result = scaleToHard(
      [makeMonster({ subtitle: 'Humanoid, CR 1', hp: { current: 78, max: 78 }, ac: 13 })],
      [makePlayer(1)],
    );
    // target CR must be >= current CR (never lower)
    expect(crToXP(result[0].targetCR)).toBeGreaterThanOrEqual(crToXP('1'));
  });

  it('uses fallback HP (currentHP × scaleFactor) when CR is unknown', () => {
    const monster = makeMonster({ subtitle: 'Homebrew beast', hp: { current: 30, max: 30 }, ac: 12 });
    const result = scaleToHard([monster], [makePlayer(5), makePlayer(5), makePlayer(5), makePlayer(5)]);
    expect(result[0].currentCR).toBeNull();
    expect(result[0].proposedHP).toBeGreaterThan(30);
  });

  it('respects overrideLevel', () => {
    const atLevel5 = scaleToHard([makeMonster()], [makePlayer(1)], 5);
    const atLevel1 = scaleToHard([makeMonster()], [makePlayer(5)], 1);
    // Higher override level → higher Hard threshold → higher proposed CR
    expect(crToXP(atLevel5[0].targetCR)).toBeGreaterThanOrEqual(crToXP(atLevel1[0].targetCR));
  });
});
