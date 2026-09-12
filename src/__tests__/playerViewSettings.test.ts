import { describe, expect, it } from 'vitest';
import {
  normalizePlayerViewSettings,
  normalizePreset,
  applyPreset,
  PLAYER_VIEW_PRESETS,
  DEFAULT_PLAYER_VIEW_SETTINGS,
} from '../lib/playerViewSettings';

describe('PLAYER_VIEW_PRESETS', () => {
  it('defines all four presets', () => {
    expect(Object.keys(PLAYER_VIEW_PRESETS).sort()).toEqual(['boss', 'cinematic', 'mystery', 'tactical']);
  });

  it('tactical shows all party stats with exact HP', () => {
    const p = PLAYER_VIEW_PRESETS.tactical;
    expect(p.party.hpMode).toBe('exact');
    expect(p.party.showAc).toBe(true);
    expect(p.showInitiativeOrder).toBe(true);
  });

  it('cinematic hides all HP and AC from players', () => {
    const p = PLAYER_VIEW_PRESETS.cinematic;
    expect(p.party.hpMode).toBe('hidden');
    expect(p.party.showAc).toBe(false);
    expect(p.monsters.showAc).toBe(false);
    expect(p.showInitiativeOrder).toBe(false);
    expect(p.defeatedCombatants).toBe('hide');
  });

  it('mystery hides monster names, AC and conditions', () => {
    const p = PLAYER_VIEW_PRESETS.mystery;
    expect(p.monsters.showName).toBe(false);
    expect(p.monsters.showAc).toBe(false);
    expect(p.monsters.showConditions).toBe(false);
    expect(p.party.showName).toBe(true);
  });

  it('boss shows bosses with banded HP', () => {
    const p = PLAYER_VIEW_PRESETS.boss;
    expect(p.bosses.hpMode).toBe('banded');
    expect(p.bosses.showName).toBe(true);
    expect(p.bosses.showAc).toBe(true);
  });
});

describe('applyPreset', () => {
  it('returns the preset settings', () => {
    const result = applyPreset('tactical');
    expect(result.party.hpMode).toBe('exact');
    expect(result.spotlight).toBeUndefined();
  });

  it('merges spotlight when provided', () => {
    const result = applyPreset('boss', { combatantId: 'boss-1', label: 'Dragon' });
    expect(result.spotlight).toEqual({ combatantId: 'boss-1', label: 'Dragon' });
    expect(result.bosses.hpMode).toBe('banded');
  });
});

describe('normalizePreset', () => {
  it('returns valid preset strings', () => {
    expect(normalizePreset('tactical')).toBe('tactical');
    expect(normalizePreset('boss')).toBe('boss');
  });

  it('returns undefined for invalid values', () => {
    expect(normalizePreset('unknown')).toBeUndefined();
    expect(normalizePreset(42)).toBeUndefined();
    expect(normalizePreset(null)).toBeUndefined();
  });
});

describe('normalizePlayerViewSettings — spotlight', () => {
  it('preserves spotlight when present', () => {
    const result = normalizePlayerViewSettings(JSON.stringify({
      ...DEFAULT_PLAYER_VIEW_SETTINGS,
      spotlight: { combatantId: 'c1', label: 'Boss!' },
    }));
    expect(result.spotlight).toEqual({ combatantId: 'c1', label: 'Boss!' });
  });

  it('omits label when absent', () => {
    const result = normalizePlayerViewSettings({ ...DEFAULT_PLAYER_VIEW_SETTINGS, spotlight: { combatantId: 'c2' } });
    expect(result.spotlight?.combatantId).toBe('c2');
    expect(result.spotlight?.label).toBeUndefined();
  });

  it('ignores invalid spotlight objects', () => {
    const result = normalizePlayerViewSettings({ ...DEFAULT_PLAYER_VIEW_SETTINGS, spotlight: { label: 'no id' } });
    expect(result.spotlight).toBeUndefined();
  });

  it('returns undefined spotlight when missing', () => {
    const result = normalizePlayerViewSettings(DEFAULT_PLAYER_VIEW_SETTINGS);
    expect(result.spotlight).toBeUndefined();
  });
});
