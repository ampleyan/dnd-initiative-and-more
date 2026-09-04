import { useEffect, useRef } from 'react';
import { Combatant, LogEntry, Spell } from '../types';
import { LOG_TYPE_TO_EFFECT, SCHOOL_TO_EFFECT, HueEffectName, HueEffectTargets, extractPalette } from '../lib/hueEffects';
import { api } from '../api/client';

export interface HueRuntimeConfig {
  enabled: boolean;
  hueEnabled?: boolean;
  haEnabled?: boolean;
  enabledEffects: Partial<Record<HueEffectName, boolean>>;
  effectTargets: Partial<Record<HueEffectName, HueEffectTargets>>;
  combatants: Combatant[];
  spells?: Spell[];
  syncSceneColor?: boolean;
  backgroundImage?: string;
}

export function useHueEffects(combatLog: LogEntry[], config: HueRuntimeConfig) {
  const lastIdRef = useRef<string | null>(null);
  const lastBgRef = useRef<string | undefined>(undefined);

  // Sync background scene color
  useEffect(() => {
    if (!config.enabled || !config.syncSceneColor) return;
    if (config.backgroundImage === lastBgRef.current) return;
    lastBgRef.current = config.backgroundImage;

    const syncColor = async () => {
      try {
        if (!config.backgroundImage) {
          await api.hue.setSceneColor({ colors: [], hueEnabled: config.hueEnabled, haEnabled: config.haEnabled });
          return;
        }

        // Extract a palette of colors to spread across lights
        const colors = await extractPalette(config.backgroundImage, 12);
        // If image failed to load, colors will be empty — skip API call
        if (!colors.length) return;
        await api.hue.setSceneColor({ colors, hueEnabled: config.hueEnabled, haEnabled: config.haEnabled });
      } catch (e) {
        // Ignore non-critical color sync failures
      }
    };

    syncColor();
  }, [config.backgroundImage, config.enabled, config.syncSceneColor]);

  // Flash effects
  useEffect(() => {
    const latest = combatLog[0];
    if (!latest || latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;

    if (!config.enabled) return;

    let effectName: HueEffectName | undefined = LOG_TYPE_TO_EFFECT[latest.type];

    if (latest.type === 'spell_cast' && config.spells?.length) {
      const spell = config.spells.find(s => s.name.toLowerCase() === (latest.actionName ?? '').toLowerCase());
      if (spell?.school) effectName = SCHOOL_TO_EFFECT[spell.school] ?? effectName;
    }

    if (!effectName) return;
    if (config.enabledEffects[effectName] === false) return;

    const targets = config.effectTargets[effectName];
    if (targets) {
      const combatantId = latest.targetId ?? latest.actorId;
      if (combatantId) {
        const combatant = config.combatants.find(c => c.id === combatantId);
        if (combatant) {
          const isPlayer = combatant.type === 'player';
          if (isPlayer && !targets.players) return;
          if (!isPlayer && !targets.monsters) return;
        }
      }
    }

    api.hue.flash({ effect: effectName, hueEnabled: config.hueEnabled, haEnabled: config.haEnabled }).catch(() => {});
  }, [combatLog, config]);
}
