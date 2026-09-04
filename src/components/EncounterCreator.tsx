import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  X,
  LayoutGrid,
  Image as ImageIcon,
  Music,
  User,
  CheckCircle2,
  MapPin,
  ChevronLeft,
  BookOpen,
  Swords,
  Settings2,
  Users,
  Zap,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, uuid } from '../lib/utils';
import { ImagePickerModal } from './ImagePickerModal';
import { AnimationLevel, Combatant, MonsterTemplate, Player, Sound } from '../types';
import { CR_TABLE } from '../constants/crTable';
import { AvatarImg } from './AvatarImg';
import { CR_XP, THRESHOLDS, crToXP, monsterMultiplier, parseLevel } from '../lib/encounterScaling';
import { ScaleEncounterModal } from './ScaleEncounterModal';

interface EncounterCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: MonsterTemplate[];
  players: Player[];
  sounds?: Sound[];
  initialCombatants?: Combatant[];
  initialName?: string;
  initialFolder?: string;
  initialBackgroundImage?: string;
  initialYoutubeUrl?: string;
  initialBackgroundOpacity?: number;
  initialPanelOpacity?: number;
  initialAnimationLevel?: AnimationLevel;
  initialSoundIds?: string[];
  existingFolders?: string[];
  onLaunch: (combatants: Combatant[], name: string, backgroundImage: string, youtubeUrl: string, folder: string, difficulty?: string, backgroundOpacity?: number, panelOpacity?: number, soundIds?: string[], animationLevel?: AnimationLevel) => void;
  onSave: (combatants: Combatant[], name: string, backgroundImage: string, youtubeUrl: string, folder: string, difficulty?: string, backgroundOpacity?: number, panelOpacity?: number, soundIds?: string[], animationLevel?: AnimationLevel) => void;
  onAutoSave?: (combatants: Combatant[], name: string, backgroundImage: string, youtubeUrl: string, folder: string, difficulty?: string, backgroundOpacity?: number, panelOpacity?: number, soundIds?: string[], animationLevel?: AnimationLevel) => void;
}

function calcDifficulty(monsters: Combatant[], partyPlayers: Player[]): {
  label: string; color: string; adjustedXP: number; partyThresholds: [number,number,number,number]; multiplierUsed: number;
} | null {
  if (monsters.length === 0 || partyPlayers.length === 0) return null;

  const partySize = partyPlayers.length;
  const avgLevel = Math.max(1, Math.round(
    partyPlayers.reduce((s, p) => s + Math.max(p.level ?? 0, parseLevel(p.subtitle)), 0) / partySize
  ));
  const base = THRESHOLDS[Math.min(20, avgLevel)] ?? THRESHOLDS[1];
  const partyThresholds: [number,number,number,number] = base.map(t => t * partySize) as [number,number,number,number];

  const rawXP = monsters.reduce((sum, m) => {
    const match = m.subtitle?.match(/CR\s*([\d/]+)/);
    return sum + crToXP(match?.[1] ?? '0');
  }, 0);
  const multiplierUsed = monsterMultiplier(monsters.length);
  const adjustedXP = Math.round(rawXP * multiplierUsed);

  let label = 'Trivial'; let color = 'text-outline';
  if (adjustedXP >= partyThresholds[3]) { label = 'Deadly'; color = 'text-red-400'; }
  else if (adjustedXP >= partyThresholds[2]) { label = 'Hard'; color = 'text-orange-400'; }
  else if (adjustedXP >= partyThresholds[1]) { label = 'Medium'; color = 'text-yellow-400'; }
  else if (adjustedXP >= partyThresholds[0]) { label = 'Easy'; color = 'text-green-400'; }

  return { label, color, adjustedXP, partyThresholds, multiplierUsed };
}

