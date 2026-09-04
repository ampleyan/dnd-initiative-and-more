import { describe, it, expect } from 'vitest';
import { cn, uuid, clean5eTags } from '../lib/utils';

// ── cn (className merge) ─────────────────────────────────────────────────────
describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'nope', 'yes')).toBe('base yes');
  });

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles undefined/null gracefully', () => {
    expect(cn('a', undefined, null as unknown as string, 'b')).toBe('a b');
  });
});

// ── uuid ─────────────────────────────────────────────────────────────────────
describe('uuid', () => {
  it('returns a string', () => {
    expect(typeof uuid()).toBe('string');
  });

  it('matches RFC 4122 v4 pattern', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid()).toMatch(uuidRegex);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
  });
});

// ── clean5eTags ───────────────────────────────────────────────────────────────
describe('clean5eTags', () => {
  it('returns empty string for falsy input', () => {
    expect(clean5eTags('')).toBe('');
    expect(clean5eTags(null as unknown as string)).toBe('');
    expect(clean5eTags(undefined as unknown as string)).toBe('');
  });

  it('converts {@atk mw} to "Melee Weapon Attack:"', () => {
    expect(clean5eTags('{@atk mw}')).toBe('Melee Weapon Attack:');
  });

  it('converts {@atk rw} to "Ranged Weapon Attack:"', () => {
    expect(clean5eTags('{@atk rw}')).toBe('Ranged Weapon Attack:');
  });

  it('converts {@hit 7} to "+7"', () => {
    expect(clean5eTags('{@hit 7}')).toBe('+7');
  });

  it('converts {@h} to "Hit: "', () => {
    expect(clean5eTags('{@h}')).toBe('Hit:');
  });

  it('converts {@dc 15} to "DC 15"', () => {
    expect(clean5eTags('{@dc 15}')).toBe('DC 15');
  });

  it('converts {@damage 2d6+3} to "2d6+3"', () => {
    expect(clean5eTags('{@damage 2d6+3}')).toBe('2d6+3');
  });

  it('converts {@dice 3d8} to "3d8"', () => {
    expect(clean5eTags('{@dice 3d8}')).toBe('3d8');
  });

  it('strips pipe aliases from {@dice 3d8|fire}', () => {
    expect(clean5eTags('{@dice 3d8|fire}')).toBe('3d8');
  });

  it('converts {@spell fireball} to "fireball"', () => {
    expect(clean5eTags('{@spell fireball}')).toBe('fireball');
  });

  it('converts {@creature goblin} to "goblin"', () => {
    expect(clean5eTags('{@creature goblin}')).toBe('goblin');
  });

  it('handles a realistic attack string', () => {
    const input = '{@atk mw} {@hit 5} to hit, reach 5 ft. {@h}{@damage 1d6+3} piercing.';
    const out = clean5eTags(input);
    expect(out).toContain('Melee Weapon Attack:');
    expect(out).toContain('+5');
    expect(out).toContain('Hit:');
    expect(out).toContain('1d6+3');
  });

  it('passes through plain text unchanged', () => {
    expect(clean5eTags('Normal text, no tags.')).toBe('Normal text, no tags.');
  });
});
