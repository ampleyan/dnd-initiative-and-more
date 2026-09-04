import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RefreshCw, ChevronDown, Image as ImageIcon, Check, Settings, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../api/client';
import { MonsterTemplate, ParsedEncounter } from '../../types';
import { parseFoundryJournal } from '../../lib/adventureParser';

const LS_DATA_PATH = 'foundry_data_path';
const LS_URL = 'foundry_url';

interface Scene {
  id: string;
  name: string;
  active: boolean;
  backgroundImg: string;
  playlistSound: string | null;
}

interface Props {
  onImportMonsters: (monsters: MonsterTemplate[]) => void;
  onImportSpells?: (spells: any[]) => void;
  onCreatePlayer?: (data: any) => Promise<any>;
  onImportScene?: (scene: { name: string; backgroundImg: string }) => void;
  onImportEncounters?: (encounters: ParsedEncounter[]) => void;
  currentEncounterId?: string | null;
}

export const FoundryImport: React.FC<Props> = ({ onImportMonsters, onImportSpells, onCreatePlayer, onImportScene, onImportEncounters, currentEncounterId }) => {
  const [tab, setTab] = useState<'actors' | 'scenes' | 'spells' | 'players' | 'journals'>('actors');
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  const [selectedWorld, setSelectedWorld] = useState('');
  const [search, setSearch] = useState('');
  const [actors, setActors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [appliedSceneId, setAppliedSceneId] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Spell state
  const [spells, setSpells] = useState<any[]>([]);
  const [spellTotal, setSpellTotal] = useState(0);
  const [spellOffset, setSpellOffset] = useState(0);
  const [spellSearch, setSpellSearch] = useState('');
  const [selectedSpells, setSelectedSpells] = useState<Set<string>>(new Set());
  const [spellsLoading, setSpellsLoading] = useState(false);
  const [importingSpells, setImportingSpells] = useState(false);
  const spellSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Players state
  const [characters, setCharacters] = useState<any[]>([]);
  const [charTotal, setCharTotal] = useState(0);
  const [charOffset, setCharOffset] = useState(0);
  const [charSearch, setCharSearch] = useState('');
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [charsLoading, setCharsLoading] = useState(false);
  const [importingPlayers, setImportingPlayers] = useState(false);

  // Journals state
  const [journals, setJournals] = useState<any[]>([]);
  const [journalSearch, setJournalSearch] = useState('');
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set());
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [importingJournals, setImportingJournals] = useState(false);
  const journalSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dataPath, setDataPath] = useState(() => localStorage.getItem(LS_DATA_PATH) ?? '');
  const [foundryUrl, setFoundryUrl] = useState(() => localStorage.getItem(LS_URL) ?? '');
  const [showConfig, setShowConfig] = useState(false);
  const [connectedPath, setConnectedPath] = useState<string | undefined>(() => localStorage.getItem(LS_DATA_PATH) || undefined);
  const [connectStatus, setConnectStatus] = useState<'idle' | 'connecting' | 'ok' | 'error'>('idle');
  const [connectError, setConnectError] = useState('');
  const [selectingAllActors, setSelectingAllActors] = useState(false);
  const [selectingAllSpells, setSelectingAllSpells] = useState(false);
  const [selectingAllChars, setSelectingAllChars] = useState(false);

  const effectiveDataPath = connectedPath;
  const LIMIT = 50;

  const handleConnect = useCallback(async () => {
    const path = dataPath.trim() || undefined;
    setConnectStatus('connecting');
    setConnectError('');
    try {
      const data = await api.foundry.worlds(path);
      localStorage.setItem(LS_DATA_PATH, dataPath.trim());
      localStorage.setItem(LS_URL, foundryUrl.trim());
      setConnectedPath(path);
      setWorlds(data);
      if (data.length > 0) setSelectedWorld(data[0].id);
      setConnectStatus('ok');
      setShowConfig(false);
    } catch {
      setConnectStatus('error');
      setConnectError('Could not read Foundry data at that path');
    }
  }, [dataPath, foundryUrl]);

  // Auto-connect on mount if a path was previously saved
  useEffect(() => {
    if (!connectedPath) return;
    setConnectStatus('connecting');
    api.foundry.worlds(connectedPath)
      .then(data => {
        setWorlds(data);
        if (data.length > 0) setSelectedWorld(data[0].id);
        setConnectStatus('ok');
      })
      .catch(() => { setConnectStatus('error'); setConnectError('Could not read Foundry data at saved path'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedWorld) return;
    api.foundry.scenes(selectedWorld, effectiveDataPath)
      .then(setScenes)
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false));
  }, [selectedWorld, tab, connectedPath]);

  // Load item packs when world changes (for spells tab)

  const fetchActors = useCallback(async (world: string, q: string, off: number) => {
    if (!world) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.foundry.actors({ world, search: q || undefined, offset: off, limit: LIMIT, dataPath: effectiveDataPath });
      setActors(data.actors);
      setTotal(data.total);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load actors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWorld) return;
    setOffset(0);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => fetchActors(selectedWorld, search, 0), 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [selectedWorld, search, fetchActors]);

  useEffect(() => {
    if (!selectedWorld) return;
    fetchActors(selectedWorld, search, offset);
  }, [offset]);

  // Fetch spells
  const fetchSpells = useCallback(async (world: string, q: string, off: number) => {
    if (!world) return;
    setSpellsLoading(true);
    setError('');
    try {
      const data = await api.foundry.spells({ world, search: q || undefined, offset: off, limit: LIMIT, dataPath: effectiveDataPath });
      setSpells(data.spells);
      setSpellTotal(data.total);
      setSelectedSpells(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load spells');
    } finally {
      setSpellsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWorld || tab !== 'spells') return;
    setSpellOffset(0);
    if (spellSearchRef.current) clearTimeout(spellSearchRef.current);
    spellSearchRef.current = setTimeout(() => fetchSpells(selectedWorld, spellSearch, 0), 300);
    return () => { if (spellSearchRef.current) clearTimeout(spellSearchRef.current); };
  }, [selectedWorld, spellSearch, fetchSpells, tab]);

  useEffect(() => {
    if (!selectedWorld) return;
    fetchSpells(selectedWorld, spellSearch, spellOffset);
  }, [spellOffset]);

  // Fetch characters
  const fetchCharacters = useCallback(async (world: string, q: string, off: number) => {
    if (!world) return;
    setCharsLoading(true);
    setError('');
    try {
      const data = await api.foundry.characters({ world, search: q || undefined, offset: off, limit: LIMIT, dataPath: effectiveDataPath });
      setCharacters(data.actors);
      setCharTotal(data.total);
      setSelectedChars(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load characters');
    } finally {
      setCharsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWorld || tab !== 'players') return;
    setCharOffset(0);
    fetchCharacters(selectedWorld, charSearch, 0);
  }, [selectedWorld, charSearch, fetchCharacters, tab]);

  useEffect(() => {
    if (!selectedWorld) return;
    fetchCharacters(selectedWorld, charSearch, charOffset);
  }, [charOffset]);

  // Fetch journals
  const fetchJournals = useCallback(async (world: string, q: string) => {
    if (!world) return;
    setJournalsLoading(true);
    setError('');
    try {
      const data = await api.foundry.journals({ world, search: q || undefined, dataPath: effectiveDataPath });
      setJournals(data);
      setSelectedJournals(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load journals');
    } finally {
      setJournalsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWorld || tab !== 'journals') return;
    if (journalSearchRef.current) clearTimeout(journalSearchRef.current);
    journalSearchRef.current = setTimeout(() => fetchJournals(selectedWorld, journalSearch), 300);
    return () => { if (journalSearchRef.current) clearTimeout(journalSearchRef.current); };
  }, [selectedWorld, journalSearch, fetchJournals, tab]);

  const handleImportJournals = async () => {
    if (selectedJournals.size === 0 || !onImportEncounters) return;
    setImportingJournals(true);
    setError('');
    try {
      const data = await api.foundry.journals({
        world: selectedWorld,
        ids: [...selectedJournals],
        full: true,
        dataPath: effectiveDataPath,
      });
      const encounters = parseFoundryJournal(JSON.stringify(data));
      if (encounters.length === 0) {
        setError('No encounter tables found in selected journals');
        return;
      }
      onImportEncounters(encounters);
      setSelectedJournals(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Journal import failed');
    } finally {
      setImportingJournals(false);
    }
  };


  const toggleSelect = (foundryId: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(foundryId) ? n.delete(foundryId) : n.add(foundryId);
      return n;
    });
  };

  const toggleAll = async () => {
    if (selected.size === total) { setSelected(new Set()); return; }
    if (total <= actors.length) { setSelected(new Set(actors.map(a => a._id))); return; }
    setSelectingAllActors(true);
    try {
      const data = await api.foundry.actors({ world: selectedWorld, search: search || undefined, limit: total, offset: 0, full: false, dataPath: effectiveDataPath });
      setSelected(new Set(data.actors.map((a: any) => a._id)));
    } catch { setSelected(new Set(actors.map(a => a._id))); }
    finally { setSelectingAllActors(false); }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError('');
    try {
      const data = await api.foundry.actors({
        world: selectedWorld,
        ids: [...selected],
        limit: selected.size,
        full: true,
        dataPath: effectiveDataPath,
      });
      if (data.actors.length === 0) {
        console.warn('[foundry] no actors returned — check id matching on backend');
      }
      onImportMonsters(data.actors);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportSpellsClick = async () => {
    if (selectedSpells.size === 0 || !onImportSpells) return;
    setImportingSpells(true);
    setError('');
    try {
      const toImport = spells.filter(s => selectedSpells.has(s.id));
      onImportSpells(toImport);
      setSelectedSpells(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Spell import failed');
    } finally {
      setImportingSpells(false);
    }
  };

  const handleImportPlayers = async () => {
    if (selectedChars.size === 0 || !onCreatePlayer) return;
    setImportingPlayers(true);
    setError('');
    try {
      const data = await api.foundry.characters({
        world: selectedWorld,
        ids: [...selectedChars],
        limit: selectedChars.size,
        full: true,
        dataPath: effectiveDataPath,
      });
      for (const char of data.actors) {
        await onCreatePlayer(char);
      }
      setSelectedChars(new Set());
    } catch (e: any) {
      setError(e.message ?? 'Player import failed');
    } finally {
      setImportingPlayers(false);
    }
  };

  const handleApplyScene = (scene: Scene) => {
    if (!onImportScene) return;
    onImportScene({ name: scene.name, backgroundImg: scene.backgroundImg });
    setAppliedSceneId(scene.id);
  };

  return (
    <div className="space-y-3">
      {/* Config: Data Path + URL */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <button
          onClick={() => setShowConfig(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-outline">
            <Settings className="w-3.5 h-3.5" />
            Connection Settings
            {connectStatus === 'ok' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">connected</span>
            )}
            {connectStatus === 'error' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">error</span>
            )}
            {connectStatus === 'connecting' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">connecting…</span>
            )}
          </div>
          {showConfig ? <ChevronDown className="w-3.5 h-3.5 text-outline" /> : <ChevronRight className="w-3.5 h-3.5 text-outline" />}
        </button>
        {showConfig && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-white/8">
            <div className="space-y-1 pt-2">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Foundry Data Path</label>
              <input
                type="text"
                value={dataPath}
                onChange={e => setDataPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                placeholder="/path/to/FoundryVTT/Data"
                className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 font-mono"
              />
              <p className="text-[10px] text-outline/50">Filesystem path to FoundryVTT Data folder</p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Foundry URL</label>
              <input
                type="text"
                value={foundryUrl}
                onChange={e => setFoundryUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                placeholder="http://localhost:30000"
                className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 font-mono"
              />
              <p className="text-[10px] text-outline/50">URL of your FoundryVTT server (used to resolve image paths)</p>
            </div>
            {connectStatus === 'error' && connectError && (
              <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{connectError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={connectStatus === 'connecting'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs disabled:opacity-50 transition-all hover:bg-primary/90"
            >
              {connectStatus === 'connecting'
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Connect & Fetch Worlds</>
              }
            </button>
          </div>
        )}
      </div>

      {/* World selector */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={selectedWorld}
            onChange={e => setSelectedWorld(e.target.value)}
            className="w-full appearance-none bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors pr-8"
          >
            {worlds.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
            {worlds.length === 0 && <option value="">No worlds found</option>}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
        <button
          onClick={() => setTab('actors')}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-colors ${tab === 'actors' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'}`}
        >
          Monsters
        </button>
        <button
          onClick={() => setTab('spells')}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-colors ${tab === 'spells' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'}`}
        >
          Spells
        </button>
        <button
          onClick={() => setTab('players')}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-colors ${tab === 'players' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'}`}
        >
          Players
        </button>
        <button
          onClick={() => setTab('journals')}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-colors ${tab === 'journals' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'}`}
        >
          Journals
        </button>
        <button
          onClick={() => setTab('scenes')}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-colors ${tab === 'scenes' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'}`}
        >
          Scenes
        </button>
      </div>

      {error && (
        <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {tab === 'actors' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actors…"
              className="w-full bg-surface-container-low border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {actors.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-outline px-1">
              <button onClick={toggleAll} className="hover:text-on-surface transition-colors" disabled={selectingAllActors}>
                {selectingAllActors ? 'Loading…' : selected.size === total ? 'Deselect all' : `Select all (${total})`}
              </button>
              <span>{total} total</span>
            </div>
          )}
          <div className="bg-surface-container-low rounded-xl overflow-hidden border border-white/5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-outline">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : actors.length === 0 ? (
              <div className="py-8 text-center text-xs text-outline">
                {selectedWorld ? 'No actors found' : 'Select a world'}
              </div>
            ) : (
              actors.map(actor => {
                const id = actor._id ?? actor.name;
                const isSelected = selected.has(id);
                const cr = actor.system?.details?.cr ?? actor.cr;
                const crStr = cr != null ? `CR ${cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : cr}` : '';
                const typeVal = actor.system?.details?.type?.value ?? actor.type ?? '';
                return (
                  <button
                    key={id}
                    onClick={() => toggleSelect(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-primary border-primary' : 'border-white/30'
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                    </div>
                    {actor.img && (
                      <img src={actor.img} alt="" className="w-7 h-7 rounded object-cover shrink-0 bg-black/30" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{actor.name}</p>
                      <p className="text-[11px] text-outline truncate capitalize">{[typeVal, crStr].filter(Boolean).join(' · ')}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {total > LIMIT && (
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-outline">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:brightness-110"
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {importing ? 'Importing…' : `Import ${selected.size > 0 ? selected.size : ''} Monster${selected.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {tab === 'spells' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              value={spellSearch}
              onChange={e => setSpellSearch(e.target.value)}
              placeholder="Search spells…"
              className="w-full bg-surface-container-low border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {spells.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-outline px-1">
              <button
                onClick={async () => {
                  if (selectedSpells.size === spellTotal) { setSelectedSpells(new Set()); return; }
                  if (spellTotal <= spells.length) { setSelectedSpells(new Set(spells.map(s => s.id))); return; }
                  setSelectingAllSpells(true);
                  try {
                    const data = await api.foundry.spells({ world: selectedWorld, search: spellSearch || undefined, limit: spellTotal, offset: 0, dataPath: effectiveDataPath });
                    setSelectedSpells(new Set(data.spells.map((s: any) => s.id)));
                  } catch { setSelectedSpells(new Set(spells.map(s => s.id))); }
                  finally { setSelectingAllSpells(false); }
                }}
                className="hover:text-on-surface transition-colors"
              >
                {selectingAllSpells ? 'Loading…' : selectedSpells.size === spellTotal ? 'Deselect all' : `Select all (${spellTotal})`}
              </button>
              <span>{spellTotal} total</span>
            </div>
          )}
          <div className="bg-surface-container-low rounded-xl overflow-hidden border border-white/5 max-h-72 overflow-y-auto">
            {spellsLoading ? (
              <div className="flex items-center justify-center py-8 text-outline">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : spells.length === 0 ? (
              <div className="py-8 text-center text-xs text-outline">
                {selectedWorld ? 'No spells found' : 'Select a world'}
              </div>
            ) : (
              spells.map(spell => {
                const isSelected = selectedSpells.has(spell.id);
                return (
                  <button
                    key={spell.id}
                    onClick={() => {
                      setSelectedSpells(prev => {
                        const n = new Set(prev);
                        n.has(spell.id) ? n.delete(spell.id) : n.add(spell.id);
                        return n;
                      });
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-primary border-primary' : 'border-white/30'
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{spell.name}</p>
                      <p className="text-[11px] text-outline truncate">
                        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.school}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {spellTotal > LIMIT && (
            <div className="flex items-center justify-between text-xs">
              <button onClick={() => setSpellOffset(Math.max(0, spellOffset - LIMIT))} disabled={spellOffset === 0}
                className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 transition-colors">
                ← Prev
              </button>
              <span className="text-outline">{spellOffset + 1}–{Math.min(spellOffset + LIMIT, spellTotal)} of {spellTotal}</span>
              <button onClick={() => setSpellOffset(spellOffset + LIMIT)} disabled={spellOffset + LIMIT >= spellTotal}
                className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright disabled:opacity-30 transition-colors">
                Next →
              </button>
            </div>
          )}
          <button
            onClick={handleImportSpellsClick}
            disabled={selectedSpells.size === 0 || importingSpells || !onImportSpells}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:brightness-110"
          >
            {importingSpells ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {importingSpells ? 'Importing…' : `Import ${selectedSpells.size > 0 ? selectedSpells.size : ''} Spell${selectedSpells.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {tab === 'players' && (
        <>
          {!onCreatePlayer && (
            <p className="text-xs text-outline bg-surface-container-low rounded-lg px-3 py-2">
              Player import is not available in this context.
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              value={charSearch}
              onChange={e => setCharSearch(e.target.value)}
              placeholder="Search characters…"
              className="w-full bg-surface-container-low border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {characters.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-outline px-1">
              <button
                onClick={async () => {
                  if (selectedChars.size === charTotal) { setSelectedChars(new Set()); return; }
                  if (charTotal <= characters.length) { setSelectedChars(new Set(characters.map((c: any) => c._id))); return; }
                  setSelectingAllChars(true);
                  try {
                    const data = await api.foundry.characters({ world: selectedWorld, search: charSearch || undefined, limit: charTotal, offset: 0, full: false, dataPath: effectiveDataPath });
                    setSelectedChars(new Set(data.actors.map((a: any) => a._id)));
                  } catch { setSelectedChars(new Set(characters.map((c: any) => c._id))); }
                  finally { setSelectingAllChars(false); }
                }}
                className="hover:text-on-surface transition-colors"
              >
                {selectingAllChars ? 'Loading…' : selectedChars.size === charTotal ? 'Deselect all' : `Select all (${charTotal})`}
              </button>
              <span>{charTotal} total</span>
            </div>
          )}
          <div className="bg-surface-container-low rounded-xl overflow-hidden border border-white/5 max-h-72 overflow-y-auto">
            {charsLoading ? (
              <div className="flex items-center justify-center py-8 text-outline">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : characters.length === 0 ? (
              <div className="py-8 text-center text-xs text-outline">
                {selectedWorld ? 'No characters found' : 'Select a world'}
              </div>
            ) : (
              characters.map((char: any) => {
                const id = char._id ?? char.name;
                const isSelected = selectedChars.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedChars(prev => {
                        const n = new Set(prev);
                        n.has(id) ? n.delete(id) : n.add(id);
                        return n;
                      });
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-primary border-primary' : 'border-white/30'
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                    </div>
                    {char.img && (
                      <img src={char.img} alt="" className="w-7 h-7 rounded object-cover shrink-0 bg-black/30" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{char.name}</p>
                      <p className="text-[11px] text-outline truncate capitalize">{char.system?.details?.class ?? 'Character'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <button
            onClick={handleImportPlayers}
            disabled={selectedChars.size === 0 || importingPlayers || !onCreatePlayer}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:brightness-110"
          >
            {importingPlayers ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {importingPlayers ? 'Importing…' : `Import ${selectedChars.size > 0 ? selectedChars.size : ''} Player${selectedChars.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {tab === 'journals' && (
        <>
          {!onImportEncounters && (
            <p className="text-xs text-outline bg-surface-container-low rounded-lg px-3 py-2">
              Journal encounter import is not available in this context.
            </p>
          )}
          <p className="text-[11px] text-outline px-1">
            Imports encounter tables from journal HTML. Select journals containing creature tables.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              value={journalSearch}
              onChange={e => setJournalSearch(e.target.value)}
              placeholder="Search journals…"
              className="w-full bg-surface-container-low border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {journals.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-outline px-1">
              <button
                onClick={() => {
                  if (selectedJournals.size === journals.length) setSelectedJournals(new Set());
                  else setSelectedJournals(new Set(journals.map((j: any) => j._id)));
                }}
                className="hover:text-on-surface transition-colors"
              >
                {selectedJournals.size === journals.length ? 'Deselect all' : `Select all (${journals.length})`}
              </button>
              <span>{journals.length} journals</span>
            </div>
          )}
          <div className="bg-surface-container-low rounded-xl overflow-hidden border border-white/5 max-h-72 overflow-y-auto">
            {journalsLoading ? (
              <div className="flex items-center justify-center py-8 text-outline">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : journals.length === 0 ? (
              <div className="py-8 text-center text-xs text-outline">
                {selectedWorld ? 'No journals found' : 'Select a world'}
              </div>
            ) : (
              journals.map((journal: any) => {
                const id = journal._id;
                const isSelected = selectedJournals.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedJournals(prev => {
                        const n = new Set(prev);
                        n.has(id) ? n.delete(id) : n.add(id);
                        return n;
                      });
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-primary border-primary' : 'border-white/30'
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                    </div>
                    <BookOpen className="w-3.5 h-3.5 text-outline shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{journal.name}</p>
                      {journal.pages?.length > 0 && (
                        <p className="text-[11px] text-outline">{journal.pages.length} page{journal.pages.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <button
            onClick={handleImportJournals}
            disabled={selectedJournals.size === 0 || importingJournals || !onImportEncounters}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:brightness-110"
          >
            {importingJournals ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {importingJournals ? 'Parsing…' : `Parse ${selectedJournals.size > 0 ? selectedJournals.size : ''} Journal${selectedJournals.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}

      {tab === 'scenes' && (
        <>
          {!onImportScene && (
            <p className="text-xs text-outline bg-surface-container-low rounded-lg px-3 py-2">
              Open an encounter first to apply a scene.
            </p>
          )}
          <div className="bg-surface-container-low rounded-xl overflow-hidden border border-white/5 max-h-80 overflow-y-auto">
            {scenesLoading ? (
              <div className="flex items-center justify-center py-8 text-outline">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading scenes…
              </div>
            ) : scenes.length === 0 ? (
              <div className="py-8 text-center text-xs text-outline">
                {selectedWorld ? 'No scenes found' : 'Select a world'}
              </div>
            ) : (
              scenes.map(scene => (
                <div key={scene.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5 last:border-0">
                  <div className="w-12 h-8 rounded bg-black/30 shrink-0 overflow-hidden border border-white/10">
                    {scene.backgroundImg ? (
                      <img src={scene.backgroundImg} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-3.5 h-3.5 text-outline/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-on-surface truncate">{scene.name}</p>
                      {scene.active && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full shrink-0">Active</span>}
                    </div>
                    {scene.playlistSound && <p className="text-[10px] text-outline truncate">♪ Has ambient sound</p>}
                  </div>
                  <button
                    onClick={() => handleApplyScene(scene)}
                    disabled={!onImportScene}
                    className={cn(
                      'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-30',
                      appliedSceneId === scene.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
                    )}
                  >
                    {appliedSceneId === scene.id ? <><Check className="w-3 h-3" /> Applied</> : 'Apply'}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
