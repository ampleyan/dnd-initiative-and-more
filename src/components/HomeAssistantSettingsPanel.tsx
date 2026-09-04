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
}

export const HomeAssistantSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<HaConfig | null>(null);
  const [lights, setLights] = useState<HaLight[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const fetchConfig = async () => {
    try {
      const data = await api.ha.getConfig() as unknown as HaConfig;
      setConfig(data);
      setUrlInput(data.url);
      setTokenInput(data.token);
    } catch (e) {
      console.error('Failed to fetch HA config', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchLights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.ha.getLights();
      if (Array.isArray(data)) {
        setLights(data as HaLight[]);
      } else {
        setLights([]);
      }
    } catch (e) {
      console.error('Failed to fetch HA lights', e);
      setLights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const isConfigured = !!config?.url && !!config?.token;

  useEffect(() => {
    if (isConfigured) fetchLights();
  }, [isConfigured, fetchLights]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.ha.saveConfig({ url: urlInput, token: tokenInput });
      await fetchConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLight = async (id: string) => {
    if (!config) return;
    const current = config.lightIds.includes(id);
    const next = current ? config.lightIds.filter(lid => lid !== id) : [...config.lightIds, id];
    const updated = { ...config, lightIds: next };
    setConfig(updated);
    await api.ha.saveConfig({ lightIds: next });
  };

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden">
      <div className="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#03A9F4]/10 rounded-xl">
            <Server className="w-5 h-5 text-[#03A9F4]" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-on-surface text-lg">Home Assistant</h2>
            <p className="text-[10px] uppercase tracking-widest text-outline">Direct Light Integration</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Setup Section */}
        <section className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      </div>
    </div>
  );
};
