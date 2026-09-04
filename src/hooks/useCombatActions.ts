import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combatant, Encounter, EncounterStats, LogEntry, MonsterTemplate, PolymorphForm } from '../types';
import { CONDITIONS } from '../constants';
import { uuid } from '../lib/utils';
import { api } from '../api/client';
import { sortWithCompanions, applyTurnStart } from '../lib/combatantUtils';
import { useToast } from './useToast';
import { computeEncounterStats, enrichStatsFromLog, CombatantTracking } from '../lib/encounterStats';

export type EncounterSnapshot = {
  combatants: Combatant[];
  currentRound: number;
  currentTurnIndex: number;
  combatantTracking: CombatantTracking;
};

export interface CombatActionsParams {
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  currentRound: number;
  setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
  currentTurnIndex: number;
  setCurrentTurnIndex: React.Dispatch<React.SetStateAction<number>>;
  isEncounterActive: boolean;
  setIsEncounterActive: React.Dispatch<React.SetStateAction<boolean>>;
  encounterName: string;
  isDbAvailable: boolean;
  combatantTracking: CombatantTracking;
  setCombatantTracking: React.Dispatch<React.SetStateAction<CombatantTracking>>;
  actionHistory: EncounterSnapshot[];
  setActionHistory: React.Dispatch<React.SetStateAction<EncounterSnapshot[]>>;
  redoStack: EncounterSnapshot[];
  setRedoStack: React.Dispatch<React.SetStateAction<EncounterSnapshot[]>>;
  pendingConChecks: Record<string, number>;
  setPendingConChecks: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  currentEncounterId: string | null;
  setCurrentEncounterId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCombatantId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveBackground: React.Dispatch<React.SetStateAction<string>>;
  setActiveYoutubeUrl: React.Dispatch<React.SetStateAction<string>>;
  setSavedEncounters: React.Dispatch<React.SetStateAction<Encounter[]>>;
  setIsInitiativeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEncounterStats: React.Dispatch<React.SetStateAction<EncounterStats | null>>;
  setCurrentTurnStartedAt: React.Dispatch<React.SetStateAction<number | null>>;
  combatLog: LogEntry[];
  isSyncingRef: React.MutableRefObject<number>;
  roundStartTimeRef: React.MutableRefObject<number | null>;
  roundDurationsRef: React.MutableRefObject<number[]>;
  autoEndingRef: React.MutableRefObject<boolean>;
  addLogEntry: (entry: Omit<LogEntry, 'id' | 'round' | 'timestamp'>) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function buildReverted(combatant: Combatant): Combatant {
  const f = combatant.polymorphForm!;
  return {
    ...combatant,
    name: f.originalName,
    subtitle: f.originalSubtitle,
    avatar: f.originalAvatar ?? combatant.avatar,
    ac: f.originalAc,
    stats: f.originalStats,
    speed: f.originalSpeed ?? combatant.speed,
    hp: f.originalHp,
    polymorphForm: undefined,
  };
}

export function useCombatActions(params: CombatActionsParams) {
  const { showError } = useToast();
  const {
    combatants, setCombatants,
    currentRound, setCurrentRound,
    currentTurnIndex, setCurrentTurnIndex,
    isEncounterActive,
    setIsEncounterActive,
    encounterName,
    isDbAvailable,
    combatantTracking, setCombatantTracking,
    actionHistory, setActionHistory,
    redoStack, setRedoStack,
    setPendingConChecks,
    currentEncounterId,
    setCurrentEncounterId,
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
  } = params;
  const playerPatchControllersRef = React.useRef<Map<string, AbortController>>(new Map());

  const pushSnapshot = () => {
    const snap: EncounterSnapshot = { combatants: [...combatants], currentRound, currentTurnIndex, combatantTracking: { ...combatantTracking } };
    setActionHistory(h => {
      const next = [...h, snap];
      return next.length > 20 ? next.slice(-20) : next;
    });
    setRedoStack([]);
  };

  const handleDeleteCombatant = (id: string) => {
    const sorted = sortWithCompanions(combatants);
    const deletedIdx = sorted.findIndex(c => c.id === id);
    const wasActive = sorted[deletedIdx]?.isCurrentTurn;
    const remaining = combatants.filter(c => c.id !== id);
    const sortedRemaining = sortWithCompanions(remaining);

    let newTurnIndex = currentTurnIndex;
    if (wasActive) {
      // Keep same index (will now point to the next combatant), but clamp to last
      newTurnIndex = Math.min(currentTurnIndex, sortedRemaining.length - 1);
    } else if (deletedIdx < currentTurnIndex) {
      // Deleted combatant was before the active one — shift index back
      newTurnIndex = Math.max(0, currentTurnIndex - 1);
    }

    const activeId = sortedRemaining[newTurnIndex]?.id;
    const updated = remaining.map(c => ({ ...c, isCurrentTurn: c.id === activeId }));
    setCombatants(updated);
    setCurrentTurnIndex(newTurnIndex);
    setSelectedCombatantId(null);
    setIsEditModalOpen(false);

    if (isDbAvailable && currentEncounterId) {
      const encId = currentEncounterId;
      api.combatants.delete(id)
        .then(() => {
          // Persist the repaired turn index
          api.encounters.update(encId, { currentTurnIndex: newTurnIndex });
        })
        .catch((e: unknown) => console.error('Failed to delete combatant from DB', e));
    }
  };

  const handleUpdateCombatant = (incoming: Combatant, damageType?: string, actionName?: string) => {
    let updated = incoming;
    const prev = combatants.find(c => c.id === updated.id);
    const activeCombatant = combatants.find(c => c.isCurrentTurn);
    if (prev && isEncounterActive) {
      pushSnapshot();
      const delta = updated.hp.current - prev.hp.current;
      if (delta !== 0) {
        const dmg = -delta;
        const blank = (c: Combatant) => ({ damageTaken: 0, healingReceived: 0, damageDone: 0, kills: 0, name: c.name, type: c.type });
        setCombatantTracking(t => {
          const target = t[updated.id] ?? blank(updated);
          const next: typeof t = {
            ...t,
            [updated.id]: delta < 0
              ? { ...target, damageTaken: target.damageTaken + dmg }
              : { ...target, healingReceived: target.healingReceived + delta },
          };
          if (delta < 0 && activeCombatant && activeCombatant.id !== updated.id) {
            const actor = next[activeCombatant.id] ?? blank(activeCombatant);
            next[activeCombatant.id] = { ...actor, damageDone: actor.damageDone + dmg };
          }
          return next;
        });
        if (delta < 0) {
          addLogEntry({ type: 'damage', actorName: activeCombatant?.name ?? 'Unknown', actorId: activeCombatant?.id, targetName: updated.name, targetId: updated.id, value: dmg, damageType, actionName });
          if (prev.hp.current > 0 && updated.hp.current <= 0) {
            if (updated.polymorphForm) {
              const f = updated.polymorphForm;
              const reverted = buildReverted(updated);
              const revertedWithEncounter = { ...reverted, encounterId: currentEncounterId || undefined };
              setCombatants(prev => prev.map(c => c.id === reverted.id ? revertedWithEncounter : c));
              if (isDbAvailable) {
                isSyncingRef.current++;
                api.combatants.update(reverted.id, revertedWithEncounter)
                  .then(() => { isSyncingRef.current = Math.max(0, isSyncingRef.current - 1); })
                  .catch((e: unknown) => { isSyncingRef.current = Math.max(0, isSyncingRef.current - 1); });

                if (reverted.type === 'player' && reverted.playerId) {
                  const prevController = playerPatchControllersRef.current.get(reverted.playerId);
                  prevController?.abort();
                  const controller = new AbortController();
                  playerPatchControllersRef.current.set(reverted.playerId, controller);
                  api.players.patch(reverted.playerId, {
                    hp_current: reverted.hp.current < reverted.hp.max ? reverted.hp.current : null,
                    ac: reverted.ac,
                    speed: reverted.speed,
                    subtitle: reverted.subtitle,
                    stats: reverted.stats,
                    spellSlots: reverted.spellSlots,
                    featureUses: reverted.featureUses,
                  }, controller.signal).catch((e: unknown) => { if ((e as any)?.name !== 'AbortError') console.error('Failed to sync player state', e); });
                }
              }
              if (f.originalHp.current <= 0) {
                addLogEntry({ type: 'creature_downed', actorName: f.originalName, actorId: reverted.id });
                if (reverted.type === 'player' && !reverted.deathSaves) {
                  const withSaves = { ...revertedWithEncounter, deathSaves: { successes: 0, failures: 0, stable: false } };
                  setCombatants(prev => prev.map(c => c.id === reverted.id ? withSaves : c));
                }
              }
              addLogEntry({ type: 'condition_removed', actorName: f.originalName, actorId: reverted.id, detail: 'Polymorph (auto-reverted)' });
              return;
            }
            addLogEntry({ type: 'creature_downed', actorName: updated.name, actorId: updated.id });
            if (updated.type === 'player' && !updated.deathSaves) {
              updated = { ...updated, deathSaves: { successes: 0, failures: 0, stable: false } };
            }
            if (activeCombatant && activeCombatant.id !== updated.id) {
              setCombatantTracking(t => {
                const actor = t[activeCombatant.id] ?? { damageTaken: 0, healingReceived: 0, damageDone: 0, kills: 0, name: activeCombatant.name, type: activeCombatant.type };
                return { ...t, [activeCombatant.id]: { ...actor, kills: actor.kills + 1 } };
              });
            }
          }
        }
        if (delta > 0) {
          addLogEntry({ type: 'heal', actorName: activeCombatant?.name ?? updated.name, actorId: activeCombatant?.id ?? updated.id, targetName: updated.name, targetId: updated.id, value: delta, actionName });
        }
      }
      const newConditions = updated.conditions.filter(id => !prev.conditions.includes(id));
      for (const condId of newConditions) {
        const cond = CONDITIONS.find(c => c.id === condId);
        addLogEntry({ type: 'condition_applied', actorName: updated.name, actorId: updated.id, detail: cond?.name ?? condId });
      }
      const removedConditions = prev.conditions.filter(id => !updated.conditions.includes(id));
      for (const condId of removedConditions) {
        const cond = CONDITIONS.find(c => c.id === condId);
        addLogEntry({ type: 'condition_removed', actorName: updated.name, actorId: updated.id, detail: cond?.name ?? condId });
      }
    }
    const combatantWithEncounter = { ...updated, encounterId: currentEncounterId || undefined };
    setCombatants(prev => prev.map(c => c.id === updated.id ? combatantWithEncounter : c));

    if (isDbAvailable) {
      isSyncingRef.current++;
      api.combatants.update(updated.id, combatantWithEncounter)
        .then(() => { isSyncingRef.current = Math.max(0, isSyncingRef.current - 1); })
        .catch((e: unknown) => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          console.error('Failed to persist combatant update', e);
        });

      if (updated.type === 'player' && updated.playerId) {
        const prevController = playerPatchControllersRef.current.get(updated.playerId);
        prevController?.abort();
        const controller = new AbortController();
        playerPatchControllersRef.current.set(updated.playerId, controller);
        api.players.patch(updated.playerId, {
          hp_current: updated.hp.current < updated.hp.max ? updated.hp.current : null,
          ac: updated.ac,
          speed: updated.speed,
          subtitle: updated.subtitle,
          stats: updated.stats,
          spellSlots: updated.spellSlots,
          featureUses: updated.featureUses,
        }, controller.signal).catch((e: unknown) => { if ((e as any)?.name !== 'AbortError') console.error('Failed to sync player state', e); });
      }
    }
  };

