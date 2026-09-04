import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Play, Users, Skull, Swords, Clock, Zap, ChevronDown, ChevronRight, MapPin, LayoutGrid, List, ArrowUpDown, Folder, FolderOpen, Settings, Image as ImageIcon, Music, ArrowRight, Trash2, CheckSquare, Square, X, Edit2, Loader2, Filter, SlidersHorizontal, Search, Star } from 'lucide-react';
import { Encounter, Player, FolderSettings, Sound } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { ImagePickerModal } from './ImagePickerModal';
import { SaveEncounterModal } from './SaveEncounterModal';
import { api } from '../api/client';

const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
};
const THRESHOLDS: Record<number, [number,number,number,number]> = {
  1:[25,50,75,100], 2:[50,100,150,200], 3:[75,150,225,400], 4:[125,250,375,500],
  5:[250,500,750,1100], 6:[300,600,900,1400], 7:[350,750,1100,1700], 8:[450,900,1400,2100],
  9:[550,1100,1600,2400], 10:[600,1200,1900,2800], 11:[800,1600,2400,3600],
  12:[1000,2000,3000,4500], 13:[1100,2200,3400,5100], 14:[1250,2500,3800,5700],
  15:[1400,2800,4300,6400], 16:[1600,3200,4800,7200], 17:[2000,3900,5900,8800],
  18:[2100,4200,6300,9500], 19:[2400,4900,7300,10900], 20:[2800,5700,8500,12700],
};
function crToXP(cr: string) { return CR_XP[cr] ?? 0; }
function monsterMult(n: number) { return n <= 1 ? 1 : n === 2 ? 1.5 : n <= 6 ? 2 : n <= 10 ? 2.5 : n <= 14 ? 3 : 4; }
function parseLevel(subtitle: string) {
  const m = subtitle?.match(/level\s*(\d+)/i) ?? subtitle?.match(/(\d+)(?:st|nd|rd|th)\s+level/i);
  return m ? Math.min(20, Math.max(1, parseInt(m[1]))) : 1;
}
function computeDifficulty(combatants: { type: string; subtitle?: string }[], players: Player[]): string | null {
  const monsters = combatants.filter(c => c.type !== 'player');
  if (monsters.length === 0 || players.length === 0) return null;
  const avgLevel = Math.max(1, Math.round(
    players.reduce((s, p) => s + Math.max(p.level ?? 0, parseLevel(p.subtitle ?? '')), 0) / players.length
  ));
  const base = THRESHOLDS[Math.min(20, avgLevel)] ?? THRESHOLDS[1];
  const thresholds = base.map(t => t * players.length) as [number,number,number,number];
  const rawXP = monsters.reduce((s, m) => {
    const match = m.subtitle?.match(/CR\s*([\d/]+)/);
    return s + crToXP(match?.[1] ?? '0');
  }, 0);
  const adj = Math.round(rawXP * monsterMult(monsters.length));
  if (adj >= thresholds[3]) return 'DEADLY';
  if (adj >= thresholds[2]) return 'HARD';
  if (adj >= thresholds[1]) return 'MEDIUM';
  if (adj >= thresholds[0]) return 'EASY';
  return 'TRIVIAL';
}

