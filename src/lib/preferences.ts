export interface AppPreferences {
  theme: 'light' | 'pink';
  optionalFeatures: {
    sessionBoard: boolean;
    dmNotes: boolean;
    ambientMusic: boolean;
    combatLog: boolean;
    playerViewTools: boolean;
    soundpad: boolean;
  };
  hue: {
    enabled: boolean;
    syncSceneColor: boolean;
    enabledEffects: Record<string, boolean>;
    effectTargets: Record<string, { players: boolean; monsters: boolean }>;
  };
  haEnabled: boolean;
  sound: {
    masterVolume: number;
    muted: boolean;
    spatialChannels: 2 | 6;
    autoplayEnabled: boolean;
  };
  display: {
    showOrderInName: boolean;
    visibleInlineActions: string[];
  };
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'pink',
  optionalFeatures: { sessionBoard: true, dmNotes: true, ambientMusic: true, combatLog: true, playerViewTools: true, soundpad: true },
  hue: { enabled: false, syncSceneColor: false, enabledEffects: {}, effectTargets: {} },
  haEnabled: false,
  sound: { masterVolume: 1, muted: false, spatialChannels: 2, autoplayEnabled: true },
  display: { showOrderInName: false, visibleInlineActions: [] },
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizePreferences(value: unknown): AppPreferences {
  if (!isObject(value)) return DEFAULT_PREFERENCES;
  const optionalFeatures = isObject(value.optionalFeatures) ? value.optionalFeatures : {};
  const hue = isObject(value.hue) ? value.hue : {};
  const sound = isObject(value.sound) ? value.sound : {};
  const display = isObject(value.display) ? value.display : {};
  const enabledEffects = isObject(hue.enabledEffects) ? hue.enabledEffects : {};
  const effectTargets = isObject(hue.effectTargets) ? hue.effectTargets : {};
  const volume = typeof sound.masterVolume === 'number' && sound.masterVolume >= 0 && sound.masterVolume <= 1
    ? sound.masterVolume
    : DEFAULT_PREFERENCES.sound.masterVolume;

  return {
    theme: value.theme === 'light' ? 'light' : DEFAULT_PREFERENCES.theme,
    optionalFeatures: {
      sessionBoard: typeof optionalFeatures.sessionBoard === 'boolean' ? optionalFeatures.sessionBoard : DEFAULT_PREFERENCES.optionalFeatures.sessionBoard,
      dmNotes: typeof optionalFeatures.dmNotes === 'boolean' ? optionalFeatures.dmNotes : DEFAULT_PREFERENCES.optionalFeatures.dmNotes,
      ambientMusic: typeof optionalFeatures.ambientMusic === 'boolean' ? optionalFeatures.ambientMusic : DEFAULT_PREFERENCES.optionalFeatures.ambientMusic,
      combatLog: typeof optionalFeatures.combatLog === 'boolean' ? optionalFeatures.combatLog : DEFAULT_PREFERENCES.optionalFeatures.combatLog,
      playerViewTools: typeof optionalFeatures.playerViewTools === 'boolean' ? optionalFeatures.playerViewTools : DEFAULT_PREFERENCES.optionalFeatures.playerViewTools,
      soundpad: typeof optionalFeatures.soundpad === 'boolean' ? optionalFeatures.soundpad : DEFAULT_PREFERENCES.optionalFeatures.soundpad,
    },
    hue: {
      enabled: typeof hue.enabled === 'boolean' ? hue.enabled : DEFAULT_PREFERENCES.hue.enabled,
      syncSceneColor: typeof hue.syncSceneColor === 'boolean' ? hue.syncSceneColor : DEFAULT_PREFERENCES.hue.syncSceneColor,
      enabledEffects: Object.fromEntries(Object.entries(enabledEffects).filter(([, enabled]) => typeof enabled === 'boolean')) as Record<string, boolean>,
      effectTargets: Object.fromEntries(Object.entries(effectTargets).flatMap(([name, target]) => isObject(target) && typeof target.players === 'boolean' && typeof target.monsters === 'boolean' ? [[name, { players: target.players, monsters: target.monsters }]] : [])),
    },
    haEnabled: typeof value.haEnabled === 'boolean' ? value.haEnabled : DEFAULT_PREFERENCES.haEnabled,
    sound: {
      masterVolume: volume,
      muted: typeof sound.muted === 'boolean' ? sound.muted : DEFAULT_PREFERENCES.sound.muted,
      spatialChannels: sound.spatialChannels === 6 ? 6 : DEFAULT_PREFERENCES.sound.spatialChannels,
      autoplayEnabled: typeof sound.autoplayEnabled === 'boolean' ? sound.autoplayEnabled : DEFAULT_PREFERENCES.sound.autoplayEnabled,
    },
    display: {
      showOrderInName: typeof display.showOrderInName === 'boolean' ? display.showOrderInName : DEFAULT_PREFERENCES.display.showOrderInName,
      visibleInlineActions: Array.isArray(display.visibleInlineActions) && display.visibleInlineActions.every(action => typeof action === 'string') ? display.visibleInlineActions : DEFAULT_PREFERENCES.display.visibleInlineActions,
    },
  };
}