  const handlePolymorph = (combatant: Combatant, monster: MonsterTemplate) => {
    const polymorphForm: PolymorphForm = {
      originalHp: combatant.hp,
      originalAc: combatant.ac,
      originalStats: combatant.stats,
      originalName: combatant.name,
      originalSubtitle: combatant.subtitle,
      originalAvatar: combatant.avatar,
      originalSpeed: combatant.speed,
    };
    const transformed: Combatant = {
      ...combatant,
      name: monster.name,
      subtitle: `${combatant.name} (Polymorphed)`,
      avatar: monster.avatar ?? combatant.avatar,
      ac: monster.ac,
      stats: monster.stats,
      speed: monster.speed,
      hp: { current: monster.hp, max: monster.hp },
      polymorphForm,
    };
    handleUpdateCombatant(transformed);
  };

  const handleRevertPolymorph = (combatant: Combatant) => {
    if (!combatant.polymorphForm) return;
    handleUpdateCombatant(buildReverted(combatant));
  };

  const handleUndo = () => {
    if (actionHistory.length === 0) return;
    const snap = actionHistory[actionHistory.length - 1];
    const current: EncounterSnapshot = { combatants: [...combatants], currentRound, currentTurnIndex, combatantTracking: { ...combatantTracking } };
    setActionHistory(h => h.slice(0, -1));
    setRedoStack(r => [...r, current]);
    setCombatants(snap.combatants);
    setCurrentRound(snap.currentRound);
    setCurrentTurnIndex(snap.currentTurnIndex);
    setCombatantTracking(snap.combatantTracking);
    if (isDbAvailable && currentEncounterId) {
      api.combatants.bulkUpdate(
        currentEncounterId,
        snap.combatants.map(c => ({ ...c, encounterId: currentEncounterId })),
        { currentRound: snap.currentRound, currentTurnIndex: snap.currentTurnIndex }
      ).catch((e: unknown) => console.error('[undo] persist failed:', e));
      for (const c of snap.combatants) {
        if (c.type === 'player' && c.playerId) {
          api.players.patch(c.playerId, { spellSlots: c.spellSlots, featureUses: c.featureUses })
            .catch((e: unknown) => console.error('[undo] player sync failed:', e));
        }
      }
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const snap = redoStack[redoStack.length - 1];
    const current: EncounterSnapshot = { combatants: [...combatants], currentRound, currentTurnIndex, combatantTracking: { ...combatantTracking } };
    setRedoStack(r => r.slice(0, -1));
    setActionHistory(h => [...h, current]);
    setCombatants(snap.combatants);
    setCurrentRound(snap.currentRound);
    setCurrentTurnIndex(snap.currentTurnIndex);
    setCombatantTracking(snap.combatantTracking);
    if (isDbAvailable && currentEncounterId) {
      api.combatants.bulkUpdate(
        currentEncounterId,
        snap.combatants.map(c => ({ ...c, encounterId: currentEncounterId })),
        { currentRound: snap.currentRound, currentTurnIndex: snap.currentTurnIndex }
      ).catch((e: unknown) => console.error('[redo] persist failed:', e));
      for (const c of snap.combatants) {
        if (c.type === 'player' && c.playerId) {
          api.players.patch(c.playerId, { spellSlots: c.spellSlots, featureUses: c.featureUses })
            .catch((e: unknown) => console.error('[redo] player sync failed:', e));
        }
      }
    }
  };

  const handleNextTurn = () => {
    const sorted = sortWithCompanions(combatants);
    if (sorted.length === 0) return;

    let nextIndex = currentTurnIndex + 1;
    let nextRound = currentRound;

    if (nextIndex >= sorted.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    // Skip dead non-player combatants
    for (let guard = 0; guard < sorted.length; guard++) {
      const c = sorted[nextIndex];
      if (!c || c.type === 'player' || c.hp.current > 0) break;
      nextIndex++;
      if (nextIndex >= sorted.length) { nextIndex = 0; nextRound++; }
    }

    const nextCombatant = sorted[nextIndex];
    const endingCombatant = sorted[currentTurnIndex];

    let endingConditionUpdate: Partial<Combatant> = {};
    if (endingCombatant?.conditionTimers && Object.keys(endingCombatant.conditionTimers).length > 0) {
      const newTimers: Record<string, number> = {};
      const newConditions = [...endingCombatant.conditions];
      for (const [condId, rounds] of Object.entries(endingCombatant.conditionTimers)) {
        if (rounds - 1 > 0) {
          newTimers[condId] = rounds - 1;
        } else {
          const idx = newConditions.indexOf(condId);
          if (idx !== -1) newConditions.splice(idx, 1);
        }
      }
      endingConditionUpdate = { conditions: newConditions, conditionTimers: newTimers };
      const expired = endingCombatant.conditions.filter(id => !newConditions.includes(id));
      for (const condId of expired) {
        const cond = CONDITIONS.find(c => c.id === condId);
        addLogEntry({ type: 'condition_removed', actorName: endingCombatant.name, actorId: endingCombatant.id, detail: cond?.name ?? condId });
      }
    }

    if (nextIndex === 0) {
      addLogEntry({ type: 'round_start', actorName: 'Round', detail: `Round ${nextRound}` });
      const now = Date.now();
      if (roundStartTimeRef.current !== null) {
        roundDurationsRef.current = [...roundDurationsRef.current, now - roundStartTimeRef.current];
      }
      roundStartTimeRef.current = now;
    }
    addLogEntry({ type: 'turn_start', actorName: nextCombatant.name, actorId: nextCombatant.id });

    const updatedCombatants = combatants.map(c => {
      const base = (endingCombatant && c.id === endingCombatant.id)
        ? { ...c, ...endingConditionUpdate }
        : c;
      return {
        ...base,
        isCurrentTurn: c.id === nextCombatant.id,
        ...(nextIndex === 0 ? { reactionUsed: false } : {}),
        ...(c.id === nextCombatant.id && c.legendaryActions
          ? { legendaryActions: applyTurnStart(c).legendaryActions }
          : {}),
      };
    });

    pushSnapshot();
    setCombatants(updatedCombatants);
    setCurrentTurnStartedAt(Date.now());
    setCurrentRound(nextRound);
    setCurrentTurnIndex(nextIndex);
    setSelectedCombatantId(nextCombatant.id);

    if (isDbAvailable && currentEncounterId) {
      const encId = currentEncounterId;
      isSyncingRef.current++;
      api.combatants.bulkUpdate(
        encId,
        updatedCombatants.map(c => ({ ...c, encounterId: encId })),
        { name: encounterName, currentRound: nextRound, currentTurnIndex: nextIndex, isEncounterActive: true, trackingData: combatantTracking }
      )
        .then(() => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          setSavedEncounters(prev =>
            prev.map(e => e.id === encId ? { ...e, currentRound: nextRound } : e)
          );
        })
        .catch((e: unknown) => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          console.error('Failed to persist turn change', e);
        });
    }
  };

