import React from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import type { DragControls } from 'motion/react';
import { Users, Save, Square, Monitor, ChevronLeft, ChevronRight, ExternalLink, ArrowLeft, Play, Edit2, Heart, UserPlus, Swords, Sparkles, AlertTriangle, Plus, Trash2, Music, X, Undo2, Redo2, MoreHorizontal } from 'lucide-react';
import { TacticalSummary } from './TacticalSummary';
import { AvatarImg } from './AvatarImg';
import { CombatantRow } from './CombatantRow';
import { AoEActionBar } from './AoEActionBar';
import { MultiTargetDamageModal } from './MultiTargetDamageModal';
import { CombatLog } from './CombatLog';
import { EncounterVault } from './EncounterVault';
import { ImportScreen } from './ImportScreen';
import { PlayerView } from './PlayerView';
import { MonsterLibrary } from './MonsterLibrary';
import { HueSettingsPanel } from './HueSettingsPanel';
import { HomeAssistantSettingsPanel } from './HomeAssistantSettingsPanel';
import { SpatialSettingsPanel } from './SpatialSettingsPanel';
import { UsersSettings } from './UsersSettings';
import { Modal } from './Modal';
import { AuthUser } from '../hooks/useAuth';
import { HueEffectName, HueEffectTargets } from '../lib/hueEffects';
import { CampaignView } from './CampaignView';
import { SessionView } from './SessionView';
import { SpellsScreen } from './SpellsScreen';
import { AbilitiesScreen } from './AbilitiesScreen';
import { SoundboardScreen } from './SoundboardScreen';
import { EditMonsterModal } from './EditMonsterModal';
import { AddMonsterDrawer } from './AddMonsterDrawer';
import { DashboardView } from './DashboardView';
import { DraggableSoundpad } from './DraggableSoundpad';
import { AnimationLevel, Combatant, Encounter, MonsterTemplate, MonsterAction, Spell, Player, LogEntry, Campaign, Session, ClassFeature, EncounterNotes } from '../types';
import { api, ApiError } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getCombatantLayout } from '../lib/combatantUtils';

type NoteToken =
  | { type: 'text'; text: string }
  | { type: 'action'; text: string; actor: Combatant; action: MonsterAction };

function tokenizeNote(note: string, combatants: Combatant[], activeCombatantId?: string): NoteToken[] {
  const entries: { name: string; actor: Combatant; action: MonsterAction }[] = [];
  for (const c of combatants) {
    for (const a of [...(c.actions ?? []), ...(c.abilities ?? []), ...(c.spells ?? [])]) {
      if (a.name && a.name.length >= 3) entries.push({ name: a.name, actor: c, action: a });
    }
  }
  if (entries.length === 0) return [{ type: 'text', text: note }];

  // Deduplicate: prefer active combatant's version, then first occurrence
  const seen = new Map<string, { actor: Combatant; action: MonsterAction }>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!seen.has(key) || e.actor.id === activeCombatantId) seen.set(key, e);
  }

  // Sort by name length descending so longer names match before substrings
  const sorted = [...seen.entries()].sort((a, b) => b[0].length - a[0].length);
  const pattern = new RegExp(
    sorted.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'gi'
  );

  const tokens: NoteToken[] = [];
  let lastIndex = 0;
  for (const match of note.matchAll(pattern)) {
    if (match.index! > lastIndex) tokens.push({ type: 'text', text: note.slice(lastIndex, match.index) });
    const key = match[0].toLowerCase();
    const entry = seen.get(key)!;
    tokens.push({ type: 'action', text: match[0], actor: entry.actor, action: entry.action });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < note.length) tokens.push({ type: 'text', text: note.slice(lastIndex) });
  return tokens.length > 0 ? tokens : [{ type: 'text', text: note }];
}

interface DraggableCombatantRowProps {
  id: string;
  activeRef?: (el: HTMLDivElement | null) => void;
  children: (dragControls: DragControls) => React.ReactNode;
}

const DraggableCombatantRow: React.FC<DraggableCombatantRowProps> = ({ id, activeRef, children }) => {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      ref={activeRef}
      as="div"
    >
      {children(dragControls)}
    </Reorder.Item>
  );
};

