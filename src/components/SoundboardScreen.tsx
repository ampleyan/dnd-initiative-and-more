import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Square, Upload, Link, X, Music, Check, Library, Settings2, Search, Tag, Volume2, VolumeX, MoreHorizontal, ChevronRight, Youtube } from 'lucide-react';
import { Sound, Spell } from '../types';
import { uuid } from '../lib/utils';
import { CATEGORIES, categoryMeta, SoundCard, LibraryBrowser, CompactSoundList, DEFAULT_LIVE } from './soundboard';
import type { LiveSettings } from './soundboard';

interface AddFormState {
  name: string;
  url: string;
  category: string;
  spellId: string;
  volume: number;
  file: File | null;
}

const EMPTY_FORM: AddFormState = { name: '', url: '', category: 'custom', spellId: '', volume: 0.8, file: null };

interface Props {
  sounds: Sound[];
  spells?: Spell[];
  onAdd: (data: FormData) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<Sound, 'name' | 'category' | 'tags' | 'spellId' | 'volume' | 'isFavorite'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  /** When true renders a compact list with always-visible controls (for floating modal) */
  compact?: boolean;
  masterVolume?: number;
  isMuted?: boolean;
  onMasterVolumeChange?: (v: number) => void;
  onMuteToggle?: (v: boolean) => void;
  playingIds: Set<string>;
  liveSettings: Record<string, import('../hooks/useSoundboard').LiveSettings>;
  onTogglePlay: (sound: Sound) => void;
  onStopAll: () => void;
  onPatchLive: (id: string, patch: any) => void;
  onSetVolume: (id: string, volume: number) => void;
}