  const handlePrevTurn = () => {
    const sorted = sortWithCompanions(combatants);
    if (sorted.length === 0) return;

    let prevIndex = currentTurnIndex - 1;
    let prevRound = currentRound;

    if (prevIndex < 0) {
      prevIndex = sorted.length - 1;
      prevRound = Math.max(1, currentRound - 1);
    }

    // Skip dead non-player combatants (backwards)
    for (let guard = 0; guard < sorted.length; guard++) {
      const c = sorted[prevIndex];
      if (!c || c.type === 'player' || c.hp.current > 0) break;
      prevIndex--;
      if (prevIndex < 0) { prevIndex = sorted.length - 1; prevRound = Math.max(1, prevRound - 1); }
    }

    const prevCombatant = sorted[prevIndex];
    const updatedCombatants = combatants.map(c => ({ ...c, isCurrentTurn: c.id === prevCombatant.id }));

    pushSnapshot();
    setCombatants(updatedCombatants);
    setCurrentTurnStartedAt(Date.now());
    setCurrentRound(prevRound);
    setCurrentTurnIndex(prevIndex);
    setSelectedCombatantId(prevCombatant.id);

    if (isDbAvailable && currentEncounterId) {
      const encId = currentEncounterId;
      isSyncingRef.current++;
      api.combatants.bulkUpdate(
        encId,
        updatedCombatants.map(c => ({ ...c, encounterId: encId })),
        { name: encounterName, currentRound: prevRound, currentTurnIndex: prevIndex, isEncounterActive: true, trackingData: combatantTracking }
      )
        .then(() => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          setSavedEncounters(prev => prev.map(e => e.id === encId ? { ...e, currentRound: prevRound } : e));
        })
        .catch((e: unknown) => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          console.error('Failed to persist prev-turn change', e);
        });
    }
  };

  const handleMoveCombatant = (combatantId: string, direction: 'up' | 'down') => {
    const sorted = [...combatants].filter(c => !c.ownerId).sort((a, b) => b.initiative - a.initiative);
    const idx = sorted.findIndex(c => c.id === combatantId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;
    const neighbor = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    const newInit = direction === 'up' ? neighbor.initiative + 1 : Math.max(0, neighbor.initiative - 1);
    const updated = combatants.map(c => c.id === combatantId ? { ...c, initiative: newInit } : c);
    const newSorted = sortWithCompanions(updated);
    const active = updated.find(c => c.isCurrentTurn);
    const newTurnIdx = active ? newSorted.findIndex(c => c.id === active.id) : currentTurnIndex;
    setCombatants(updated);
    setCurrentTurnIndex(newTurnIdx);
    if (isDbAvailable && currentEncounterId) {
      const moved = updated.find(c => c.id === combatantId)!;
      const encId = currentEncounterId;
      Promise.all([
        api.combatants.update(combatantId, { ...moved, encounterId: encId }),
        api.encounters.update(encId, { currentTurnIndex: newTurnIdx }),
      ]).catch((e: unknown) => {
        console.error('[moveCombatant] persist failed:', e);
        showError('Move failed to save — refresh to see saved order.');
      });
    }
  };

  const handleReorderCombatants = (newOrderIds: string[]) => {
    const mains = combatants.filter(c => !c.ownerId);
    if (mains.length !== newOrderIds.length) return;
    const sortedInits = mains.map(c => c.initiative).sort((a, b) => b - a);
    const initByNewPos = new Map<string, number>();
    newOrderIds.forEach((id, i) => initByNewPos.set(id, sortedInits[i]));
    const changed: string[] = [];
    const updated = combatants.map(c => {
      const newInit = initByNewPos.get(c.id);
      if (newInit !== undefined && newInit !== c.initiative) {
        changed.push(c.id);
        return { ...c, initiative: newInit };
      }
      return c;
    });
    if (changed.length === 0) return;
    const newSorted = sortWithCompanions(updated);
    const active = updated.find(c => c.isCurrentTurn);
    const newTurnIdx = active ? newSorted.findIndex(c => c.id === active.id) : currentTurnIndex;
    setCombatants(updated);
    setCurrentTurnIndex(newTurnIdx);
    if (isDbAvailable && currentEncounterId) {
      const encId = currentEncounterId;
      const updates = updated.filter(c => changed.includes(c.id));
      Promise.all([
        ...updates.map(c => api.combatants.update(c.id, { ...c, encounterId: encId })),
        api.encounters.update(encId, { currentTurnIndex: newTurnIdx }),
      ]).catch((e: unknown) => {
        console.error('[reorderCombatants] persist failed:', e);
        showError('Reorder failed to save — refresh to see saved order.');
      });
    }
  };


  const handleFinishInitiative = (updatedCombatants: Combatant[]) => {
    const sorted = sortWithCompanions(updatedCombatants);
    let finalCombatants = [...updatedCombatants];
    let firstId = null;

    if (sorted.length > 0) {
      firstId = sorted[0].id;
      finalCombatants = updatedCombatants.map(c => ({
        ...c,
        isCurrentTurn: c.id === firstId,
        // Reset non-player combatants to full HP so a re-run of an ended
        // encounter doesn't immediately trigger the auto-end effect.
        ...(c.type !== 'player' && { hp: { ...c.hp, current: c.hp.max }, tempHp: 0, deathSaves: undefined }),
      }));
      setSelectedCombatantId(firstId);
    }

    setCombatantTracking({});
    setActionHistory([]);
    setRedoStack([]);
    roundDurationsRef.current = [];
    roundStartTimeRef.current = Date.now();
    autoEndingRef.current = false;
    setCombatants(finalCombatants);
    setIsEncounterActive(true);
    if (currentEncounterId) {
      window.open(`${window.location.origin}/player/${currentEncounterId}`, '_blank');
    }
    setShowSummary(false);
    setIsInitiativeModalOpen(false);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    setCurrentTurnStartedAt(Date.now());

    if (isDbAvailable && currentEncounterId) {
      const encId = currentEncounterId;
      isSyncingRef.current++;
      Promise.all(finalCombatants.map(c => api.combatants.update(c.id, { ...c, encounterId: encId })))
        .then(() => api.encounters.update(encId, {
          name: encounterName,
          currentRound: 1,
          currentTurnIndex: 0,
          isEncounterActive: true,
          showSummary: false,
        }))
        .then(() => { isSyncingRef.current = Math.max(0, isSyncingRef.current - 1); })
        .catch((e: unknown) => {
          isSyncingRef.current = Math.max(0, isSyncingRef.current - 1);
          console.error('Failed to sync initiative to DB', e);
        });
    }
  };

  const handleEndEncounter = async () => {
    if (roundStartTimeRef.current !== null) {
      roundDurationsRef.current = [...roundDurationsRef.current, Date.now() - roundStartTimeRef.current];
      roundStartTimeRef.current = null;
    }
    const rawStats = computeEncounterStats(combatants, currentRound, combatantTracking);
    const stats = enrichStatsFromLog({ ...rawStats, roundDurations: roundDurationsRef.current }, combatLog);
    roundDurationsRef.current = [];
    setCombatantTracking({});
    setEncounterStats(stats);

    const allFallen = combatants.filter(c => c.type === 'player').every(c => c.hp.current <= 0);
    addLogEntry({ type: 'encounter_end', actorName: 'Encounter', detail: allFallen ? 'Defeat' : 'Victory!' });
    setIsEncounterActive(false);
    setActionHistory([]);
    setRedoStack([]);
    setCurrentTurnStartedAt(null);
    setShowSummary(true);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    setActiveBackground('');
    setActiveYoutubeUrl('');
    const updatedCombatants = combatants.map(c => ({ ...c, isCurrentTurn: false }));
    setCombatants(updatedCombatants);

    try {
      if (currentEncounterId) {
        await api.encounters.update(currentEncounterId, {
          name: encounterName,
          currentRound: 1,
          currentTurnIndex: 0,
          isEncounterActive: false,
          showSummary: true,
          encounterStats: stats,
          completedAt: new Date().toISOString(),
        });

        setSavedEncounters(prev => prev.map(e =>
          e.id === currentEncounterId ? { ...e, isEncounterActive: false } : e
        ));

        await Promise.all(updatedCombatants.map(c =>
          api.combatants.update(c.id, { ...c, encounterId: currentEncounterId! })
        ));

        for (const controller of playerPatchControllersRef.current.values()) {
          controller.abort();
        }
        playerPatchControllersRef.current.clear();

        const playerCombatants = updatedCombatants.filter(
          c => c.type === 'player' && c.playerId
        );
        await Promise.all(playerCombatants.map(c =>
          api.players.patch(c.playerId!, {
            hp_current: c.hp.current < c.hp.max ? c.hp.current : null,
            ac: c.ac,
            speed: c.speed,
            subtitle: c.subtitle,
            stats: c.stats,
            spellSlots: c.spellSlots,
            featureUses: c.featureUses,
          }).catch((e: unknown) => console.error('Failed end-of-encounter player flush', e))
        ));
      }
    } catch (e) {
      console.error('Failed to end encounter in DB', e);
    }
  };

  const handleCloseSummary = async () => {
    setShowSummary(false);
    if (currentEncounterId) {
      try {
        await api.encounters.update(currentEncounterId, {
          name: encounterName,
          currentRound,
          isEncounterActive: false,
          showSummary: false,
        });
      } catch (e) {
        console.error('Failed to close summary in DB', e);
      }
    }
    setCurrentEncounterId(null);
    navigate('/');
  };

  const handleHealAll = async () => {
    const healed = combatants.map(c => ({ ...c, hp: { ...c.hp, current: c.hp.max }, tempHp: 0 }));
    setCombatants(healed);
    if (isDbAvailable && currentEncounterId) {
      try {
        await Promise.all(healed.map(c =>
          api.combatants.update(c.id, { ...c, encounterId: currentEncounterId! })
        ));
      } catch (e) {
        console.error('Failed to heal all in DB', e);
      }
    }
  };

  const handleAddCompanion = async (ownerId: string, template: { name: string; hp: number; ac: number; avatar?: string; subtitle?: string; stats?: Combatant['stats'] }) => {
    const owner = combatants.find(c => c.id === ownerId);
    const newCompanion: Combatant = {
      id: uuid(),
      name: template.name,
      type: 'monster',
      initiative: owner?.initiative ?? 10,
      hp: { current: template.hp, max: template.hp },
      ac: template.ac,
      speed: '30 ft.',
      subtitle: template.subtitle ?? 'Companion',
      avatar: template.avatar ?? '',
      conditions: [],
      tags: [],
      stats: template.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ownerId,
    };
    setCombatants(prev => [...prev, newCompanion]);
    if (isDbAvailable && currentEncounterId) {
      try {
        await api.combatants.create({ ...newCompanion, encounterId: currentEncounterId });
      } catch (e) {
        console.error('Failed to add companion to DB', e);
      }
    }
  };

  const triggerConCheck = useCallback((combatantId: string, dc: number) => {
    setPendingConChecks(prev => ({ ...prev, [combatantId]: dc }));
  }, [setPendingConChecks]);

  const clearConCheck = useCallback((combatantId: string) => {
    setPendingConChecks(prev => { const n = { ...prev }; delete n[combatantId]; return n; });
  }, [setPendingConChecks]);

  return {
    handleDeleteCombatant,
    handleUpdateCombatant,
    handleAddCompanion,
    handleNextTurn,
    handlePrevTurn,
    handleMoveCombatant,
    handleReorderCombatants,
    handleFinishInitiative,
    handleEndEncounter,
    handleCloseSummary,
    handleHealAll,
    handleUndo,
    handleRedo,
    triggerConCheck,
    clearConCheck,
    handlePolymorph,
    handleRevertPolymorph,
  };
}
