import React from 'react';
import { Link2, RefreshCw, Radar } from 'lucide-react';
import { api } from '../api/client';

export const FOUNDRY_SETTINGS_CHANGED = 'foundry-settings-changed';

export const FoundrySettingsPanel: React.FC = () => {
  const [url, setUrl] = React.useState('');
  const [dataPath, setDataPath] = React.useState('');
  const [token, setToken] = React.useState('');
  const [world, setWorld] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [error, setError] = React.useState('');
  const [detecting, setDetecting] = React.useState(false);
  const [detectResult, setDetectResult] = React.useState<'found' | 'notfound' | null>(null);
  React.useEffect(() => {
    api.foundry.getConfig().then(config => {
      setUrl(config.url);
      setDataPath(config.dataPath);
      setToken(config.syncToken ?? '');
    }).catch(() => {});
  }, []);
  const isConfigured = Boolean(dataPath.trim());
  const connectionStatus = status === 'connected'
    ? { label: 'Connected', action: 'Choose a world when you are ready to import.', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' }
    : status === 'error'
      ? { label: 'Unavailable', action: 'Review the connection details and try again.', className: 'border-red-400/20 bg-red-400/10 text-red-300' }
      : { label: 'Needs setup', action: isConfigured ? 'Save and test the connection.' : 'Add the Foundry data folder, then save and test.', className: 'border-amber-400/20 bg-amber-400/10 text-amber-200' };

  const save = async () => {
    setStatus('checking');
    setError('');
    try {
      await api.foundry.saveConfig({ url: url.trim(), dataPath: dataPath.trim() });
      if (token.trim()) {
        await api.foundry.saveSyncToken(token.trim());
      }
      window.dispatchEvent(new Event(FOUNDRY_SETTINGS_CHANGED));
      const worlds = await api.foundry.worlds(dataPath.trim() || undefined);
      setWorld(worlds[0]?.id ?? '');
      setStatus('connected');
    } catch {
      setStatus('error');
      setError('Could not read the Foundry data folder. Check the path and try again.');
    }
  };

  const detectFoundry = async () => {
    setDetecting(true);
    setDetectResult(null);
    const hostname = window.location.hostname;
    const candidates = [...new Set([
      `http://${hostname}:30000`,
      'http://localhost:30000',
      'http://localhost:30001',
    ])];
    for (const candidate of candidates) {
      try {
        const res = await fetch(`${candidate}/api`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && typeof data === 'object') {
            setUrl(candidate);
            setDetectResult('found');
            setDetecting(false);
            return;
          }
        }
      } catch { /* unreachable or CORS */ }
    }
    setDetectResult('notfound');
    setDetecting(false);
  };

  const generateToken = async () => {
    const result = await api.foundry.generateSyncToken();
    setToken(result.token);
  };

  return (
    <section className="space-y-4">
      <p className="text-xs text-outline leading-relaxed">
        Configure the Foundry world used for character and spell-slot imports. The data folder is read by this app's server.
      </p>
      <div className={`rounded-xl border px-3 py-2 ${connectionStatus.className}`} role="status">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold">{connectionStatus.label}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Next action</span>
        </div>
        <p className="mt-1 text-xs opacity-90">{connectionStatus.action}</p>
      </div>
      <label className="block space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Foundry URL</span>
          <button
            type="button"
            onClick={detectFoundry}
            disabled={detecting}
            className="flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
          >
            <Radar className={`w-3 h-3 ${detecting ? 'animate-pulse' : ''}`} />
            {detecting ? 'Scanning…' : 'Auto-detect'}
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3">
          <Link2 className="w-3.5 h-3.5 text-outline shrink-0" />
          <input value={url} onChange={e => { setUrl(e.target.value); setDetectResult(null); }} placeholder="http://localhost:30000" className="w-full bg-transparent py-2 text-xs text-on-surface outline-none" />
        </div>
        {detectResult === 'found' && <p className="text-[10px] text-emerald-400">Foundry instance detected — URL prefilled.</p>}
        {detectResult === 'notfound' && <p className="text-[10px] text-red-400">No Foundry instance found on ports 30000–30001. Enter the URL manually.</p>}
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