function parseYoutubeId(url: string): string | null {
  if (!url) return null;
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

export const EncounterCreator: React.FC<EncounterCreatorProps> = ({
  isOpen,
  onClose,
  monsters,
  players,
  sounds = [],
  initialCombatants = [],
  initialName,
  initialFolder = '',
  initialBackgroundImage = '',
  initialYoutubeUrl = '',
  initialBackgroundOpacity = 0.22,
  initialPanelOpacity = 0.92,
  initialAnimationLevel,
  initialSoundIds = [],
  existingFolders = [],
  onLaunch,
  onSave,
  onAutoSave,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [libraryTab, setLibraryTab] = useState<'monsters' | 'players'>('monsters');
  const [mobileView, setMobileView] = useState<'library' | 'roster' | 'settings'>(() => 
    initialCombatants.length === 0 ? 'library' : 'roster'
  );
  const [currentCombatants, setCurrentCombatants] = useState<Combatant[]>(initialCombatants);
  const [encounterName, setEncounterName] = useState(initialName || 'New Encounter');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initialBackgroundImage);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [backgroundOpacity, setBackgroundOpacity] = useState(initialBackgroundOpacity);
  const [panelOpacity, setPanelOpacity] = useState(initialPanelOpacity);
  const [animationLevel, setAnimationLevel] = useState<AnimationLevel>(initialAnimationLevel ?? 'minimal');
  const [folder, setFolder] = useState(initialFolder);
  const [selectedSoundIds, setSelectedSoundIds] = useState<string[]>(initialSoundIds);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const uniqueFolders = Array.from(new Set(existingFolders.filter(Boolean))).sort();

  useEffect(() => {
    if (isOpen) {
      setCurrentCombatants(initialCombatants);
      setEncounterName(initialName || 'New Encounter');
      setBackgroundImageUrl(initialBackgroundImage);
      setYoutubeUrl(initialYoutubeUrl);
      setFolder(initialFolder);
      setBackgroundOpacity(initialBackgroundOpacity);
      setPanelOpacity(initialPanelOpacity);
      setSelectedSoundIds(initialSoundIds);
      setSearchQuery('');
      setSourceFilter('');
      setVisibleCount(30);
      setLibraryTab('monsters');
      if (initialCombatants.length === 0) setMobileView('library');
      else setMobileView('roster');
    }
  }, [isOpen]);


  const allSources = useMemo(() => {
    const set = new Set<string>();
    monsters.forEach(m => { if (m.source) set.add(m.source); });
    return Array.from(set).sort();
  }, [monsters]);

  const filteredLibrary = useMemo(() => {
    return monsters.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = !sourceFilter || m.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [monsters, searchQuery, sourceFilter]);

  const visibleMonsters = useMemo(() => filteredLibrary.slice(0, visibleCount), [filteredLibrary, visibleCount]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 30, filteredLibrary.length));
  }, [filteredLibrary.length]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, sourceFilter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, libraryTab]);

  const addMonster = (monster: MonsterTemplate) => {
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: monster.name,
      type: 'monster',
      initiative: 0,
      hp: { current: monster.hp, max: monster.hp },
      ac: monster.ac,
      speed: monster.speed,
      subtitle: `${monster.type} • CR ${monster.cr}`,
      avatar: monster.image,
      conditions: [],
      tags: [],
      stats: { ...monster.stats },
      actions: monster.actions ? [...monster.actions] : [],
      abilities: monster.abilities ? [...monster.abilities] : [],
      spells: monster.spells ? [...monster.spells] : [],
    };
    setCurrentCombatants(prev => [...prev, newCombatant]);
  };

  const addPlayer = (player: Player) => {
    const alreadyAdded = currentCombatants.some(c => c.playerId === player.id || c.id === `player-${player.id}`);
    if (alreadyAdded) {
      setCurrentCombatants(prev => prev.filter(c => c.playerId !== player.id && c.id !== `player-${player.id}`));
      return;
    }
    const newCombatant: Combatant = {
      id: uuid(),
      playerId: player.id,
      name: player.name,
      type: 'player',
      initiative: 0,
      hp: { current: player.hp_max, max: player.hp_max },
      ac: player.ac,
      speed: player.speed,
      subtitle: player.subtitle,
      avatar: player.avatar,
      conditions: [],
      tags: [],
      stats: { ...player.stats },
      actions: player.actions ?? [],
      abilities: player.abilities ?? [],
      spells: player.spells ?? [],
    };
    setCurrentCombatants(prev => [...prev, newCombatant]);
  };

  const removeCombatant = (id: string) => {
    setCurrentCombatants(prev => prev.filter(c => c.id !== id));
  };

  const addAllPlayers = () => {
    const newCombatants: Combatant[] = players
      .filter(p => !currentCombatants.some(c => c.playerId === p.id || c.id === `player-${p.id}`))
      .map(p => ({
        id: uuid(),
        playerId: p.id,
        name: p.name,
        type: 'player' as const,
        initiative: 0,
        hp: { current: p.hp_max, max: p.hp_max },
        ac: p.ac,
        speed: p.speed,
        subtitle: p.subtitle,
        avatar: p.avatar,
        conditions: [],
        tags: [],
        stats: { ...p.stats },
        actions: p.actions ?? [],
        abilities: p.abilities ?? [],
        spells: p.spells ?? [],
      }));
    if (newCombatants.length > 0) setCurrentCombatants(prev => [...prev, ...newCombatants]);
  };

  const updateCombatantCR = (id: string, newCR: string) => {
    setCurrentCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updatedSubtitle = c.subtitle?.replace(/CR\s*[\d/]+/, `CR ${newCR}`) ?? c.subtitle;
      const crStats = CR_TABLE[newCR];
      const newHp = crStats ? Math.round((crStats.hpMin + crStats.hpMax) / 2) : c.hp.max;
      const newAc = crStats ? crStats.acSuggested : c.ac;
      return { ...c, subtitle: updatedSubtitle, ac: newAc, hp: { current: newHp, max: newHp } };
    }));
  };

  const difficulty = useMemo(() => {
    const monsterCombatants = currentCombatants.filter(c => c.type !== 'player' && !c.isFriendly);
    return calcDifficulty(monsterCombatants, players);
  }, [currentCombatants, players]);

  const handleScaleApply = (changes: { id: string; hp: number; ac: number }[], difficultyLabel: string) => {
    const newCombatants = currentCombatants.map(c => {
      const change = changes.find(ch => ch.id === c.id);
      if (!change) return c;
      return { ...c, hp: { current: change.hp, max: change.hp }, ac: change.ac };
    });
    setCurrentCombatants(newCombatants);
    setScaleModalOpen(false);
    onAutoSave?.(newCombatants, encounterName, backgroundImageUrl ?? '', youtubeUrl ?? '', folder ?? '', difficultyLabel, backgroundOpacity, panelOpacity, selectedSoundIds, animationLevel);
  };

  const youtubeId = parseYoutubeId(youtubeUrl);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#0A0C12] flex flex-col"
    >
      {/* Header */}
      <header className="h-14 sm:h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-12 shrink-0">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-bold rounded-lg transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" /> <span>Back</span>
          </button>

          <div className="hidden sm:block w-px h-8 bg-white/10 mx-2" />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-2xl font-headline font-bold text-white tracking-tight truncate">Encounter Creator</h1>
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b border-white/5 shrink-0">
        {([
          { key: 'library', icon: BookOpen, label: 'Library' },
          { key: 'roster',  icon: Swords,   label: 'Roster' },
          { key: 'settings',icon: Settings2, label: 'Settings' },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setMobileView(key)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors",
              mobileView === key ? "text-primary border-b-2 border-primary" : "text-outline"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Library Explorer */}
        <aside className={cn("flex-col bg-[#05070A] border-r border-white/5", mobileView === 'library' ? "flex flex-1 md:flex-none md:w-80" : "hidden md:flex md:w-80")}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-outline">
              <Search className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Library Explorer</span>
            </div>

            {/* Tab toggle */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setLibraryTab('monsters')}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-md transition-all ${
                  libraryTab === 'monsters' ? 'bg-white/10 text-white' : 'text-outline hover:text-white'
                }`}
              >Monsters</button>
              <button
                onClick={() => setLibraryTab('players')}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-md transition-all ${
                  libraryTab === 'players' ? 'bg-white/10 text-white' : 'text-outline hover:text-white'
                }`}
              >Players</button>
            </div>

            {libraryTab === 'monsters' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/40" />
                  <input
                    type="text"
                    placeholder="Search compendium..."
                    className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                {allSources.length > 0 && (
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline/40 pointer-events-none" />
                    <select
                      value={sourceFilter}
                      onChange={e => setSourceFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-outline focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">All sources</option>
                      {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {libraryTab === 'players' && players.length > 0 && (
            <div className="px-4 pb-2 shrink-0">
              <button
                onClick={addAllPlayers}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 transition-all"
              >
                <Users className="w-3.5 h-3.5" /> Add All Players
              </button>
            </div>
          )}

          {libraryTab === 'monsters' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {visibleMonsters.map(monster => (
                <div key={monster.id} className="group flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/10 transition-all">
                  <AvatarImg src={monster.image} name={monster.name} className="w-12 h-12 rounded-lg border border-white/10" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{monster.name}</h4>
                    <p className="text-[10px] text-outline uppercase font-label">CR {monster.cr} • {monster.type}</p>
                  </div>
                  <button
                    onClick={() => addMonster(monster)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg border border-primary/20 transition-all font-bold text-[10px] uppercase tracking-wide shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>
              ))}
              <div ref={sentinelRef} className="h-1" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {players.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <p className="text-xs text-outline opacity-60">No players in roster.</p>
                  <p className="text-[10px] text-outline opacity-40">Import characters from the D&D Beyond tab.</p>
                </div>
              ) : (
                players.map(player => {
                  const isAdded = currentCombatants.some(c => c.playerId === player.id || c.id === `player-${player.id}`);
                  return (
                    <div
                      key={player.id}
                      onClick={() => addPlayer(player)}
                      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isAdded
                          ? 'bg-green-500/10 border-green-500/20 hover:border-green-500/40'
                          : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {player.avatar ? (
                        <img src={player.avatar} alt={player.name} className="w-12 h-12 rounded-lg border border-white/10 object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center border border-white/10">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{player.name}</h4>
                        <p className="text-[10px] text-outline truncate">{player.subtitle || 'No class info'}</p>
                        <p className="text-[10px] text-outline opacity-60">HP {player.hp_max} • AC {player.ac}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); addPlayer(player); }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all font-bold text-[10px] uppercase tracking-wide shrink-0",
                          isAdded 
                            ? "bg-green-500 text-white border-green-600 shadow-lg shadow-green-900/20" 
                            : "bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border-primary/20"
                        )}
                      >
                        {isAdded ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Added</>
                        ) : (
                          <><Plus className="w-3.5 h-3.5" /> Add</>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </aside>

        {/* Center Column: Current Combatants */}
        <main className={cn("flex-col bg-[#0A0C12] relative", mobileView === 'roster' ? "flex flex-1" : "hidden md:flex md:flex-1")}>
          <div className="p-4 sm:p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Difficulty detail */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-black uppercase tracking-wider", difficulty?.color ?? 'text-outline/40')}>
                    {difficulty ? `${difficulty.label} Encounter` : (players.length === 0 ? 'Add players to roster to calculate difficulty' : 'Add monsters to calculate difficulty')}
                  </span>
                  {difficulty && difficulty.multiplierUsed > 1 && (
                    <span className="text-[10px] text-outline/60">×{difficulty.multiplierUsed} multiplier</span>
                  )}
                </div>
                {(() => {
                  const thresholds = difficulty?.partyThresholds ?? [25, 50, 75, 100];
                  const adjustedXP = difficulty?.adjustedXP ?? 0;
                  const [easy, medium, hard, deadly] = thresholds;
                  const max = Math.max(deadly * 1.5, adjustedXP * 1.1, 1);
                  const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
                  const markerPct = Math.min(100, (adjustedXP / max) * 100);
                  return (
                    <div className="relative h-3 rounded-full overflow-visible bg-surface-container-lowest">
                      <div className="absolute inset-0 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-700/60 h-full" style={{ width: pct(easy) }} />
                        <div className="bg-yellow-600/60 h-full" style={{ width: `calc(${pct(medium)} - ${pct(easy)})` }} />
                        <div className="bg-orange-600/60 h-full" style={{ width: `calc(${pct(hard)} - ${pct(medium)})` }} />
                        <div className="bg-error/60 h-full flex-1" />
                      </div>
                      {difficulty && (
                        <div
                          className="absolute top-1/2 w-2 h-4 bg-white rounded-sm shadow-lg z-10"
                          style={{ left: `${markerPct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                        />
                      )}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-4 gap-1 text-center">
                  {(['Easy', 'Medium', 'Hard', 'Deadly'] as const).map((lbl, i) => (
                    <div key={lbl}>
                      <p className="text-[8px] uppercase text-outline tracking-wider">{lbl}</p>
                      <p className="text-[10px] font-bold text-on-surface/70">
                        {difficulty ? difficulty.partyThresholds[i].toLocaleString() : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <header className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <input
                    type="text"
                    value={encounterName}
                    onChange={e => setEncounterName(e.target.value)}
                    className="text-2xl font-headline font-bold text-white bg-transparent border-b border-white/20 focus:border-primary outline-none transition-colors min-w-0 flex-1"
                    placeholder="Encounter name..."
                  />
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-black rounded uppercase tracking-wider shrink-0">
                    {currentCombatants.length} ACTIVE
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <button className="p-2 text-outline hover:text-white transition-colors">
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <button onClick={() => setCurrentCombatants([])} className="p-2 text-outline hover:text-error transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  {currentCombatants.some(c => c.type !== 'player') && (
                    <button
                      onClick={() => setScaleModalOpen(true)}
                      title="Scale encounter difficulty for current party"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-orange-400 border border-orange-400/30 hover:bg-orange-400/10 rounded-lg transition-colors"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Scale Difficulty
                    </button>
                  )}
                </div>
              </header>

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {currentCombatants.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "group relative bg-[#12141C] rounded-2xl border border-white/5 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-4 transition-all hover:bg-white/5",
                        idx === 0 && "ring-1 ring-primary/30"
                      )}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl opacity-60"
                        style={{ backgroundColor: idx === 0 ? 'var(--color-primary)' : '#ffffff22' }}
                      />

                      {/* Index */}
                      <div className="flex flex-col items-center justify-center w-8 shrink-0 ml-1">
                        <span className={cn(
                          "font-headline font-black text-xl leading-none",
                          idx === 0 ? "text-primary" : "text-outline/50"
                        )}>
                          {idx + 1}
                        </span>
                      </div>

                      {/* Portrait */}
                      <AvatarImg
                        src={c.avatar}
                        name={c.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-outline-variant/20 shrink-0"
                      />

                      {/* Name + subtitle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="text-sm sm:text-base font-headline font-bold text-white leading-none">{c.name}</h3>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0",
                            c.type === 'player' ? "bg-blue-600/80 text-white" : c.isFriendly ? "bg-emerald-600/80 text-white" : "bg-red-600/80 text-white"
                          )}>
                            {c.type === 'player' ? 'Player' : c.isFriendly ? 'Friendly' : 'Monster'}
                          </span>
                        </div>
                        {c.subtitle && (
                          <p className="text-[10px] text-outline italic truncate">{c.subtitle}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                        {c.type !== 'player' && (() => {
                          const crMatch = c.subtitle?.match(/CR\s*([\d/]+)/);
                          const currentCR = crMatch?.[1] ?? '1';
                          return (
                            <div className="hidden sm:block">
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-outline opacity-40 mb-0.5">CR</p>
                              <select
                                value={currentCR}
                                onChange={e => updateCombatantCR(c.id, e.target.value)}
                                className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                              >
                                {Object.keys(CR_XP).map(cr => (
                                  <option key={cr} value={cr}>{cr}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                        <div className="text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-outline opacity-40 mb-0.5">AC</p>
                          <p className="text-sm font-headline font-black text-white">{c.ac}</p>
                        </div>
                        <div className="w-20 sm:w-28">
                          <div className="flex justify-between items-end mb-1">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-outline opacity-40">HP</p>
                            <p className="text-[10px] font-bold text-white tabular-nums">{c.hp.current} / {c.hp.max}</p>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full w-full" />
                          </div>
                        </div>
                      </div>

                      {c.type !== 'player' && (
                        <button
                          onClick={() => setCurrentCombatants(prev => prev.map(x => x.id === c.id ? { ...x, isFriendly: !x.isFriendly } : x))}
                          title={c.isFriendly ? 'Remove friendly' : 'Mark as friendly'}
                          className={cn(
                            "p-1.5 rounded-lg transition-all shrink-0",
                            c.isFriendly
                              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                              : "opacity-0 group-hover:opacity-100 text-outline hover:text-emerald-400 hover:bg-emerald-500/10"
                          )}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeCombatant(c.id)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-outline hover:text-error transition-all shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Difficulty Bar — sticky at bottom */}
          <footer className="border-t border-white/5 bg-[#05070A] px-4 sm:px-12 py-3 shrink-0 space-y-3">
            {/* Launch / Save — mobile only; desktop has these in the right sidebar */}
            <div className="md:hidden flex gap-2">
              <button
                onClick={() => onSave(currentCombatants, encounterName, backgroundImageUrl, youtubeUrl, folder, difficulty?.label, backgroundOpacity, panelOpacity, selectedSoundIds, animationLevel)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs border border-white/5 transition-all uppercase tracking-wide"
              >
                Save
              </button>
              <button
                onClick={() => onLaunch(currentCombatants, encounterName, backgroundImageUrl, youtubeUrl, folder, difficulty?.label, backgroundOpacity, panelOpacity, selectedSoundIds, animationLevel)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-primary to-blue-600 text-on-primary rounded-xl font-bold text-xs transition-all uppercase tracking-wide"
              >
                <Zap className="w-3.5 h-3.5" /> Launch
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn("text-[10px] font-black uppercase tracking-widest shrink-0 w-16", difficulty?.color ?? 'text-outline/30')}>
                {difficulty?.label ?? '—'}
              </span>
              {(() => {
                const thresholds = difficulty?.partyThresholds ?? [25, 50, 75, 100];
                const adjustedXP = difficulty?.adjustedXP ?? 0;
                const [easy, medium, hard, deadly] = thresholds;
                const max = Math.max(deadly * 1.5, adjustedXP * 1.1, 1);
                const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
                const markerPct = Math.min(100, (adjustedXP / max) * 100);
                return (
                  <div className="relative flex-1 h-2 rounded-full overflow-visible bg-surface-container-lowest">
                    <div className="absolute inset-0 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-700/60 h-full" style={{ width: pct(easy) }} />
                      <div className="bg-yellow-600/60 h-full" style={{ width: `calc(${pct(medium)} - ${pct(easy)})` }} />
                      <div className="bg-orange-600/60 h-full" style={{ width: `calc(${pct(hard)} - ${pct(medium)})` }} />
                      <div className="bg-error/60 h-full flex-1" />
                    </div>
                    {difficulty && (
                      <div
                        className="absolute top-1/2 w-2 h-3.5 bg-white rounded-sm shadow-lg z-10"
                        style={{ left: `${markerPct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                      />
                    )}
                  </div>
                );
              })()}
              {difficulty && difficulty.multiplierUsed > 1 && (
                <span className="text-[10px] text-outline/50 shrink-0">×{difficulty.multiplierUsed}</span>
              )}
              {!difficulty && (
                <span className="text-[10px] text-outline/30 shrink-0">
                  {players.length === 0 ? 'add players to roster' : 'add monsters to calculate'}
                </span>
              )}
            </div>
          </footer>
        </main>

        {/* Right Column: Atmosphere & Ambience */}
        <aside className={cn("flex-col bg-[#05070A] border-l border-white/5 overflow-y-auto custom-scrollbar", mobileView === 'settings' ? "flex flex-1 md:flex-none md:w-80" : "hidden md:flex md:w-80")}>
          <div className="p-8 space-y-10">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-outline">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Location / Group</span>
              </div>
              <input
                type="text"
                placeholder="e.g. Undermountain, Act 1, Session 3..."
                value={folder}
                onChange={e => setFolder(e.target.value)}
                list="ec-folder-suggestions"
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              {uniqueFolders.length > 0 && (
                <datalist id="ec-folder-suggestions">
                  {uniqueFolders.map(f => <option key={f} value={f} />)}
                </datalist>
              )}
              {uniqueFolders.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {uniqueFolders.map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFolder(f)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                        folder === f
                          ? 'bg-primary/15 border-primary/30 text-primary'
                          : 'bg-white/5 border-white/10 text-outline hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-outline">
                <ImageIcon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Atmosphere</span>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline opacity-60 mb-2 block">Background Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={backgroundImageUrl}
                    onChange={e => setBackgroundImageUrl(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePickerOpen(true)}
                    className="px-3 py-2 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-colors text-outline hover:text-on-surface shrink-0"
                    title="Search images"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {backgroundImageUrl && (
                <div className="rounded-lg overflow-hidden border border-white/10 aspect-video">
                  <img
                    src={backgroundImageUrl}
                    alt="Background preview"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline opacity-60">Background Opacity</label>
                  <span className="text-[10px] font-bold text-outline/70">{Math.round(backgroundOpacity * 100)}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round(backgroundOpacity * 100)}
                  onChange={e => setBackgroundOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-primary h-1.5 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline opacity-60">Panel Opacity</label>
                  <span className="text-[10px] font-bold text-outline/70">{Math.round(panelOpacity * 100)}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round(panelOpacity * 100)}
                  onChange={e => setPanelOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-primary h-1.5 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline opacity-60 mb-2 block">Animations</label>
                <div className="flex rounded-md overflow-hidden border border-white/10">
                  {(['none', 'minimal', 'typed', 'full'] as AnimationLevel[]).map((level, i) => (
                    <button
                      key={level}
                      onClick={() => setAnimationLevel(level)}
                      className={cn(
                        'flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                        i > 0 && 'border-l border-white/10',
                        animationLevel === level
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-outline hover:text-on-surface hover:bg-surface-container-highest',
                      )}
                    >
                      {level === 'none' ? 'Off' : level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-outline">
                <Music className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ambience</span>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline opacity-60 mb-2 block">YouTube URL</label>
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>

              {youtubeId && (
                <div className="rounded-lg overflow-hidden border border-white/10 aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=0`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </section>

            {sounds.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-outline">
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Auto-play Sounds</span>
              </div>
              <p className="text-[10px] text-outline/60 leading-relaxed">These sounds will play automatically when this encounter is loaded.</p>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {sounds.map(s => {
                  const selected = selectedSoundIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSoundIds(prev => selected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all border ${selected ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/5 border-white/5 text-outline hover:text-white hover:bg-white/10'}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-outline/40'}`}>
                        {selected && <span className="text-[7px] font-black text-on-primary leading-none">✓</span>}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="ml-auto text-[9px] opacity-50 capitalize flex-shrink-0">{s.category}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            <div className="space-y-4">
              {!encounterName.trim() && (
                <p className="text-xs text-amber-400/80 text-center">Enter an encounter name to continue.</p>
              )}
              <button
                disabled={!encounterName.trim()}
                onClick={() => onLaunch(currentCombatants, encounterName.trim(), backgroundImageUrl, youtubeUrl, folder, difficulty?.label, backgroundOpacity, panelOpacity, selectedSoundIds, animationLevel)}
                className="w-full py-4 bg-gradient-to-r from-primary to-blue-600 text-on-primary rounded-xl font-headline font-black text-sm tracking-widest shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Launch Encounter
              </button>
              <button
                disabled={!encounterName.trim()}
                onClick={() => onSave(currentCombatants, encounterName.trim(), backgroundImageUrl, youtubeUrl, folder, difficulty?.label, backgroundOpacity, panelOpacity, selectedSoundIds, animationLevel)}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-headline font-black text-sm tracking-widest border border-white/5 transition-all uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5"
              >
                Save Encounter
              </button>
            </div>
          </div>
        </aside>
      </div>
      <ImagePickerModal
        isOpen={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={url => setBackgroundImageUrl(url)}
      />
      <ScaleEncounterModal
        isOpen={scaleModalOpen}
        onClose={() => setScaleModalOpen(false)}
        combatants={currentCombatants}
        players={players}
        onApply={handleScaleApply}
      />
    </motion.div>
  );
};
