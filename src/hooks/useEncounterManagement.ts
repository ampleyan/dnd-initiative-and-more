import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combatant, Encounter, Player, AnimationLevel } from '../types';
import { uuid } from '../lib/utils';
import { api, ApiError } from '../api/client';

export function playerToCombatant(p: Player): Combatant {
  return {
    id: uuid(),
    name: p.name,
    type: 'player',
    initiative: 0,
    hp: { current: Math.min(p.hp_current ?? p.hp_max, p.hp_max), max: p.hp_max },
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
    spellIds: p.spellIds ?? [],
    featureIds: p.featureIds ?? [],
    playerId: p.id,
    spellSlots: p.spellSlots ? { ...p.spellSlots } : undefined,
    featureUses: p.featureUses ? { ...p.featureUses } : undefined,
  };
}

export interface EncounterManagementParams {
  savedEncounters: Encounter[];
  setSavedEncounters: React.Dispatch<React.SetStateAction<Encounter[]>>;
  currentEncounterId: string | null;
  setCurrentEncounterId: React.Dispatch<React.SetStateAction<string | null>>;
  encounterName: string;
  setEncounterName: React.Dispatch<React.SetStateAction<string>>;
  isDbAvailable: boolean;
  isEncounterActive: boolean;
  currentRound: number;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  setActiveBackground: React.Dispatch<React.SetStateAction<string>>;
  setActiveYoutubeUrl: React.Dispatch<React.SetStateAction<string>>;
  setActiveBackgroundOpacity: React.Dispatch<React.SetStateAction<number>>;
  setActivePanelOpacity: React.Dispatch<React.SetStateAction<number>>;
  setActiveAnimationLevel: React.Dispatch<React.SetStateAction<AnimationLevel>>;
  setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
  setCurrentTurnIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsEncounterActive: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  loadingEncounterId: string | null;
  setLoadingEncounterId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaveEncounterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  socketRef: React.MutableRefObject<import('socket.io-client').Socket | null>;
  fetchEncounterData: (encounterId: string) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  players: Player[];
}