const DIFFICULTY_STYLES: Record<string, { badge: string; bar: string; text: string }> = {
  DEADLY:  { badge: 'bg-red-500/15 text-red-400 border-red-500/20',          bar: 'bg-red-500', text: 'text-red-400' },
  HARD:    { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20',  bar: 'bg-orange-500', text: 'text-orange-400' },
  MEDIUM:  { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',  bar: 'bg-yellow-500', text: 'text-yellow-400' },
  EASY:    { badge: 'bg-green-500/15 text-green-400 border-green-500/20',     bar: 'bg-green-500', text: 'text-green-400' },
  TRIVIAL: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15', bar: 'bg-emerald-500', text: 'text-emerald-400' },
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type SortOption = 'newest' | 'oldest' | 'name' | 'difficulty';
type ViewMode = 'grid' | 'list';

interface EncounterVaultProps {
  encounters: Encounter[];
  players: Player[];
  onLoadEncounter: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  onSimulateEncounter: (enc: Encounter) => void;
  onNewEncounter: () => void;
  onUpdateEncounter?: (id: string, updates: Partial<Encounter>) => Promise<void>;
  onDeleteEncounters?: (ids: string[]) => void;
  sounds?: Sound[];
  filter?: 'saved' | 'recent';
}

type ChipCombatant = { id: string; name?: string; avatar?: string; subtitle?: string };

const CombatantChipSection: React.FC<{
  label: string;
  combatants: ChipCombatant[];
  variant: 'monster' | 'player';
  compact?: boolean;
}> = ({ label, combatants, variant, compact = false }) => {
  if (combatants.length === 0) return null;
  const isMonster = variant === 'monster';
  const avatarSize = compact ? 'w-6 h-6' : 'w-7 h-7';
  const avatarRadius = compact ? 'rounded' : 'rounded-md';
  const iconSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const gap = compact ? 'gap-1.5' : 'gap-2';
  const chipPy = compact ? 'py-1' : 'py-1.5';
  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const maxW = compact ? 'max-w-[100px]' : 'max-w-[120px]';
  const chipBg = isMonster
    ? 'bg-surface-container-highest/80 border-outline-variant/15'
    : 'bg-sky-500/8 border-sky-500/20';
  const avatarBg = isMonster ? 'bg-surface-container' : 'bg-sky-500/10';
  const nameColor = isMonster ? 'text-on-surface/90' : 'text-sky-200/90';
  return (
    <div className={compact ? '' : 'mb-2'}>
      <p className={`text-[9px] font-black uppercase tracking-widest text-outline/50 mb-1.5${compact ? '' : ' px-0.5'}`}>{label}</p>
      <div className={`flex flex-wrap ${gap}`}>
        {combatants.map(c => (
          <div key={c.id} className={`flex items-center gap-1.5 border rounded-lg px-2 ${chipPy} ${chipBg}`}>
            <div className={`${avatarSize} ${avatarRadius} overflow-hidden ${avatarBg} flex-shrink-0`}>
              {c.avatar ? (
                <img src={c.avatar} className="w-full h-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {isMonster
                    ? <Skull className={`${iconSize} text-outline/30`} />
                    : <Users className={`${iconSize} text-sky-400/50`} />}
                </div>
              )}
            </div>
            {compact ? (
              <p className={`${textSize} font-semibold ${nameColor} truncate ${maxW}`}>{c.name || 'Unknown'}</p>
            ) : (
              <div className="min-w-0">
                <p className={`${textSize} font-semibold ${nameColor} leading-tight truncate ${maxW}`}>{c.name || 'Unknown'}</p>
                {c.subtitle && <p className={`text-[9px] ${isMonster ? 'text-outline/60' : 'text-sky-300/50'} leading-tight truncate ${maxW}`}>{c.subtitle}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const EncounterCard: React.FC<{
  encounter: Encounter;
  players: Player[];
  onLoad: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  onSimulate: (enc: Encounter) => void;
  onEdit?: (enc: Encounter) => void;
  folderSettings?: FolderSettings;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ encounter, players, onLoad, loadingEncounterId, onSimulate, onEdit, folderSettings, selectionMode, selected, onToggleSelect, onToggleFavorite }) => {
  const combatants = encounter.combatants ?? [];
  const computed = computeDifficulty(combatants, players);
  const diffKey = computed ?? (encounter.difficulty || 'MEDIUM').toUpperCase();
  const diff = DIFFICULTY_STYLES[diffKey] ?? DIFFICULTY_STYLES.MEDIUM;
  const playerCount = combatants.filter(c => c.type === 'player').length;
  const monsterCount = combatants.filter(c => c.type !== 'player').length;
  const totalHp = combatants.reduce((s, c) => s + (c.hp?.max ?? 0), 0);
  const bg = encounter.backgroundImage || folderSettings?.backgroundImage;
  const monsters = combatants.filter(c => c.type !== 'player');
  const pcs = combatants.filter(c => c.type === 'player');

  const [showCombatants, setShowCombatants] = useState(false);

  const mergedLoad = (enc: Encounter) => onLoad({
    ...enc,
    backgroundImage: enc.backgroundImage || folderSettings?.backgroundImage,
    musicUrl: enc.musicUrl || folderSettings?.musicUrl,
  });
  const mergedSimulate = (enc: Encounter) => onSimulate({
    ...enc,
    backgroundImage: enc.backgroundImage || folderSettings?.backgroundImage,
    musicUrl: enc.musicUrl || folderSettings?.musicUrl,
  });

  return (
    <div
      className={cn(
        "group relative w-full text-left rounded-2xl bg-surface-container-low border transition-all duration-200",
        loadingEncounterId === encounter.id && "opacity-60",
        selectionMode && selected
          ? "border-primary/60 shadow-lg shadow-primary/10"
          : "border-outline-variant/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      {/* Clickable main area */}
      <div
        onClick={() => selectionMode ? onToggleSelect?.(encounter.id) : (loadingEncounterId !== encounter.id && mergedLoad(encounter))}
        className={cn("overflow-hidden rounded-2xl cursor-pointer", loadingEncounterId === encounter.id && "cursor-not-allowed")}
      >
      {/* Hero image */}
      <div className="relative h-28 overflow-hidden bg-surface-container">
        {bg ? (
          <img
            src={bg}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70"
            alt=""
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Swords className="w-10 h-10 text-outline/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Selection checkbox */}
        {selectionMode && (
          <div className={cn(
            "absolute top-2.5 left-2.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            selected ? "bg-primary border-primary" : "bg-black/40 border-white/40"
          )}>
            {selected && <span className="text-[9px] font-black text-white leading-none">✓</span>}
          </div>
        )}

        {/* Active badge */}
        {encounter.isEncounterActive && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">⚔ Round {encounter.currentRound ?? 1}</span>
          </div>
        )}

        {/* Difficulty badge */}
        <div className={cn('absolute top-2.5 right-2.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase', diff.badge)}>
          {diffKey}
        </div>

        {/* Edit button */}
        {!selectionMode && onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(encounter); }}
            className="absolute top-2.5 left-2.5 p-1.5 bg-black/60 text-outline hover:text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm border border-white/10"
            title="Edit encounter settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Round indicator */}
        {(encounter.currentRound ?? 0) > 0 && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-outline">
            <Zap className="w-2.5 h-2.5" />
            Round {encounter.currentRound}
          </div>
        )}

      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-headline font-bold text-sm text-on-surface leading-tight truncate flex-1 group-hover:text-primary transition-colors">
              {encounter.name}
            </h3>
            {!selectionMode && onToggleFavorite && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorite(encounter.id); }}
                className="shrink-0 p-0.5 -mr-0.5"
                title={encounter.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={cn("w-3.5 h-3.5 transition-colors", encounter.favorite ? "fill-amber-400 text-amber-400" : "text-outline/30 hover:text-amber-400")} />
              </button>
            )}
            {encounter.campaignName && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-teal-500/10 text-[9px] font-bold text-teal-400 border border-teal-500/20 uppercase tracking-wider">
                {encounter.campaignName}
              </span>
            )}
          </div>
          {encounter.description && (
            <p className="text-[10px] text-outline mt-0.5 line-clamp-1">{encounter.description}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-outline">
          {playerCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-400/70" />
              <span className="text-blue-300/80 font-bold">{playerCount}</span>
            </span>
          )}
          {monsterCount > 0 && (
            <span className="flex items-center gap-1">
              <Skull className="w-3 h-3 text-red-400/70" />
              <span className="text-red-300/80 font-bold">{monsterCount}</span>
            </span>
          )}
          {encounter.cr != null && (
            <span className="flex items-center gap-1 ml-auto">
              <span className="text-outline/60">CR</span>
              <span className="font-bold text-on-surface/60">{encounter.cr}</span>
            </span>
          )}
          {totalHp > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-outline/60">HP</span>
              <span className="font-bold text-on-surface/60">{totalHp}</span>
            </span>
          )}
        </div>

        {/* Difficulty bar */}
        <div className="h-0.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', diff.bar)}
            style={{ width: diffKey === 'DEADLY' ? '100%' : diffKey === 'HARD' ? '75%' : diffKey === 'MEDIUM' ? '50%' : diffKey === 'EASY' ? '25%' : '10%' }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[9px] text-outline/50">
            <Clock className="w-2.5 h-2.5" />
            {relativeDate(encounter.lastModified || new Date().toISOString())}
          </span>
          {!selectionMode && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-bold text-primary">
              {loadingEncounterId === encounter.id
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <Play className="w-2.5 h-2.5 fill-primary" />}
              {loadingEncounterId === encounter.id ? 'Loading…' : encounter.isEncounterActive ? 'Resume' : 'Load'}
            </span>
          )}
        </div>
      </div>
      </div>

      {/* Combatant preview toggle */}
      {!selectionMode && combatants.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setShowCombatants(v => !v); }}
          className={cn(
            "w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold border-t transition-colors",
            showCombatants
              ? "text-primary border-primary/20 bg-primary/5"
              : "text-outline/50 border-outline-variant/10 hover:text-on-surface hover:bg-white/3"
          )}
        >
          {showCombatants ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {showCombatants ? 'Hide' : 'Show'} combatants
        </button>
      )}

      {/* Combatant preview panel */}
      {showCombatants && combatants.length > 0 && (
        <div className="px-3 pb-3 pt-2 border-t border-outline-variant/10 space-y-2">
          <CombatantChipSection label="Monsters" combatants={monsters} variant="monster" compact />
          <CombatantChipSection label="Players" combatants={pcs} variant="player" compact />
        </div>
      )}
    </div>
  );
};

const EncounterListItem: React.FC<{
  encounter: Encounter;
  players: Player[];
  onLoad: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  onSimulate: (enc: Encounter) => void;
  onEdit?: (enc: Encounter) => void;
  folderSettings?: FolderSettings;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ encounter, players, onLoad, loadingEncounterId, onSimulate, onEdit, folderSettings, selectionMode, selected, onToggleSelect, onToggleFavorite }) => {
  const combatants = encounter.combatants ?? [];
  const computed = computeDifficulty(combatants, players);
  const diffKey = computed ?? (encounter.difficulty || 'MEDIUM').toUpperCase();
  const diff = DIFFICULTY_STYLES[diffKey] ?? DIFFICULTY_STYLES.MEDIUM;
  const playerCount = combatants.filter(c => c.type === 'player').length;
  const monsterCount = combatants.filter(c => c.type !== 'player').length;
  const bg = encounter.backgroundImage || folderSettings?.backgroundImage;
  const mergedLoad = (enc: Encounter) => onLoad({
    ...enc,
    backgroundImage: enc.backgroundImage || folderSettings?.backgroundImage,
    musicUrl: enc.musicUrl || folderSettings?.musicUrl,
  });
  const mergedSimulate = (enc: Encounter) => onSimulate({
    ...enc,
    backgroundImage: enc.backgroundImage || folderSettings?.backgroundImage,
    musicUrl: enc.musicUrl || folderSettings?.musicUrl,
  });

  const [showCombatants, setShowCombatants] = useState(false);
  const monsters = combatants.filter(c => c.type !== 'player');
  const pcs = combatants.filter(c => c.type === 'player');

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      selectionMode && selected ? "border-primary/40" : "border-outline-variant/10"
    )}>
      {/* Main row */}
      <div
        onClick={() => selectionMode ? onToggleSelect?.(encounter.id) : undefined}
        className={cn(
          "group w-full flex items-center gap-4 p-3 rounded-xl transition-all",
          selectionMode ? "cursor-pointer" : "",
          selectionMode && selected
            ? "bg-primary/5"
            : "bg-surface-container-low hover:border-primary/30 hover:bg-surface-container-high"
        )}
      >
        {/* Checkbox */}
        {selectionMode && (
          <div className={cn(
            "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            selected ? "bg-primary border-primary" : "border-white/30 bg-transparent"
          )}>
            {selected && <span className="text-[9px] font-black text-white leading-none">✓</span>}
          </div>
        )}
        <button
          onClick={e => { if (!selectionMode && loadingEncounterId !== encounter.id) { mergedLoad(encounter); } else { e.stopPropagation(); onToggleSelect?.(encounter.id); } }}
          disabled={!selectionMode && loadingEncounterId === encounter.id}
          className={cn("flex flex-1 items-center gap-4 text-left min-w-0", loadingEncounterId === encounter.id && "opacity-60 cursor-not-allowed")}
        >
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container flex-shrink-0">
            {bg ? (
              <img src={bg} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Swords className="w-5 h-5 text-outline/20" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                {encounter.name}
              </h3>
              {encounter.campaignName && (
                <span className="px-1.5 py-0.5 rounded-md bg-teal-500/10 text-[9px] font-bold text-teal-400 border border-teal-500/20 uppercase tracking-wider">
                  {encounter.campaignName}
                </span>
              )}
              {encounter.isEncounterActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <p className="text-[10px] text-outline truncate">
              {monsters.length > 0 ? `${monsters.length} monster${monsters.length !== 1 ? 's' : ''}` : ''}
              {monsters.length > 0 && pcs.length > 0 ? ' · ' : ''}
              {pcs.length > 0 ? `${pcs.length} player${pcs.length !== 1 ? 's' : ''}` : ''}
              {monsters.length === 0 && pcs.length === 0 ? 'No combatants' : ''}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[10px] text-outline/70">
            <span className="flex items-center gap-1 w-12">
              <Users className="w-3 h-3" /> {pcs.length}
            </span>
            <span className="flex items-center gap-1 w-12">
              <Skull className="w-3 h-3" /> {monsters.length}
            </span>
          </div>

          <div className={cn('px-2 py-0.5 rounded border text-[9px] font-black uppercase w-16 text-center shrink-0', diff.badge)}>
            {diffKey}
          </div>

          <div className="text-[9px] text-outline/50 w-20 text-right shrink-0">
            {relativeDate(encounter.lastModified || new Date().toISOString())}
          </div>
        </button>
        
        {!selectionMode && (
          <div className="flex items-center gap-1 shrink-0">
            {onToggleFavorite && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorite(encounter.id); }}
                className={cn("p-1.5 transition-colors rounded-lg", encounter.favorite ? "text-amber-400 opacity-100" : "text-outline opacity-30 group-hover:opacity-100 hover:text-amber-400")}
                title={encounter.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={cn("w-4 h-4", encounter.favorite && "fill-amber-400")} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onEdit?.(encounter); }}
              className="p-1.5 text-outline hover:text-primary transition-colors rounded-lg opacity-30 group-hover:opacity-100"
              title="Edit Encounter Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {combatants.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setShowCombatants(v => !v); }}
                className={cn("p-1.5 transition-colors rounded-lg hover:bg-white/5", showCombatants ? "text-primary" : "text-outline hover:text-on-surface")}
                title="Show combatants"
              >
                {showCombatants ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); if (loadingEncounterId !== encounter.id) mergedLoad(encounter); }}
              disabled={loadingEncounterId === encounter.id}
              className={cn("p-1.5 text-outline hover:text-primary transition-colors opacity-30 group-hover:opacity-100", loadingEncounterId === encounter.id && "cursor-not-allowed")}
              title="Load Encounter"
            >
              {loadingEncounterId === encounter.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Combatant preview panel */}
      {showCombatants && combatants.length > 0 && (
        <div className="px-3 pb-3 pt-2 bg-surface-container-low rounded-b-xl border-t border-outline-variant/10">
          <CombatantChipSection label="Monsters" combatants={monsters} variant="monster" />
          <CombatantChipSection label="Players" combatants={pcs} variant="player" />
        </div>
      )}
    </div>
  );
};

const EncounterDisplay: React.FC<{
  mode: ViewMode;
  encounters: Encounter[];
  players: Player[];
  onLoad: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  onSimulate: (enc: Encounter) => void;
  onEdit?: (enc: Encounter) => void;
  folderSettings?: FolderSettings;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ mode, encounters, players, onLoad, loadingEncounterId, onSimulate, onEdit, folderSettings, selectionMode, selectedIds, onToggleSelect, onToggleFavorite }) => {
  if (mode === 'list') {
    return (
      <div className="space-y-1">
        {encounters.map(enc => (
          <EncounterListItem key={enc.id} encounter={enc} players={players} onLoad={onLoad} loadingEncounterId={loadingEncounterId} onSimulate={onSimulate} onEdit={onEdit} folderSettings={folderSettings} selectionMode={selectionMode} selected={selectedIds?.has(enc.id)} onToggleSelect={onToggleSelect} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {encounters.map(enc => (
        <EncounterCard key={enc.id} encounter={enc} players={players} onLoad={onLoad} loadingEncounterId={loadingEncounterId} onSimulate={onSimulate} onEdit={onEdit} folderSettings={folderSettings} selectionMode={selectionMode} selected={selectedIds?.has(enc.id)} onToggleSelect={onToggleSelect} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
};

const FolderSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  folder: string;
  settings?: FolderSettings;
  onSave: (settings: FolderSettings) => void;
}> = ({ isOpen, onClose, folder, settings, onSave }) => {
  const [formData, setFormData] = useState<FolderSettings>({
    folder,
    backgroundImage: settings?.backgroundImage || '',
    musicUrl: settings?.musicUrl || '',
  });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  useEffect(() => {
    if (settings) setFormData(settings);
    else setFormData({ folder, backgroundImage: '', musicUrl: '' });
  }, [settings, folder]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Group Settings: ${folder}`}>
      <div className="space-y-6">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3" /> Background Image URL
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
              value={formData.backgroundImage}
              onChange={e => setFormData({ ...formData, backgroundImage: e.target.value })}
              placeholder="https://..."
            />
            <button
              type="button"
              onClick={() => setImagePickerOpen(true)}
              className="px-3 py-2 bg-surface-container-high rounded-lg hover:bg-surface-container-highest transition-colors text-outline hover:text-on-surface shrink-0"
              title="Search images"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
            <Music className="w-3 h-3" /> Music URL (YouTube/Direct)
          </label>
          <input
            className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
            value={formData.musicUrl}
            onChange={e => setFormData({ ...formData, musicUrl: e.target.value })}
            placeholder="https://youtube.com/..."
          />
        </div>

        <button
          onClick={() => onSave(formData)}
          className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          Save Group Settings
        </button>
      </div>
      <ImagePickerModal
        isOpen={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={url => setFormData(f => ({ ...f, backgroundImage: url }))}
      />
    </Modal>
  );
};

const FolderSection: React.FC<{
  label: string;
  encounters: Encounter[];
  players: Player[];
  onLoad: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  onSimulate: (enc: Encounter) => void;
  onEdit?: (enc: Encounter) => void;
  viewMode: ViewMode;
  defaultOpen?: boolean;
  onSettingsClick: (folder: string) => void;
  folderSettings?: FolderSettings;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onDeleteGroup?: (ids: string[]) => void;
  onToggleFavorite?: (id: string) => void;
}> = ({ label, encounters, players, onLoad, loadingEncounterId, onSimulate, onEdit, viewMode, defaultOpen = false, onSettingsClick, folderSettings, selectionMode, selectedIds, onToggleSelect, onDeleteGroup, onToggleFavorite }) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasBg = !!folderSettings?.backgroundImage;

  const campaignNames = Array.from(new Set(encounters.map(e => e.campaignName).filter(Boolean)));
  const commonCampaign = campaignNames.length === 1 ? campaignNames[0] : null;

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-300",
      open ? "bg-white/[0.02] border-white/5 pb-4" : "bg-transparent border-transparent"
    )}>
      {/* Header — hero banner if backgroundImage is set, plain row otherwise */}
      {hasBg ? (
        <div className="relative rounded-2xl overflow-hidden mb-0">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${folderSettings!.backgroundImage})` }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e12]/90 via-[#0c0e12]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e12]/60 to-transparent" />

          {/* Clickable area to toggle open */}
          <button
            onClick={() => setOpen(o => !o)}
            className="relative w-full text-left px-5 py-5 flex items-end justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-xl text-white leading-tight drop-shadow">{label}</h3>
                {commonCampaign && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-[10px] font-black text-teal-300 border border-teal-500/30 uppercase tracking-widest backdrop-blur-sm">
                    {commonCampaign}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/60 mt-0.5">
                {encounters.length} encounter{encounters.length !== 1 ? 's' : ''} in this location
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {open
                ? <ChevronDown className="w-5 h-5 text-white/50" />
                : <ChevronRight className="w-5 h-5 text-white/50" />
              }
            </div>
          </button>

          {/* Settings / delete buttons — top-right corner */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            {onDeleteGroup && (
              <button
                onClick={() => onDeleteGroup(encounters.map(e => e.id))}
                className="p-1.5 text-white/30 hover:text-red-400 transition-colors rounded-lg hover:bg-black/30"
                title="Delete entire group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onSettingsClick(label)}
              className="p-1.5 text-white/30 hover:text-primary transition-colors rounded-lg hover:bg-black/30"
              title="Folder Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 pr-3">
          <button
            onClick={() => setOpen(o => !o)}
            className={cn(
              "flex items-center gap-3 group flex-1 text-left p-3 rounded-xl transition-all",
              open ? "bg-white/5" : "hover:bg-white/5"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              open ? "bg-primary/20 text-primary" : "bg-surface-container-high text-outline"
            )}>
              {open ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-on-surface group-hover:text-primary transition-colors">
                  {label}
                </span>
                {commonCampaign && (
                  <span className="px-1.5 py-0.5 rounded-md bg-teal-500/10 text-[9px] font-bold text-teal-400 border border-teal-500/20 uppercase tracking-wider">
                    {commonCampaign}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-outline font-medium">
                {encounters.length} encounter{encounters.length !== 1 ? 's' : ''} in this location
              </p>
            </div>

            {open
              ? <ChevronDown className="w-4 h-4 text-outline/30 group-hover:text-outline transition-colors" />
              : <ChevronRight className="w-4 h-4 text-outline/30 group-hover:text-outline transition-colors" />
            }
          </button>
          {onDeleteGroup && (
            <button
              onClick={() => onDeleteGroup(encounters.map(e => e.id))}
              className="p-2 text-outline/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
              title="Delete entire group"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onSettingsClick(label)}
            className="p-2 text-outline/30 hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
            title="Folder Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 mt-4">
          <EncounterDisplay mode={viewMode} encounters={encounters} players={players} onLoad={onLoad} loadingEncounterId={loadingEncounterId} onSimulate={onSimulate} onEdit={onEdit} folderSettings={folderSettings} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onToggleFavorite={onToggleFavorite} />
        </div>
      )}
    </div>
  );
};

export const EncounterVault: React.FC<EncounterVaultProps> = ({
  encounters,
  players,
  onLoadEncounter,
  loadingEncounterId,
  onSimulateEncounter,
  onNewEncounter,
  onUpdateEncounter,
  onDeleteEncounters,
  sounds,
  filter = 'saved',
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('vaultViewMode') as ViewMode) || 'list');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [folderSettings, setFolderSettings] = useState<FolderSettings[]>([]);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingEncounter, setEditingEncounter] = useState<Encounter | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterDifficulties, setFilterDifficulties] = useState<Set<string>>(new Set());
  const [filterMinEnemies, setFilterMinEnemies] = useState('');
  const [filterMaxEnemies, setFilterMaxEnemies] = useState('');
  const [filterMinPlayers, setFilterMinPlayers] = useState('');

  const activeFilterCount = filterDifficulties.size + (filterMinEnemies ? 1 : 0) + (filterMaxEnemies ? 1 : 0) + (filterMinPlayers ? 1 : 0);

  const clearFilters = () => {
    setFilterDifficulties(new Set());
    setFilterMinEnemies('');
    setFilterMaxEnemies('');
    setFilterMinPlayers('');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('search');
    if (s) setSearch(s);
  }, []);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0 || !onDeleteEncounters) return;
    onDeleteEncounters(Array.from(selectedIds));
    exitSelectionMode();
  };

  useEffect(() => {
    api.folderSettings.list()
      .then(setFolderSettings)
      .catch(console.error);
  }, []);

  const saveFolderSettings = async (settings: FolderSettings) => {
    try {
      await api.folderSettings.save(settings);
      setFolderSettings(prev => {
          const idx = prev.findIndex(s => s.folder === settings.folder);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = settings;
            return next;
          }
          return [...prev, settings];
        });
      setEditingFolder(null);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    localStorage.setItem('vaultViewMode', next);
  };

  const sortedAndFiltered = useMemo(() => {
    let list = filter === 'recent' ? encounters.slice(0, 10) : encounters;
    
    if (search) {
      list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.folder?.toLowerCase().includes(search.toLowerCase()));
    }

    if (filterDifficulties.size > 0) {
      list = list.filter(e => {
        const diff = (computeDifficulty(e.combatants ?? [], players) || 'MEDIUM').toUpperCase();
        return filterDifficulties.has(diff);
      });
    }

    const minEnemies = filterMinEnemies !== '' ? parseInt(filterMinEnemies) : null;
    const maxEnemies = filterMaxEnemies !== '' ? parseInt(filterMaxEnemies) : null;
    const minPlayers = filterMinPlayers !== '' ? parseInt(filterMinPlayers) : null;

    if (minEnemies !== null || maxEnemies !== null || minPlayers !== null) {
      list = list.filter(e => {
        const enemyCount = (e.combatants ?? []).filter(c => c.type !== 'player').length;
        const playerCount = (e.combatants ?? []).filter(c => c.type === 'player').length;
        if (minEnemies !== null && enemyCount < minEnemies) return false;
        if (maxEnemies !== null && enemyCount > maxEnemies) return false;
        if (minPlayers !== null && playerCount < minPlayers) return false;
        return true;
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'oldest') return new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime();
      if (sortBy === 'difficulty') {
        const diffs = ['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'DEADLY'];
        const da = computeDifficulty(a.combatants ?? [], players) || 'MEDIUM';
        const db = computeDifficulty(b.combatants ?? [], players) || 'MEDIUM';
        return diffs.indexOf(db) - diffs.indexOf(da);
      }
      // default newest
      return new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime();
    });
  }, [encounters, search, sortBy, filter, players, filterDifficulties, filterMinEnemies, filterMaxEnemies, filterMinPlayers]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const enc = encounters.find(e => e.id === id);
    if (!enc) return;
    await onUpdateEncounter?.(id, { favorite: !enc.favorite });
  }, [encounters, onUpdateEncounter]);

  const active = sortedAndFiltered.filter(e => e.isEncounterActive);
  const inactive = sortedAndFiltered.filter(e => !e.isEncounterActive);
  const favorites = sortedAndFiltered.filter(e => e.favorite && !e.isEncounterActive);

  const grouped = inactive.reduce<Record<string, Encounter[]>>((acc, enc) => {
    let key = enc.folder?.trim() || '';
    
    // Heuristic: if no folder, check name prefix (e.g. "L1: Kitchen" or "L1-L")
    if (!key) {
      const prefixMatch = enc.name.match(/^([A-Z])\d+/i);
      if (prefixMatch) {
        const code = prefixMatch[1].toUpperCase();
        const mapping: Record<string, string> = {
          'B': 'Brigganock Mine', 'C': 'Motherhorn', 'D': 'Downfall',
          'L': 'Loomlurch', 'M': 'Motherhorn', 'P': 'Palace of Heart\'s Desire',
          'W': 'Wayward Pool', 'H': 'Hither', 'T': 'Thither', 'Y': 'Yon'
        };
        if (mapping[code]) key = mapping[code];
      }
    }

    (acc[key] ??= []).push(enc);
    return acc;
  }, {});

  const folderKeys = Object.keys(grouped).filter(Boolean).sort();
  const ungrouped = grouped[''] ?? [];

  const isEmpty = active.length === 0 && inactive.length === 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Encounters</h2>
          <p className="text-outline text-sm mt-1">{encounters.length} saved scenarios</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-surface-container-high border border-outline-variant/20 rounded-lg pl-9 pr-4 py-2 text-sm w-64 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <Search className="w-4 h-4 text-outline/40 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center bg-surface-container-high rounded-lg border border-outline-variant/20 px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-outline/50 mr-1.5 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[11px] font-bold uppercase tracking-wider text-outline focus:outline-none cursor-pointer pr-1"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </div>

          <div className="flex items-center bg-surface-container-high rounded-lg border border-outline-variant/20 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded transition-all", viewMode === 'grid' ? "bg-white/10 text-primary shadow-sm" : "text-outline/50 hover:text-outline")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded transition-all", viewMode === 'list' ? "bg-white/10 text-primary shadow-sm" : "text-outline/50 hover:text-outline")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {onDeleteEncounters && (
            <div className="flex items-center gap-2">
              {selectionMode && (
                <button
                  onClick={() => {
                    const all = sortedAndFiltered.map(e => e.id);
                    const allSelected = all.every(id => selectedIds.has(id));
                    setSelectedIds(allSelected ? new Set() : new Set(all));
                  }}
                  className="px-3 py-2 bg-surface-container-high border border-outline-variant/20 rounded-lg text-xs font-bold text-outline hover:text-on-surface transition-colors"
                >
                  {sortedAndFiltered.every(e => selectedIds.has(e.id)) ? 'Deselect All' : 'Select All'}
                </button>
              )}
              <button
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border",
                  selectionMode
                    ? "bg-white/10 border-white/20 text-on-surface"
                    : "border-outline-variant/20 text-outline hover:text-on-surface hover:border-white/20"
                )}
              >
                {selectionMode ? <><X className="w-4 h-4" /> Cancel</> : <><CheckSquare className="w-4 h-4" /> Select</>}
              </button>
            </div>
          )}

          <button
            onClick={onNewEncounter}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 ml-2"
          >
            <Plus className="w-4 h-4" /> New
          </button>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border",
              showFilters || activeFilterCount > 0
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-outline-variant/20 text-outline hover:text-on-surface hover:border-white/20"
            )}
            title="Filter encounters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface-container/80 backdrop-blur-xl border border-outline-variant/10 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-outline">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-outline hover:text-on-surface transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-xs text-outline mb-2">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {(['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'DEADLY'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setFilterDifficulties(prev => {
                    const next = new Set(prev);
                    next.has(d) ? next.delete(d) : next.add(d);
                    return next;
                  })}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                    filterDifficulties.has(d)
                      ? d === 'DEADLY' ? "bg-red-600 border-red-600 text-white"
                        : d === 'HARD' ? "bg-orange-500 border-orange-500 text-white"
                        : d === 'MEDIUM' ? "bg-yellow-500 border-yellow-500 text-black"
                        : d === 'EASY' ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-surface-container-high border-outline text-outline"
                      : "border-outline-variant/30 text-outline hover:border-outline hover:text-on-surface"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Enemy count */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-outline mb-1.5">Enemies (min)</p>
              <input
                type="number"
                min="0"
                value={filterMinEnemies}
                onChange={e => setFilterMinEnemies(e.target.value)}
                placeholder="Any"
                className="w-20 bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <p className="text-xs text-outline mb-1.5">Enemies (max)</p>
              <input
                type="number"
                min="0"
                value={filterMaxEnemies}
                onChange={e => setFilterMaxEnemies(e.target.value)}
                placeholder="Any"
                className="w-20 bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <p className="text-xs text-outline mb-1.5">Players (min)</p>
              <input
                type="number"
                min="0"
                value={filterMinPlayers}
                onChange={e => setFilterMinPlayers(e.target.value)}
                placeholder="Any"
                className="w-20 bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          <p className="text-xs text-outline">
            Showing <span className="text-on-surface font-bold">{sortedAndFiltered.length}</span> of <span className="text-on-surface font-bold">{encounters.length}</span> encounters
          </p>
        </div>
      )}

      {/* Active (Live) encounters */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-green-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </h3>
          <EncounterDisplay mode={viewMode} encounters={active} players={players} onLoad={onLoadEncounter} loadingEncounterId={loadingEncounterId} onSimulate={onSimulateEncounter} onEdit={setEditingEncounter} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleFavorite={handleToggleFavorite} />
        </section>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2">
            <Star className="w-3 h-3 fill-amber-400" />
            Favorites
          </h3>
          <EncounterDisplay mode={viewMode} encounters={favorites} players={players} onLoad={onLoadEncounter} loadingEncounterId={loadingEncounterId} onSimulate={onSimulateEncounter} onEdit={setEditingEncounter} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleFavorite={handleToggleFavorite} />
        </section>
      )}

      {/* Empty state — no encounters at all */}
      {isEmpty && !search && activeFilterCount === 0 && (
        <div className="py-24 text-center text-outline">
          <Swords className="w-16 h-16 mx-auto mb-4 opacity-10" />
          <p className="font-bold text-lg">Encounters list is empty</p>
          <p className="text-sm mt-1 opacity-60">Create encounters to see them here</p>
          <button
            onClick={onNewEncounter}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> New Encounter
          </button>
        </div>
      )}

      {/* Empty state — search/filters returned nothing */}
      {!isEmpty && sortedAndFiltered.length === 0 && (search || activeFilterCount > 0) && (
        <div className="py-16 text-center text-outline">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="font-bold text-base">No encounters match your {activeFilterCount > 0 ? 'filters' : 'search'}</p>
          <p className="text-sm mt-1 opacity-60">Try different keywords or adjust the filters</p>
          <div className="flex items-center justify-center gap-3 mt-5">
            {search && (
              <button onClick={() => setSearch('')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container-high text-outline hover:text-on-surface transition-colors">
                Clear search
              </button>
            )}
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container-high text-outline hover:text-on-surface transition-colors">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grouped folders */}
      {folderKeys.length > 0 && (
        <div className="space-y-6">
          {folderKeys.map(folder => (
            <FolderSection
              key={folder}
              label={folder}
              encounters={grouped[folder]}
              players={players}
              onLoad={onLoadEncounter}
              loadingEncounterId={loadingEncounterId}
              onSimulate={onSimulateEncounter}
              onEdit={setEditingEncounter}
              viewMode={viewMode}
              onSettingsClick={setEditingFolder}
              folderSettings={folderSettings.find(s => s.folder === folder)}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onDeleteGroup={onDeleteEncounters ? (ids) => onDeleteEncounters(ids) : undefined}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Ungrouped encounters */}
      {ungrouped.length > 0 && (
        <section className="space-y-3">
          {folderKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-outline-variant/10" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-outline/40 whitespace-nowrap">Ungrouped</h3>
              <div className="h-px flex-1 bg-outline-variant/10" />
            </div>
          )}
          <EncounterDisplay mode={viewMode} encounters={ungrouped} players={players} onLoad={onLoadEncounter} loadingEncounterId={loadingEncounterId} onSimulate={onSimulateEncounter} onEdit={setEditingEncounter} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleFavorite={handleToggleFavorite} />
        </section>
      )}

      {editingFolder && (
        <FolderSettingsModal
          isOpen={true}
          onClose={() => setEditingFolder(null)}
          folder={editingFolder}
          settings={folderSettings.find(s => s.folder === editingFolder)}
          onSave={saveFolderSettings}
        />
      )}

      {editingEncounter && (
        <SaveEncounterModal
          isOpen={!!editingEncounter}
          onClose={() => setEditingEncounter(null)}
          onSave={(name, folder, backgroundImage, youtubeUrl, soundIds) => {
            onUpdateEncounter?.(editingEncounter.id, { name, folder, backgroundImage, youtubeUrl, soundIds });
            setEditingEncounter(null);
          }}
          initialName={editingEncounter.name}
          initialFolder={editingEncounter.folder}
          initialBackgroundImage={editingEncounter.backgroundImage}
          initialYoutubeUrl={editingEncounter.youtubeUrl}
          initialSoundIds={editingEncounter.soundIds}
          sounds={sounds}
          title="Edit Encounter"
        />
      )}

      {/* Sticky selection action bar */}
      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0f1419] border border-white/10 shadow-2xl shadow-black/60">
          <button
            onClick={() => {
              const all = sortedAndFiltered.map(e => e.id);
              const allSelected = all.every(id => selectedIds.has(id));
              if (allSelected) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(all));
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-outline hover:text-on-surface transition-colors"
          >
            {sortedAndFiltered.every(e => selectedIds.has(e.id))
              ? <><Square className="w-3.5 h-3.5" /> Deselect all</>
              : <><CheckSquare className="w-3.5 h-3.5" /> Select all</>
            }
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-xs font-bold text-outline/60">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          <button
            onClick={exitSelectionMode}
            className="p-1.5 text-outline/50 hover:text-outline transition-colors rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
