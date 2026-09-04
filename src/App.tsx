import React from 'react';
import { Menu, ChevronRight, UserPlus, Users, Settings, Keyboard, Undo2, Redo2, LayoutDashboard, Swords, Shield, Music, MoreHorizontal } from 'lucide-react';
import { Routes, Route, Navigate, useParams, NavLink } from 'react-router-dom';
import { CONDITIONS, INITIATIVE_COLORS } from './constants';
import { cn, uuid } from './lib/utils';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';

// Components
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EncounterSummary } from './components/EncounterSummary';
import { EncounterCreator } from './components/EncounterCreator';

// Modals
import { MobileNav } from './components/MobileNav';
import { RightSidebar } from './components/RightSidebar';
import { MainContent } from './components/MainContent';
import { PlayerView } from './components/PlayerView';
import { ModalsContainer } from './components/ModalsContainer';
import { ActionExecutionModal } from './components/ActionExecutionModal';
import { WhatsNewModal, hasSeenWhatsNew } from './components/WhatsNewModal';
import { AddEnemyModal } from './components/AddEnemyModal';
import { SessionStatsModal } from './components/SessionStatsModal';
import { HelpModal } from './components/HelpModal';
import { CommandPalette } from './components/CommandPalette';
import { useAppState } from './hooks/useAppState';
import { useSoundboard } from './hooks/useSoundboard';
import { getDisplayNames } from './lib/combatantUtils';
import { useHueEffects } from './hooks/useHueEffects';
import { HueEffectName, HueEffectTargets } from './lib/hueEffects';
import { Combatant, Encounter, Player, EncounterNotes } from './types';
import { api } from './api/client';
import { playerToCombatant } from './hooks/useEncounterManagement';
import { SessionBoard } from './components/SessionBoard';
import { FloatingMusicPlayer } from './components/FloatingMusicPlayer';
import { useLocalState } from './hooks/useLocalState';
import { useRouterSync } from './hooks/useRouterSync';
import { useActionExecution } from './hooks/useActionExecution';
import type { SessionBoardHandle } from './components/SessionBoard';

const HOTKEYS = [
  { key: 'Space',   label: 'Next Turn' },
  { key: '⇧ Space', label: 'Prev Turn' },
  { key: 'D',       label: 'Damage' },
  { key: 'H',       label: 'Heal' },
  { key: 'T',       label: 'Temp HP' },
  { key: 'C',       label: 'Condition' },
  { key: '⌘Z',      label: 'Undo' },
  { key: '⌘⇧Z',     label: 'Redo' },
];

