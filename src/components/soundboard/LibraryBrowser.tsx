import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Library, X, Check, Download, Music2, FolderOpen, Globe, Play, Square, Youtube, AlertCircle, Info, Search, ChevronRight, ChevronDown, ScrollText } from 'lucide-react';
import { Sound } from '../../types';
import { CATEGORIES, categoryMeta } from './constants';
import { api } from '../../api/client';

interface LibrarySound {
  id: string;
  name: string;
  description?: string;
  pack?: string;
  category: string;
  tags: string[];
  volume: number;
  url: string;
}

interface AmbienceVariant { label: string; url: string; }
interface AmbienceTrack {
  id: string;
  name: string;
  genre: string;
  defaultUrl: string;
  variants: AmbienceVariant[];
}

interface LibraryBrowserProps {
  show: boolean;
  onClose: () => void;
  sounds: Sound[];
  onRefresh: () => Promise<void>;
  initialYtQuery?: string | null;
}

export const LibraryBrowser = React.memo<LibraryBrowserProps>(({ show, onClose, sounds, onRefresh, initialYtQuery }) => {
  const [library, setLibrary] = useState<LibrarySound[]>([]);
  const [localLibrary, setLocalLibrary] = useState<LibrarySound[]>([]);
  const [ambienceLibrary, setAmbienceLibrary] = useState<AmbienceTrack[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libSource, setLibSource] = useState<'ambiences' | 'local' | 'online' | 'youtube' | 'foundry'>('ambiences');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [libCategory, setLibCategory] = useState('all');
  const [libSearch, setLibSearch] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // YouTube import state
  const QUICK_MOODS = [
    { label: 'Combat',   q: 'epic fantasy battle music', icon: '⚔️' },
    { label: 'Tavern',   q: 'medieval tavern ambience with music', icon: '🍺' },
    { label: 'Forest',   q: 'fantasy forest nature ambience', icon: '🌲' },
    { label: 'Dungeon',  q: 'creepy dark dungeon ambience', icon: '💀' },
    { label: 'Magic',    q: 'ethereal magic spell sounds', icon: '🪄' },
    { label: 'Market',   q: 'medieval market crowd ambience', icon: '🏙️' },
    { label: 'Storm',    q: 'heavy rain and thunder ambience', icon: '⛈️' },
    { label: 'Horror',   q: 'dark horror ambient drone', icon: '👻' },
  ];
  const [ytUrl, setYtUrl] = useState('');
  const [ytName, setYtName] = useState('');
  const [ytCategory, setYtCategory] = useState('ambient');
  const [ytVolume, setYtVolume] = useState(0.8);
  const [ytFetching, setYtFetching] = useState(false);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytSuccess, setYtSuccess] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytRecent, setYtRecent] = useState<string[]>([]);

  const handleYoutubeSearch = useCallback(async (query: string) => {
    if (!query.trim() || ytSearching) return;
    setYtSearching(true);
    setYtError(null);
    setYtResults([]);
    try {
      const results = await api.sounds.youtubeSearch(query);
      setYtResults(results);
      setYtRecent(prev => {
        const next = [query, ...prev.filter(q => q !== query)].slice(0, 5);
        return next;
      });
    } catch (e: any) {
      setYtError(e.message ?? 'Search failed');
    }
    setYtSearching(false);
  }, [ytSearching]);

  // Foundry state
  const [foundryDataPath, setFoundryDataPath] = useState<string>(() => localStorage.getItem('foundry_data_path') ?? '');
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<string>('');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());
  const [foundryLoading, setFoundryLoading] = useState(false);

  const togglePreview = (url: string, id: string) => {
    if (previewingId === id) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => setPreviewingId(null);
    previewAudioRef.current = audio;
    setPreviewingId(id);
  };

  const loadLibSource = useCallback(async (src: 'ambiences' | 'local' | 'online', forceReload = false) => {
    if (src === 'ambiences' && (ambienceLibrary.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const d = await api.sounds.ambiences(); setAmbienceLibrary(d as AmbienceTrack[]); } catch {}
      setLibraryLoading(false);
    }
    if (src === 'local' && (localLibrary.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const d = await api.sounds.local(); setLocalLibrary(d as LibrarySound[]); } catch {}
      setLibraryLoading(false);
    }
    if (src === 'online' && (library.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const d = await api.sounds.library(); setLibrary(d as LibrarySound[]); } catch {}
      setLibraryLoading(false);
    }
  }, [ambienceLibrary.length, localLibrary.length, library.length]);

  // When modal opens, reset selection state and load initial source
  useEffect(() => {
    if (show) {
      setSelectedIds(new Set());
      setSelectedVariants({});
      setLibSource('ambiences');
      setLibCategory('all');
      setLibSearch('');
      setYtUrl(''); setYtName(''); setYtCategory('ambient'); setYtVolume(0.8);
      setYtError(null); setYtSuccess(null);
      setWorlds([]); setSelectedWorld(''); setPlaylists([]); setExpandedPlaylists(new Set());
      loadLibSource('ambiences');
    } else {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run YouTube search when opened with an initial query
  useEffect(() => {
    if (show && initialYtQuery) {
      setLibSource('youtube');
      handleYoutubeSearch(initialYtQuery);
    }
  }, [show, initialYtQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch YouTube title when URL is pasted
  useEffect(() => {
    if (libSource !== 'youtube' || !ytUrl.trim() || !ytUrl.startsWith('http')) return;
    const timer = setTimeout(async () => {
      setYtFetching(true);
      try {
        const { title } = await api.sounds.youtubeMeta(ytUrl);
        if (title) setYtName(prev => prev || title);
      } catch {}
      setYtFetching(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [ytUrl, libSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleYoutubeDownload = useCallback(async () => {
    if (!ytUrl.trim() || ytDownloading) return;
    setYtDownloading(true);
    setYtError(null);
    setYtSuccess(null);
    try {
      const result = await api.sounds.youtubeDownload({ url: ytUrl, name: ytName.trim() || undefined, category: ytCategory, volume: ytVolume });
      setYtSuccess(`"${result.name}" imported successfully!`);
      setYtUrl(''); setYtName('');
      await onRefresh();
    } catch (e: any) {
      setYtError(e.message ?? 'Download failed');
    }
    setYtDownloading(false);
  }, [ytUrl, ytName, ytCategory, ytVolume, ytDownloading, onRefresh]);

  const loadFoundryWorlds = useCallback(async () => {
    setFoundryLoading(true);
    try {
      const data = await api.foundry.worlds(foundryDataPath.trim() || undefined);
      setWorlds(data);
    } catch {}
    setFoundryLoading(false);
  }, [foundryDataPath]);

  const loadFoundryPlaylists = useCallback(async (worldId: string) => {
    setFoundryLoading(true);
    try {
      const data = await api.foundry.playlists(worldId, foundryDataPath.trim() || undefined);
      setPlaylists(data);
    } catch {}
    setFoundryLoading(false);
  }, [foundryDataPath]);

  useEffect(() => {
    if (libSource === 'foundry' && worlds.length === 0) {
      loadFoundryWorlds();
    }
  }, [libSource, worlds.length, loadFoundryWorlds]);

  useEffect(() => {
    if (selectedWorld) {
      loadFoundryPlaylists(selectedWorld);
    } else {
      setPlaylists([]);
    }
  }, [selectedWorld, loadFoundryPlaylists]);

  const toggleLibrarySelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    if (libSource === 'ambiences') {
      const items = Array.from(selectedIds).map(id => {
        const track = ambienceLibrary.find(t => t.id === id)!;
        const url = selectedVariants[id] ?? track.defaultUrl;
        return { id, name: track.name, url, genre: track.genre };
      });
      await api.sounds.importAmbiences(items);
    } else {
      const endpoint = libSource === 'local' ? '/api/sounds/local/import' : '/api/sounds/library/import';
      await api.sounds.importBulkVisible(endpoint, Array.from(selectedIds));
    }
    await onRefresh();
    onClose();
    setImporting(false);
  }, [selectedIds, libSource, ambienceLibrary, selectedVariants, onRefresh, onClose]);

  const handleFoundryImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    try {
      const toImport: any[] = [];
      for (const pl of playlists) {
        for (const s of pl.sounds) {
          if (selectedIds.has(s.id)) {
            toImport.push({
              id: `foundry-${selectedWorld}-${s.id}`,
              name: s.name,
              url: s.url,
              category: 'ambient',
              tags: JSON.stringify(['foundry', pl.name.toLowerCase()]),
              volume: s.volume
            });
          }
        }
      }
      for (const s of toImport) {
        await api.sounds.create(s);
      }
      await onRefresh();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Foundry import failed');
    }
    setImporting(false);
  }, [selectedIds, playlists, selectedWorld, onRefresh, onClose]);

  const handleImportAll = useCallback(async () => {
    setImporting(true);
    const q = libSearch.toLowerCase();
    if (libSource === 'ambiences') {
      const visible = ambienceLibrary.filter(t =>
        (!q || t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q)) &&
        !sounds.some(s => s.id === t.id)
      );
      const items = visible.map(t => ({
        id: t.id, name: t.name, url: selectedVariants[t.id] ?? t.defaultUrl, genre: t.genre,
      }));
      await api.sounds.importAmbiences(items);
    } else {
      const activeLib = libSource === 'local' ? localLibrary : library;
      const endpoint = libSource === 'local' ? '/api/sounds/local/import' : '/api/sounds/library/import';
      const visible = activeLib.filter(s =>
        (libCategory === 'all' || s.category === libCategory) &&
        (!q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)) || (s.pack && s.pack.toLowerCase().includes(q)))
      );
      await api.sounds.importBulkVisible(endpoint, visible.map(s => s.id));
    }
    await onRefresh();
    onClose();
    setImporting(false);
  }, [libSource, library, localLibrary, ambienceLibrary, libSearch, libCategory, selectedVariants, sounds, onRefresh, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface-container rounded-2xl border border-outline/20 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10 shrink-0">
          <div className="flex items-center gap-3">
            <Library className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-headline font-bold text-on-surface">Sound Library</h3>
              <p className="text-[10px] text-outline uppercase tracking-widest">
                {libraryLoading ? 'Loading…'
                  : libSource === 'ambiences' ? `${ambienceLibrary.length} ambience tracks`
                  : libSource === 'local'     ? `${localLibrary.length} local sound effects`
                  : `${library.length} tracks · Tabletop Audio · CC-BY-NC-ND`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-outline/40 hover:text-outline rounded-full bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0 border-b border-outline/5">
          {([
            { key: 'ambiences', label: 'Ambiences',  Icon: Music2 },
            { key: 'local',     label: 'SFX Packs',  Icon: FolderOpen },
            { key: 'online',    label: 'Online',      Icon: Globe },
            { key: 'foundry',   label: 'Foundry',     Icon: ScrollText },
            { key: 'youtube',   label: 'Web Search',  Icon: Search },
          ] as const).map(({ key: src, label, Icon }) => (
            <button
              key={src}
              onClick={async () => {
                setLibSource(src);
                setSelectedIds(new Set());
                setLibCategory('all');
                previewAudioRef.current?.pause();
                setPreviewingId(null);
                if (src !== 'youtube' && src !== 'foundry') await loadLibSource(src as any);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
                libSource === src
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-outline border-transparent hover:text-on-surface hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        {libSource !== 'youtube' && libSource !== 'foundry' && (
          <div className="px-6 pt-3 pb-2 shrink-0">
            <input
              type="text"
              placeholder={libSource === 'ambiences' ? 'Search by name or genre…' : libSource === 'local' ? 'Search by name or pack…' : 'Search by name or tag…'}
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
        )}

        {/* Track list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1">
          {libraryLoading ? (
            <div className="flex items-center justify-center py-16 text-outline/30">
              <div className="text-sm font-headline uppercase tracking-widest animate-pulse">Loading…</div>
            </div>
          ) : libSource === 'foundry' ? (
            <div className="py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Foundry Data Path</label>
                <input
                  type="text"
                  value={foundryDataPath}
                  onChange={e => {
                    setFoundryDataPath(e.target.value);
                    localStorage.setItem('foundry_data_path', e.target.value);
                    setWorlds([]);
                    setSelectedWorld('');
                    setPlaylists([]);
                  }}
                  onBlur={() => { if (libSource === 'foundry') loadFoundryWorlds(); }}
                  onKeyDown={e => { if (e.key === 'Enter') loadFoundryWorlds(); }}
                  placeholder="/path/to/FoundryVTT/Data"
                  className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-3 py-2 text-xs font-mono text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-[10px] text-outline/40 px-1">Filesystem path to your FoundryVTT Data folder</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Select Foundry World</label>
                <select
                  value={selectedWorld}
                  onChange={e => setSelectedWorld(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                >
                  <option value="">Choose a world...</option>
                  {worlds.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                </select>
              </div>

              {foundryLoading ? (
                <div className="flex items-center justify-center py-12 text-outline/30">
                  <div className="text-sm font-headline uppercase tracking-widest animate-pulse">Scanning Playlists…</div>
                </div>
              ) : playlists.length > 0 ? (
                <div className="space-y-3">
                  {playlists.map(pl => {
                    const isExpanded = expandedPlaylists.has(pl.id);
                    const notAdded = pl.sounds.filter((s: any) => !sounds.some(ex => ex.id === `foundry-${selectedWorld}-${s.id}`));
                    const allSel = notAdded.length > 0 && notAdded.every((s: any) => selectedIds.has(s.id));
                    const someSel = notAdded.some((s: any) => selectedIds.has(s.id));

                    return (
                      <div key={pl.id} className="border border-outline/10 rounded-xl overflow-hidden bg-surface-container-high/20">
                        <div className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high/40 transition-colors cursor-pointer"
                          onClick={() => setExpandedPlaylists(prev => {
                            const next = new Set(prev);
                            if (next.has(pl.id)) next.delete(pl.id); else next.add(pl.id);
                            return next;
                          })}
                        >
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (allSel) notAdded.forEach((s: any) => next.delete(s.id));
                                else notAdded.forEach((s: any) => next.add(s.id));
                                return next;
                              });
                            }}
                            disabled={notAdded.length === 0}
                            className="shrink-0"
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                              notAdded.length === 0 ? 'border-outline/10' :
                              allSel ? 'border-primary bg-primary' :
                              someSel ? 'border-primary/60 bg-primary/20' : 'border-outline/30'
                            }`}>
                              {allSel && <Check className="w-2.5 h-2.5 text-on-primary" />}
                              {!allSel && someSel && <div className="w-1.5 h-0.5 bg-primary rounded-full" />}
                            </div>
                          </button>
                          <span className="text-sm font-bold text-on-surface flex-1">{pl.name}</span>
                          <span className="text-[10px] text-outline/50 font-mono mr-2">{pl.sounds.length} tracks</span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-outline/40" /> : <ChevronRight className="w-4 h-4 text-outline/40" />}
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-2 space-y-1 border-t border-outline/5 pt-2 bg-black/5">
                            {pl.sounds.map((s: any) => {
                              const sid = `foundry-${selectedWorld}-${s.id}`;
                              const alreadyAdded = sounds.some(ex => ex.id === sid);
                              const isSelected = selectedIds.has(s.id);
                              return (
                                <button key={s.id} disabled={alreadyAdded} onClick={() => !alreadyAdded && toggleLibrarySelect(s.id)}
                                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left transition-all ${alreadyAdded ? 'opacity-40 grayscale' : isSelected ? 'bg-primary/10' : 'hover:bg-white/5'}`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${alreadyAdded ? 'border-outline/20 bg-surface-container' : isSelected ? 'border-primary bg-primary' : 'border-outline/30'}`}>
                                    {(isSelected || alreadyAdded) && <Check className="w-2.5 h-2.5 text-on-primary" />}
                                  </div>
                                  <span className="text-xs text-on-surface flex-1 truncate">{s.name}</span>
                                  {alreadyAdded && <span className="text-[9px] text-outline/50 font-bold uppercase tracking-widest shrink-0">Added</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : selectedWorld ? (
                <div className="flex items-center justify-center py-16 text-outline/30 text-sm italic">No playlists found in this world</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-outline/30 space-y-2">
                  <ScrollText className="w-8 h-8 opacity-20" />
                  <div className="text-sm text-center">Select a world to browse playlists.<br/><span className="text-[10px] opacity-60">Music must be in a playlist in your Foundry world.</span></div>
                </div>
              )}
            </div>
          ) : libSource === 'youtube' ? (
            <div className="py-4 space-y-6">
              <div className="space-y-6">
                {/* Quick Moods */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-outline/60">Quick Mood Search</h5>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUICK_MOODS.map(mood => (
                      <button
                        key={mood.label}
                        onClick={() => handleYoutubeSearch(mood.q)}
                        disabled={ytSearching}
                        className="flex flex-col items-center gap-1.5 p-3 bg-surface-container-high/40 border border-outline/10 rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all group disabled:opacity-50"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform">{mood.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-outline group-hover:text-primary">{mood.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Searches */}
                {ytRecent.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Recent</h5>
                    <div className="flex flex-wrap gap-2">
                      {ytRecent.map(q => (
                        <button
                          key={q}
                          onClick={() => handleYoutubeSearch(q)}
                          className="px-2.5 py-1.5 bg-surface-container-high/60 border border-outline/10 rounded-lg text-[10px] text-outline hover:text-primary hover:border-primary/30 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Youtube className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-bold text-on-surface">Import from YouTube</h4>
                      <p className="text-xs text-outline leading-relaxed">
                        Search by query or paste a video URL. We'll use <code className="bg-surface-container px-1 rounded text-primary">yt-dlp</code> to extract the audio.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Search or URL</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search for something or paste https://..."
                          value={ytUrl}
                          onChange={e => setYtUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (!ytUrl.startsWith('http') ? handleYoutubeSearch(ytUrl) : handleYoutubeDownload())}
                          className="w-full bg-surface-container-high border border-outline/20 rounded-xl pl-4 pr-12 py-3 text-sm text-on-surface placeholder:text-outline/30 focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                        <button
                          onClick={() => !ytUrl.startsWith('http') ? handleYoutubeSearch(ytUrl) : handleYoutubeDownload()}
                          disabled={!ytUrl.trim() || ytSearching || ytDownloading || ytFetching}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30"
                        >
                          {ytSearching || ytDownloading || ytFetching ? (
                            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          ) : (
                            ytUrl.startsWith('http') ? <Download className="w-4 h-4" /> : <Search className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Search Results */}
                    {ytResults.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-2 duration-300">
                        {ytResults.map(res => (
                          <button
                            key={res.id}
                            onClick={() => {
                              setYtUrl(res.url);
                              setYtName(res.title);
                            }}
                            className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${
                              ytUrl === res.url 
                                ? 'bg-primary/10 border-primary/40' 
                                : 'bg-surface-container-high/40 border-outline/10 hover:bg-surface-container-high hover:border-outline/20'
                            }`}
                          >
                            <img src={res.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-on-surface truncate">{res.title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-outline/60">{res.uploader}</span>
                                <span className="text-[10px] text-outline/40">•</span>
                                <span className="text-[10px] text-outline/60 font-mono">{res.duration}</span>
                              </div>
                            </div>
                            {ytUrl === res.url && <Check className="w-4 h-4 text-primary shrink-0 mr-1" />}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Display Name</label>
                        <input
                          type="text"
                          placeholder="Auto-detected from title"
                          value={ytName}
                          onChange={e => setYtName(e.target.value)}
                          className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline/30 focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60 px-1">Category</label>
                        <select
                          value={ytCategory}
                          onChange={e => setYtCategory(e.target.value)}
                          className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                        >
                          {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-outline/60">Base Volume</label>
                        <span className="text-[10px] font-mono text-primary font-bold">{Math.round(ytVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={ytVolume}
                        onChange={e => setYtVolume(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {ytError && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="flex-1">{ytError}</p>
                      </div>
                    )}

                    {ytSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs animate-in slide-in-from-top-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <p className="flex-1">{ytSuccess}</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={handleYoutubeDownload}
                        disabled={!ytUrl.trim() || !ytUrl.startsWith('http') || ytDownloading || ytFetching}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                      >
                        {ytDownloading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                            <span>Downloading & Extracting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Download Audio Track</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-surface-container-high/40 rounded-xl border border-outline/10 flex items-start gap-3">
                  <Info className="w-4 h-4 text-outline/40 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-outline/60">Other Sources</h5>
                    <p className="text-[10px] text-outline/40 leading-relaxed">
                      You can also use URLs from SoundCloud, Bandcamp, and hundreds of other sites supported by yt-dlp. Direct audio file links (mp3, wav, ogg) will also work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : libSource === 'ambiences' ? (() => {
            const q = libSearch.toLowerCase();
            const visible = ambienceLibrary.filter(t =>
              !q || t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q)
            );
            if (visible.length === 0) return (
              <div className="flex items-center justify-center py-16 text-outline/30 text-sm">No tracks match</div>
            );
            // Group by genre
            const byGenre = new Map<string, AmbienceTrack[]>();
            for (const t of visible) {
              if (!byGenre.has(t.genre)) byGenre.set(t.genre, []);
              byGenre.get(t.genre)!.push(t);
            }
            return Array.from(byGenre.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([genre, tracks]) => {
              const notAdded = tracks.filter(t => !sounds.some(s => s.id === t.id));
              const allSel = notAdded.length > 0 && notAdded.every(t => selectedIds.has(t.id));
              const someSel = notAdded.some(t => selectedIds.has(t.id));
              return (
                <div key={genre} className="mb-4">
                  {/* Genre header with select-all */}
                  <button
                    onClick={() => setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (allSel) notAdded.forEach(t => next.delete(t.id));
                      else notAdded.forEach(t => next.add(t.id));
                      return next;
                    })}
                    disabled={notAdded.length === 0}
                    className="w-full flex items-center gap-2 px-1 pb-1.5 border-b border-outline/10 mb-1 hover:border-primary/30 transition-colors group/genre"
                  >
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                      notAdded.length === 0 ? 'border-outline/10' :
                      allSel ? 'border-primary bg-primary' :
                      someSel ? 'border-primary/60 bg-primary/20' : 'border-outline/30 group-hover/genre:border-primary/50'
                    }`}>
                      {allSel && <Check className="w-2 h-2 text-on-primary" />}
                      {!allSel && someSel && <div className="w-1.5 h-0.5 bg-primary rounded-full" />}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline/60 group-hover/genre:text-outline flex-1 text-left">{genre}</span>
                    <span className="text-[9px] text-outline/30 font-mono">{tracks.length}</span>
                  </button>
                  {/* Tracks */}
                  {tracks.map(track => {
                    const alreadyAdded = sounds.some(s => s.id === track.id);
                    const isSelected = selectedIds.has(track.id);
                    const currentVariantUrl = selectedVariants[track.id] ?? track.defaultUrl;
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 transition-all ${
                          alreadyAdded ? 'opacity-40 bg-surface-container-high/20' :
                          isSelected ? 'bg-teal-500/10 border border-teal-500/30 ring-1 ring-teal-500/20' :
                          'bg-surface-container-high/40 border border-outline/5 hover:bg-surface-container-high hover:border-outline/20'
                        }`}
                      >
                        <button
                          disabled={alreadyAdded}
                          onClick={() => !alreadyAdded && toggleLibrarySelect(track.id)}
                          className="shrink-0"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            alreadyAdded ? 'border-outline/20 bg-surface-container' :
                            isSelected ? 'border-primary bg-primary' : 'border-outline/30'
                          }`}>
                            {(isSelected || alreadyAdded) && <Check className="w-2.5 h-2.5 text-on-primary" />}
                          </div>
                        </button>
                        <span className="text-sm text-on-surface flex-1 truncate">{track.name}</span>
                        {/* Preview button */}
                        {!alreadyAdded && (
                          <button
                            onClick={e => { e.stopPropagation(); togglePreview(selectedVariants[track.id] ?? track.defaultUrl, track.id); }}
                            title={previewingId === track.id ? 'Stop preview' : 'Preview'}
                            className={`shrink-0 p-1 rounded transition-colors ${previewingId === track.id ? 'text-primary' : 'text-outline/40 hover:text-outline'}`}
                          >
                            {previewingId === track.id ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                          </button>
                        )}
                        {/* Variant selector */}
                        {track.variants.length > 1 && !alreadyAdded && (
                          <select
                            value={currentVariantUrl}
                            onChange={e => setSelectedVariants(prev => ({ ...prev, [track.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="text-[9px] bg-surface-container border border-outline/10 rounded px-1.5 py-1 text-outline/70 appearance-none cursor-pointer focus:outline-none max-w-[130px]"
                          >
                            {track.variants.map(v => (
                              <option key={v.url} value={v.url}>{v.label}</option>
                            ))}
                          </select>
                        )}
                        {alreadyAdded && <span className="text-[9px] text-outline/40 font-bold uppercase tracking-widest shrink-0">Added</span>}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })() : (() => {
            const activeLib = libSource === 'local' ? localLibrary : library;
            const q = libSearch.toLowerCase();
            const visible = activeLib.filter(s =>
              (libCategory === 'all' || s.category === libCategory) &&
              (!q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)) || (s.pack && s.pack.toLowerCase().includes(q)))
            );
            if (visible.length === 0) return (
              <div className="flex items-center justify-center py-16 text-outline/30 text-sm">No sounds match your search</div>
            );
            if (libSource === 'local') {
              const byPack = new Map<string, LibrarySound[]>();
              for (const s of visible) {
                const pack = s.pack ?? 'Other';
                if (!byPack.has(pack)) byPack.set(pack, []);
                byPack.get(pack)!.push(s);
              }
              return Array.from(byPack.entries()).map(([pack, items]) => {
                const notAdded = items.filter(s => !sounds.some(ex => ex.id === s.id));
                const allSelected = notAdded.length > 0 && notAdded.every(s => selectedIds.has(s.id));
                const someSelected = notAdded.some(s => selectedIds.has(s.id));
                return (
                  <div key={pack} className="mb-3">
                    <button
                      onClick={() => setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (allSelected) notAdded.forEach(s => next.delete(s.id));
                        else notAdded.forEach(s => next.add(s.id));
                        return next;
                      })}
                      disabled={notAdded.length === 0}
                      className="w-full flex items-center gap-2 px-1 pb-1.5 border-b border-outline/10 mb-1 hover:border-primary/30 transition-colors group/pack"
                    >
                      <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        notAdded.length === 0 ? 'border-outline/10 bg-surface-container' :
                        allSelected ? 'border-primary bg-primary' :
                        someSelected ? 'border-primary/60 bg-primary/20' : 'border-outline/30 group-hover/pack:border-primary/50'
                      }`}>
                        {allSelected && <Check className="w-2 h-2 text-on-primary" />}
                        {!allSelected && someSelected && <div className="w-1.5 h-0.5 bg-primary rounded-full" />}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline/50 group-hover/pack:text-outline flex-1 text-left transition-colors">{pack}</span>
                      <span className="text-[9px] text-outline/30 font-mono">{items.length}</span>
                    </button>
                    {items.map(item => {
                      const alreadyAdded = sounds.some(s => s.id === item.id);
                      const isSelected = selectedIds.has(item.id);
                      const cat = categoryMeta(item.category);
                      return (
                        <button key={item.id} disabled={alreadyAdded} onClick={() => !alreadyAdded && toggleLibrarySelect(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all mb-0.5 ${alreadyAdded ? 'opacity-40 cursor-not-allowed bg-surface-container-high/20' : isSelected ? `${cat.bg} ${cat.border} border ring-1 ring-current/40` : 'bg-surface-container-high/40 border border-outline/5 hover:bg-surface-container-high hover:border-outline/20'}`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${alreadyAdded ? 'border-outline/20 bg-surface-container' : isSelected ? 'border-primary bg-primary' : 'border-outline/30'}`}>
                            {(isSelected || alreadyAdded) && <Check className="w-2.5 h-2.5 text-on-primary" />}
                          </div>
                          <span className="text-sm text-on-surface truncate flex-1">{item.name}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${cat.bg} ${cat.color}`}>{cat.label}</span>
                          {alreadyAdded && <span className="text-[9px] text-outline/50 font-bold uppercase tracking-widest shrink-0">Added</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            }
            return visible.map(item => {
              const alreadyAdded = sounds.some(s => s.id === item.id);
              const isSelected = selectedIds.has(item.id);
              const cat = categoryMeta(item.category);
              return (
                <button key={item.id} disabled={alreadyAdded} onClick={() => !alreadyAdded && toggleLibrarySelect(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all mb-0.5 ${alreadyAdded ? 'opacity-40 cursor-not-allowed bg-surface-container-high/20' : isSelected ? `${cat.bg} ${cat.border} border ring-1 ring-current/40` : 'bg-surface-container-high/40 border border-outline/5 hover:bg-surface-container-high hover:border-outline/20'}`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${alreadyAdded ? 'border-outline/20 bg-surface-container' : isSelected ? 'border-primary bg-primary' : 'border-outline/30'}`}>
                    {(isSelected || alreadyAdded) && <Check className="w-3 h-3 text-on-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-on-surface truncate">{item.name}</span>
                      {alreadyAdded && <span className="text-[9px] text-outline/50 font-bold uppercase tracking-widest shrink-0">Added</span>}
                    </div>
                    {item.description && <p className="text-[10px] text-outline/50 truncate mt-0.5">{item.description}</p>}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${cat.bg} ${cat.color}`}>{cat.label}</span>
                      {item.tags.slice(0, 4).map(t => <span key={t} className="text-[9px] text-outline/40">{t}</span>)}
                    </div>
                  </div>
                </button>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-outline/10 shrink-0">
          <div className="flex items-center gap-2">
            {libSource !== 'youtube' && libSource !== 'foundry' && (
              <>
                <button
                  onClick={() => {
                    if (libSource === 'ambiences') {
                      const q = libSearch.toLowerCase();
                      const notAdded = ambienceLibrary.filter(t =>
                        (!q || t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q)) &&
                        !sounds.some(s => s.id === t.id)
                      );
                      setSelectedIds(new Set(notAdded.map(t => t.id)));
                    } else {
                      const activeLib = libSource === 'local' ? localLibrary : library;
                      const q = libSearch.toLowerCase();
                      const visible = activeLib.filter(s =>
                        (libCategory === 'all' || s.category === libCategory) &&
                        (!q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)) || (s.pack && s.pack.toLowerCase().includes(q)))
                      );
                      setSelectedIds(new Set(visible.filter(s => !sounds.some(ex => ex.id === s.id)).map(s => s.id)));
                    }
                  }}
                  className="text-xs text-outline hover:text-on-surface transition-colors underline underline-offset-2"
                >Select all visible</button>
                <span className="text-outline/20 text-xs">·</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-outline hover:text-on-surface transition-colors underline underline-offset-2">Clear</button>
                {selectedIds.size > 0 && <span className="text-[10px] text-primary font-bold ml-1">{selectedIds.size} selected</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-outline hover:text-on-surface transition-colors">
              {libSource === 'youtube' || libSource === 'foundry' ? 'Close' : 'Cancel'}
            </button>
            {libSource !== 'youtube' && (
              <button
                onClick={libSource === 'foundry' ? handleFoundryImport : selectedIds.size > 0 ? handleImport : handleImportAll}
                disabled={importing || libraryLoading || (libSource === 'foundry' && selectedIds.size === 0)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {importing ? 'Importing…' : libSource === 'foundry'
                  ? `Import ${selectedIds.size} from Foundry`
                  : selectedIds.size > 0
                  ? `Import ${selectedIds.size}`
                  : libSource === 'ambiences' ? 'Import All Ambiences' : libSource === 'local' ? 'Import All SFX' : 'Import All (313)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

LibraryBrowser.displayName = 'LibraryBrowser';
