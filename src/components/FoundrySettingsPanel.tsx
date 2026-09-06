import React from 'react';
import { CheckCircle2, Link2, RefreshCw, Server } from 'lucide-react';
import { api } from '../api/client';

const DATA_PATH_KEY = 'foundry_data_path';
const URL_KEY = 'foundry_url';
const TOKEN_KEY = 'foundry_sync_token';

export const FoundrySettingsPanel: React.FC = () => {
  const [url, setUrl] = React.useState(() => localStorage.getItem(URL_KEY) ?? '');
  const [dataPath, setDataPath] = React.useState(() => localStorage.getItem(DATA_PATH_KEY) ?? '');
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [world, setWorld] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [error, setError] = React.useState('');

  const save = async () => {
    setStatus('checking');
    setError('');
    localStorage.setItem(URL_KEY, url.trim());
    localStorage.setItem(DATA_PATH_KEY, dataPath.trim());
    try {
      if (token.trim()) {
        await api.foundry.saveSyncToken(token.trim());
        localStorage.setItem(TOKEN_KEY, token.trim());
      }
      const worlds = await api.foundry.worlds(dataPath.trim() || undefined);
      setWorld(worlds[0]?.id ?? '');
      setStatus('connected');
    } catch {
      setStatus('error');
      setError('Could not read the Foundry data folder. Check the path and try again.');
    }
  };

  const generateToken = async () => {
    const result = await api.foundry.generateSyncToken();
    setToken(result.token);
    localStorage.setItem(TOKEN_KEY, result.token);
  };

  return (
    <section className="rounded-2xl bg-surface-container-low p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-on-surface">Foundry VTT</h3>
        {status === 'connected' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
      </div>
      <p className="text-xs text-outline leading-relaxed">
        Configure the Foundry world used for character and spell-slot imports. The data folder is read by this app's server.
      </p>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Foundry URL</span>
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3">
          <Link2 className="w-3.5 h-3.5 text-outline shrink-0" />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://notmac:3000/" className="w-full bg-transparent py-2 text-xs text-on-surface outline-none" />
        </div>
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Live sync token</span>
        <div className="flex gap-2">
          <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Generate a shared token" className="min-w-0 flex-1 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface outline-none" />
          <button type="button" onClick={generateToken} className="rounded-lg border border-outline/20 px-2 text-[10px] font-bold text-outline hover:text-on-surface">Generate</button>
        </div>
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Foundry data folder</span>
        <input value={dataPath} onChange={e => setDataPath(e.target.value)} placeholder="E:\\DnD\\FoundryVTT\\Data" className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface outline-none" />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={status === 'checking'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
          {status === 'checking' ? 'Checking…' : 'Save and test connection'}
        </button>
        {world && <span className="text-xs text-emerald-400">World: {world}</span>}
      </div>
      {status === 'error' && <p className="text-xs text-error">{error}</p>}
    </section>
  );
};
