import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Star, ChevronDown, X, Eye, Plus, Edit2, SlidersHorizontal, User, Copy, Trash2, Save, Sparkles, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MonsterTemplate, Player, Spell, ClassFeature, FeatureUses } from '../types';
import { parseFeatureUses } from '../lib/featureUsesParser';
import { useMonsterFilter } from '../hooks/useMonsterFilter';
import { AvatarImg } from './AvatarImg';
import { MonsterDetailPanel } from './MonsterDetailPanel';

const FAVORITES_KEY = 'monster_library_favorites';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(ids)));
}

function parseCR(cr: string): number {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

type SortBy = 'name' | 'cr-asc' | 'cr-desc';
type CollectionFilter = 'all' | 'favorites' | 'players';

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
          value.length > 0
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest'
        }`}
      >
        {label}
        {value.length > 0 && (
          <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] flex items-center justify-center font-black">
            {value.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-xl min-w-[160px] py-1.5 max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                value.includes(opt)
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {opt}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-outline">No options</p>
          )}
        </div>
      )}
    </div>
  );
};

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  XMM:    { label: 'XMM 2024', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  MM:     { label: 'MM 2014',  color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  VGM:    { label: "VGM",      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  MTF:    { label: "MTF",      color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  WBTW:   { label: "WBTW",     color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  custom: { label: 'Custom',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

function sourceTag(source?: string) {
  if (!source) return SOURCE_LABEL.custom;
  return SOURCE_LABEL[source] ?? { label: source, color: 'bg-surface-container-highest text-outline border-outline-variant/20' };
}

interface LibraryCardProps {
  monster: MonsterTemplate;
  isFavorite: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  isSaving?: boolean;
}

const LibraryCard: React.FC<LibraryCardProps> = ({ monster, isFavorite, onSelect, onAdd, onEdit, onCopy, onDelete, isSaving }) => {
  const src = sourceTag(monster.source);
  return (
    <div className="group relative rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/10 cursor-pointer hover:border-primary/30 transition-all duration-200">
      {/* Hero image */}
      <div className="relative h-40 overflow-hidden" onClick={onSelect}>
        <AvatarImg
          src={monster.image}
          name={monster.name}
          className="w-full h-full group-hover:scale-105 transition-transform duration-500 text-4xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* CR badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <div className="px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-full text-[10px] font-black text-white">
            CR {monster.cr}
          </div>
          <div className={`px-2 py-0.5 backdrop-blur-sm rounded-full text-[10px] font-bold border ${src.color}`}>
            {src.label}
          </div>
        </div>

        {isFavorite && (
          <div className="absolute top-2.5 right-2.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
            <Eye className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-bold">View Statblock</span>
          </div>
        </div>

        {/* Name + type bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white font-headline font-bold text-sm leading-tight truncate">{monster.name}</p>
          <p className="text-white/60 text-[10px] capitalize truncate">{monster.type}</p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-container">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-outline">
          <span>HP {monster.hp}</span>
          <span className="text-outline/40">·</span>
          <span>AC {monster.ac}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 hover:bg-surface-container-high rounded-lg text-outline hover:text-on-surface transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="p-1.5 hover:bg-surface-container-high rounded-lg text-outline hover:text-primary transition-colors"
            title="Copy & Edit"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (!isSaving) onDelete(); }}
            disabled={isSaving}
            className="p-1.5 hover:bg-error/10 rounded-lg text-outline hover:text-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg text-[10px] font-bold transition-all"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
};

interface MonsterLibraryProps {
  monsters: MonsterTemplate[];
  players: Player[];
  spells?: Spell[];
  classFeatures?: ClassFeature[];
  onAddToEncounter: (monster: MonsterTemplate) => void;
  onAddPlayer: (player: Player) => void;
  onEdit: (id: string) => void;
  onCopy: (monster: MonsterTemplate) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onRemovePlayer: (id: string) => void;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<any>;
  isSaving?: boolean;
}

const PAGE_SIZE = 48;

export const MonsterLibrary: React.FC<MonsterLibraryProps> = ({
  monsters,
  players,
  spells = [],
  classFeatures = [],
  onAddToEncounter,
  onAddPlayer,
  onEdit,
  onCopy,
  onDelete,
  onDeleteAll,
  onRemovePlayer,
  onUpdatePlayer,
  isSaving,
}) => {
  const monsterFilter = useMonsterFilter(monsters);
  const [selectedMonster, setSelectedMonster] = useState<MonsterTemplate | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [linkTab, setLinkTab] = useState<'spells' | 'abilities'>('spells');
  const [linkSearch, setLinkSearch] = useState('');

  const openPlayerEdit = (player: Player) => {
    setEditingPlayer(player);
    setLinkSearch('');
    setLinkTab('spells');
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
      spellIds: player.spellIds ?? [],
      featureIds: player.featureIds ?? [],
      featureUses: player.featureUses ?? {} as FeatureUses,
    });
  };

  const savePlayerEdit = async () => {
    if (!editingPlayer) return;
    setEditSaving(true);
    try {
      await onUpdatePlayer(editingPlayer.id, editForm);
      setEditingPlayer(null);
    } finally {
      setEditSaving(false);
    }
  };
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const favCount = favorites.size;

  const allMonsters = React.useMemo(() => {
    let list = monsterFilter.filtered;
    if (collectionFilter === 'favorites') {
      list = list.filter(m => favorites.has(m.id));
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'cr-asc') return parseCR(a.cr ?? '0') - parseCR(b.cr ?? '0');
      if (sortBy === 'cr-desc') return parseCR(b.cr ?? '0') - parseCR(a.cr ?? '0');
      return 0;
    });
  }, [monsterFilter.filtered, collectionFilter, favorites, sortBy]);

  // Reset visible count whenever the full list changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [allMonsters]);

  // Sentinel observer — load more when bottom comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => Math.min(c + PAGE_SIZE, allMonsters.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [allMonsters.length]);

  const displayedMonsters = allMonsters.slice(0, visibleCount);

  const hasActiveFilters =
    monsterFilter.filters.search ||
    monsterFilter.filters.types.length > 0 ||
    monsterFilter.filters.sources.length > 0 ||
    monsterFilter.filters.tags.length > 0 ||
    monsterFilter.filters.sizes.length > 0 ||
    monsterFilter.filters.traits.length > 0 ||
    monsterFilter.filters.crRange[0] > 0 ||
    monsterFilter.filters.crRange[1] < 30;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] rounded-2xl border border-outline-variant/10 bg-surface-container-low">

        {/* Filter bar */}
        <div className="relative z-20 flex items-center gap-3 p-4 border-b border-outline-variant/10 flex-shrink-0  bg-surface-container-low rounded-t-2xl">
          {/* Collection pills */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCollectionFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                collectionFilter === 'all'
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              All
              <span className={`text-[10px] font-black ${collectionFilter === 'all' ? 'text-primary/70' : 'text-outline'}`}>{monsters.length}</span>
            </button>
            <button
              onClick={() => setCollectionFilter('favorites')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                collectionFilter === 'favorites'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <Star className={`w-3 h-3 ${collectionFilter === 'favorites' ? 'fill-amber-400' : ''}`} />
              Fav
              {favCount > 0 && <span className="text-[10px] font-black opacity-70">{favCount}</span>}
            </button>
            <button
              onClick={() => setCollectionFilter('players')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                collectionFilter === 'players'
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <User className="w-3 h-3" />
              Players
              {players.length > 0 && <span className="text-[10px] font-black opacity-70">{players.length}</span>}
            </button>
          </div>

          <div className="w-px h-6 bg-outline-variant/20 shrink-0" />

          {/* Search */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              placeholder="Search monsters..."
              value={monsterFilter.filters.search}
              onChange={e => monsterFilter.setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-container-high border border-outline-variant/20 rounded-lg text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/50 transition-colors"
            />
            {monsterFilter.filters.search && (
              <button
                onClick={() => monsterFilter.setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <MultiSelect
            label="Type"
            options={monsterFilter.availableTypes}
            value={monsterFilter.filters.types}
            onChange={monsterFilter.setTypes}
          />
          {monsterFilter.availableSizes.length > 1 && (
            <MultiSelect
              label="Size"
              options={monsterFilter.availableSizes}
              value={monsterFilter.filters.sizes}
              onChange={monsterFilter.setSizes}
            />
          )}
          <MultiSelect
            label="Source"
            options={monsterFilter.availableSources}
            value={monsterFilter.filters.sources}
            onChange={monsterFilter.setSources}
          />

          {/* CR Range */}
          <button
            onClick={() => setShowFilters(o => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>

          {/* Sort */}
          <div className="ml-auto flex items-center gap-1 bg-surface-container-high rounded-lg p-0.5 border border-outline-variant/20">
            {(['name', 'cr-asc', 'cr-desc'] as SortBy[]).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  sortBy === s
                    ? 'bg-surface-container-highest text-on-surface shadow-sm'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {s === 'name' ? 'A-Z' : s === 'cr-asc' ? 'CR ↑' : 'CR ↓'}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={monsterFilter.resetFilters}
              className="text-xs text-outline hover:text-on-surface underline"
            >
              Reset
            </button>
          )}

          {monsters.length > 0 && (
            confirmDeleteAll ? (
              <div className="flex items-center gap-2 ml-auto pl-3 border-l border-outline-variant/20">
                <span className="text-xs text-red-400">Delete all {monsters.length}?</span>
                <button
                  onClick={() => { onDeleteAll(); setConfirmDeleteAll(false); }}
                  className="px-2 py-1 text-xs font-bold bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="px-2 py-1 text-xs font-bold bg-surface-container-high text-outline rounded-lg hover:bg-surface-container-highest transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-auto pl-3 border-l border-outline-variant/20"
                title="Delete all monsters"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All
              </button>
            )
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="relative z-10 px-4 py-3 border-b border-outline-variant/10 bg-surface-container flex flex-wrap gap-4 items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-outline">CR Range</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={monsterFilter.filters.crRange[0]}
                  onChange={e => monsterFilter.setCrRange([Number(e.target.value), monsterFilter.filters.crRange[1]])}
                  className="w-14 px-2 py-1 bg-surface-container-high border border-outline-variant/20 rounded text-xs text-center text-on-surface focus:outline-none"
                />
                <span className="text-outline text-xs">–</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={monsterFilter.filters.crRange[1]}
                  onChange={e => monsterFilter.setCrRange([monsterFilter.filters.crRange[0], Number(e.target.value)])}
                  className="w-14 px-2 py-1 bg-surface-container-high border border-outline-variant/20 rounded text-xs text-center text-on-surface focus:outline-none"
                />
              </div>
            </div>
            {monsterFilter.availableTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-outline">Tags</span>
                {monsterFilter.availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      const active = monsterFilter.filters.tags;
                      monsterFilter.setTags(
                        active.includes(tag) ? active.filter(t => t !== tag) : [...active, tag]
                      );
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      monsterFilter.filters.tags.includes(tag)
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-surface-container-highest text-outline hover:text-on-surface border border-outline-variant/20'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-outline">Traits</span>
              {([
                { id: 'legendary', label: 'Legendary' },
                { id: 'spellcaster', label: 'Spellcaster' },
                { id: 'flying', label: 'Flying' },
                { id: 'swarm', label: 'Swarm' },
                { id: 'undead', label: 'Undead' },
                { id: 'shapechanger', label: 'Shapechanger' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    const active = monsterFilter.filters.traits;
                    monsterFilter.setTraits(
                      active.includes(id) ? active.filter(t => t !== id) : [...active, id]
                    );
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    monsterFilter.filters.traits.includes(id)
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'bg-surface-container-highest text-outline hover:text-on-surface border border-outline-variant/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count bar */}
        <div className="px-4 py-2 flex-shrink-0">
          {collectionFilter === 'players' ? (
            <p className="text-[10px] text-outline font-bold uppercase tracking-widest">
              {players.length} players
            </p>
          ) : (
            <p className="text-[10px] text-outline font-bold uppercase tracking-widest">
              {displayedMonsters.length} of {allMonsters.length} monsters
            </p>
          )}
        </div>

        {/* Grid + Detail panel row */}
        <div className="flex flex-1 min-h-0">
        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {collectionFilter === 'players' ? (
            players.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-outline">
                <p className="font-bold text-sm">No players yet</p>
                <p className="text-xs mt-1">Import players from D&amp;D Beyond in the Import tab</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {players.map(player => (
                  <div key={player.id} className="group rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/10 hover:border-primary/30 transition-all duration-200">
                    <div className="relative h-40 overflow-hidden">
                      <AvatarImg src={player.avatar} name={player.name} className="w-full h-full group-hover:scale-105 transition-transform duration-500 text-4xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <div className="px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-full text-[10px] font-black text-white">PC</div>
                        <div className="px-2 py-0.5 backdrop-blur-sm rounded-full text-[10px] font-bold border bg-sky-500/20 text-sky-300 border-sky-500/30">D&amp;D Beyond</div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-white font-headline font-bold text-sm leading-tight truncate">{player.name}</p>
                        <p className="text-white/60 text-[10px] truncate">{player.subtitle || 'Player Character'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-container">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-outline">
                        <span>HP {player.hp_max}</span>
                        <span className="text-outline/40">·</span>
                        <span>AC {player.ac}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openPlayerEdit(player)}
                          className="p-1.5 hover:bg-surface-container-high rounded-lg text-outline hover:text-on-surface transition-colors"
                          title="Edit player"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (!isSaving) onRemovePlayer(player.id); }}
                          disabled={isSaving}
                          className="p-1.5 hover:bg-error/10 rounded-lg text-outline hover:text-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Remove player"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onAddPlayer(player)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg text-[10px] font-bold transition-all"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : allMonsters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-outline">
              <p className="font-bold text-sm">No monsters found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {displayedMonsters.map(monster => (
                  <LibraryCard
                    key={monster.id}
                    monster={monster}
                    isFavorite={favorites.has(monster.id)}
                    onSelect={() => setSelectedMonster(monster)}
                    onAdd={() => onAddToEncounter(monster)}
                    onEdit={() => onEdit(monster.id)}
                    onCopy={() => onCopy(monster)}
                    onDelete={() => onDelete(monster.id)}
                    isSaving={isSaving}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="h-8 mt-2" />
              {visibleCount < allMonsters.length && (
                <p className="text-center text-xs text-outline py-2">Loading more...</p>
              )}
            </>
          )}
        </div>

        {/* Right panel — Detail (desktop only) */}
        {selectedMonster && (
          <div className="hidden md:block w-[380px] flex-shrink-0 border-l border-outline-variant/10 overflow-y-auto">
            <MonsterDetailPanel
              monster={selectedMonster}
              onClose={() => setSelectedMonster(null)}
              onAddToEncounter={(m) => { onAddToEncounter(m); }}
              isFavorite={favorites.has(selectedMonster.id)}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
        </div>{/* end grid+detail row */}

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
                <h2 className="text-xl font-headline font-bold text-on-surface">Edit Player</h2>
                <button onClick={() => setEditingPlayer(null)} className="text-outline hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Name</label>
                    <input className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Class / Subtitle</label>
                    <input className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.subtitle} onChange={e => setEditForm((f: any) => ({ ...f, subtitle: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Level</label>
                    <input type="number" min={1} max={20} className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.level} onChange={e => setEditForm((f: any) => ({ ...f, level: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Passive Perception</label>
                    <input type="number" min={1} max={30} className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.passivePerception} onChange={e => setEditForm((f: any) => ({ ...f, passivePerception: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Max HP</label>
                    <input type="number" className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.hp_max} onChange={e => setEditForm((f: any) => ({ ...f, hp_max: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">AC</label>
                    <input type="number" className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.ac} onChange={e => setEditForm((f: any) => ({ ...f, ac: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Speed</label>
                    <input className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.speed} onChange={e => setEditForm((f: any) => ({ ...f, speed: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-1 block">Avatar URL</label>
                    <input className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50" value={editForm.avatar} onChange={e => setEditForm((f: any) => ({ ...f, avatar: e.target.value }))} />
                  </div>
                </div>

                {/* Spells & Abilities linking */}
                {(spells.length > 0 || classFeatures.length > 0) && (
                  <div>
                    <label className="text-xs font-bold text-outline uppercase tracking-widest mb-2 block">Spells &amp; Abilities</label>
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => { setLinkTab('spells'); setLinkSearch(''); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${linkTab === 'spells' ? 'bg-sky-500/20 text-sky-300' : 'text-outline hover:text-on-surface'}`}
                      >
                        <Sparkles className="w-3 h-3" /> Spells <span className="opacity-60">({editForm.spellIds?.length ?? 0})</span>
                      </button>
                      <button
                        onClick={() => { setLinkTab('abilities'); setLinkSearch(''); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${linkTab === 'abilities' ? 'bg-amber-500/20 text-amber-300' : 'text-outline hover:text-on-surface'}`}
                      >
                        <Shield className="w-3 h-3" /> Abilities <span className="opacity-60">({editForm.featureIds?.length ?? 0})</span>
                      </button>
                    </div>

                    {/* Linked chips */}
                    {linkTab === 'spells' && (editForm.spellIds ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(editForm.spellIds as string[]).map(id => {
                          const s = spells.find(x => x.id === id);
                          if (!s) return null;
                          return (
                            <button
                              key={id}
                              onClick={() => setEditForm((f: any) => ({ ...f, spellIds: f.spellIds.filter((x: string) => x !== id) }))}
                              className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded-full text-[10px] font-bold hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            >
                              {s.name} <X className="w-2.5 h-2.5" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {linkTab === 'abilities' && (editForm.featureIds ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(editForm.featureIds as string[]).map(id => {
                          const f = classFeatures.find(x => x.id === id);
                          if (!f) return null;
                          return (
                            <div key={id} className="flex items-center gap-1 mb-0.5">
                            <button
                              onClick={() => setEditForm((ef: any) => {
                                const newFU = { ...(ef.featureUses ?? {}) };
                                delete newFU[id];
                                return { ...ef, featureIds: ef.featureIds.filter((x: string) => x !== id), featureUses: newFU };
                              })}
                              className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            >
                              {f.name} <X className="w-2.5 h-2.5" />
                            </button>
                            {editForm.featureUses?.[id] && (
                              <span className="flex items-center gap-1 text-[9px] text-outline/60">
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={editForm.featureUses[id].total}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={e => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setEditForm((ef: any) => ({
                                      ...ef,
                                      featureUses: { ...ef.featureUses, [id]: { ...ef.featureUses[id], total: val } },
                                    }));
                                  }}
                                  className="w-8 text-center bg-surface-container-high border border-white/10 rounded px-1 py-0 text-[9px] text-on-surface"
                                />
                                {editForm.featureUses[id].restType === 'short' ? 'SR' : 'LR'}
                              </span>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Search to add */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-outline" />
                      <input
                        type="text"
                        placeholder={linkTab === 'spells' ? 'Search spells to link…' : 'Search abilities to link…'}
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        className="w-full bg-surface-container-high border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50"
                      />
                    </div>

                    {(linkSearch.trim() || linkTab === 'abilities') && (
                      <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-surface-container-highest">
                        {linkTab === 'spells' ? (
                          spells
                            .filter(s => s.name.toLowerCase().includes(linkSearch.toLowerCase()) && !(editForm.spellIds ?? []).includes(s.id))
                            .slice(0, 20)
                            .map(s => (
                              <button
                                key={s.id}
                                onClick={() => { setEditForm((f: any) => ({ ...f, spellIds: [...(f.spellIds ?? []), s.id] })); setLinkSearch(''); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-on-surface hover:bg-sky-500/10 hover:text-sky-300 transition-colors flex items-center justify-between"
                              >
                                <span>{s.name}</span>
                                <span className="text-[9px] text-outline">{s.level === 0 ? 'Cantrip' : `Lv ${s.level}`} · {s.school}</span>
                              </button>
                            ))
                        ) : (
                          classFeatures
                            .filter(f => {
                              if ((editForm.featureIds ?? []).includes(f.id)) return false;
                              if (linkSearch.trim()) return f.name.toLowerCase().includes(linkSearch.toLowerCase());
                              // Default: show features matching the player's class (from subtitle)
                              const sub = (editForm.subtitle ?? '').toLowerCase();
                              return sub ? f.className.toLowerCase().split(' ').some((w: string) => sub.includes(w)) : true;
                            })
                            .slice(0, 20)
                            .map(f => (
                              <button
                                key={f.id}
                                onClick={() => {
                                const parsed = parseFeatureUses(f, editForm.level ?? 1, editForm.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
                                setEditForm((ef: any) => ({
                                  ...ef,
                                  featureIds: [...(ef.featureIds ?? []), f.id],
                                  featureUses: parsed
                                    ? { ...(ef.featureUses ?? {}), [f.id]: { name: f.name, total: parsed.total, used: 0, restType: parsed.restType } }
                                    : ef.featureUses ?? {},
                                }));
                                setLinkSearch('');
                              }}
                                className="w-full text-left px-3 py-1.5 text-xs text-on-surface hover:bg-amber-500/10 hover:text-amber-300 transition-colors flex items-center justify-between"
                              >
                                <span>{f.name}</span>
                                <span className="text-[9px] text-outline">{f.className}{f.subclassName ? ` · ${f.subclassName}` : ''} · Lv {f.level}</span>
                              </button>
                            ))
                        )}
                        {linkTab === 'spells' && spells.filter(s => s.name.toLowerCase().includes(linkSearch.toLowerCase()) && !(editForm.spellIds ?? []).includes(s.id)).length === 0 && (
                          <p className="px-3 py-2 text-xs text-outline">No matches</p>
                        )}
                        {linkTab === 'abilities' && classFeatures.filter(f => {
                          if ((editForm.featureIds ?? []).includes(f.id)) return false;
                          if (linkSearch.trim()) return f.name.toLowerCase().includes(linkSearch.toLowerCase());
                          const sub = (editForm.subtitle ?? '').toLowerCase();
                          return sub ? f.className.toLowerCase().split(' ').some((w: string) => sub.includes(w)) : true;
                        }).length === 0 && (
                          <p className="px-3 py-2 text-xs text-outline">No matches</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 p-6 border-t border-white/10">
                <button onClick={() => setEditingPlayer(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-outline hover:text-white text-sm font-bold transition-colors">Cancel</button>
                <button onClick={savePlayerEdit} disabled={editSaving} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