export const SoundboardScreen: React.FC<Props> = ({
  sounds, spells = [], onAdd, onUpdate, onDelete, onRefresh,
  compact = false, masterVolume = 1.0, isMuted = false,
  onMasterVolumeChange, onMuteToggle,
  playingIds, liveSettings, onTogglePlay, onStopAll, onPatchLive, onSetVolume
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLibrary, setShowLibrary] = useState(false);
  const [search, setSearch] = useState('');
  const [ytFallbackQuery, setYtFallbackQuery] = useState<string | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('sb_collapsed');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });
  const overflowRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      sessionStorage.setItem('sb_collapsed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  const handleVolumeChange = useCallback(async (sound: Sound, value: number) => {
    onSetVolume(sound.id, value);
    await onUpdate(sound.id, { volume: value });
  }, [onUpdate, onSetVolume]);

  const handleSubmit = async () => {
    if (!form.name.trim() || (!form.url.trim() && !form.file)) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('id', uuid());
    fd.append('name', form.name.trim());
    fd.append('category', form.category);
    fd.append('tags', JSON.stringify([]));
    fd.append('spellId', form.spellId);
    fd.append('volume', String(form.volume));
    if (form.file) {
      fd.append('file', form.file);
    } else {
      fd.append('url', form.url.trim());
    }
    await onAdd(fd);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  };

  const allCustomTags = useMemo(() => {
    const tags = new Set<string>();
    for (const s of sounds) {
      for (const t of s.tags) {
        if (t) tags.add(t);
      }
    }
    return [...tags].sort();
  }, [sounds]);

  const visible = useMemo(() => {
    let result: Sound[];
    if (activeCategory === 'all') result = sounds;
    else if (activeCategory === 'favorites') result = sounds.filter(s => s.isFavorite === 1);
    else result = sounds.filter(s => s.category === activeCategory);
    if (activeTag) result = result.filter(s => s.tags.includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)));
    }
    return result;
  }, [sounds, activeCategory, activeTag, search]);

  const linkedSpell = (s: Sound) => s.spellId ? spells.find(sp => sp.id === s.spellId) : null;

  const groupedVisible = useMemo(() => {
    const groups = new Map<string, Sound[]>();
    const OTHER = '__other__';
    for (const s of visible) {
      const isLocal = s.id.startsWith('local-');
      const pack = isLocal && s.tags.length > 0 ? s.tags[0] : OTHER;
      if (!groups.has(pack)) groups.set(pack, []);
      groups.get(pack)!.push(s);
    }
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === OTHER) return 1;
      if (b === OTHER) return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [visible]);

  if (compact) {
    return (
      <CompactSoundList
        sounds={sounds}
        visible={visible}
        allCustomTags={allCustomTags}
        activeCategory={activeCategory}
        activeTag={activeTag}
        playingIds={playingIds}
        liveSettingsState={liveSettings}
        onSetActiveCategory={setActiveCategory}
        onSetActiveTag={setActiveTag}
        onTogglePlay={onTogglePlay}
        onStopAll={onStopAll}
        onPatchLive={onPatchLive}
        onVolumeChange={handleVolumeChange}
      />
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-headline font-bold text-on-surface">Soundboard</h2>
            <p className="text-[10px] text-outline uppercase tracking-widest font-semibold">{sounds.length} {sounds.length === 1 ? 'Sound' : 'Sounds'} available</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Master Volume Control */}
          <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-high/60 border border-outline/10 rounded-xl mr-2">
            <button
              onClick={() => onMuteToggle?.(!isMuted)}
              className={`p-1.5 rounded-lg transition-colors ${isMuted ? 'text-error bg-error/10' : 'text-primary hover:bg-primary/10'}`}
              title={isMuted ? 'Unmute' : 'Mute All'}
            >
              {isMuted || masterVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="flex flex-col gap-1 min-w-[100px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-outline/60">Master</span>
                <span className="text-[9px] font-mono font-bold text-primary">{Math.round(masterVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={masterVolume}
                onChange={e => onMasterVolumeChange?.(parseFloat(e.target.value))}
                className="w-full h-1 bg-outline/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {playingIds.size > 0 && (
            <button
              onClick={onStopAll}
              className="flex items-center gap-2 px-3 py-2 bg-error/10 text-error border border-error/20 rounded-lg text-xs font-bold hover:bg-error/20 transition-all active:scale-95"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop All ({playingIds.size})
            </button>
          )}

          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">Import Library</span>
            <span className="sm:hidden">Library</span>
          </button>

          <div className="relative" ref={overflowRef}>
            <button
              onClick={() => setShowOverflow(v => !v)}
              className="p-2 rounded-lg border border-outline/20 text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showOverflow && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-highest border border-outline/15 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
                <button
                  onClick={() => { setShowForm(v => !v); setShowOverflow(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-on-surface hover:bg-white/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-outline" />
                  Add Sound
                </button>
                <button
                  onClick={() => { setIsManageMode(v => !v); setShowOverflow(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-on-surface hover:bg-white/5 transition-colors"
                >
                  {isManageMode
                    ? <><Check className="w-3.5 h-3.5 text-primary" /><span>Done Editing</span></>
                    : <><Settings2 className="w-3.5 h-3.5 text-outline" /><span>Manage Sounds</span></>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Library Import Modal */}
      <LibraryBrowser
        show={showLibrary}
        onClose={() => { setShowLibrary(false); setYtFallbackQuery(null); }}
        sounds={sounds}
        onRefresh={onRefresh}
        initialYtQuery={ytFallbackQuery}
      />

      {/* Add form (Accordian-style) */}
      {showForm && (
        <div className="bg-surface-container rounded-2xl p-6 border border-outline/10 space-y-5 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Upload className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Create New Sound</h3>
            </div>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="p-2 text-outline/40 hover:text-outline transition-colors bg-white/5 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-headline uppercase tracking-widest text-outline ml-1">Sound Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Fireball Blast"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-headline uppercase tracking-widest text-outline ml-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    {CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'favorites').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-headline uppercase tracking-widest text-outline ml-1">Default Vol</label>
                  <div className="flex items-center gap-3 bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.volume}
                      onChange={e => setForm(f => ({ ...f, volume: parseFloat(e.target.value) }))}
                      className="flex-1 h-1.5 accent-primary cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-outline w-6 text-right">{Math.round(form.volume * 100)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-headline uppercase tracking-widest text-outline ml-1">Audio Source</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/30" />
                    <input
                      type="url"
                      placeholder="Paste URL (Dropbox, Discord, etc.)"
                      value={form.url}
                      disabled={!!form.file}
                      onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                      className="w-full bg-surface-container-high border border-outline/20 rounded-xl pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40 transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-headline text-outline px-2">OR</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap active:scale-95 ${
                        form.file
                          ? 'bg-primary/20 text-primary border-primary/40 ring-2 ring-primary/20'
                          : 'bg-surface-container-high text-on-surface border-outline/20 hover:border-outline/40'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      {form.file ? form.file.name.slice(0, 15) + (form.file.name.length > 15 ? '...' : '') : 'Upload File'}
                    </button>
                  </div>
                  {form.file && (
                    <button onClick={() => setForm(f => ({ ...f, file: null }))} className="p-3 text-outline/40 hover:text-error transition-colors bg-white/5 rounded-xl">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setForm(prev => ({ ...prev, file: f, url: f ? '' : prev.url }));
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-headline uppercase tracking-widest text-outline ml-1">Link to Spell <span className="opacity-40 italic">(Optional)</span></label>
                <select
                  value={form.spellId}
                  onChange={e => setForm(f => ({ ...f, spellId: e.target.value }))}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="">None — Not linked to a specific spell</option>
                  {[...spells].sort((a,b) => a.name.localeCompare(b.name)).map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name} (Level {sp.level})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-outline/5 mt-2">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-6 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || (!form.url.trim() && !form.file) || !form.name.trim()}
              className="px-8 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95"
            >
              {saving ? 'Creating...' : 'Create Sound'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Search sounds…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface-container-high border border-outline/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline/30 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/40 hover:text-outline transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category filter — only show categories that have sounds (except 'all') */}
      <div className="flex gap-2 flex-wrap pb-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.filter(cat => {
          if (cat.id === 'all') return true;
          if (cat.id === 'favorites') return sounds.some(s => s.isFavorite === 1);
          return sounds.some(s => s.category === cat.id);
        }).map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-headline font-bold uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${
              activeCategory === cat.id
                ? `${cat.bg} ${cat.color} ring-1 ring-current/40 shadow-sm`
                : 'bg-surface-container-high/40 text-outline hover:text-on-surface hover:bg-white/5 border border-outline/5'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cat.id === 'all' ? 'bg-primary' : cat.color.replace('text', 'bg')}`} />
            {cat.label}
            <span className="text-[10px] opacity-40 font-mono">
              {cat.id === 'all' ? sounds.length : cat.id === 'favorites' ? sounds.filter(s => s.isFavorite === 1).length : sounds.filter(s => s.category === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Custom tag filter */}
      {allCustomTags.length > 0 && (
        <div className="relative">
          <div className="flex gap-1.5 flex-wrap pb-1 overflow-x-auto no-scrollbar items-center">
            <Tag className="w-3 h-3 text-outline/40 shrink-0" />
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${
                activeTag === null
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                  : 'bg-surface-container-high/40 text-outline hover:text-on-surface hover:bg-white/5'
              }`}
            >
              All
            </button>
            {allCustomTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap active:scale-95 ${
                  activeTag === tag
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'bg-surface-container-high/40 text-outline hover:text-on-surface hover:bg-white/5'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface-container to-transparent" />
        </div>
      )}

      {/* Sound Board Grid */}
      {visible.length === 0 && search.trim() ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-outline/30">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-current flex items-center justify-center">
            <Music className="w-7 h-7" />
          </div>
          <p className="text-sm font-headline uppercase tracking-tighter">No local results</p>
          <button
            onClick={() => { setYtFallbackQuery(search.trim()); setShowLibrary(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors active:scale-95"
          >
            <Youtube className="w-3.5 h-3.5" />
            Search YouTube for &ldquo;{search}&rdquo;
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-outline/20">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center">
            <Music className="w-8 h-8" />
          </div>
          <p className="text-sm font-headline uppercase tracking-tighter">Empty Soundboard</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedVisible.map(([pack, groupSounds]) => (
            <div key={pack}>
              {(groupedVisible.length > 1 || pack !== '__other__') && (
                <button
                  onClick={() => toggleSection(pack)}
                  className="flex items-center gap-3 mb-3 w-full group"
                >
                  <ChevronRight className={`w-3 h-3 text-outline/40 transition-transform duration-200 ${collapsedSections.has(pack) ? '' : 'rotate-90'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline/50 capitalize">
                    {pack === '__other__' ? 'Custom / Other' : pack.replace(/-/g, ' ')}
                  </span>
                  <div className="flex-1 h-px bg-outline/10" />
                  <span className="text-[10px] text-outline/30 font-mono">{groupSounds.length}</span>
                </button>
              )}
              {!collapsedSections.has(pack) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {groupSounds.map(sound => {
                    const isPlaying = playingIds.has(sound.id);
                    const cat = categoryMeta(sound.category);
                    const spell = linkedSpell(sound);
                    const live: LiveSettings = liveSettings[sound.id] ?? DEFAULT_LIVE;

                    return (
                      <SoundCard
                        key={sound.id}
                        sound={sound}
                        spells={spells}
                        isPlaying={isPlaying}
                        live={live}
                        isManageMode={isManageMode}
                        cat={cat}
                        linkedSpell={spell}
                        onTogglePlay={onTogglePlay}
                        onVolumeChange={handleVolumeChange}
                        onPatchLive={onPatchLive}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Now Playing bar */}
      {playingIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest/95 backdrop-blur-md border border-primary/20 rounded-2xl shadow-2xl shadow-black/40 max-w-2xl w-full">
          <Volume2 className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
            {sounds.filter(s => playingIds.has(s.id)).map(s => {
              const cat = categoryMeta(s.category);
              return (
                <div key={s.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shrink-0 ${cat.bg} ${cat.border}`}>
                  <span className={`text-xs font-bold truncate max-w-[120px] ${cat.color}`}>{s.name}</span>
                  <button
                    onClick={() => onTogglePlay(s)}
                    title="Stop"
                    className="text-outline/50 hover:text-error transition-colors shrink-0"
                  >
                    <VolumeX className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={onStopAll}
            className="flex items-center gap-1.5 px-3 py-1 bg-error/15 text-error border border-error/30 rounded-lg text-xs font-bold hover:bg-error/25 transition-colors shrink-0"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop All
          </button>
        </div>
      )}
    </div>
  );
};