export function useEncounterManagement(params: EncounterManagementParams) {
  const {
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
  } = params;

  const handleNewEncounter = () => {
    setCurrentEncounterId(null);
    setEncounterName('New Encounter');
    setCombatants([]);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    setIsEncounterActive(false);
    setShowSummary(false);
    setActiveBackground('');
    setActiveYoutubeUrl('');
    navigate('/');
  };

  const handleSaveEncounter = async (name: string, overrideCombatants?: Combatant[], backgroundImage?: string, youtubeUrl?: string, folder?: string, difficulty?: string, backgroundOpacity?: number, panelOpacity?: number, soundIds?: string[], animationLevel?: AnimationLevel) => {
    if (isSaving) return;
    const id = currentEncounterId || uuid();
    const combatantsToSave = overrideCombatants || combatants;

    let existing: Partial<Encounter> = {};
    if (currentEncounterId) {
      try {
        existing = await api.encounters.get(currentEncounterId);
      } catch (e) { console.error('[saveEncounter] fetch existing failed:', e); }
    }

    const newEncounter: any = {
      id,
      name,
      currentRound,
      isEncounterActive,
      backgroundImage: backgroundImage ?? existing.backgroundImage ?? '',
      youtubeUrl: youtubeUrl ?? existing.youtubeUrl ?? '',
      folder: folder ?? existing.folder ?? '',
      difficulty: difficulty ?? existing.difficulty ?? '',
      backgroundOpacity: backgroundOpacity ?? existing.backgroundOpacity ?? 0.22,
      panelOpacity: panelOpacity ?? existing.panelOpacity ?? 0.92,
      animationLevel: animationLevel ?? existing.animationLevel ?? 'minimal',
      soundIds: soundIds ?? existing.soundIds ?? [],
    };

    if (isDbAvailable) {
      setIsSaving(true);
      try {
        if (currentEncounterId) {
          await api.encounters.update(id, newEncounter);
          await api.combatants.clearAll(id);
          await Promise.all(combatantsToSave.map(c =>
            api.combatants.create({ ...c, encounterId: id })
          ));
        } else {
          // New encounter — auto-add all players from the roster unless already present
          const existingNames = new Set(combatantsToSave.map(c => c.name.toLowerCase()));
          const playerCombatants = players
            .filter(p => !existingNames.has(p.name.toLowerCase()))
            .map(playerToCombatant);
          const allCombatants = [...combatantsToSave, ...playerCombatants];
          await api.encounters.create(newEncounter);
          await Promise.all(allCombatants.map(c =>
            api.combatants.create({ ...c, encounterId: id })
          ));
          if (playerCombatants.length > 0) {
            setCombatants(allCombatants);
          }
        }

        setCurrentEncounterId(id);
        setEncounterName(name);
        setActiveBackground(backgroundImage || '');
        setActiveYoutubeUrl(youtubeUrl || '');
        setActiveBackgroundOpacity(backgroundOpacity ?? 0.22);
        setActivePanelOpacity(panelOpacity ?? 0.92);
        setActiveAnimationLevel(animationLevel ?? 'minimal');

        const encounterList = await api.encounters.list();
        setSavedEncounters(encounterList);
        showSuccess('Encounter saved');
      } catch (e) {
        showError(e instanceof ApiError ? e.message : 'Failed to save encounter');
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentEncounterId(id);
      setEncounterName(name);
    }

    setIsSaveEncounterModalOpen(false);
  };

  const handleImportEncounters = async (encounters: Encounter[]) => {
    if (!isDbAvailable) return;
    try {
      for (const encounter of encounters) {
        const id = encounter.id || uuid();
        await api.encounters.create({ id, name: encounter.name, currentRound: 1, isEncounterActive: false, backgroundImage: '', youtubeUrl: '', folder: encounter.folder || '' });
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
      setSavedEncounters(await api.encounters.list());
    } catch (e) {
      console.error('Failed to import encounters', e);
    }
    navigate('/encounters');
  };

  const handleLoadEncounter = async (encounter: Encounter) => {
    if (loadingEncounterId === encounter.id) return;
    setLoadingEncounterId(encounter.id);
    try {
      if (socketRef.current) {
        socketRef.current.emit('join-encounter', encounter.id);
      }
      setCurrentEncounterId(encounter.id);
      navigate(`/encounters/${encounter.id}`);
      if (isDbAvailable) {
        try {
          await fetchEncounterData(encounter.id);
        } catch (e) {
          console.error('Failed to load encounter', e);
        }
      }
    } finally {
      setLoadingEncounterId(null);
    }
  };

  const handleSimulateEncounter = (encounter: Encounter) => {
    setCurrentEncounterId(encounter.id);
    setEncounterName(encounter.name);
    setIsEncounterActive(true);
    navigate(`/encounters/${encounter.id}`, { state: { runSimulation: true } });
  };

  const handleDeleteEncounters = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} encounter${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    if (isDbAvailable) {
      try {
        await api.encounters.bulkDelete(ids);
        setSavedEncounters(prev => prev.filter(e => !ids.includes(e.id)));
        if (ids.includes(currentEncounterId ?? '')) handleNewEncounter();
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Failed to delete encounters');
      }
    }
  };

  const handleUpdateEncounter = useCallback(async (id: string, updates: Partial<Encounter>) => {
    await api.encounters.update(id, updates);
    setSavedEncounters(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (currentEncounterId === id) {
      setEncounterName(prev => updates.name ?? prev);
      if (updates.backgroundImage !== undefined) setActiveBackground(updates.backgroundImage ?? '');
      if (updates.youtubeUrl !== undefined) setActiveYoutubeUrl(updates.youtubeUrl ?? '');
    }
  }, [currentEncounterId, setSavedEncounters, setEncounterName, setActiveBackground, setActiveYoutubeUrl]);

  return {
    handleSaveEncounter,
    handleImportEncounters,
    handleLoadEncounter,
    handleSimulateEncounter,
    handleNewEncounter,
    handleDeleteEncounters,
    handleUpdateEncounter,
  };
}
