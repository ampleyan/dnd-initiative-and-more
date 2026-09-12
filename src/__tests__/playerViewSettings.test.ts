import { describe, expect, it } from 'vitest';
import type { Combatant } from '../types';
import { DEFAULT_PLAYER_VIEW_SETTINGS, getPlayerViewDisclosure, normalizePlayerViewSettings, normalizeWeather } from '../lib/playerViewSettings';

const combatant = (overrides: Partial<Combatant>): Combatant => ({
  id: 'c', name: 'Combatant', type: 'monster', initiative: 10, hp: { current: 10, max: 20 }, ac: 14,
  speed: '30 ft.', subtitle: '', avatar: '', conditions: [], tags: [],
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ...overrides,
});

describe('player view settings', () => {
  it('defaults legacy and malformed settings to the established disclosure', () => {
    expect(normalizePlayerViewSettings(null)).toEqual(DEFAULT_PLAYER_VIEW_SETTINGS);
    expect(normalizePlayerViewSettings('{bad json')).toEqual(DEFAULT_PLAYER_VIEW_SETTINGS);
  });

  it('selects disclosures by party, monster, and legendary boss', () => {
    const settings = normalizePlayerViewSettings({
      party: { showName: true, showAc: true, showConditions: true, hpMode: 'exact' },
      monsters: { showName: false, showAc: false, showConditions: false, hpMode: 'hidden' },
      bosses: { showName: true, showAc: false, showConditions: true, hpMode: 'banded' },
    });
    expect(getPlayerViewDisclosure(combatant({ type: 'player' }), settings).hpMode).toBe('exact');
    expect(getPlayerViewDisclosure(combatant({}), settings).showName).toBe(false);
    expect(getPlayerViewDisclosure(combatant({ legendaryActions: { max: 3, remaining: 3 } }), settings).hpMode).toBe('banded');
  });

  it('allows only supported weather and defaults everything else to none', () => {
    expect(normalizeWeather('rain')).toBe('rain');
    expect(normalizeWeather('sun')).toBe('none');
    expect(normalizeWeather(null)).toBe('none');
  });
});
