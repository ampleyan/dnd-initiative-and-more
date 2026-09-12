import type { Combatant } from '../types';

export type PlayerViewHpMode = 'hidden' | 'banded' | 'exact';
export type PlayerViewWeather = 'none' | 'snow' | 'rain' | 'storm' | 'ash' | 'fog' | 'motes' | 'leaves' | 'sand';
export type PlayerViewPreset = 'tactical' | 'cinematic' | 'mystery' | 'boss';

export interface PlayerViewDisclosure { showName: boolean; showAc: boolean; showConditions: boolean; hpMode: PlayerViewHpMode; }
export interface PlayerViewSpotlight { combatantId: string; label?: string; }
export interface PlayerViewSettings { party: PlayerViewDisclosure; monsters: PlayerViewDisclosure; bosses: PlayerViewDisclosure; showInitiativeOrder: boolean; showRoundTurnBanner: boolean; defeatedCombatants: 'dim' | 'hide'; spotlight?: PlayerViewSpotlight; }

const legacyDisclosure: PlayerViewDisclosure = { showName: true, showAc: true, showConditions: true, hpMode: 'banded' };
export const DEFAULT_PLAYER_VIEW_SETTINGS: PlayerViewSettings = { party: { ...legacyDisclosure, hpMode: 'exact' }, monsters: { ...legacyDisclosure }, bosses: { ...legacyDisclosure }, showInitiativeOrder: true, showRoundTurnBanner: true, defeatedCombatants: 'dim' };

export const PLAYER_VIEW_PRESETS: Record<PlayerViewPreset, PlayerViewSettings> = {
  tactical: {
    party: { showName: true, showAc: true, showConditions: true, hpMode: 'exact' },
    monsters: { showName: true, showAc: true, showConditions: true, hpMode: 'banded' },
    bosses: { showName: true, showAc: true, showConditions: true, hpMode: 'banded' },
    showInitiativeOrder: true, showRoundTurnBanner: true, defeatedCombatants: 'dim',
  },
  cinematic: {
    party: { showName: true, showAc: false, showConditions: false, hpMode: 'hidden' },
    monsters: { showName: true, showAc: false, showConditions: false, hpMode: 'hidden' },
    bosses: { showName: true, showAc: false, showConditions: false, hpMode: 'banded' },
    showInitiativeOrder: false, showRoundTurnBanner: true, defeatedCombatants: 'hide',
  },
  mystery: {
    party: { showName: true, showAc: true, showConditions: true, hpMode: 'exact' },
    monsters: { showName: false, showAc: false, showConditions: false, hpMode: 'hidden' },
    bosses: { showName: false, showAc: false, showConditions: false, hpMode: 'banded' },
    showInitiativeOrder: true, showRoundTurnBanner: false, defeatedCombatants: 'dim',
  },
  boss: {
    party: { showName: true, showAc: true, showConditions: true, hpMode: 'exact' },
    monsters: { showName: true, showAc: false, showConditions: true, hpMode: 'hidden' },
    bosses: { showName: true, showAc: true, showConditions: true, hpMode: 'banded' },
    showInitiativeOrder: true, showRoundTurnBanner: true, defeatedCombatants: 'dim',
  },
};

export function applyPreset(preset: PlayerViewPreset, spotlight?: PlayerViewSpotlight): PlayerViewSettings {
  return { ...PLAYER_VIEW_PRESETS[preset], spotlight };
}

const weatherValues: PlayerViewWeather[] = ['none', 'snow', 'rain', 'storm', 'ash', 'fog', 'motes', 'leaves', 'sand'];
const presetValues: PlayerViewPreset[] = ['tactical', 'cinematic', 'mystery', 'boss'];
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function disclosure(value: unknown, fallback: PlayerViewDisclosure): PlayerViewDisclosure {
  const data = object(value);
  if (!data) return { ...fallback };
  return { showName: typeof data.showName === 'boolean' ? data.showName : fallback.showName, showAc: typeof data.showAc === 'boolean' ? data.showAc : fallback.showAc, showConditions: typeof data.showConditions === 'boolean' ? data.showConditions : fallback.showConditions, hpMode: data.hpMode === 'hidden' || data.hpMode === 'banded' || data.hpMode === 'exact' ? data.hpMode : fallback.hpMode };
}
function spotlight(value: unknown): PlayerViewSpotlight | undefined {
  const data = object(value);
  if (!data || typeof data.combatantId !== 'string') return undefined;
  return { combatantId: data.combatantId, label: typeof data.label === 'string' ? data.label : undefined };
}
export function normalizePlayerViewSettings(value: unknown): PlayerViewSettings {
  let parsed = value;
  if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch { parsed = null; } }
  const data = object(parsed);
  if (!data) return structuredClone(DEFAULT_PLAYER_VIEW_SETTINGS);
  return { party: disclosure(data.party, DEFAULT_PLAYER_VIEW_SETTINGS.party), monsters: disclosure(data.monsters, DEFAULT_PLAYER_VIEW_SETTINGS.monsters), bosses: disclosure(data.bosses, DEFAULT_PLAYER_VIEW_SETTINGS.bosses), showInitiativeOrder: typeof data.showInitiativeOrder === 'boolean' ? data.showInitiativeOrder : true, showRoundTurnBanner: typeof data.showRoundTurnBanner === 'boolean' ? data.showRoundTurnBanner : true, defeatedCombatants: data.defeatedCombatants === 'hide' ? 'hide' : 'dim', spotlight: spotlight(data.spotlight) };
}
export function normalizeWeather(value: unknown): PlayerViewWeather { return typeof value === 'string' && weatherValues.includes(value as PlayerViewWeather) ? value as PlayerViewWeather : 'none'; }
export function normalizePreset(value: unknown): PlayerViewPreset | undefined { return typeof value === 'string' && presetValues.includes(value as PlayerViewPreset) ? value as PlayerViewPreset : undefined; }
export function getPlayerViewDisclosure(combatant: Combatant, settings: PlayerViewSettings): PlayerViewDisclosure { return combatant.type === 'player' ? settings.party : combatant.legendaryActions ? settings.bosses : settings.monsters; }