export default function App() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const [encounterSubtab, setEncounterSubtab] = React.useState<'saved' | 'recent'>('saved');

  const {
    activeTab, setActiveTab,
    selectedCombatantId, setSelectedCombatantId,
    combatants, setCombatants,
    monsters, setMonsters,
    spells, setSpells,
    savedEncounters, setSavedEncounters,
    encounterName, setEncounterName,
    currentEncounterId, setCurrentEncounterId,
    isPlayerView, setIsPlayerView,
    isInitiativeModalOpen, setIsInitiativeModalOpen,
    currentRound, setCurrentRound,
    currentTurnIndex, setCurrentTurnIndex,
    isEncounterActive, setIsEncounterActive,
    isEditModalOpen, setIsEditModalOpen,
    isStatusModalOpen, setIsStatusModalOpen,
    isQuickActionModalOpen, setIsQuickActionModalOpen,
    isMonsterEditModalOpen, setIsMonsterEditModalOpen,
    isSaveEncounterModalOpen, setIsSaveEncounterModalOpen,
    isEncounterCreatorOpen, setIsEncounterCreatorOpen,
    isSidebarCollapsed, setIsSidebarCollapsed,
    showSummary, setShowSummary,
    navigate, location,
    editingCombatantId, setEditingCombatantId,
    quickActionCombatantId, setQuickActionCombatantId,
    quickActionMode, setQuickActionMode,
    editingMonsterId, setEditingMonsterId,
    isDbAvailable, setIsDbAvailable,
    encounterStats,
    socketRef,
    selectedCombatant,
    activeCombatant,
    editingCombatant,
    quickActionCombatant,
    editingMonster,
    handleDeleteCombatant,
    handleUpdateCombatant,
    handlePolymorph,
    handleRevertPolymorph,
    handleAddCompanion,
    handleNextTurn,
    handlePrevTurn,
    handleMoveCombatant,
    handleReorderCombatants,
    handleFinishInitiative,
    handleEndEncounter,
    handleCloseSummary,
    handleUpdateMonster,
    handleCopyMonster,
    handleAddMonsterToEncounter,
    handleAddPlayerToEncounter,
    handleAddAllPlayersToEncounter,
    handleHealAll,
    handleSaveEncounter,
    handleImportEncounters,
    handleImportMonsters,
    handleImportSpells,
    handleLoadEncounter,
    handleSimulateEncounter,
    handleNewEncounter,
    handleDeleteEncounters,
    handleUpdateEncounter,
    handleDeleteMonster,
    handleDeleteAllMonsters,
    players,
    handleImportPlayer,
    handleCreatePlayer,
    handleUpdatePlayer,
    handleUpdateSpellSlot,
    handleUpdateFeatureUse,
    handleRest,
    handleRemovePlayer,
    activeBackground,
    activeYoutubeUrl,
    activeBackgroundOpacity,
    activePanelOpacity,
    activeSoundIds,
    activeAnimationLevel,
    addLogEntry,
    combatLog,
    pendingConChecks,
    triggerConCheck,
    clearConCheck,
    campaigns,
    activeCampaignId, setActiveCampaignId,
    sessions,
    handleCreateCampaign,
    handleUpdateCampaign,
    handleDeleteCampaign,
    handleLoadSessions,
    handleCreateSession,
    handleDeleteSession,
    handleUpdateSession,
    handleAssignEncounterToSession,
    classFeatures,
    handleImportClassFeatures,
    fetchData,
    fetchEncounterData,
    loadingEncounterId,
    isSaving,
    playerLog,
    playerLogVisible,
    syncPlayerLog,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    masterVolume, setMasterVolume,
    isMuted, setIsMuted,
  } = useAppState();

  const [encounterNotes, setEncounterNotes] = React.useState<EncounterNotes>({ general: '', rounds: [] });
  const [sidebarView, setSidebarView] = React.useState<'details' | 'notes'>('details');
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = React.useState(false);
  const notesDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showLog, setShowLog] = React.useState(false);
  const [showLogToPlayers, setShowLogToPlayers] = React.useState(false);
  const [showWhatsNew, setShowWhatsNew] = React.useState(() => !hasSeenWhatsNew());
  const [showSessionStats, setShowSessionStats] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isAddEnemyModalOpen, setIsAddEnemyModalOpen] = React.useState(false);
  const sessionBoardRef = React.useRef<SessionBoardHandle | null>(null);
  const { actionModal, openActionModal, closeActionModal, handleActionApply } = useActionExecution({
    combatants,
    spells,
    handleUpdateCombatant,
    handleUpdateSpellSlot,
    triggerConCheck,
    addLogEntry,
  });

  React.useEffect(() => {
    syncPlayerLog(showLogToPlayers, showLogToPlayers ? combatLog : []);
  }, [showLogToPlayers, combatLog, syncPlayerLog]);

  React.useEffect(() => {
    const onCmdK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onCmdK);
    return () => window.removeEventListener('keydown', onCmdK);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isEncounterActive || isPlayerView) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;
      const anyModalOpen = isEditModalOpen || isStatusModalOpen || isQuickActionModalOpen || isMonsterEditModalOpen || isSaveEncounterModalOpen || isEncounterCreatorOpen || isInitiativeModalOpen || isCommandPaletteOpen || actionModal !== null || showSummary;
      if (anyModalOpen) return;
      if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); handleNextTurn(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevTurn(); }
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleUndo?.(); }
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); handleRedo?.(); }
      else if (e.key === 'd' || e.key === 'D') {
        if (!activeCombatant) return;
        setQuickActionCombatantId(activeCombatant.id);
        setQuickActionMode('damage');
        setIsQuickActionModalOpen(true);
      } else if (e.key === 'h' || e.key === 'H') {
        if (!activeCombatant) return;
        setQuickActionCombatantId(activeCombatant.id);
        setQuickActionMode('heal');
        setIsQuickActionModalOpen(true);
      } else if (e.key === 't' || e.key === 'T') {
        if (!activeCombatant) return;
        setQuickActionCombatantId(activeCombatant.id);
        setQuickActionMode('tempHp');
        setIsQuickActionModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEncounterActive, isPlayerView, isEditModalOpen, isStatusModalOpen, isQuickActionModalOpen, isMonsterEditModalOpen, isSaveEncounterModalOpen, isEncounterCreatorOpen, isInitiativeModalOpen, isCommandPaletteOpen, actionModal, showSummary, handleNextTurn, handlePrevTurn, handleUndo, handleRedo, activeCombatant, setQuickActionCombatantId, setQuickActionMode, setIsQuickActionModalOpen]);

  const [sounds, setSounds] = React.useState<import('./types').Sound[]>([]);

  const {
    playingIds: activePlayingIds,
    liveSettings: activeLiveSettings,
    togglePlay: handleTogglePlay,
    stopAll: handleStopAllSounds,
    patchLive: handlePatchLive,
    setVolume: handleSetVolume,
    getAudioCtx,
    spatialMode,
    audioRefs,
  } = useSoundboard(masterVolume, isMuted);

  React.useEffect(() => {
    if (user) {
      fetchData();
      api.sounds.list().then(d => setSounds(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [user]);

  // Auto-play sounds when encounter loads
  React.useEffect(() => {
    if (!activeSoundIds.length || !sounds.length) return;
    activeSoundIds.forEach(id => {
      const sound = sounds.find(s => s.id === id);
      if (sound && !activePlayingIds.has(id)) {
        handleTogglePlay(sound);
      }
    });
  }, [activeSoundIds, sounds, handleTogglePlay, activePlayingIds]);

  const handleAddSound = React.useCallback(async (data: FormData) => {
    await api.sounds.upload(data);
    const fresh = await api.sounds.list();
    setSounds(Array.isArray(fresh) ? fresh : []);
  }, []);

  const handleUpdateSound = React.useCallback(async (id: string, patch: any) => {
    await api.sounds.update(id, patch);
    setSounds(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const handleDeleteSound = React.useCallback(async (id: string) => {
    await api.sounds.delete(id);
    setSounds(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleRefreshSounds = React.useCallback(async () => {
    const fresh = await api.sounds.list();
    setSounds(Array.isArray(fresh) ? fresh : []);
  }, []);

  const [theme, setTheme] = React.useState<'dark' | 'pink'>(() =>
    (localStorage.getItem('appTheme') as 'dark' | 'pink') ?? 'dark'
  );
  React.useEffect(() => {
    if (theme === 'pink') {
      document.documentElement.classList.add('theme-pink');
    } else {
      document.documentElement.classList.remove('theme-pink');
    }
    localStorage.setItem('appTheme', theme);
  }, [theme]);
  const toggleTheme = React.useCallback(() =>
    setTheme(t => t === 'dark' ? 'pink' : 'dark'), []);

  const [hueEnabled, setHueEnabled] = React.useState(() => localStorage.getItem('hueEnabled') === 'true');
  const [hueSyncScene, setHueSyncScene] = React.useState(() => localStorage.getItem('hueSyncScene') === 'true');
  const [hueEnabledEffects, setHueEnabledEffects] = useLocalState<Partial<Record<HueEffectName, boolean>>>('hueEnabledEffects', {});
  const [hueEffectTargets, setHueEffectTargets] = useLocalState<Partial<Record<HueEffectName, HueEffectTargets>>>('hueEffectTargets', {});

  const handleSelectCampaign = React.useCallback((id: string) => {
    navigate(`/campaigns/${id}`);
  }, [navigate]);

  const handleImportAdventureAsCampaign = React.useCallback(async (
    name: string,
    description: string,
    chapters: Array<{ name: string; encounters: import('./types').Encounter[] }>
  ) => {
    const campaign = await handleCreateCampaign(name, description);
    if (!campaign) return;
    for (const chapter of chapters) {
      const session = await handleCreateSession(campaign.id, chapter.name, '', '');
      if (!session) continue;
      for (const encounter of chapter.encounters) {
        const id = encounter.id || uuid();
        await api.encounters.create({ id, name: encounter.name, currentRound: 1, isEncounterActive: false, backgroundImage: '', youtubeUrl: '', folder: '', sessionId: session.id });
        const existingNames = new Set((encounter.combatants ?? []).map((c: Combatant) => c.name.toLowerCase()));
        const playerCombatants = players
          .filter(p => !existingNames.has(p.name.toLowerCase()))
          .map(playerToCombatant);
        const allCombatants = [...(encounter.combatants ?? []), ...playerCombatants];
        if (allCombatants.length) {
          await Promise.all(allCombatants.map(c =>
            api.combatants.create({ ...c, encounterId: id })
          ));
        }
      }
    }
    navigate(`/campaigns/${campaign.id}`);
  }, [handleCreateCampaign, handleCreateSession, players, navigate]);

  const handleBackToCampaigns = React.useCallback(() => {
    navigate('/campaigns');
  }, [navigate]);

  const handleOpenEncounter = React.useCallback((enc: Encounter) => {
    navigate(`/encounters/${enc.id}`);
  }, [navigate]);

  const handleToggleHue = (v: boolean) => { setHueEnabled(v); localStorage.setItem('hueEnabled', String(v)); };
  const handleToggleHueEffect = (name: HueEffectName, v: boolean) => {
    setHueEnabledEffects(prev => ({ ...prev, [name]: v }));
  };
  const handleToggleHueTarget = (name: HueEffectName, target: 'players' | 'monsters', v: boolean) => {
    setHueEffectTargets(prev => {
      const current = prev[name] ?? { players: true, monsters: true };
      const next = { ...prev, [name]: { ...current, [target]: v } };
      return next;
    });
  };

  useHueEffects(combatLog, { 
    enabled: hueEnabled, 
    enabledEffects: hueEnabledEffects, 
    effectTargets: hueEffectTargets, 
    combatants, 
    spells,
    syncSceneColor: hueSyncScene,
    backgroundImage: activeBackground
  });

  const extractYoutubeId = (url: string): string | null => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const youtubeId = activeYoutubeUrl ? extractYoutubeId(activeYoutubeUrl) : null;
  const [isMusicPaused, setIsMusicPaused] = React.useState(false);
  React.useEffect(() => { setIsMusicPaused(false); }, [youtubeId]);

  const currentEncounter = savedEncounters.find(e => e.id === currentEncounterId);

  React.useEffect(() => {
    setEncounterNotes(currentEncounter?.notes ?? { general: '', rounds: [] });
  }, [currentEncounterId]);

  const handleUpdateNotes = React.useCallback((notes: EncounterNotes) => {
    setEncounterNotes(notes);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      if (!currentEncounterId || !isDbAvailable) return;
      api.encounters.update(currentEncounterId, { notes }).catch(console.error);
    }, 400);
  }, [currentEncounterId, isDbAvailable]);

  const sortedCombatants = React.useMemo(() =>
    [...combatants].sort((a, b) => b.initiative - a.initiative), [combatants]);
  const displayNames = React.useMemo(() =>
    getDisplayNames(sortedCombatants), [sortedCombatants]);
  const activeConditions = React.useMemo(() =>
    Array.from(new Set(combatants.flatMap(c => c.conditions)))
      .map(id => CONDITIONS.find(cond => cond.id === id))
      .filter(Boolean), [combatants]);

  const handleClearAllConditions = React.useCallback(() => {
    combatants.forEach(c => {
      if (c.conditions.length > 0) {
        handleUpdateCombatant({ ...c, conditions: [], conditionTimers: {} });
      }
    });
  }, [combatants, handleUpdateCombatant]);

  const handleImportScene = React.useCallback((scene: { name: string; backgroundImg: string }) => {
    if (!currentEncounterId) return;
    api.encounters.update(currentEncounterId, { name: scene.name, backgroundImage: scene.backgroundImg } as any)
      .then(() => fetchEncounterData(currentEncounterId))
      .catch(console.error);
  }, [currentEncounterId, fetchEncounterData]);

  const getInitiativeColor = (initiative: number) => {
    const idx = Math.min(Math.max(Math.floor(initiative), 1), 20) - 1;
    return INITIATIVE_COLORS[idx];
  };

  useRouterSync({
    setCurrentEncounterId,
    setActiveCampaignId,
    setIsPlayerView,
    handleLoadEncounter,
    fetchEncounterData,
    savedEncounters,
    currentEncounterId,
  });

  if (authLoading) return <div className="min-h-screen bg-surface flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /></div>;
  if (!user) return <LoginScreen onLogin={login} />;

  const mainContentProps = {
    isPlayerView,
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
    onSimulateEncounter: handleSimulateEncounter,
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
    handleImportEncounters,
    handleImportMonsters,
    handleImportSpells,
    players,
    onImportPlayer: handleImportPlayer,
    onCreatePlayer: handleCreatePlayer,
    onUpdatePlayer: handleUpdatePlayer,
    onRemovePlayer: handleRemovePlayer,
    setActiveTab,
    setIsPlayerView,
    activeBackground,
    activeBackgroundOpacity,
    activePanelOpacity,
    activeAnimationLevel,
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
    displayNames,
    addLogEntry,
    combatLog,
    showLog,
    showLogToPlayers,
    onToggleLogToPlayers: () => setShowLogToPlayers((v: boolean) => !v),
    pendingConChecks,
    triggerConCheck,
    clearConCheck,
    hueEnabled,
    hueSyncScene,
    hueEnabledEffects,
    hueEffectTargets,
    onToggleHue: handleToggleHue,
    onToggleHueSyncScene: (v: boolean) => { setHueSyncScene(v); localStorage.setItem('hueSyncScene', String(v)); },
    onToggleHueEffect: handleToggleHueEffect,
    onToggleHueTarget: handleToggleHueTarget,
    campaigns,
    activeCampaignId,
    sessions,
    onSelectCampaign: handleSelectCampaign,
    onBackToCampaigns: handleBackToCampaigns,
    onCreateCampaign: async (name: string, desc: string, mapImage?: string) => { await handleCreateCampaign(name, desc, mapImage); },
    onUpdateCampaign: handleUpdateCampaign,
    onDeleteCampaign: handleDeleteCampaign,
    onCreateSession: async (name: string, date: string, notes: string) => { await handleCreateSession(activeCampaignId!, name, date, notes); },
    onDeleteSession: handleDeleteSession,
    onUpdateSession: handleUpdateSession,
    onAssignEncounter: handleAssignEncounterToSession,
    onLoadSessions: handleLoadSessions,
    onOpenEncounter: handleOpenEncounter,
    onDeleteEncounters: handleDeleteEncounters,
    onUpdateEncounter: handleUpdateEncounter,
    onImportAdventureAsCampaign: handleImportAdventureAsCampaign,
    onUseSpellFromLibrary: (actor: Combatant, action: import('./types').MonsterAction) => openActionModal(action, actor),
    classFeatures,
    handleImportClassFeatures,
    currentUser: user,
    onLogout: logout,
    sounds,
    onAddSound: handleAddSound,
    onUpdateSound: handleUpdateSound,
    onDeleteSound: handleDeleteSound,
    onRefreshSounds: handleRefreshSounds,
    soundPlayingIds: activePlayingIds,
    soundLiveSettings: activeLiveSettings,
    onTogglePlay: handleTogglePlay,
    onStopAllSounds: handleStopAllSounds,
    onPatchLive: handlePatchLive,
    onSetVolume: handleSetVolume,
    masterVolume,
    setMasterVolume,
    isMuted,
    setIsMuted,
    getAudioCtx,
    spatialMode,
    loadingEncounterId,
    isSaving,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    onImportScene: handleImportScene,
    encounterNotes,
    onSwitchSidebarToNotes: () => setSidebarView('notes'),
  };

  return (
    <AppShell
      sidebar={<>
      {/* Sidebar */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        isPlayerView={isPlayerView}
        currentEncounterId={currentEncounterId}
        isEncounterActive={isEncounterActive}
        encounterName={encounterName}
        encounterSubtab={encounterSubtab}
        setEncounterSubtab={setEncounterSubtab}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        setIsPlayerView={setIsPlayerView}
        setCombatants={setCombatants}
        setIsEncounterActive={setIsEncounterActive}
        setCurrentRound={setCurrentRound}
        setCurrentEncounterId={setCurrentEncounterId}
        setEncounterName={setEncounterName}
        setIsEncounterCreatorOpen={setIsEncounterCreatorOpen}
        handleEndEncounter={handleEndEncounter}
        onToggleLog={() => setShowLog(v => !v)}
        onShowWhatsNew={() => setShowWhatsNew(true)}
        onShowSessionStats={() => setShowSessionStats(true)}
        onShowHelp={() => setShowHelp(true)}
        showLog={showLog}
        theme={theme}
        onToggleTheme={toggleTheme}
        youtubeId={youtubeId}
        youtubeUrl={activeYoutubeUrl}
        isMusicPaused={isMusicPaused}
        onToggleMusic={() => setIsMusicPaused(v => !v)}
      />
      </>}
      main={<>

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-h-screen flex flex-col bg-[#0A0C12] theme-pink:bg-background transition-all duration-300 ease-in-out relative overflow-hidden",
        !isPlayerView && (isEncounterActive ? "md:ml-16" : (isSidebarCollapsed ? "md:ml-16" : "md:ml-56"))
      )}>
        {/* Combat Focus Header — shown only during active combat */}
        {isEncounterActive && !isPlayerView && (
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#05070A]/95 backdrop-blur-sm border-b border-white/5 shrink-0">
            <button
              onClick={() => navigate('/encounters')}
              className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors shrink-0"
              title="Back to encounters"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => navigate('/encounters')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/25 rounded-lg shrink-0 hover:bg-amber-500/25 transition-colors"
                title="Go to active encounter"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest truncate max-w-[120px]">
                  ⚔ {encounterName}
                </span>
                <span className="text-[9px] text-amber-300/70 shrink-0">· R{currentRound}</span>
              </button>
              {sortedCombatants.length > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {sortedCombatants.map((c, i) => (
                    <div
                      key={c.id}
                      title={c.name}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        i === currentTurnIndex
                          ? "w-2.5 h-2.5 bg-primary shadow-[0_0_6px_rgba(173,198,255,0.8)]"
                          : i < currentTurnIndex
                          ? "w-1.5 h-1.5 bg-white/20"
                          : "w-1.5 h-1.5 bg-white/10"
                      )}
                    />
                  ))}
                </div>
              )}
              <span className="text-sm font-headline font-bold text-on-surface truncate">
                {activeCombatant?.name ?? encounterName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="p-2 rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-outline hover:text-on-surface hover:bg-white/5"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="p-2 rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-outline hover:text-on-surface hover:bg-white/5"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              {/* Session Board quick-open */}
              <button
                onClick={() => sessionBoardRef.current?.open()}
                className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
                title="Session Board (Ctrl+Shift+B)"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Keyboard shortcuts — hover to reveal */}
              <div className="relative group">
                <button className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors" title="Keyboard shortcuts">
                  <Keyboard className="w-4 h-4" />
                </button>
                <div className="absolute top-full right-0 mt-1 bg-black/80 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 space-y-1 shadow-lg z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {HOTKEYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <kbd className="text-[10px] font-mono font-bold text-white/80 bg-white/15 border border-white/30 rounded px-1.5 py-0.5 leading-none min-w-[40px] text-center">{key}</kbd>
                      <span className="text-[10px] text-white/70 font-medium whitespace-nowrap">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsMobileRightPanelOpen(v => !v)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-sm transition-colors border border-white/8"
                title="Details panel"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAddEnemyModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-sm transition-colors border border-white/8"
                title="Add enemy to encounter"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
              <button
                onClick={handleNextTurn}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-on-primary rounded-xl font-bold text-sm transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Background Image */}
        {activeBackground && currentEncounterId && (
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-1000 z-0"
            style={{ 
              backgroundImage: `url(${activeBackground})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center', 
              opacity: activeBackgroundOpacity 
            }}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          <div className={cn(
            "flex-1 overflow-y-auto custom-scrollbar",
            isEncounterActive ? "p-2 pb-24 md:pb-20" : "p-3 md:p-12 pb-24 md:pb-12"
          )}>
            <ErrorBoundary label="Main Content">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<MainContent {...mainContentProps} activeTab="dashboard" />} />
                <Route path="/encounters" element={<MainContent {...mainContentProps} activeTab="encounters" />} />
                <Route path="/encounters/:id" element={<MainContent {...mainContentProps} activeTab="encounters" />} />
                <Route path="/campaigns" element={<MainContent {...mainContentProps} activeTab="campaigns" />} />
                <Route path="/campaigns/:id" element={<MainContent {...mainContentProps} activeTab="campaigns" />} />
                <Route path="/monsters" element={<MainContent {...mainContentProps} activeTab="monsters" />} />
                <Route path="/spells" element={<MainContent {...mainContentProps} activeTab="spells" />} />
                <Route path="/abilities" element={<MainContent {...mainContentProps} activeTab="abilities" />} />
                <Route path="/soundboard" element={<MainContent {...mainContentProps} activeTab="soundboard" />} />
                <Route path="/import" element={<MainContent {...mainContentProps} activeTab="import" />} />
                <Route path="/settings" element={<MainContent {...mainContentProps} activeTab="settings" />} />
                <Route path="/player/:id" element={
                  <PlayerView
                    combatants={combatants}
                    currentTurnIndex={currentTurnIndex}
                    isEncounterActive={isEncounterActive}
                    currentRound={currentRound}
                    encounterName={encounterName}
                    backgroundImage={activeBackground}
                    backgroundOpacity={activeBackgroundOpacity}
                    panelOpacity={activePanelOpacity}
                    animationLevel={activeAnimationLevel}
                    displayNames={displayNames}
                    showOrderInName={localStorage.getItem('showOrderInName') === 'true'}
                    pendingConChecks={pendingConChecks}
                    combatLog={playerLogVisible ? playerLog : undefined}
                  />
                } />
              </Routes>
            </ErrorBoundary>
          </div>
        </div>

        {/* Encounter Summary — full-page, inside main so sidebar stays visible */}
        {showSummary && !isPlayerView && (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0f1419]">
            <EncounterSummary
              encounterName={encounterName}
              combatants={combatants}
              stats={encounterStats}
              onClose={handleCloseSummary}
              isDM={!isPlayerView}
              activeCampaignId={activeCampaignId}
              sessions={sessions}
              onCreateSession={async (name, date, notes) => { if (activeCampaignId) return await handleCreateSession(activeCampaignId, name, date, notes); return null; }}
              onAssignEncounter={handleAssignEncounterToSession}
              currentEncounterId={currentEncounterId}
            />
          </div>
        )}

        {/* Encounter Creator — renders inside main so sidebar stays visible */}
        <EncounterCreator
          isOpen={isEncounterCreatorOpen}
          onClose={() => setIsEncounterCreatorOpen(false)}
          monsters={monsters}
          players={players}
          sounds={sounds}
          initialCombatants={combatants}
          initialName={encounterName}
          initialFolder={savedEncounters.find(e => e.id === currentEncounterId)?.folder ?? ''}
          initialBackgroundImage={savedEncounters.find(e => e.id === currentEncounterId)?.backgroundImage || activeBackground || ''}
          initialYoutubeUrl={savedEncounters.find(e => e.id === currentEncounterId)?.youtubeUrl || activeYoutubeUrl || ''}
          initialBackgroundOpacity={savedEncounters.find(e => e.id === currentEncounterId)?.backgroundOpacity ?? 0.22}
          initialPanelOpacity={savedEncounters.find(e => e.id === currentEncounterId)?.panelOpacity ?? 0.92}
          initialAnimationLevel={savedEncounters.find(e => e.id === currentEncounterId)?.animationLevel ?? 'minimal'}
          initialSoundIds={savedEncounters.find(e => e.id === currentEncounterId)?.soundIds ?? []}
          existingFolders={savedEncounters.map(e => e.folder ?? '').filter(Boolean)}
          onLaunch={(updatedCombatants, name, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel) => {
            setCombatants(updatedCombatants);
            setEncounterName(name);
            handleSaveEncounter(name, updatedCombatants, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel);
            setIsEncounterCreatorOpen(false);
            setIsInitiativeModalOpen(true);
          }}
          onSave={(updatedCombatants, name, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel) => {
            setCombatants(updatedCombatants);
            setEncounterName(name);
            handleSaveEncounter(name, updatedCombatants, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel);
            setIsEncounterCreatorOpen(false);
          }}
          onAutoSave={(updatedCombatants, name, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel) => {
            handleSaveEncounter(name, updatedCombatants, backgroundImage, youtubeUrl, folder, difficulty, backgroundOpacity, panelOpacity, soundIds, animationLevel);
          }}
        />

        {/* Floating YouTube Player — draggable, position persisted */}
        {youtubeId && !isPlayerView && <FloatingMusicPlayer youtubeId={youtubeId} isPaused={isMusicPaused} />}
      </main>
      </>}
      afterMain={<>

      {/* Right Sidebar - Details */}
      {!isPlayerView && (
        <ErrorBoundary label="Right Sidebar">
          <RightSidebar
            selectedCombatant={selectedCombatant || null}
            selectedDisplayName={displayNames.get(selectedCombatant?.id ?? '') ?? selectedCombatant?.name}
            setSelectedCombatantId={setSelectedCombatantId}
            savedEncounters={savedEncounters}
            handleLoadEncounter={handleLoadEncounter}
            isEncounterActive={isEncounterActive}
            handleNextTurn={handleNextTurn}
            setEditingCombatantId={setEditingCombatantId}
            setIsEditModalOpen={setIsEditModalOpen}
            setIsStatusModalOpen={setIsStatusModalOpen}
            setQuickActionCombatantId={setQuickActionCombatantId}
            setIsQuickActionModalOpen={setIsQuickActionModalOpen}
            currentEncounterId={currentEncounterId}
            activeTab={activeTab}
            combatants={combatants}
            onUseAction={openActionModal}
            onUpdate={handleUpdateCombatant}
            spellLibrary={spells}
            encounterNotes={encounterNotes}
            onUpdateNotes={handleUpdateNotes}
            sidebarView={sidebarView}
            onSetSidebarView={setSidebarView}
            onRestPlayer={(combatantId, type) => {
              const c = combatants.find(x => x.id === combatantId);
              if (c?.playerId) handleRest(c.playerId, type);
            }}
            onUseFeature={(combatantId, featureId) => {
              const c = combatants.find(x => x.id === combatantId);
              if (!c?.playerId || !c.featureUses?.[featureId]) return;
              const feat = c.featureUses[featureId];
              if (feat.used < feat.total) handleUpdateFeatureUse(c.playerId, featureId, feat.used + 1);
            }}
            isAdmin={user?.role === 'admin'}
            isMobileOpen={isMobileRightPanelOpen}
            onMobileClose={() => setIsMobileRightPanelOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* Mobile bottom nav — hidden on md+ where sidebar is visible */}
      {!isPlayerView && (
        <nav className="fixed bottom-0 inset-x-0 z-40 flex md:hidden bg-[#05070A]/95 backdrop-blur-sm border-t border-white/8 pb-safe">
          <NavLink to="/dashboard" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-outline/50'}`}>
            <LayoutDashboard className="w-5 h-5" />
            Home
          </NavLink>
          <NavLink to="/encounters" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-outline/50'}`}>
            <Swords className="w-5 h-5" />
            Encounter
          </NavLink>
          <NavLink to="/monsters" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-outline/50'}`}>
            <Shield className="w-5 h-5" />
            Monsters
          </NavLink>
          <NavLink to="/soundboard" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-outline/50'}`}>
            <Music className="w-5 h-5" />
            Sounds
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-outline/50'}`}>
            <MoreHorizontal className="w-5 h-5" />
            More
          </NavLink>
        </nav>
      )}

      {/* Modals */}
      <ModalsContainer
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        editingCombatant={editingCombatant}
        editingCombatantDisplayName={displayNames.get(editingCombatant?.id ?? '') ?? editingCombatant?.name}
        handleUpdateCombatant={handleUpdateCombatant}
        handleDeleteCombatant={handleDeleteCombatant}
        isStatusModalOpen={isStatusModalOpen}
        setIsStatusModalOpen={setIsStatusModalOpen}
        isInitiativeModalOpen={isInitiativeModalOpen}
        setIsInitiativeModalOpen={setIsInitiativeModalOpen}
        combatants={combatants}
        handleFinishInitiative={handleFinishInitiative}
        players={players}
        handleAddPlayerToEncounter={handleAddPlayerToEncounter}
        isQuickActionModalOpen={isQuickActionModalOpen}
        setIsQuickActionModalOpen={setIsQuickActionModalOpen}
        quickActionCombatant={quickActionCombatant}
        quickActionDisplayName={displayNames.get(quickActionCombatant?.id ?? '') ?? quickActionCombatant?.name}
        quickActionCombatantId={quickActionCombatantId}
        quickActionMode={quickActionMode}
        triggerConCheck={triggerConCheck}
        isSaveEncounterModalOpen={isSaveEncounterModalOpen}
        setIsSaveEncounterModalOpen={setIsSaveEncounterModalOpen}
        handleSaveEncounter={handleSaveEncounter}
        isSaving={isSaving}
        encounterName={encounterName}
        currentEncounterId={currentEncounterId}
        savedEncounters={savedEncounters}
        sounds={sounds}
        isMonsterEditModalOpen={isMonsterEditModalOpen}
        setIsMonsterEditModalOpen={setIsMonsterEditModalOpen}
        editingMonster={editingMonster}
        handleUpdateMonster={handleUpdateMonster}
        spells={spells}
      />


{/* Action Execution Modal */}
      <ActionExecutionModal
        isOpen={actionModal !== null}
        onClose={closeActionModal}
        actor={actionModal?.actor ?? null}
        action={actionModal?.action ?? null}
        combatants={combatants}
        spellData={actionModal?.action.category === 'spell' ? spells.find(s => s.name.toLowerCase() === actionModal.action.name.toLowerCase()) : undefined}
        onApply={handleActionApply}
        monsters={monsters}
        onPolymorph={(targetId, monster) => {
          const target = combatants.find(c => c.id === targetId);
          if (target) handlePolymorph(target, monster);
        }}
        sounds={sounds}
        onTogglePlay={handleTogglePlay}
        playingIds={activePlayingIds}
      />

      {/* What's New Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

      <AddEnemyModal
        isOpen={isAddEnemyModalOpen}
        onClose={() => setIsAddEnemyModalOpen(false)}
        monsters={monsters}
        onAdd={(monster, initiative, count) => handleAddMonsterToEncounter(monster, initiative, count)}
      />

      {/* Session Stats Modal */}
      <SessionStatsModal isOpen={showSessionStats} onClose={() => setShowSessionStats(false)} />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        combatants={combatants}
        monsters={monsters}
        isEncounterActive={isEncounterActive}
        currentEncounterId={currentEncounterId}
        displayNames={displayNames}
        onNavigate={navigate}
        onNextTurn={handleNextTurn}
        onPrevTurn={handlePrevTurn}
        onHealAll={handleHealAll}
        onClearConditions={handleClearAllConditions}
        onAddMonster={handleAddMonsterToEncounter}
        onSelectCombatant={setSelectedCombatantId}
        onQuickDamage={(id) => { setQuickActionCombatantId(id); setQuickActionMode('damage'); setIsQuickActionModalOpen(true); }}
        onQuickHeal={(id) => { setQuickActionCombatantId(id); setQuickActionMode('heal'); setIsQuickActionModalOpen(true); }}
      />

      {!isPlayerView && <SessionBoard ref={sessionBoardRef} isEncounterActive={isEncounterActive} hideTrigger={isEncounterActive} />}
      </>}
    />
  );
}
