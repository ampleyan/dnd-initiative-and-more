import React, { useState, useEffect } from 'react';
import { RefreshCw, User, Users, Settings, AlertCircle, Trash2, ArrowRight, ChevronDown, Edit2, X, Save } from 'lucide-react';
import { api } from '../../api/client';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Player } from '../../types';
import { PlayerDetailModal } from '../PlayerDetailModal';

interface DndBeyondImportProps {
  players: Player[];
  onImportPlayer: (dndBeyondId: string, cobaltSession?: string) => Promise<any>;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<any>;
  onRemovePlayer: (id: string) => Promise<void>;
}

export const DndBeyondImport = React.memo<DndBeyondImportProps>(({
  players,
  onImportPlayer,
  onUpdatePlayer,
  onRemovePlayer,
}) => {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditForm({
      name: player.name,
      subtitle: player.subtitle,
      hp_max: player.hp_max,
      ac: player.ac,
      speed: player.speed,
      avatar: player.avatar,
      level: player.level ?? 1,
      passivePerception: player.passivePerception ?? 10,
      stats: { ...player.stats },
    });
  };

  const saveEdit = async () => {
    if (!editingPlayer) return;
    setEditSaving(true);
    try {
      await onUpdatePlayer(editingPlayer.id, editForm);
      setEditingPlayer(null);
    } finally {
      setEditSaving(false);
    }
  };

  const [cobaltSession, setCobaltSession] = useState(() => localStorage.getItem('cobaltSession') || '');
  const [cobaltExpanded, setCobaltExpanded] = useState(false);
  const [ddbInput, setDdbInput] = useState('');
  const [ddbLoading, setDdbLoading] = useState(false);
  const [ddbError, setDdbError] = useState('');
  const [campaignUrl, setCampaignUrl] = useState('');
  const [cobaltToken, setCobaltToken] = useState(() => localStorage.getItem('ddb_cobalt_token') ?? '');
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [requiresCobalt, setRequiresCobalt] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignCharacters, setCampaignCharacters] = useState<Player[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<{ url: string; lastFetched: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('ddb_recent_campaigns') ?? '[]'); } catch { return []; }
  });
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [defaultPartyLoading, setDefaultPartyLoading] = useState(false);
  const [defaultPartyProgress, setDefaultPartyProgress] = useState<string | null>(null);

  const DEFAULT_PARTY_IDS = ['153118837', '153118241', '153117278', '153116510', '155606059'];

  const handleImportDefaultParty = async () => {
    setDefaultPartyLoading(true);
    setDefaultPartyProgress(null);
    let imported = 0;
    for (const id of DEFAULT_PARTY_IDS) {
      setDefaultPartyProgress(`Importing ${imported + 1}/${DEFAULT_PARTY_IDS.length}...`);
      try {
        await onImportPlayer(id, cobaltSession || undefined);
        imported++;
      } catch (e) {
        // continue with others on failure
      }
    }
    setDefaultPartyProgress(`Done — ${imported}/${DEFAULT_PARTY_IDS.length} imported`);
    setDefaultPartyLoading(false);
    setTimeout(() => setDefaultPartyProgress(null), 3000);
  };

  useEffect(() => {
    localStorage.setItem('cobaltSession', cobaltSession);
  }, [cobaltSession]);

  const extractDdbId = (input: string): string | null => {
    const match = input.match(/\/characters?\/(\d+)/i);
    if (match) return match[1];
    if (/^\d+$/.test(input.trim())) return input.trim();
    return null;
  };

  const handleDdbImport = async () => {
    const id = extractDdbId(ddbInput);
    if (!id) { setDdbError('Enter a valid D&D Beyond character URL or ID.'); return; }
    setDdbLoading(true);
    setDdbError('');
    try {
      await onImportPlayer(id, cobaltSession || undefined);
      setDdbInput('');
    } catch (e: any) {
      setDdbError(e.message || 'Import failed.');
    } finally {
      setDdbLoading(false);
    }
  };

  const handleRefreshPlayer = async (player: Player) => {
    if (!player.dndBeyondId) return;
    setRefreshingId(player.dndBeyondId);
    try {
      await onImportPlayer(player.dndBeyondId, cobaltToken || cobaltSession || undefined);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleFetchCampaign = async () => {
    setCampaignLoading(true);
    setCampaignError(null);
    setRequiresCobalt(false);
    try {
      const data = await api.dndBeyond.campaignCharacters({ joinCode: campaignUrl, cobaltToken: cobaltToken || undefined }) as { requiresAuth?: boolean; error?: string; characters?: unknown[] };
      if (data.requiresAuth) { setRequiresCobalt(true); return; }
      if (data.error) throw new Error(data.error);
      if (cobaltToken) localStorage.setItem('ddb_cobalt_token', cobaltToken);
      setCampaignCharacters((data.characters ?? []) as Player[]);
      const entry = { url: campaignUrl, lastFetched: new Date().toISOString() };
      setRecentCampaigns(prev => {
        const updated = [entry, ...prev.filter(c => c.url !== campaignUrl)].slice(0, 5);
        localStorage.setItem('ddb_recent_campaigns', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      setCampaignError(e instanceof Error ? e.message : 'Failed to fetch campaign');
    } finally {
      setCampaignLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Private characters toggle */}
        <div className="bg-surface-container-low rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setCobaltExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-sm font-bold text-white">Private Characters</span>
              <span className="text-[10px] text-outline opacity-60">D&amp;D Beyond login required</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-outline transition-transform ${cobaltExpanded ? 'rotate-180' : ''}`} />
          </button>
          {cobaltExpanded && (
            <div className="px-4 pb-4 space-y-2 border-t border-white/5">
              <p className="text-[11px] text-outline pt-3">F12 → Application → Cookies → copy <code className="text-primary">CobaltSession</code></p>
              <input
                type="password"
                value={cobaltSession}
                onChange={e => setCobaltSession(e.target.value)}
                placeholder="Paste CobaltSession value..."
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
        </div>

        {/* Single character import */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-white/5 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={ddbInput}
              onChange={e => setDdbInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDdbImport()}
              placeholder="dndbeyond.com/characters/12345678 or bare ID"
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleDdbImport}
              disabled={!ddbInput || ddbLoading}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {ddbLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Import
            </button>
          </div>
          {ddbError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {ddbError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImportDefaultParty}
              disabled={defaultPartyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {defaultPartyLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
              Import Default Party
            </button>
            {defaultPartyProgress && <span className="text-xs text-outline">{defaultPartyProgress}</span>}
          </div>
        </div>

        {/* Player roster */}
        {players.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-outline uppercase tracking-widest">Roster</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {players.map(player => (
                <div key={player.id} onClick={() => setDetailPlayer(player)} className="relative bg-surface-container-low rounded-xl border border-white/5 p-3 flex items-center gap-3 hover:border-white/10 transition-all cursor-pointer">
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.name} className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{player.name}</p>
                    <p className="text-[10px] text-outline truncate">{player.subtitle || 'No class info'}</p>
                    <div className="flex gap-2 mt-0.5 text-[9px] text-outline/70">
                      <span>HP {player.hp_max}</span>
                      <span>AC {player.ac}</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {!!player.dndBeyondId && (
                      <button onClick={() => handleRefreshPlayer(player)} disabled={refreshingId === player.dndBeyondId} className="p-1 text-outline hover:text-primary transition-colors" title="Refresh">
                        <RefreshCw className={cn("w-3.5 h-3.5", refreshingId === player.dndBeyondId && "animate-spin")} />
                      </button>
                    )}
                    <button onClick={() => openEdit(player)} className="p-1 text-outline hover:text-primary transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onRemovePlayer(player.id)} className="p-1 text-outline hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campaign import */}
        <div className="border-t border-outline-variant/10 pt-4 space-y-3">
          <h4 className="text-sm font-bold text-on-surface">Campaign Import</h4>
          {recentCampaigns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recentCampaigns.map(c => (
                <button
                  key={c.url}
                  onClick={() => { setCampaignUrl(c.url); setCampaignCharacters([]); setCampaignError(null); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-high border border-outline-variant/20 text-xs text-on-surface hover:border-primary/40 hover:text-primary transition-colors"
                  title={`Last fetched: ${new Date(c.lastFetched).toLocaleDateString()}`}
                >
                  <span className="truncate max-w-[180px]">{c.url.replace('https://www.dndbeyond.com/campaigns/join/', '…/join/')}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="url"
              value={campaignUrl}
              onChange={e => setCampaignUrl(e.target.value)}
              placeholder="https://www.dndbeyond.com/campaigns/join/..."
              className="flex-1 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={handleFetchCampaign} disabled={campaignLoading || !campaignUrl.trim()} className="px-3 py-2 rounded-lg bg-primary text-on-primary font-semibold text-sm disabled:opacity-50 hover:opacity-90">
              {campaignLoading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
          {requiresCobalt && (
            <div className="space-y-2">
              <p className="text-xs text-amber-400">Characters are private — paste your CobaltSession cookie.</p>
              <div className="flex gap-2">
                <input type="text" autoComplete="off" value={cobaltToken} onChange={e => setCobaltToken(e.target.value)} placeholder="CobaltSession value" className="flex-1 px-3 py-2 rounded-lg bg-surface-container-high border border-amber-500/30 text-on-surface text-sm focus:outline-none" />
                <button onClick={handleFetchCampaign} disabled={campaignLoading} className="px-3 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm disabled:opacity-50">Retry</button>
              </div>
            </div>
          )}
          {campaignError && <p className="text-xs text-error">{campaignError}</p>}
          {campaignCharacters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-outline font-bold uppercase tracking-widest">{campaignCharacters.length} Characters Found</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => campaignCharacters.forEach((c: Player) => c.dndBeyondId && onImportPlayer(c.dndBeyondId, cobaltToken || undefined))}
                    className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
                  >
                    Import All
                  </button>
                </div>
              </div>
              {campaignCharacters.map((char: Player) => (
                <div key={char.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/10">
                  {char.avatar && <img src={char.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{char.name}</p>
                    <p className="text-[10px] text-outline">{char.subtitle}</p>
                  </div>
                  <button onClick={() => char.dndBeyondId && onImportPlayer(char.dndBeyondId, cobaltToken || undefined)} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20">
                    Import
                  </button>
                </div>
              ))}
              <button onClick={() => campaignCharacters.forEach((c: Player) => c.dndBeyondId && onImportPlayer(c.dndBeyondId, cobaltToken || undefined))} className="w-full py-2 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:opacity-90">
                Import All ({campaignCharacters.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Player Edit Modal */}
      <AnimatePresence>
        {editingPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingPlayer(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface-container rounded-2xl border border-white/10 w-full max-w-lg overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-headline font-bold text-white">Edit Player</h2>
                <button onClick={() => setEditingPlayer(null)} className="text-outline hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Name</label>
                    <input
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.name}
                      onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Class / Subtitle</label>
                    <input
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.subtitle}
                      onChange={e => setEditForm((f: any) => ({ ...f, subtitle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Level</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.level}
                      onChange={e => setEditForm((f: any) => ({ ...f, level: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Passive Perception</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.passivePerception}
                      onChange={e => setEditForm((f: any) => ({ ...f, passivePerception: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Max HP</label>
                    <input
                      type="number"
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.hp_max}
                      onChange={e => setEditForm((f: any) => ({ ...f, hp_max: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">AC</label>
                    <input
                      type="number"
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.ac}
                      onChange={e => setEditForm((f: any) => ({ ...f, ac: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Speed</label>
                    <input
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.speed}
                      onChange={e => setEditForm((f: any) => ({ ...f, speed: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Avatar URL</label>
                    <input
                      className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                      value={editForm.avatar}
                      onChange={e => setEditForm((f: any) => ({ ...f, avatar: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-outline uppercase tracking-widest mb-2 block">Ability Scores</label>
                  <div className="grid grid-cols-6 gap-2">
                    {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                      <div key={stat} className="flex flex-col items-center gap-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-outline">{stat}</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className="w-full bg-surface-container-high border border-white/10 rounded-lg px-1 py-1.5 text-white text-sm text-center focus:outline-none focus:border-primary/50"
                          value={editForm.stats?.[stat] ?? 10}
                          onChange={e => setEditForm((f: any) => ({ ...f, stats: { ...f.stats, [stat]: Number(e.target.value) } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-outline hover:text-white text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlayerDetailModal player={detailPlayer} onClose={() => setDetailPlayer(null)} />
    </>
  );
});
DndBeyondImport.displayName = 'DndBeyondImport';
