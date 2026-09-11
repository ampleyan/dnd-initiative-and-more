import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, Server, Key, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface HaLight {
  entity_id: string;
  attributes: {
    friendly_name?: string;
  };
  state: string;
}

interface HaConfig {
  url: string;
  token: string;
  lightIds: string[];
  enabled?: boolean;
}

interface HomeAssistantSettingsPanelProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

export const HomeAssistantSettingsPanel: React.FC<HomeAssistantSettingsPanelProps> = ({ enabled, onToggleEnabled }) => {
  const [config, setConfig] = useState<HaConfig | null>(null);
  const [lights, setLights] = useState<HaLight[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Form states
  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const fetchConfig = async () => {
    try {
      const data = await api.ha.getConfig() as unknown as HaConfig;
      setConfig(data);
      onToggleEnabled(data.enabled ?? false);
      setUrlInput(data.url);
      setTokenInput(data.token);
      setConnectionError(false);
    } catch (e) {
      console.error('Failed to fetch HA config', e);
      setConnectionError(true);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [onToggleEnabled]);

  const fetchLights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.ha.getLights();
      if (Array.isArray(data)) {
        setLights(data as HaLight[]);
        setConnectionError(false);
      } else {
        setLights([]);
        setConnectionError(true);
      }
    } catch (e) {
      console.error('Failed to fetch HA lights', e);
      setLights([]);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const isConfigured = !!config?.url && !!config?.token;
  const connectionStatus = connectionError
    ? { label: 'Unavailable', action: 'Review the connection details and refresh.', className: 'border-red-400/20 bg-red-400/10 text-red-300' }
    : isConfigured
      ? { label: 'Connected', action: 'Choose the lights to use at your table.', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' }
      : { label: 'Needs setup', action: 'Add the instance URL and access token, then connect.', className: 'border-amber-400/20 bg-amber-400/10 text-amber-200' };

  useEffect(() => {
    if (isConfigured) fetchLights();
  }, [isConfigured, fetchLights]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.ha.saveConfig({ url: urlInput, token: tokenInput, enabled: true });
      await fetchConfig();
      await fetchLights();
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = useCallback((next: boolean) => {
    onToggleEnabled(next);
    api.ha.saveConfig({ enabled: next }).catch(() => {});
  }, [onToggleEnabled]);

  const handleToggleLight = async (id: string) => {
    if (!config) return;
    const current = config.lightIds.includes(id);
    const next = current ? config.lightIds.filter(lid => lid !== id) : [...config.lightIds, id];
    const updated = { ...config, lightIds: next };
    setConfig(updated);
    await api.ha.saveConfig({ lightIds: next });
  };

  return (
    <div className="@container/ha bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden">
      <div className="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#03A9F4]/10 rounded-xl">
            <Server className="w-5 h-5 text-[#03A9F4]" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-on-surface text-lg">Home Assistant</h2>
            <p className="text-[10px] uppercase tracking-widest text-outline">Direct Light Integration</p>
          </div>
          <div
            role="switch"
            aria-checked={enabled}
            tabIndex={0}
            onClick={() => toggleEnabled(!enabled)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleEnabled(!enabled);
              }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-[#03A9F4]' : 'bg-surface-container-highest border border-outline/30'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </div>
      </div>

      <div className={`mx-5 mt-5 rounded-xl border px-3 py-2 ${connectionStatus.className}`} role="status">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold">{connectionStatus.label}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Next action</span>
        </div>
        <p className="mt-1 text-xs opacity-90">{connectionStatus.action}</p>
      </div>

      {enabled && <div className="p-5 space-y-6">
        {/* Setup Section */}
        <section className="space-y-3">
          <div className="grid grid-cols-1 @[28rem]/ha:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-headline uppercase tracking-widest text-outline">Instance URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.100:8123"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-headline uppercase tracking-widest text-outline">Long-Lived Access Token</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste a long-lived access token"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  className="flex-1 bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <button
                  onClick={handleSaveConfig}
                  disabled={saving || !urlInput || !tokenInput}
                  className="px-4 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {isConfigured && (
          <section className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-sm text-on-surface">Target Lights</h3>
              <button
                onClick={fetchLights}
                disabled={loading}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-outline"
                title="Refresh Lights"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
              </button>
            </div>

            {lights.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-warning/10 text-warning rounded-lg border border-warning/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs">No lights found. Check your URL and Token, or ensure your HA instance has entities starting with <code className="bg-black/20 px-1 rounded">light.</code>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 @[24rem]/ha:grid-cols-2 @[40rem]/ha:grid-cols-3 gap-3">
                {lights.map(light => {
                  const selected = config.lightIds.includes(light.entity_id);
                  const isOff = light.state === 'off' || light.state === 'unavailable';
                  return (
                    <button
                      key={light.entity_id}
                      onClick={() => handleToggleLight(light.entity_id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selected
                          ? 'bg-[#03A9F4]/10 border-[#03A9F4]/30'
                          : 'bg-surface-container border-outline/10 hover:border-outline/30 hover:bg-surface-container-high'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        selected ? 'bg-[#03A9F4]/20 text-[#03A9F4]' : 'bg-surface-container-highest text-outline'
                      }`}>
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selected ? 'text-on-surface' : 'text-on-surface/80'}`}>
                          {light.attributes.friendly_name || light.entity_id}
                        </p>
                        <p className="text-[10px] text-outline font-mono truncate">
                          {isOff ? light.state : 'Ready'}
                        </p>
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#03A9F4] ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>}
    </div>
  );
};
