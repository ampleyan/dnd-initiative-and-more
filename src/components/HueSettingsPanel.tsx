import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Wifi, RefreshCw, CheckCircle2, XCircle, Sliders, Zap, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { EFFECT_CONFIGS, HueEffectName, HueEffectTargets } from '../lib/hueEffects';
import { api } from '../api/client';

interface HueLight {
  id: string;
  name: string;
  on: boolean;
  reachable: boolean;
}

interface HueConfig {
  bridgeIp: string;
  username: string;
  lightIds: string[];
  enabledEffects: Partial<Record<HueEffectName, boolean>>;
  brightness: number;
  syncSceneColor?: boolean;
}

interface HueSettingsPanelProps {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  syncSceneColorEnabled: boolean;
  onToggleSyncScene: (v: boolean) => void;
  enabledEffects: Partial<Record<HueEffectName, boolean>>;
  onToggleEffect: (name: HueEffectName, v: boolean) => void;
  effectTargets: Partial<Record<HueEffectName, HueEffectTargets>>;
  onToggleTarget: (name: HueEffectName, target: 'players' | 'monsters', v: boolean) => void;
}

export const HueSettingsPanel: React.FC<HueSettingsPanelProps> = ({
  enabled,
  onToggleEnabled,
  syncSceneColorEnabled,
  onToggleSyncScene,
  enabledEffects,
  onToggleEffect,
  effectTargets,
  onToggleTarget,
}) => {
  const [config, setConfig] = useState<HueConfig | null>(null);
  const [lights, setLights] = useState<HueLight[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [loadingLights, setLoadingLights] = useState(false);
  const [testingEffect, setTestingEffect] = useState<string | null>(null);
  const [bridgeIpInput, setBridgeIpInput] = useState('');
  const [pairError, setPairError] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [updatingIp, setUpdatingIp] = useState(false);
  const [ipSuccess, setIpSuccess] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.hue.getConfig();
      setConfig(data as unknown as HueConfig);
      setBridgeIpInput((data as unknown as HueConfig).bridgeIp || '');
    } catch {}
  }, []);

  const loadLights = useCallback(async () => {
    setLoadingLights(true);
    try {
      const data = await api.hue.getLights();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const list: HueLight[] = Object.entries(data as Record<string, unknown>).map(([id, light]) => {
          const l = light as { name?: string; state?: { on?: boolean; reachable?: boolean } };
          return {
            id,
            name: l.name ?? id,
            on: l.state?.on ?? false,
            reachable: l.state?.reachable ?? false,
          };
        });
        setLights(list);
      }
    } catch {} finally {
      setLoadingLights(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config?.username) loadLights();
  }, [config?.username, loadLights]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const data = await api.hue.discover() as { savedIp?: string; bridges?: { internalipaddress?: string }[] };
      if (data.savedIp) setBridgeIpInput(data.savedIp);
      else if (data.bridges?.[0]?.internalipaddress) setBridgeIpInput(data.bridges[0].internalipaddress);
    } catch {} finally {
      setDiscovering(false);
    }
  };

  const handlePair = async () => {
    setPairError('');
    setPairSuccess(false);
    setPairing(true);
    try {
      await api.hue.pair(bridgeIpInput);
      setPairSuccess(true);
      await loadConfig();
      await loadLights();
    } catch (e: unknown) {
      setPairError(e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      setPairing(false);
    }
  };

  const toggleLight = async (id: string) => {
    if (!config) return;
    const newIds = config.lightIds.includes(id)
      ? config.lightIds.filter(l => l !== id)
      : [...config.lightIds, id];
    const updated = { ...config, lightIds: newIds };
    setConfig(updated);
    setSavingConfig(true);
    try {
      await api.hue.saveConfig(updated as unknown as Record<string, unknown>);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleBrightnessChange = async (brightness: number) => {
    if (!config) return;
    const updated = { ...config, brightness };
    setConfig(updated);
    await api.hue.saveConfig({ brightness });
  };

  const handleSyncSceneChange = async (syncSceneColor: boolean) => {
    onToggleSyncScene(syncSceneColor);
    if (!config) return;
    const updated = { ...config, syncSceneColor };
    setConfig(updated);
    await api.hue.saveConfig({ syncSceneColor });
  };

  const handleTestEffect = async (effectName: string) => {
    setTestingEffect(effectName);
    try {
      await api.hue.flash({ effect: effectName });
    } finally {
      setTimeout(() => setTestingEffect(null), 1500);
    }
  };

  const handleUpdateIp = async () => {
    setUpdatingIp(true);
    setIpSuccess(false);
    try {
      await api.hue.saveConfig({ bridgeIp: bridgeIpInput });
      setConfig(prev => prev ? { ...prev, bridgeIp: bridgeIpInput } : prev);
      setIpSuccess(true);
      await loadLights();
      setTimeout(() => setIpSuccess(false), 3000);
    } finally {
      setUpdatingIp(false);
    }
  };

  const isPaired = !!config?.username;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-on-surface text-lg">Philips Hue</h2>
            <p className="text-[11px] text-outline">React to combat events with your lights</p>
          </div>
        </div>
        {/* Master toggle */}
        <div
          onClick={() => onToggleEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-amber-500' : 'bg-surface-container-highest border border-outline/30'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>

      {/* Bridge setup — only shown when integration is enabled */}
      {enabled && (
      <section className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-bold text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" />
            Bridge Connection
          </h3>
          {isPaired && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 font-mono"
            placeholder="192.168.1.x"
            value={bridgeIpInput}
            onChange={e => setBridgeIpInput(e.target.value)}
          />
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="px-3 py-2 bg-surface-container-high border border-white/10 rounded-lg text-outline hover:text-on-surface transition-colors text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
            Auto-Discover
          </button>
        </div>

        {isPaired ? (
          <div className="space-y-2">
            <p className="text-[11px] text-outline leading-relaxed">
              Already paired — update the IP if your bridge moved to a new address. No button press needed.
            </p>
            <button
              onClick={handleUpdateIp}
              disabled={updatingIp || !bridgeIpInput || bridgeIpInput === config?.bridgeIp}
              className="w-full py-2.5 bg-surface-container-high border border-white/10 text-on-surface rounded-xl font-bold text-sm transition-all hover:border-primary/40 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updatingIp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {updatingIp ? 'Updating…' : 'Update Bridge IP'}
            </button>
            {ipSuccess && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> IP updated successfully!
              </p>
            )}
            <p className="text-[10px] text-outline/50 text-center">
              Need to re-pair a different bridge?{' '}
              <button onClick={() => { setConfig(prev => prev ? { ...prev, username: '' } : prev); setPairSuccess(false); setPairError(''); }} className="underline hover:text-outline transition-colors">
                Re-pair
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-outline leading-relaxed">
              Press the <strong className="text-on-surface">physical button</strong> on your Hue Bridge, then click Pair within 30 seconds.
            </p>
            <button
              onClick={handlePair}
              disabled={pairing || !bridgeIpInput}
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {pairing ? 'Pairing…' : 'Pair with Bridge'}
            </button>
            {pairError && (
              <p className="text-[11px] text-error flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 shrink-0" /> {pairError}
              </p>
            )}
            {pairSuccess && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Paired successfully!
              </p>
            )}
          </div>
        )}
      </section>
      )} {/* end enabled */}

      {/* Light selection */}
      {isPaired && (
        <section className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Select Lights
            </h3>
            <button
              onClick={loadLights}
              disabled={loadingLights}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLights ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {lights.length === 0 ? (
            <p className="text-[11px] text-outline italic text-center py-4">
              {loadingLights ? 'Loading lights…' : 'No lights found'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {lights.map(light => {
                const selected = config?.lightIds.includes(light.id) ?? false;
                return (
                  <button
                    key={light.id}
                    onClick={() => toggleLight(light.id)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-left transition-all',
                      selected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-surface-container-high border-white/5 text-on-surface-variant hover:border-white/20',
                      !light.reachable && 'opacity-40',
                    )}
                  >
                    <Lightbulb className={`w-4 h-4 shrink-0 ${selected ? 'text-amber-400' : 'text-outline'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{light.name}</p>
                      <p className="text-[9px] text-outline uppercase tracking-wider">
                        {light.reachable ? (light.on ? 'On' : 'Off') : 'Unreachable'}
                      </p>
                    </div>
                    {selected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Brightness */}
          <div className="pt-3 border-t border-outline-variant/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Effect Brightness
              </label>
              <span className="text-xs font-bold text-on-surface">{config?.brightness ?? 100}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={config?.brightness ?? 100}
              onChange={e => handleBrightnessChange(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>
          
          {/* Sync Scene */}
          <div className="pt-3 border-t border-outline-variant/10">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                  Sync with Scene Background
                </span>
                <p className="text-[10px] text-outline leading-tight max-w-[200px]">
                  Automatically changes idle light color to match the encounter's background image.
                </p>
              </div>
              <div className={cn(
                "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0",
                config?.syncSceneColor ? "bg-amber-400" : "bg-surface-container-highest"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                  config?.syncSceneColor ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={config?.syncSceneColor ?? false}
                onChange={e => handleSyncSceneChange(e.target.checked)}
              />
            </label>
          </div>
        </section>
      )}

      {/* Effect toggles */}
      {isPaired && (
        <section className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-3">
          <h3 className="font-headline font-bold text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Combat Effects
          </h3>
          {!enabled && (
            <div className="flex items-center gap-2 p-3 bg-outline/5 border border-outline/10 rounded-lg">
              <AlertCircle className="w-4 h-4 text-outline shrink-0" />
              <p className="text-[11px] text-outline">Enable Hue integration above to activate effects</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {EFFECT_CONFIGS.map(effect => {
              const isOn = enabledEffects[effect.name] !== false;
              const targets = effectTargets[effect.name] ?? { players: true, monsters: true };
              return (
                <div
                  key={effect.name}
                  className="flex items-center justify-between p-3 bg-surface-container-high rounded-xl border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: effect.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface">{effect.label}</p>
                      <p className="text-[10px] text-outline truncate">{effect.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => onToggleTarget(effect.name, 'players', !targets.players)}
                      disabled={!isOn}
                      title="Trigger for players"
                      className={cn(
                        'px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded border transition-colors disabled:opacity-30',
                        targets.players
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'bg-surface-container-highest border-white/10 text-outline hover:text-on-surface'
                      )}
                    >
                      P
                    </button>
                    <button
                      onClick={() => onToggleTarget(effect.name, 'monsters', !targets.monsters)}
                      disabled={!isOn}
                      title="Trigger for monsters"
                      className={cn(
                        'px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded border transition-colors disabled:opacity-30',
                        targets.monsters
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : 'bg-surface-container-highest border-white/10 text-outline hover:text-on-surface'
                      )}
                    >
                      M
                    </button>
                    <button
                      onClick={() => handleTestEffect(effect.name)}
                      disabled={!enabled || !config?.lightIds.length}
                      className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-surface-container-highest border border-white/10 rounded text-outline hover:text-on-surface transition-colors disabled:opacity-30"
                    >
                      {testingEffect === effect.name ? '…' : 'Test'}
                    </button>
                    <div
                      onClick={() => onToggleEffect(effect.name, !isOn)}
                      className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${isOn ? 'bg-primary' : 'bg-surface-container-highest border border-outline/30'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
