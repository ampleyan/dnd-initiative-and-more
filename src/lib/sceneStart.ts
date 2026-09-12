import type { PlayerViewSettings, PlayerViewWeather } from './playerViewSettings';

export interface SceneStartConfig {
  applyBackground: boolean;
  applyMusic: boolean;
  applyHuePreset: boolean;
  applyPlayerView: boolean;
  applyWeather: boolean;
}

export type SceneStartCommandType = 'background' | 'music' | 'hue' | 'playerView' | 'weather';

export interface SceneStartCommand {
  type: SceneStartCommandType;
  value: string | PlayerViewSettings;
}

export function defaultSceneStartConfig(): SceneStartConfig {
  return { applyBackground: false, applyMusic: false, applyHuePreset: false, applyPlayerView: false, applyWeather: false };
}

export function normalizeSceneStartConfig(value: unknown): SceneStartConfig {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return defaultSceneStartConfig(); }
  }
  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return defaultSceneStartConfig();
  }
  const data = parsed as Record<string, unknown>;
  return {
    applyBackground: data.applyBackground === true,
    applyMusic: data.applyMusic === true,
    applyHuePreset: data.applyHuePreset === true,
    applyPlayerView: data.applyPlayerView === true,
    applyWeather: data.applyWeather === true,
  };
}

interface EncounterSceneFields {
  backgroundImage?: string;
  musicUrl?: string;
  huePreset?: string;
  playerViewSettings?: PlayerViewSettings;
  weather?: PlayerViewWeather;
}

export function buildSceneStartCommands(
  encounter: EncounterSceneFields,
  config: SceneStartConfig,
): SceneStartCommand[] {
  const commands: SceneStartCommand[] = [];
  if (config.applyBackground && encounter.backgroundImage) {
    commands.push({ type: 'background', value: encounter.backgroundImage });
  }
  if (config.applyMusic && encounter.musicUrl) {
    commands.push({ type: 'music', value: encounter.musicUrl });
  }
  if (config.applyHuePreset && encounter.huePreset) {
    commands.push({ type: 'hue', value: encounter.huePreset });
  }
  if (config.applyPlayerView && encounter.playerViewSettings) {
    commands.push({ type: 'playerView', value: encounter.playerViewSettings });
  }
  if (config.applyWeather && encounter.weather) {
    commands.push({ type: 'weather', value: encounter.weather });
  }
  return commands;
}
