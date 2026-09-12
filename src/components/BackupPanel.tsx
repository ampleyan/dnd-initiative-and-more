import React from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { db, ApiError } from '../api/client';

export const BackupPanel: React.FC = () => {
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importConfirm, setImportConfirm] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const blob = await db.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnd-initiative-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Backup downloaded.' });
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof ApiError ? e.message : 'Export failed.' });
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    setImportConfirm(!!file);
    setStatus(null);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      await db.importBackup(data);
      setStatus({ type: 'success', message: 'Restore complete — reloading…' });
      setImportConfirm(false);
      setPendingFile(null);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof ApiError ? e.message : 'Import failed. Check the backup file.' });
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setImportConfirm(false);
    setPendingFile(null);
  };

  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-on-surface">Backup &amp; Restore</h3>
      </div>
      <p className="text-xs text-outline leading-relaxed">
        Export all encounters, monsters, players, campaigns, and sounds to a single JSON file. Use the same file to restore everything on a new device.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
        >
          <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
          {exporting ? 'Exporting…' : 'Export backup'}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 rounded-lg border border-outline/30 px-3 py-2 text-xs font-bold text-outline hover:text-on-surface transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          Import backup
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
      </div>

      {importConfirm && pendingFile && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300">Replace all data?</p>
              <p className="text-xs text-outline mt-0.5">
                Restoring <span className="font-medium text-on-surface">{pendingFile.name}</span> will overwrite every encounter, monster, player, campaign, and sound. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
            >
              {importing ? 'Restoring…' : 'Yes, restore'}
            </button>
            <button onClick={cancelImport} className="rounded-lg border border-outline/20 px-3 py-1.5 text-xs font-bold text-outline hover:text-on-surface transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className={`text-xs font-bold ${status.type === 'success' ? 'text-emerald-400' : 'text-error'}`}>
          {status.type === 'success' ? '✓ ' : '✗ '}{status.message}
        </p>
      )}
    </section>
  );
};
