import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { AppPreferences, DEFAULT_PREFERENCES, normalizePreferences } from '../lib/preferences';

function legacyPreferences() {
  try {
    return {
      theme: localStorage.getItem('appTheme'),
      optionalFeatures: JSON.parse(localStorage.getItem('optionalFeatures') ?? '{}'),
      hue: {
        enabled: localStorage.getItem('hueEnabled') === 'true',
        syncSceneColor: localStorage.getItem('hueSyncScene') === 'true',
        enabledEffects: JSON.parse(localStorage.getItem('hueEnabledEffects') ?? '{}'),
        effectTargets: JSON.parse(localStorage.getItem('hueEffectTargets') ?? '{}'),
      },
      haEnabled: localStorage.getItem('haEnabled') === 'true',
      sound: { spatialChannels: Number(localStorage.getItem('spatial_channels')), autoplayEnabled: localStorage.getItem('sound_autoplay_enabled') !== 'false' },
      display: { showOrderInName: localStorage.getItem('showOrderInName') === 'true', visibleInlineActions: JSON.parse(localStorage.getItem('visibleInlineActions') ?? '[]') },
    };
  } catch {
    return {};
  }
}

export function usePreferences(user: unknown) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.preferences.get().then(stored => {
      if (!active) return;
      const source = Object.keys(stored).length ? stored : legacyPreferences();
      const next = normalizePreferences(source);
      setPreferences(next);
      setLoaded(true);
      if (!Object.keys(stored).length) api.preferences.save(next).catch(() => {});
    }).catch(() => {
      if (!active) return;
      setPreferences(normalizePreferences(legacyPreferences()));
      setLoaded(true);
    });
    return () => { active = false; };
  }, [user]);

  const updatePreferences = useCallback((update: (current: AppPreferences) => AppPreferences) => {
    setPreferences(current => {
      const next = normalizePreferences(update(current));
      if (loaded) saveQueue.current = saveQueue.current.then(() => api.preferences.save(next).then(() => {})).catch(() => {});
      return next;
    });
  }, [loaded]);

  return { preferences, loaded, updatePreferences };
}
