import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Combatant, MonsterTemplate, Spell, Encounter, EncounterStats, Player, LogEntry, FolderSettings, Campaign, Session, ClassFeature, AnimationLevel } from '../types';
import { MONSTER_LIBRARY, CONDITIONS } from '../constants';
import { api, ApiError } from '../api/client';
import { useToast } from './useToast';
import { useCombatLog } from './useCombatLog';
import { useCombatActions } from './useCombatActions';
import { useMonsterActions } from './useMonsterActions';
import { usePlayerActions } from './usePlayerActions';
import { useCampaignActions } from './useCampaignActions';
import { useEncounterManagement } from './useEncounterManagement';
import { sortWithCompanions } from '../lib/combatantUtils';
import { computeEncounterStats, enrichStatsFromLog, CombatantTracking } from '../lib/encounterStats';

export function useAppState() {
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null);

  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [monsters, setMonsters] = useState<MonsterTemplate[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [classFeatures, setClassFeatures] = useState<ClassFeature[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [savedEncounters, setSavedEncounters] = useState<Encounter[]>([]);
  const [encounterName, setEncounterName] = useState('New Encounter');
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null);
  const [isPlayerView, setIsPlayerView] = useState(false);
  
  const [isInitiativeModalOpen, setIsInitiativeModalOpen] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isEncounterActive, setIsEncounterActive] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [isMonsterEditModalOpen, setIsMonsterEditModalOpen] = useState(false);
  const [isSaveEncounterModalOpen, setIsSaveEncounterModalOpen] = useState(false);
  const [isEncounterCreatorOpen, setIsEncounterCreatorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [currentTurnStartedAt, setCurrentTurnStartedAt] = useState<number | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess, showToast } = useToast();

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path.startsWith('/encounters')) return 'encounters';
    if (path.startsWith('/campaigns')) return 'campaigns';
    if (path === '/monsters') return 'monsters';
    if (path === '/spells') return 'spells';
    if (path === '/abilities') return 'abilities';
    if (path === '/soundboard') return 'soundboard';
    if (path === '/import') return 'import';
    if (path === '/settings') return 'settings';
    return 'dashboard';
  }, [location.pathname]);

  const setActiveTab = useCallback((tab: string) => {
    navigate(`/${tab}`);
  }, [navigate]);
  
  const [editingCombatantId, setEditingCombatantId] = useState<string | null>(null);
  const [quickActionCombatantId, setQuickActionCombatantId] = useState<string | null>(null);
  const [quickActionMode, setQuickActionMode] = useState<'damage' | 'heal' | 'tempHp' | null>(null);
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);

  const [isDbAvailable, setIsDbAvailable] = useState(true);
  const [encounterStats, setEncounterStats] = useState<EncounterStats | null>(null);
  const [combatantTracking, setCombatantTracking] = useState<CombatantTracking>({});
  const [activeBackground, setActiveBackground] = useState('');
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState('');
  const [activeBackgroundOpacity, setActiveBackgroundOpacity] = useState(0.22);
  const [activePanelOpacity, setActivePanelOpacity] = useState(0.92);
  const [activeAnimationLevel, setActiveAnimationLevel] = useState<AnimationLevel>('minimal');
  const [activeSoundIds, setActiveSoundIds] = useState<string[]>([]);
  const [pendingConChecks, setPendingConChecks] = useState<Record<string, number>>({});
  const [loadingEncounterId, setLoadingEncounterId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playerLog, setPlayerLog] = useState<LogEntry[]>([]);
  const [playerLogVisible, setPlayerLogVisible] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isSyncingRef = useRef(0);  // counter: >0 means a write is in flight
  const fetchSeqRef = useRef(0);   // monotonic token: discard stale fetch responses
  const selectedCombatantIdRef = useRef<string | null>(null);
  const playersRef = useRef<Player[]>([]);
  const combatantsRef = useRef<Combatant[]>([]);
  const roundStartTimeRef = useRef<number | null>(null);
  const roundDurationsRef = useRef<number[]>([]);
  const autoEndingRef = useRef(false);
  const currentEncounterIdRef = useRef<string | null>(null);

  const { combatLog, setCombatLog, addLogEntry, combatLogRef, addLogEntryRef } = useCombatLog(currentRound);

  useEffect(() => {
    selectedCombatantIdRef.current = selectedCombatantId;
  }, [selectedCombatantId]);

  useEffect(() => {
    const prev = currentEncounterIdRef.current;
    currentEncounterIdRef.current = currentEncounterId;
    if (socketRef.current?.connected) {
      if (prev && prev !== currentEncounterId) {
        socketRef.current.emit('leave-encounter', prev);
      }
      if (currentEncounterId) {
        socketRef.current.emit('join-encounter', currentEncounterId);
      }
    }
  }, [currentEncounterId]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    combatantsRef.current = combatants;
  }, [combatants]);

  const fetchData = useCallback(async () => {
    try {
      const [encounterList, monsterList, playerList, spellList, campaignList] = await Promise.all([
        api.encounters.list(),
        api.monsters.list(),
        api.players.list(),
        api.spells.list(),
        api.campaigns.list(),
      ]);
      setSavedEncounters(encounterList);
      setMonsters(monsterList.length > 0 ? monsterList : MONSTER_LIBRARY);
      setPlayers(playerList);
      setSpells(spellList);
      setCampaigns(campaignList);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to load app data';
      showError(message);
      setMonsters(MONSTER_LIBRARY);
    }
  }, [showError]);

  const fetchEncounterData = useCallback(async (encounterId: string) => {
    const seq = ++fetchSeqRef.current;
    try {
      const [encResult, combResult, folderResult] = await Promise.allSettled([
        api.encounters.get(encounterId),
        api.combatants.list(encounterId),
        api.folderSettings.list(),
      ]);

      // Discard if a newer fetch started while we were awaiting
      if (seq !== fetchSeqRef.current) return;

      let current: Encounter | null = null;
      if (encResult.status === 'fulfilled') {
        current = encResult.value;
       
        if (current) {
          setShowSummary(!!current.showSummary);
          setIsEncounterActive(!!current.isEncounterActive);
          setCurrentRound(current.currentRound || 1);
          setCurrentTurnIndex(current.currentTurnIndex || 0);
          setEncounterName(current.name);
          
          let bg = current.backgroundImage || '';
          let yt = current.youtubeUrl || '';

          if (folderResult.status === 'fulfilled') {
            const allFolderSettings: FolderSettings[] = folderResult.value;

            let effectiveFolder = current.folder?.trim() || '';
            if (!effectiveFolder && current.name) {
              const prefixMatch = current.name.match(/^([A-Z])\d+/i);
              if (prefixMatch) {
                const code = prefixMatch[1].toUpperCase();
                const mapping: Record<string, string> = {
                  'B': 'Brigganock Mine', 'C': 'Motherhorn', 'D': 'Downfall',
                  'L': 'Loomlurch', 'M': 'Motherhorn', 'P': "Palace of Heart's Desire",
                  'W': 'Wayward Pool', 'H': 'Hither', 'T': 'Thither', 'Y': 'Yon',
                };
                effectiveFolder = mapping[code] || '';
              }
            }

            const settings = allFolderSettings.find(s => s.folder === effectiveFolder);
           
            if (settings) {
              if (!bg) bg = settings.backgroundImage || '';
              if (!yt) yt = settings.musicUrl || '';
            }
          }

          setActiveBackground(bg);
          setActiveYoutubeUrl(yt);
          if (current.backgroundOpacity != null) setActiveBackgroundOpacity(current.backgroundOpacity);
          if (current.panelOpacity != null) setActivePanelOpacity(current.panelOpacity);
          if (current.animationLevel != null) setActiveAnimationLevel(current.animationLevel);
          if (current.encounterStats) setEncounterStats(current.encounterStats);
          else setEncounterStats(null);
          if (current.isEncounterActive && current.trackingData) setCombatantTracking(current.trackingData);
          else setCombatantTracking({});
          if (current.soundIds?.length) setActiveSoundIds(current.soundIds);
          else setActiveSoundIds([]);
        }
      }

      if (combResult.status === 'fulfilled') {
        const data: Combatant[] = combResult.value;
        const merged = data.map(c => {
          if (c.type === 'player') {
            const player = playersRef.current.find(p => p.id === c.playerId) ?? playersRef.current.find(p => p.name === c.name);
            const inMemory = combatantsRef.current.find(e => e.id === c.id);
            if (player) {
              return {
                ...c,
                playerId: c.playerId ?? player.id,
                actions: player.actions?.length ? player.actions : c.actions,
                abilities: player.abilities?.length ? player.abilities : c.abilities,
                spells: player.spells?.length ? player.spells : c.spells,
                spellSlots: inMemory?.spellSlots ?? player.spellSlots ?? c.spellSlots,
                featureUses: inMemory?.featureUses ?? player.featureUses ?? c.featureUses,
              };
            }
          }
          return c;
        });
        const turnIdx = current?.currentTurnIndex ?? 0;
        const sortedForActive = sortWithCompanions(merged);
        const activeId = sortedForActive[turnIdx]?.id;
        const mergedWithActive = merged.map(c => ({ ...c, isCurrentTurn: c.id === activeId }));
        setCombatants(mergedWithActive);
        // Enrich player combatants immediately from the player roster ref,
        // so we don't depend on the players effect firing order.
        const currentPlayers = playersRef.current;
        if (currentPlayers.length > 0) {
          setCombatants(cs => cs.map(c => {
            if (c.type !== 'player') return c;
            const player = currentPlayers.find(p => p.id === c.playerId) ?? currentPlayers.find(p => p.name === c.name);
            if (!player) return c;
            return {
              ...c,
              playerId: c.playerId ?? player.id,
              actions: player.actions?.length ? player.actions : c.actions,
              abilities: player.abilities?.length ? player.abilities : c.abilities,
              spells: player.spells?.length ? player.spells : c.spells,
              spellSlots: c.spellSlots ?? player.spellSlots,
              featureUses: c.featureUses ?? player.featureUses,
            };
          }));
        }
        if (selectedCombatantIdRef.current === null) {
          const cur = mergedWithActive.find((c: Combatant) => c.isCurrentTurn);
          if (cur) setSelectedCombatantId(cur.id);
        }
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, [showError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const encounterId = params.get('encounterId');

    if (view === 'player') {
      setIsPlayerView(true);
    }

    if (encounterId) {
      setCurrentEncounterId(encounterId);
    }
  }, []);

  useEffect(() => {
    const state = location.state as { tab?: string; clearEncounter?: boolean } | null;
    if (!state) return;
    if (state.tab) {
      setActiveTab(state.tab);
    }
    if (state.clearEncounter) {
      setCurrentEncounterId(null);
    }
  }, [location.state]);

  useEffect(() => {
    if (currentEncounterId) fetchEncounterData(currentEncounterId);
  }, [currentEncounterId]);

  useEffect(() => {
    if (players.length === 0 || isEncounterActive) return;
    setCombatants(prev => prev.map(c => {
      if (c.type !== 'player') return c;
      const player = players.find(p => p.name === c.name);
      if (!player) return c;
      return {
        ...c,
        playerId: c.playerId ?? player.id,
        actions: (player.actions?.length ?? 0) > 0 ? player.actions! : c.actions,
        abilities: (player.abilities?.length ?? 0) > 0 ? player.abilities! : c.abilities,
        spells: (player.spells?.length ?? 0) > 0 ? player.spells! : c.spells,
      };
    }));
  }, [players, isEncounterActive]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      const encId = currentEncounterIdRef.current;
      if (encId) socket.emit('join-encounter', encId);
    });

    socket.on('encounter-updated', (data: { encounterId: string }) => {
      if (isSyncingRef.current) return;
      const encId = currentEncounterIdRef.current;
      if (data.encounterId === encId) {
        fetchEncounterData(data.encounterId);
      }
    });

    socket.on('player-log-updated', ({ show, entries }: { show: boolean; entries: LogEntry[] }) => {
      setPlayerLogVisible(show);
      setPlayerLog(entries);
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (isPlayerView || !isEncounterActive || autoEndingRef.current) return;
    const enemies = combatants.filter(c => c.type !== 'player');
    if (enemies.length === 0) return;
    if (enemies.every(c => c.hp.current <= 0)) {
      autoEndingRef.current = true;
      setTimeout(() => { autoEndingRef.current = false; }, 2000);
      (async () => {
        if (roundStartTimeRef.current !== null) {
          roundDurationsRef.current = [...roundDurationsRef.current, Date.now() - roundStartTimeRef.current];
          roundStartTimeRef.current = null;
        }
        const rawStats = computeEncounterStats(combatants, currentRound, combatantTracking);
        const stats = enrichStatsFromLog({ ...rawStats, roundDurations: roundDurationsRef.current }, combatLogRef.current);
        roundDurationsRef.current = [];
        setCombatantTracking({});
        setEncounterStats(stats);
        const allFallen = combatants.filter(c => c.type === 'player').every(c => c.hp.current <= 0);
        addLogEntryRef.current?.({ type: 'encounter_end', actorName: 'Encounter', detail: allFallen ? 'Defeat' : 'Victory!' });
        setIsEncounterActive(false);
        setCurrentTurnStartedAt(null);
        setShowSummary(true);
        setCurrentRound(1);
        setCurrentTurnIndex(0);
        setActiveBackground('');
        setActiveYoutubeUrl('');
        const updatedCombatants = combatants.map(c => ({ ...c, isCurrentTurn: false }));
        setCombatants(updatedCombatants);
        if (isDbAvailable && currentEncounterIdRef.current) {
          const encId = currentEncounterIdRef.current;
          api.encounters.update(encId, { name: encounterName, currentRound: 1, currentTurnIndex: 0, isEncounterActive: false, showSummary: true, encounterStats: stats, completedAt: new Date().toISOString() })
            .catch((e: unknown) => console.error('[endEncounter] persist failed:', e));
          updatedCombatants
            .filter(c => c.type === 'player' && c.playerId)
            .forEach(c => {
              api.players.patch(c.playerId!, {
                hp_current: c.hp.current < c.hp.max ? c.hp.current : null,
                ac: c.ac,
                speed: c.speed,
                stats: c.stats,
                spellSlots: c.spellSlots,
                featureUses: c.featureUses,
              }).catch((e: unknown) => console.error('[endEncounter] player flush failed:', e));
            });
        }
      })();
    }
  }, [isPlayerView, combatants, isEncounterActive, currentRound, combatantTracking, isDbAvailable, encounterName]);

  const selectedCombatant = combatants.find(c => c.id === selectedCombatantId);
  const activeCombatant = combatants.find(c => c.isCurrentTurn) ?? null;
  const editingCombatant = combatants.find(c => c.id === editingCombatantId);
  const quickActionCombatant = combatants.find(c => c.id === quickActionCombatantId);
  const editingMonster = monsters.find(m => m.id === editingMonsterId);

  // --- Domain hooks ---

  const currentEncounter = savedEncounters.find(e => e.id === currentEncounterId);

  const combatActions = useCombatActions({
    combatants, setCombatants,
    currentRound, setCurrentRound,
    currentTurnIndex, setCurrentTurnIndex,
    isEncounterActive, setIsEncounterActive,
    encounterName,
    isDbAvailable,
    combatantTracking, setCombatantTracking,
    pendingConChecks, setPendingConChecks,
    currentEncounterId, setCurrentEncounterId,
    setSelectedCombatantId,
    setShowSummary,
    setActiveBackground,
    setActiveYoutubeUrl,
    setSavedEncounters,
    setIsInitiativeModalOpen,
    setIsEditModalOpen,
    setEncounterStats,
    setCurrentTurnStartedAt,
    combatLog,
    isSyncingRef,
    roundStartTimeRef,
    roundDurationsRef,
    autoEndingRef,
    addLogEntry,
    navigate,
  });

  const monsterActions = useMonsterActions({
    monsters, setMonsters,
    isDbAvailable,
    isSaving, setIsSaving,
    currentEncounterId,
    combatants, setCombatants,
    setEditingMonsterId,
    setIsMonsterEditModalOpen,
    navigate,
  });

  const playerActions = usePlayerActions({
    players, setPlayers,
    spells, setSpells,
    classFeatures, setClassFeatures,
    isDbAvailable,
    isSaving, setIsSaving,
    currentEncounterId,
    combatants, setCombatants,
    playersRef,
    navigate,
  });

  const campaignActions = useCampaignActions({
    campaigns, setCampaigns,
    sessions, setSessions,
    activeCampaignId, setActiveCampaignId,
    activeSessionId, setActiveSessionId,
    savedEncounters, setSavedEncounters,
  });

  const encounterManagement = useEncounterManagement({
    savedEncounters, setSavedEncounters,
    currentEncounterId, setCurrentEncounterId,
    encounterName, setEncounterName,
    isDbAvailable,
    isEncounterActive,
    currentRound,
    isSaving, setIsSaving,
    combatants, setCombatants,
    setActiveBackground,
    setActiveYoutubeUrl,
    setActiveBackgroundOpacity,
    setActivePanelOpacity,
    setActiveAnimationLevel,
    setCurrentRound,
    setCurrentTurnIndex,
    setIsEncounterActive,
    setShowSummary,
    loadingEncounterId, setLoadingEncounterId,
    setIsSaveEncounterModalOpen,
    socketRef,
    fetchEncounterData,
    navigate,
    showError,
    showSuccess,
    players,
  });

  const syncPlayerLog = useCallback((show: boolean, entries: LogEntry[]) => {
    if (socketRef.current && currentEncounterId) {
      socketRef.current.emit('dm-log-sync', { encounterId: currentEncounterId, show, entries });
    }
  }, [currentEncounterId]);

  return {
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
    currentTurnStartedAt,
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
    ...combatActions,
    ...monsterActions,
    ...playerActions,
    ...campaignActions,
    ...encounterManagement,
    players, setPlayers,
    activeBackground,
    activeYoutubeUrl,
    activeBackgroundOpacity,
    activePanelOpacity,
    activeAnimationLevel,
    activeSoundIds,
    combatLog,
    addLogEntry,
    pendingConChecks,
    campaigns, setCampaigns,
    activeCampaignId, setActiveCampaignId,
    sessions, setSessions,
    activeSessionId, setActiveSessionId,
    classFeatures,
    fetchData,
    fetchEncounterData,
    loadingEncounterId,
    isSaving,
    masterVolume, setMasterVolume,
    isMuted, setIsMuted,
    playerLog,
    playerLogVisible,
    syncPlayerLog,
  };
}