const ResetDbPanel: React.FC = () => {
  const [confirm, setConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const { showError } = useToast();

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.db.reset();
      setDone(true);
      setConfirm(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      showError(e instanceof ApiError ? e.message : 'Database reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-container-low p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-red-400" />
        <h3 className="text-sm font-bold text-on-surface">Danger Zone</h3>
      </div>
      <p className="text-xs text-outline leading-relaxed">
        Reset the database — removes all encounters, monsters, spells, players, campaigns and sounds.
        User accounts and integration settings (Hue, HA) are preserved.
      </p>
      {done ? (
        <p className="text-xs text-emerald-400 font-bold">✓ Database cleared — reloading…</p>
      ) : confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400 font-bold flex-1">Are you sure? This cannot be undone.</span>
          <button
            onClick={() => setConfirm(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container-high text-outline hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {loading ? 'Resetting…' : 'Yes, reset everything'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Reset Database
        </button>
      )}
    </div>
  );
};

interface MainContentProps {
  isPlayerView: boolean;
  activeTab: 'dashboard' | 'monsters' | 'players' | 'encounters' | 'spells' | 'archive' | 'settings' | 'import' | 'campaigns' | 'abilities' | 'soundboard';
  encounterSubtab: 'saved' | 'recent';
  currentEncounterId: string | null;
  encounterName: string;
  currentRound: number;
  combatants: Combatant[];
  currentTurnIndex: number;
  isEncounterActive: boolean;
  savedEncounters: Encounter[];
  monsters: MonsterTemplate[];
  spells: Spell[];
  handleLoadEncounter: (enc: Encounter) => void;
  loadingEncounterId?: string | null;
  isSaving?: boolean;
  handleUndo?: () => void;
  handleRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  setIsEncounterCreatorOpen: (open: boolean) => void;
  setIsInitiativeModalOpen: (open: boolean) => void;
  setIsSaveEncounterModalOpen: (open: boolean) => void;
  handleEndEncounter: () => void;
  setEditingCombatantId: (id: string) => void;
  setIsEditModalOpen: (open: boolean) => void;
  setIsStatusModalOpen: (open: boolean) => void;
  setQuickActionCombatantId: (id: string) => void;
  setIsQuickActionModalOpen: (open: boolean) => void;
  setQuickActionMode: (mode: 'damage' | 'heal' | 'tempHp') => void;
  handleAddMonsterToEncounter: (monster: MonsterTemplate) => void;
  handleAddPlayerToEncounter: (player: Player) => void;
  handleAddAllPlayersToEncounter: () => void;
  handleHealAll: () => void;
  handleClearAllConditions: () => void;
  setEditingMonsterId: (id: string) => void;
  setIsMonsterEditModalOpen: (open: boolean) => void;
  handleUpdateMonster: (updated: MonsterTemplate) => void;
  handleCopyMonster: (monster: MonsterTemplate) => void;
  handleDeleteMonster: (id: string) => void;
  handleDeleteAllMonsters: () => void;
  handleRemovePlayer: (id: string) => Promise<void>;
  handleImportMonsters: (monsters: MonsterTemplate[]) => void;
  handleImportSpells: (spells: Spell[]) => void;
  handleImportEncounters: (encounters: Encounter[]) => void;
  players: Player[];
  onImportPlayer: (dndBeyondId: string, cobaltSession?: string) => Promise<any>;
  onCreatePlayer?: (data: Partial<Player>) => Promise<Player>;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<any>;
  onRemovePlayer: (id: string) => Promise<void>;
  setActiveTab: (tab: 'dashboard' | 'monsters' | 'players' | 'encounters' | 'spells' | 'archive' | 'settings' | 'import' | 'campaigns' | 'abilities' | 'soundboard') => void;
  classFeatures?: ClassFeature[];
  onImportClassFeatures?: (features: ClassFeature[]) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  campaigns?: Campaign[];
  activeCampaignId?: string | null;
  sessions?: Session[];
  onSelectCampaign?: (id: string) => void;
  onBackToCampaigns?: () => void;
  onCreateCampaign?: (name: string, description: string, mapImage?: string) => Promise<void>;
  onUpdateCampaign?: (id: string, updates: Partial<Pick<Campaign, 'name' | 'description' | 'mapImage'>>) => Promise<void>;
  onDeleteCampaign?: (id: string) => Promise<void>;
  onCreateSession?: (name: string, date: string, notes: string) => Promise<void>;
  onDeleteSession?: (id: string) => Promise<void>;
  onUpdateSession?: (id: string, updates: { notes?: string }) => Promise<void>;
  onAssignEncounter?: (encounterId: string, sessionId: string | null) => Promise<void>;
  onLoadSessions?: (campaignId: string) => Promise<void>;
  onOpenEncounter?: (enc: Encounter) => void;
  onUpdateEncounter?: (id: string, updates: Partial<Encounter>) => Promise<void>;
  setIsPlayerView: (v: boolean) => void;
  handlePrevTurn: () => void;
  handleNextTurn: () => void;
  handleNewEncounter: () => void;
  handleMoveCombatant: (id: string, direction: 'up' | 'down') => void;
  handleReorderCombatants: (newOrderIds: string[]) => void;
  handleUpdateCombatant: (updated: Combatant) => void;
  handleRevertPolymorph?: (combatant: Combatant) => void;
  handleAddCompanion?: (ownerId: string, template: { name: string; hp: number; ac: number; avatar?: string; subtitle?: string; stats?: Combatant['stats'] }) => void;
  handleDeleteCombatant?: (id: string) => void;
  selectedCombatantId?: string | null;
  setSelectedCombatantId: (id: string | null) => void;
  activeBackground?: string;
  activeBackgroundOpacity?: number;
  activePanelOpacity?: number;
  activeAnimationLevel?: AnimationLevel;
  displayNames: Map<string, string>;
  addLogEntry?: (entry: Omit<LogEntry, 'id' | 'round'>) => void;
  combatLog?: LogEntry[];
  showLog?: boolean;
  showLogToPlayers?: boolean;
  onToggleLogToPlayers?: () => void;
  pendingConChecks?: Record<string, number>;
  triggerConCheck?: (combatantId: string, dc: number) => void;
  clearConCheck?: (combatantId: string) => void;
  hueEnabled?: boolean;
  hueSyncScene?: boolean;
  hueEnabledEffects?: Partial<Record<HueEffectName, boolean>>;
  hueEffectTargets?: Partial<Record<HueEffectName, HueEffectTargets>>;
  onToggleHue?: (v: boolean) => void;
  haEnabled?: boolean;
  onToggleHa?: (v: boolean) => void;
  onToggleHueSyncScene?: (v: boolean) => void;
  onToggleHueEffect?: (name: HueEffectName, v: boolean) => void;
  onToggleHueTarget?: (name: HueEffectName, target: 'players' | 'monsters', v: boolean) => void;
  onUseSpellFromLibrary?: (actor: Combatant, action: import('../types').MonsterAction) => void;
  onDeleteEncounters?: (ids: string[]) => void;
  onImportAdventureAsCampaign?: (name: string, description: string, chapters: Array<{ name: string; encounters: Encounter[] }>) => Promise<void>;
  sounds?: import('../types').Sound[];
  onAddSound?: (data: FormData) => Promise<void>;
  onUpdateSound?: (id: string, patch: Partial<Pick<import('../types').Sound, 'name' | 'category' | 'tags' | 'spellId' | 'volume' | 'isFavorite'>>) => Promise<void>;
  onDeleteSound?: (id: string) => Promise<void>;
  onRefreshSounds?: () => Promise<void>;
  soundPlayingIds?: Set<string>;
  soundLiveSettings?: Record<string, import('../hooks/useSoundboard').LiveSettings>;
  onTogglePlay?: (sound: import('../types').Sound) => void;
  onStopAllSounds?: () => void;
  onPatchLive?: (id: string, patch: any) => void;
  onSetVolume?: (id: string, volume: number) => void;
  masterVolume?: number;
  setMasterVolume?: (v: number) => void;
  isMuted?: boolean;
  setIsMuted?: (v: boolean) => void;
  spatialMode?: import('../hooks/useSoundboard').SpatialMode;
  getAudioCtx?: () => AudioContext;
  onImportScene?: (scene: { name: string; backgroundImg: string }) => void;
  encounterNotes?: EncounterNotes;
  onSwitchSidebarToNotes?: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  isPlayerView,
  activeTab,
  encounterSubtab,
  currentEncounterId,
  encounterName,
  currentRound,
  combatants,
  currentTurnIndex,
  isEncounterActive,
  savedEncounters,
  monsters,
  spells,
  handleLoadEncounter,
  loadingEncounterId,
  isSaving,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  setIsEncounterCreatorOpen,
  setIsInitiativeModalOpen,
  setIsSaveEncounterModalOpen,
  handleEndEncounter,
  setEditingCombatantId,
  setIsEditModalOpen,
  setIsStatusModalOpen,
  setQuickActionCombatantId,
  setIsQuickActionModalOpen,
  setQuickActionMode,
  handleAddMonsterToEncounter,
  handleAddPlayerToEncounter,
  handleAddAllPlayersToEncounter,
  handleHealAll,
  handleClearAllConditions,
  setEditingMonsterId,
  setIsMonsterEditModalOpen,
  handleUpdateMonster,
  handleCopyMonster,
  handleDeleteMonster,
  handleDeleteAllMonsters,
  handleRemovePlayer,
  handleImportMonsters,
  handleImportSpells,
  handleImportEncounters,
  players,
  onImportPlayer,
  onCreatePlayer,
  onUpdatePlayer,
  onRemovePlayer,
  setActiveTab,
  setIsPlayerView,
  handlePrevTurn,
  handleNextTurn,
  handleNewEncounter,
  handleMoveCombatant,
  handleReorderCombatants,
  handleUpdateCombatant,
  handleRevertPolymorph,
  handleAddCompanion,
  handleDeleteCombatant,
  selectedCombatantId,
  setSelectedCombatantId,
  activeBackground,
  activeBackgroundOpacity,
  activePanelOpacity,
  activeAnimationLevel,
  displayNames,
  addLogEntry,
  combatLog,
  showLog,
  showLogToPlayers,
  onToggleLogToPlayers,
  pendingConChecks,
  triggerConCheck,
  clearConCheck,
  hueEnabled,
  hueSyncScene,
  hueEnabledEffects,
  hueEffectTargets,
  onToggleHue,
  haEnabled,
  onToggleHa,
  onToggleHueSyncScene,
  onToggleHueEffect,
  onToggleHueTarget,
  campaigns,
  activeCampaignId,
  sessions,
  onSelectCampaign,
  onBackToCampaigns,
  onCreateCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onCreateSession,
  onDeleteSession,
  onUpdateSession,
  onAssignEncounter,
  onLoadSessions,
  onOpenEncounter,
  onUpdateEncounter,
  onUseSpellFromLibrary,
  onDeleteEncounters,
  onImportAdventureAsCampaign,
  classFeatures,
  onImportClassFeatures,
  currentUser,
  onLogout,
  sounds,
  onAddSound,
  onUpdateSound,
  onDeleteSound,
  onRefreshSounds,
  soundPlayingIds,
  soundLiveSettings,
  onTogglePlay,
  onStopAllSounds,
  onPatchLive,
  onSetVolume,
  masterVolume,
  setMasterVolume,
  isMuted,
  setIsMuted,
  spatialMode,
  getAudioCtx,
  onImportScene,
  encounterNotes,
  onSwitchSidebarToNotes,
}) => {
  const currentEncounter = savedEncounters?.find((e: any) => e.id === currentEncounterId);
  const dmNotes = currentEncounter?.description;

  const [activeRowVisible, setActiveRowVisible] = React.useState(true);
  const activeRowObserverRef = React.useRef<IntersectionObserver | null>(null);
  const activeRowCallbackRef = React.useCallback((node: HTMLDivElement | null) => {
    activeRowObserverRef.current?.disconnect();
    activeRowObserverRef.current = null;
    if (!node) { setActiveRowVisible(true); return; }
    activeRowObserverRef.current = new IntersectionObserver(
      ([entry]) => setActiveRowVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    activeRowObserverRef.current.observe(node);
  }, [currentTurnIndex]);

  const [dmNotesOpen, setDmNotesOpen] = React.useState(() => {
    if (!currentEncounterId) return false;
    return !localStorage.getItem(`dm-notes-dismissed-${currentEncounterId}`);
  });

  const [isAddMonsterOpen, setIsAddMonsterOpen] = React.useState(false);
  const [encounterEditMonster, setEncounterEditMonster] = React.useState<import('../types').MonsterTemplate | null>(null);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = React.useState(false);
  const [isSoundpadOpen, setIsSoundpadOpen] = React.useState(false);

  const [showOrderInName, setShowOrderInName] = React.useState(() =>
    localStorage.getItem('showOrderInName') === 'true'
  );

  const toggleOrderInName = (v: boolean) => {
    setShowOrderInName(v);
    localStorage.setItem('showOrderInName', String(v));
  };

  const [multiSelectMode, setMultiSelectMode] = React.useState(false);
  const [selectedCombatantIds, setSelectedCombatantIds] = React.useState<Set<string>>(new Set());
  const [isMultiTargetOpen, setIsMultiTargetOpen] = React.useState(false);
  const [showToolbarOverflow, setShowToolbarOverflow] = React.useState(false);
  const toolbarOverflowRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showToolbarOverflow) return;
    const handleClick = (e: MouseEvent) => {
      if (!toolbarOverflowRef.current?.contains(e.target as Node)) setShowToolbarOverflow(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showToolbarOverflow]);

  const toggleCombatantSelect = (id: string) => {
    setSelectedCombatantIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearMultiSelect = () => {
    setSelectedCombatantIds(new Set());
    setMultiSelectMode(false);
  };

  const ALL_INLINE_ACTIONS = ['companion', 'moveUp', 'moveDown', 'edit', 'conditions', 'damage', 'heal'] as const;
  type InlineAction = typeof ALL_INLINE_ACTIONS[number];

  const [visibleInlineActions, setVisibleInlineActions] = React.useState<Set<InlineAction>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('visibleInlineActions') ?? 'null');
      if (Array.isArray(saved)) return new Set(saved as InlineAction[]);
    } catch {}
    return new Set(ALL_INLINE_ACTIONS);
  });

  const toggleInlineAction = (action: InlineAction) => {
    setVisibleInlineActions(prev => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      localStorage.setItem('visibleInlineActions', JSON.stringify([...next]));
      return next;
    });
  };

  const combatLayout = React.useMemo(() => {
    const { mainSorted, companionsByOwner: companionMap, allSorted } = getCombatantLayout(combatants);
    return { mainSorted, companionMap, allSorted, mainIds: mainSorted.map(c => c.id) };
  }, [combatants]);

  return (
    <>
    <AnimatePresence mode="wait">
      {isPlayerView ? (
        <PlayerView
          combatants={combatants.filter(c => !c.hidden)}
          currentTurnIndex={currentTurnIndex}
          isEncounterActive={isEncounterActive}
          currentRound={currentRound}
          encounterName={encounterName}
          backgroundImage={activeBackground}
          backgroundOpacity={activeBackgroundOpacity}
          panelOpacity={activePanelOpacity}
          animationLevel={activeAnimationLevel}
          displayNames={displayNames}
          showOrderInName={showOrderInName}
          pendingConChecks={pendingConChecks}
        />

      ) : (
        <motion.div
          key="dm-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-4"
        >
          {activeTab === 'encounters' && !currentEncounterId && (
            <EncounterVault
              encounters={savedEncounters}
              players={players}
              onLoadEncounter={handleLoadEncounter}
              loadingEncounterId={loadingEncounterId}
              onNewEncounter={() => setIsEncounterCreatorOpen(true)}
              onUpdateEncounter={onUpdateEncounter}
              onDeleteEncounters={onDeleteEncounters}
              sounds={sounds}
              filter={encounterSubtab}
            />
          )}

          {activeTab === 'encounters' && currentEncounterId && (
            <>
            <div className="space-y-3">
              <div className={`flex items-center justify-between mb-3 gap-2 sm:gap-4 flex-wrap${isEncounterActive ? ' hidden md:flex' : ''}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setActiveTab('encounters'); handleNewEncounter(); }}
                    title="New Encounter"
                    className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('encounters')}
                    title="Back to Encounters"
                    className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl sm:text-3xl font-headline font-bold text-on-surface">{encounterName}</h2>
                  <button
                    onClick={() => window.open(`${window.location.origin}/player/${currentEncounterId}`, '_blank')}
                    className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <p className="text-outline text-sm">Round {currentRound}</p>
                </div>
                {combatants.some(c => c.hidden) && (
                  <div className="flex items-center gap-2 flex-wrap w-full order-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Hidden waves</span>
                    {Array.from(new Set(combatants.filter(c => c.hidden).map(c => c.waveId ?? 'default'))).map(waveId => (
                      <button key={waveId} onClick={async () => { await api.encounters.revealWave(currentEncounterId!, waveId); const refreshed = await api.encounters.get(currentEncounterId!); handleLoadEncounter(refreshed); }} className="rounded-md bg-amber-400/20 border border-amber-300/30 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-400/30">
                        Reveal {waveId}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap items-center">
                  {isEncounterActive && (
                    <>
                      <button
                        onClick={handlePrevTurn}
                        className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      <button
                        onClick={handleNextTurn}
                        className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!isEncounterActive && players.length > 0 && (
                    <button
                      onClick={handleAddAllPlayersToEncounter}
                      className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5"
                      title="Add all players to encounter"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Players
                    </button>
                  )}
                  {!isEncounterActive && (
                    <button
                      onClick={() => setIsInitiativeModalOpen(true)}
                      className="px-3 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5 shadow-lg shadow-primary/20"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  )}

                  {/* Overflow menu — secondary actions */}
                  <div className="relative" ref={toolbarOverflowRef}>
                    <button
                      onClick={() => setShowToolbarOverflow(v => !v)}
                      title="More actions"
                      className={`px-2.5 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1 ${
                        showToolbarOverflow
                          ? 'bg-surface-container-highest text-on-surface'
                          : 'bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface'
                      }`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {showToolbarOverflow && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] rounded-xl bg-surface-container-highest border border-outline-variant/15 shadow-2xl shadow-black/40 overflow-hidden py-1">
                        <button
                          onClick={() => { handleHealAll(); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-400 hover:bg-surface-container transition-colors text-left"
                        >
                          <Heart className="w-4 h-4 shrink-0" />
                          Heal All to Full
                        </button>
                        <button
                          onClick={() => { handleClearAllConditions(); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-surface-container transition-colors text-left"
                        >
                          <Sparkles className="w-4 h-4 shrink-0" />
                          Clear All Conditions
                        </button>
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <button
                          onClick={() => { handleAddAllPlayersToEncounter(); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                        >
                          <UserPlus className="w-4 h-4 shrink-0" />
                          Add All Players
                        </button>
                        <button
                          onClick={() => { setIsAddMonsterOpen(true); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          Add Monster
                        </button>
                        <button
                          onClick={() => { setIsEncounterCreatorOpen(true); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                        >
                          <Edit2 className="w-4 h-4 shrink-0" />
                          Edit Encounter
                        </button>
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <button
                          onClick={() => { window.open(`${window.location.origin}/player/${currentEncounterId}`, '_blank'); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-surface-container transition-colors text-left"
                        >
                          <Monitor className="w-4 h-4 shrink-0" />
                          Player View
                        </button>
                        <button
                          onClick={() => { setIsSoundpadOpen(true); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-pink-400 hover:bg-surface-container transition-colors text-left"
                        >
                          <Music className="w-4 h-4 shrink-0" />
                          Soundpad
                        </button>
                        <button
                          onClick={() => { onToggleLogToPlayers(); setShowToolbarOverflow(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-container transition-colors text-left ${showLogToPlayers ? 'text-primary' : 'text-on-surface'}`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${showLogToPlayers ? 'bg-primary border-primary' : 'border-outline/50'}`}>
                            {showLogToPlayers && <span className="text-[8px] font-black text-on-primary leading-none">✓</span>}
                          </div>
                          Log to Players
                        </button>
                        {isEncounterActive && (
                          <>
                            <div className="h-px bg-outline-variant/10 my-1" />
                            <button
                              onClick={() => { setIsInitiativeModalOpen(true); setShowToolbarOverflow(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                            >
                              <Users className="w-4 h-4 shrink-0" />
                              Re-roll Initiative
                            </button>
                          </>
                        )}
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <button
                          onClick={() => { setIsSaveEncounterModalOpen(true); setShowToolbarOverflow(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                        >
                          <Save className="w-4 h-4 shrink-0" />
                          Save Encounter
                        </button>
                      </div>
                    )}
                  </div>

                  {isEncounterActive && (
                    <button
                      onClick={() => setIsEndConfirmOpen(true)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-red-900/30"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      End
                    </button>
                  )}
                </div>
              </div>

              {dmNotes && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
                    onClick={() => {
                      const next = !dmNotesOpen;
                      setDmNotesOpen(next);
                      if (!next && currentEncounterId) {
                        localStorage.setItem(`dm-notes-dismissed-${currentEncounterId}`, '1');
                      }
                    }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/80">DM Notes</span>
                    <span className="text-outline text-xs">{dmNotesOpen ? '▲' : '▼'}</span>
                  </button>
                  {dmNotesOpen && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-amber-200/60 italic leading-relaxed">{dmNotes}</p>
                    </div>
                  )}
                </div>
              )}

              <TacticalSummary
                combatants={combatants}
                currentTurnIndex={currentTurnIndex}
                isEncounterActive={isEncounterActive}
                currentRound={currentRound}
              />

              {isEncounterActive && !activeRowVisible && (() => {
                const active = combatLayout.allSorted[currentTurnIndex];
                if (!active) return null;
                const hpPct = active.hp.max > 0 ? Math.max(0, Math.min(100, (active.hp.current / active.hp.max) * 100)) : 0;
                const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-error';
                return (
                  <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-2 bg-[#0f1419]/95 backdrop-blur border border-primary/30 rounded-xl shadow-lg mb-1">
                    <AvatarImg src={active.avatar} name={active.name} className="w-7 h-7 rounded-lg border border-primary/30 shrink-0 text-xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-on-surface truncate">{active.name}</span>
                        <span className="text-[10px] text-primary font-bold shrink-0">Active Turn</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-outline shrink-0">{active.hp.current}/{active.hp.max}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2 sm:gap-4 flex-wrap overflow-x-hidden">
                  {isEncounterActive && (handleUndo || handleRedo) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleUndo}
                        disabled={!canUndo}
                        title="Undo last HP change"
                        className="p-1.5 rounded-lg border border-outline/20 text-outline disabled:opacity-25 hover:text-on-surface hover:border-outline/40 transition-colors disabled:cursor-not-allowed"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={!canRedo}
                        title="Redo"
                        className="p-1.5 rounded-lg border border-outline/20 text-outline disabled:opacity-25 hover:text-on-surface hover:border-outline/40 transition-colors disabled:cursor-not-allowed"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const next = !multiSelectMode;
                      setMultiSelectMode(next);
                      if (!next) setSelectedCombatantIds(new Set());
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                      multiSelectMode
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'border-outline/20 text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="hidden sm:inline">Multi-select </span>{multiSelectMode && selectedCombatantIds.size > 0 && `(${selectedCombatantIds.size})`}
                  </button>
                  <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none group">
                    <span className="text-[10px] uppercase font-bold text-outline group-hover:text-on-surface transition-colors tracking-widest">Show # in name</span>
                    <div
                      onClick={() => toggleOrderInName(!showOrderInName)}
                      className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${showOrderInName ? 'bg-primary' : 'bg-surface-container-highest border border-outline/30'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showOrderInName ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="hidden sm:inline text-[10px] uppercase font-bold text-outline tracking-widest mr-1">Actions</span>
                    {([
                      { id: 'companion', icon: <UserPlus className="w-3.5 h-3.5" />, title: 'Companion' },
                      { id: 'moveUp',    icon: <ChevronLeft className="w-3.5 h-3.5 rotate-90" />, title: 'Move Up' },
                      { id: 'moveDown',  icon: <ChevronRight className="w-3.5 h-3.5 rotate-90" />, title: 'Move Down' },
                      { id: 'edit',       icon: <Edit2 className="w-3.5 h-3.5" />, title: 'Edit' },
                      { id: 'conditions', icon: <Sparkles className="w-3.5 h-3.5" />, title: 'Conditions' },
                      { id: 'damage',     icon: <Swords className="w-3.5 h-3.5" />, title: 'Damage' },
                      { id: 'heal',       icon: <Heart className="w-3.5 h-3.5" />, title: 'Heal' },
                    ] as { id: InlineAction; icon: React.ReactNode; title: string }[]).map(({ id, icon, title }) => (
                      <button
                        key={id}
                        onClick={() => toggleInlineAction(id)}
                        title={title}
                        className={`p-1.5 rounded-lg border transition-all ${visibleInlineActions.has(id) ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-surface-container-highest border-outline/20 text-outline/40'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const note = encounterNotes?.rounds.find(r => r.round === currentRound)?.text;
                  if (!isEncounterActive || !note?.trim()) return null;
                  const activeCombatantId = combatants[currentTurnIndex]?.id;
                  const tokens = onUseSpellFromLibrary
                    ? tokenizeNote(note, combatants, activeCombatantId)
                    : [{ type: 'text' as const, text: note }];
                  return (
                    <div className="mx-2 mb-2 px-3 py-1.5 rounded-lg bg-surface-container border border-outline/20 text-sm text-on-surface shrink-0 flex items-start gap-2">
                      <span className="text-outline/60 text-xs font-bold shrink-0 mt-0.5">R{currentRound}</span>
                      <span className="flex-1 text-xs leading-relaxed">
                        {tokens.map((tok, i) =>
                          tok.type === 'text' ? (
                            <span key={i} className="whitespace-pre-wrap">{tok.text}</span>
                          ) : (
                            <button
                              key={i}
                              onClick={() => onUseSpellFromLibrary!(tok.actor, tok.action)}
                              className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/15 border border-primary/25 text-primary font-bold hover:bg-primary/25 transition-colors leading-none align-baseline mx-0.5"
                              title={`${tok.actor.name}: ${tok.action.name}`}
                            >
                              {tok.text}
                            </button>
                          )
                        )}
                      </span>
                      <button
                        onClick={() => onSwitchSidebarToNotes?.()}
                        className="text-xs text-outline/50 hover:text-on-surface transition-colors shrink-0"
                      >
                        edit
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  const { mainSorted, companionMap, allSorted, mainIds } = combatLayout;
                  return (
                    <Reorder.Group
                      axis="y"
                      values={mainIds}
                      onReorder={handleReorderCombatants}
                      className="space-y-2"
                      as="div"
                    >
                      {mainSorted.map((combatant, index) => {
                        const companions = companionMap.get(combatant.id) ?? [];
                        const ownerIdx = allSorted.findIndex(c => c.id === combatant.id);
                        const anyActive = isEncounterActive && (
                          ownerIdx === currentTurnIndex ||
                          companions.some(cp => allSorted.findIndex(c => c.id === cp.id) === currentTurnIndex)
                        );
                        const isActive = isEncounterActive && ownerIdx === currentTurnIndex;
                        return (
                          <DraggableCombatantRow
                            key={combatant.id}
                            id={combatant.id}
                            activeRef={isActive ? activeRowCallbackRef : undefined}
                          >
                            {(dragControls) => (
                              <CombatantRow
                                combatant={combatant}
                                isActive={isActive}
                                queueIndex={index + 1}
                                onEdit={() => { setEditingCombatantId(combatant.id); setIsEditModalOpen(true); }}
                                onStatus={() => { setEditingCombatantId(combatant.id); setIsStatusModalOpen(true); }}
                                onQuickAction={(mode) => { setQuickActionMode(mode ?? 'damage'); setQuickActionCombatantId(combatant.id); setIsQuickActionModalOpen(true); }}
                                onUpdate={handleUpdateCombatant}
                                onMoveUp={() => handleMoveCombatant(combatant.id, 'up')}
                                onMoveDown={() => handleMoveCombatant(combatant.id, 'down')}
                                onSelect={() => setSelectedCombatantId(combatant.id)}
                                isPanelSelected={selectedCombatantId === combatant.id}
                                displayName={displayNames.get(combatant.id)}
                                showOrderInName={showOrderInName}
                                visibleInlineActions={visibleInlineActions}
                                addLogEntry={addLogEntry}
                                pendingConCheckDc={pendingConChecks?.[combatant.id]}
                                onConCheckDismiss={() => clearConCheck?.(combatant.id)}
                                onConCheckFail={() => {
                                  if (combatant.concentrationTargets) {
                                    for (const [targetId, appliedConditions] of Object.entries(combatant.concentrationTargets)) {
                                      const target = combatants.find(c => c.id === targetId);
                                      if (target && appliedConditions.length > 0) {
                                        handleUpdateCombatant({ ...target, conditions: target.conditions.filter(c => !appliedConditions.includes(c)) });
                                      }
                                    }
                                  }
                                  handleUpdateCombatant({ ...combatant, concentratingOn: undefined, concentrationTargets: undefined, conditions: combatant.conditions.filter(c => c !== 'concentrating') });
                                  clearConCheck?.(combatant.id);
                                }}
                                onConcentrationCheckTriggered={(dc) => triggerConCheck?.(combatant.id, dc)}
                                companions={companionMap.get(combatant.id)}
                                monsters={monsters}
                                onRevertPolymorph={handleRevertPolymorph}
                                onAddCompanion={handleAddCompanion && combatant.type === 'player' ? (t) => handleAddCompanion(combatant.id, t) : undefined}
                                onUpdateCompanion={handleUpdateCombatant}
                                onRemoveCompanion={handleDeleteCombatant}
                                onRemove={handleDeleteCombatant ? () => handleDeleteCombatant(combatant.id) : undefined}
                                onEditLibrary={combatant.type === 'monster' ? () => {
                                  const tpl = monsters.find(m => m.name.toLowerCase() === combatant.name.toLowerCase());
                                  if (tpl) setEncounterEditMonster(tpl);
                                } : undefined}
                                groupActive={anyActive}
                                multiSelectMode={multiSelectMode}
                                isSelected={selectedCombatantIds.has(combatant.id)}
                                onToggleSelect={() => toggleCombatantSelect(combatant.id)}
                                dragControls={dragControls}
                              />
                            )}
                          </DraggableCombatantRow>
                        );
                      })}
                    </Reorder.Group>
                  );
                })()}
              </div>
              {isEncounterActive && (
                <div className="sticky bottom-0 z-10 pt-2 pb-1">
                  <div className="flex items-center gap-2 p-1.5 bg-[#0d0f14]/95 backdrop-blur border border-white/8 rounded-2xl shadow-xl">
                    <button
                      onClick={handlePrevTurn}
                      className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface/70 hover:text-on-surface rounded-xl font-bold text-sm transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <button
                      onClick={() => setIsEndConfirmOpen(true)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-600/20 rounded-xl font-bold text-sm transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      End Combat
                    </button>
                    <button
                      onClick={handleNextTurn}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm transition-colors hover:brightness-110 shadow-lg shadow-primary/20"
                    >
                      Next Turn
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {showLog && combatLog && (
                <div className="mt-4 p-4 bg-surface-container-low rounded-2xl border border-white/5">
                  <h4 className="text-[10px] uppercase font-bold text-outline mb-3 tracking-widest">Combat Log</h4>
                  <CombatLog entries={combatLog} />
                </div>
              )}
            </div>
            {isAddMonsterOpen && (
              <AddMonsterDrawer
                monsters={monsters}
                onAdd={handleAddMonsterToEncounter}
                onClose={() => setIsAddMonsterOpen(false)}
              />
            )}
            <EditMonsterModal
              isOpen={!!encounterEditMonster}
              onClose={() => setEncounterEditMonster(null)}
              monster={encounterEditMonster}
              onSave={(updated) => {
                handleUpdateMonster(updated);
                combatants
                  .filter(c => c.type === 'monster' && c.name.toLowerCase() === updated.name.toLowerCase())
                  .forEach(c => handleUpdateCombatant({
                    ...c,
                    actions: updated.actions ?? [],
                    abilities: updated.abilities ?? [],
                    spells: updated.spells ?? [],
                    stats: { ...updated.stats },
                    ac: updated.ac,
                    speed: updated.speed,
                    subtitle: `${updated.type} · CR ${updated.cr}`,
                  }));
                setEncounterEditMonster(null);
              }}
              spellLibrary={spells}
            />
            <AoEActionBar
              selectedCombatants={combatants.filter(c => selectedCombatantIds.has(c.id))}
              onApply={updates => { updates.forEach(u => handleUpdateCombatant(u)); clearMultiSelect(); }}
              onApplyKeepSelection={updates => { updates.forEach(u => handleUpdateCombatant(u)); }}
              onClear={clearMultiSelect}
              onPerTarget={() => setIsMultiTargetOpen(true)}
            />
            <MultiTargetDamageModal
              isOpen={isMultiTargetOpen}
              onClose={() => setIsMultiTargetOpen(false)}
              combatants={combatants.filter(c => selectedCombatantIds.has(c.id))}
              onApply={updates => { updates.forEach(u => handleUpdateCombatant(u)); clearMultiSelect(); setIsMultiTargetOpen(false); }}
            />
            </>
          )}

          {activeTab === 'monsters' && (
            <MonsterLibrary
              monsters={monsters}
              players={players}
              spells={spells}
              classFeatures={classFeatures}
              onAddToEncounter={handleAddMonsterToEncounter}
              onAddPlayer={handleAddPlayerToEncounter}
              onEdit={(id) => { setEditingMonsterId(id); setIsMonsterEditModalOpen(true); }}
              onCopy={handleCopyMonster}
              onDelete={handleDeleteMonster}
              onDeleteAll={handleDeleteAllMonsters}
              onRemovePlayer={handleRemovePlayer}
              onUpdatePlayer={onUpdatePlayer}
              isSaving={isSaving}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              isEncounterActive={isEncounterActive}
              currentEncounterId={currentEncounterId}
              encounterName={encounterName}
              currentRound={currentRound}
              combatants={combatants}
              savedEncounters={savedEncounters}
              monsters={monsters}
              players={players}
              spells={spells}
              campaigns={campaigns}
              setActiveTab={setActiveTab}
              setIsEncounterCreatorOpen={setIsEncounterCreatorOpen}
              onSelectCampaign={onSelectCampaign}
              handleLoadEncounter={handleLoadEncounter}
            />
          )}


          {activeTab === 'spells' && (
            <SpellsScreen
              spells={spells}
              combatants={combatants}
              onUseSpell={onUseSpellFromLibrary}
            />
          )}

          {activeTab === 'abilities' && (
            <AbilitiesScreen features={classFeatures ?? []} />
          )}


          {/* Soundpad floating panel */}
          <DraggableSoundpad
            isOpen={isSoundpadOpen}
            onClose={() => setIsSoundpadOpen(false)}
            sounds={sounds}
            spells={spells}
            onAddSound={onAddSound}
            onUpdateSound={onUpdateSound}
            onDeleteSound={onDeleteSound}
            onRefreshSounds={onRefreshSounds}
            soundPlayingIds={soundPlayingIds}
            soundLiveSettings={soundLiveSettings}
            onTogglePlay={onTogglePlay}
            onStopAllSounds={onStopAllSounds}
            onPatchLive={onPatchLive}
            onSetVolume={onSetVolume}
            masterVolume={masterVolume}
            setMasterVolume={setMasterVolume}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
          />

          <div 
            className={
              activeTab === 'soundboard'
                ? "block"
                : "hidden"
            }
          >
            <div className="overflow-y-auto custom-scrollbar">
              <SoundboardScreen
                sounds={sounds ?? []}
                spells={spells}
                onAdd={onAddSound ?? (async () => {})}
                onUpdate={onUpdateSound ?? (async () => {})}
                onDelete={onDeleteSound ?? (async () => {})}
                onRefresh={onRefreshSounds ?? (async () => {})}
                playingIds={soundPlayingIds ?? new Set()}
                liveSettings={soundLiveSettings ?? {}}
                onTogglePlay={onTogglePlay ?? (() => {})}
                onStopAll={onStopAllSounds ?? (() => {})}
                onPatchLive={onPatchLive ?? (() => {})}
                onSetVolume={onSetVolume ?? (() => {})}
                masterVolume={masterVolume}
                isMuted={isMuted}
                onMasterVolumeChange={setMasterVolume}
                onMuteToggle={setIsMuted}
              />
            </div>
          </div>

          {activeTab === 'import' && (
            <ImportScreen
              onImportMonsters={handleImportMonsters}
              onImportSpells={handleImportSpells}
              onImportEncounters={handleImportEncounters}
              onImportScene={onImportScene}
              currentEncounterId={currentEncounterId}
              onCancel={() => setActiveTab('encounters')}
              players={players}
              onImportPlayer={onImportPlayer}
              onCreatePlayer={onCreatePlayer}
              onUpdatePlayer={onUpdatePlayer}
              onRemovePlayer={onRemovePlayer}
              monsters={monsters}
              classFeatures={classFeatures ?? []}
              onImportEncountersFromAdventure={handleImportEncounters}
              onImportAdventureAsCampaign={onImportAdventureAsCampaign}
              onImportClassFeatures={onImportClassFeatures}
              existingEncounters={savedEncounters}
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 p-4">
              <h2 className="text-2xl font-headline font-bold text-on-surface tracking-tight">Settings</h2>
              {currentUser && onLogout && (
                <UsersSettings currentUser={currentUser} onLogout={onLogout} />
              )}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <HueSettingsPanel
                  enabled={hueEnabled ?? false}
                  onToggleEnabled={onToggleHue ?? (() => {})}
                  syncSceneColorEnabled={hueSyncScene ?? false}
                  onToggleSyncScene={onToggleHueSyncScene ?? (() => {})}
                  enabledEffects={hueEnabledEffects ?? {}}
                  onToggleEffect={onToggleHueEffect ?? (() => {})}
                  effectTargets={hueEffectTargets ?? {}}
                  onToggleTarget={onToggleHueTarget ?? (() => {})}
                />
                <HomeAssistantSettingsPanel enabled={haEnabled ?? false} onToggleEnabled={onToggleHa ?? (() => {})} />
              </div>
              <SpatialSettingsPanel
                audioCtx={getAudioCtx ? getAudioCtx() : null}
                spatialMode={spatialMode ?? 'stereo'}
              />
              <ResetDbPanel />
            </div>
          )}

          {activeTab === 'campaigns' && !activeCampaignId && (
            <CampaignView
              campaigns={campaigns ?? []}
              players={players}
              isEncounterActive={isEncounterActive}
              currentEncounterName={encounterName}
              currentEncounterId={currentEncounterId}
              onSelectCampaign={onSelectCampaign ?? (() => {})}
              onCreateCampaign={onCreateCampaign ?? (async () => {})}
              onUpdateCampaign={onUpdateCampaign ?? (async () => {})}
              onDeleteCampaign={onDeleteCampaign ?? (async () => {})}
            />
          )}

          {activeTab === 'campaigns' && !!activeCampaignId && (
            <SessionView
              campaign={(campaigns ?? []).find(c => c.id === activeCampaignId)!}
              sessions={sessions ?? []}
              players={players}
              allEncounters={savedEncounters}
              isEncounterActive={isEncounterActive}
              currentEncounterName={encounterName}
              onBack={onBackToCampaigns ?? (() => {})}
              onCreateSession={onCreateSession ?? (async () => {})}
              onDeleteSession={onDeleteSession ?? (async () => {})}
              onUpdateSession={onUpdateSession ?? (async () => {})}
              onUpdateCampaign={onUpdateCampaign ?? (async () => {})}
              onAssignEncounter={onAssignEncounter ?? (async () => {})}
              onLoadSessions={onLoadSessions ?? (async () => {})}
              onOpenEncounter={onOpenEncounter ?? (() => {})}
              onUpdateEncounter={onUpdateEncounter ?? (async () => {})}
              sounds={sounds ?? []}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isEndConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEndConfirmOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm bg-surface-container rounded-2xl border border-red-500/20 p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-headline font-bold text-on-surface">End Encounter?</h2>
                <p className="text-sm text-outline mt-1">This will reset the turn order and rounds.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsEndConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-outline font-bold text-sm hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setIsEndConfirmOpen(false); handleEndEncounter(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-red-900/30"
              >
                End Encounter
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    </>
  );
};
