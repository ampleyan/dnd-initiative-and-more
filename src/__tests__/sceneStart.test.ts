import { describe, expect, it } from 'vitest';
import {
  buildSceneStartCommands,
  defaultSceneStartConfig,
  normalizeSceneStartConfig,
  type SceneStartConfig,
} from '../lib/sceneStart';

const baseEncounter = {
  backgroundImage: '/img/cave.jpg',
  musicUrl: 'https://example.com/battle.mp3',
  huePreset: 'dungeon',
  playerViewSettings: { party: { showName: true, showAc: true, showConditions: true, hpMode: 'exact' as const }, monsters: { showName: true, showAc: true, showConditions: true, hpMode: 'banded' as const }, bosses: { showName: true, showAc: true, showConditions: true, hpMode: 'banded' as const }, showInitiativeOrder: true, showRoundTurnBanner: true, defeatedCombatants: 'dim' as const },
  weather: 'rain' as const,
};

describe('defaultSceneStartConfig', () => {
  it('returns a config with all flags false by default', () => {
    const config = defaultSceneStartConfig();
    expect(config.applyBackground).toBe(false);
    expect(config.applyMusic).toBe(false);
    expect(config.applyHuePreset).toBe(false);
    expect(config.applyPlayerView).toBe(false);
    expect(config.applyWeather).toBe(false);
  });
});

describe('normalizeSceneStartConfig', () => {
  it('returns default config for null/undefined', () => {
    expect(normalizeSceneStartConfig(null)).toEqual(defaultSceneStartConfig());
    expect(normalizeSceneStartConfig(undefined)).toEqual(defaultSceneStartConfig());
  });

  it('parses a JSON string', () => {
    const config: SceneStartConfig = { applyBackground: true, applyMusic: false, applyHuePreset: true, applyPlayerView: false, applyWeather: false };
    const result = normalizeSceneStartConfig(JSON.stringify(config));
    expect(result.applyBackground).toBe(true);
    expect(result.applyHuePreset).toBe(true);
  });

  it('accepts a plain object', () => {
    const result = normalizeSceneStartConfig({ applyBackground: true });
    expect(result.applyBackground).toBe(true);
    expect(result.applyMusic).toBe(false);
  });

  it('ignores non-boolean values', () => {
    const result = normalizeSceneStartConfig({ applyBackground: 'yes', applyMusic: 1 });
    expect(result.applyBackground).toBe(false);
    expect(result.applyMusic).toBe(false);
  });

  it('returns default for invalid JSON', () => {
    expect(normalizeSceneStartConfig('{bad json')).toEqual(defaultSceneStartConfig());
  });
});

describe('buildSceneStartCommands', () => {
  it('returns empty array when all flags are false', () => {
    const commands = buildSceneStartCommands(baseEncounter, defaultSceneStartConfig());
    expect(commands).toHaveLength(0);
  });

  it('emits background command when applyBackground is true and backgroundImage exists', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyBackground: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'background', value: '/img/cave.jpg' });
  });

  it('skips background command when backgroundImage is absent', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyBackground: true };
    const commands = buildSceneStartCommands({ ...baseEncounter, backgroundImage: undefined }, config);
    expect(commands).toHaveLength(0);
  });

  it('emits music command when applyMusic is true and musicUrl exists', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyMusic: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'music', value: 'https://example.com/battle.mp3' });
  });

  it('emits hue command when applyHuePreset is true and huePreset exists', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyHuePreset: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'hue', value: 'dungeon' });
  });

  it('emits playerView command when applyPlayerView is true and playerViewSettings exists', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyPlayerView: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(1);
    expect(commands[0].type).toBe('playerView');
    expect(commands[0].value).toEqual(baseEncounter.playerViewSettings);
  });

  it('emits weather command when applyWeather is true and weather exists', () => {
    const config: SceneStartConfig = { ...defaultSceneStartConfig(), applyWeather: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'weather', value: 'rain' });
  });

  it('emits multiple commands when multiple flags are true', () => {
    const config: SceneStartConfig = { applyBackground: true, applyMusic: true, applyHuePreset: true, applyPlayerView: true, applyWeather: true };
    const commands = buildSceneStartCommands(baseEncounter, config);
    expect(commands).toHaveLength(5);
    const types = commands.map(c => c.type);
    expect(types).toContain('background');
    expect(types).toContain('music');
    expect(types).toContain('hue');
    expect(types).toContain('playerView');
    expect(types).toContain('weather');
  });

  it('skips commands for fields that have no value', () => {
    const config: SceneStartConfig = { applyBackground: true, applyMusic: true, applyHuePreset: true, applyPlayerView: true, applyWeather: true };
    const emptyEncounter = {};
    const commands = buildSceneStartCommands(emptyEncounter, config);
    expect(commands).toHaveLength(0);
  });

  it('is deterministic', () => {
    const config: SceneStartConfig = { applyBackground: true, applyMusic: true, applyHuePreset: false, applyPlayerView: false, applyWeather: false };
    const c1 = buildSceneStartCommands(baseEncounter, config);
    const c2 = buildSceneStartCommands(baseEncounter, config);
    expect(c1).toEqual(c2);
  });
});
