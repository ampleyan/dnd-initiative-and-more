import { expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from '../lib/preferences';

it('merges stored preferences with defaults without accepting invalid values', () => {
  expect(normalizePreferences({
    theme: 'light',
    optionalFeatures: { sessionBoard: false },
    sound: { masterVolume: 0.4, spatialChannels: 6 },
    display: { showOrderInName: true },
  })).toEqual({
    ...DEFAULT_PREFERENCES,
    theme: 'light',
    optionalFeatures: { ...DEFAULT_PREFERENCES.optionalFeatures, sessionBoard: false },
    sound: { ...DEFAULT_PREFERENCES.sound, masterVolume: 0.4, spatialChannels: 6 },
    display: { ...DEFAULT_PREFERENCES.display, showOrderInName: true },
  });

  expect(normalizePreferences({ theme: 'midnight', sound: { masterVolume: 5, spatialChannels: 4 } }))
    .toEqual(DEFAULT_PREFERENCES);
});
