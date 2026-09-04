import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Combatant, Encounter, MonsterTemplate, EncounterStats } from '../types';
import { INITIAL_COMBATANTS, MONSTER_LIBRARY } from '../constants';
import { api } from '../api/client';

export function useEncounter(encounterId: string | null) {
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [encounterName, setEncounterName] = useState('New Encounter');
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isEncounterActive, setIsEncounterActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isDbAvailable, setIsDbAvailable] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [encounterStats, setEncounterStats] = useState<EncounterStats | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const runSimulation = async () => {
    if (isSimulating || combatants.length === 0) return;
    setIsSimulating(true);
    setIsEncounterActive(true);
    setShowSummary(false);
    setEncounterStats(null);
    setCurrentRound(1);
    setCurrentTurnIndex(0);

    // 1. Reset all combatants to max HP and roll initiative
    let simulatedCombatants = combatants.map(c => ({
      ...c,
      hp: { ...c.hp, current: c.hp.max },
      initiative: Math.floor(Math.random() * 20) + 1 + (c.stats?.dex ? Math.floor((c.stats.dex - 10) / 2) : 0),
      conditions: []
    }));

    // Initialize tracking
    const tracking: Record<string, { damageTaken: number; healingReceived: number; damageDone: number; kills: number; name: string; type: string }> = {};
    simulatedCombatants.forEach(c => {
      tracking[c.id] = { damageTaken: 0, healingReceived: 0, damageDone: 0, kills: 0, name: c.name, type: c.type };
    });

    // 2. Sort by initiative and set current turn
    simulatedCombatants.sort((a, b) => b.initiative - a.initiative);
    simulatedCombatants = simulatedCombatants.map((c, i) => ({ ...c, isCurrentTurn: i === 0 }));
    setCombatants(simulatedCombatants);

    if (isDbAvailable && encounterId) {
      await api.encounters.update(encounterId, { isEncounterActive: true, currentRound: 1, currentTurnIndex: 0 });
    }

    // 3. Simulation Loop
    let round = 1;
    let turn = 0;

    while (round <= 3) {
      const actor = simulatedCombatants[turn];
      if (actor.hp.current <= 0) {
        turn++;
        if (turn >= simulatedCombatants.length) {
          turn = 0;
          round++;
        }
        continue;
      }

      // Decide: Attack or Heal? (Players heal sometimes, monsters just attack)
      const shouldHeal = actor.type === 'player' && Math.random() > 0.7;

      if (shouldHeal) {
        const healTargets = simulatedCombatants.filter(c => c.type === actor.type && c.hp.current > 0 && c.hp.current < c.hp.max);
        if (healTargets.length > 0) {
          const target = healTargets[Math.floor(Math.random() * healTargets.length)];
          const healAmount = Math.floor(Math.random() * 10) + 5;
          const actualHeal = Math.min(target.hp.max - target.hp.current, healAmount);

          simulatedCombatants = simulatedCombatants.map(c => {
            if (c.id === target.id) {
              return { ...c, hp: { ...c.hp, current: c.hp.current + actualHeal } };
            }
            return c;
          });

          tracking[target.id].healingReceived += actualHeal;
        }
      } else {
        const targets = simulatedCombatants.filter(c => c.type !== actor.type && c.hp.current > 0);
        if (targets.length === 0) break; // Victory!

        const target = targets[Math.floor(Math.random() * targets.length)];

        // Players win: players do more damage, monsters do less
        const damage = actor.type === 'player' 
          ? Math.floor(Math.random() * 15) + 10 
          : Math.floor(Math.random() * 5) + 2;

        simulatedCombatants = simulatedCombatants.map(c => {
          if (c.id === target.id) {
            const newHp = Math.max(0, c.hp.current - damage);
            const actualDamage = c.hp.current - newHp;
            tracking[target.id].damageTaken += actualDamage;
            tracking[actor.id].damageDone += actualDamage;
            if (newHp === 0 && c.hp.current > 0) {
              tracking[actor.id].kills += 1;
            }
            return { ...c, hp: { ...c.hp, current: newHp } };
          }
          return c;
        });
      }

      // Advance turn
      turn++;
      if (turn >= simulatedCombatants.length) {
        turn = 0;
        round++;
        if (round > 3) break;
      }

      // Update current turn flag
      simulatedCombatants = simulatedCombatants.map((c, i) => ({ ...c, isCurrentTurn: i === turn }));

      setCombatants([...simulatedCombatants]);
      setCurrentRound(Math.min(3, round));
      setCurrentTurnIndex(turn);

      // Brief delay to make it look "real"
      await new Promise(r => setTimeout(r, 800));

      // Check if any monsters left
      if (!simulatedCombatants.some(c => c.type !== 'player' && c.hp.current > 0)) break;
      // Check if any players left
      if (!simulatedCombatants.some(c => c.type === 'player' && c.hp.current > 0)) break;
    }

    setIsSimulating(false);

    // Auto-end encounter if it finished or reached limit
    // Calculate final stats
    const finalStats: EncounterStats = {
      totalRounds: Math.min(3, round),
      playersAlive: simulatedCombatants.filter(c => c.type === 'player' && c.hp.current > 0).length,
      playersFallen: simulatedCombatants.filter(c => c.type === 'player' && c.hp.current <= 0).length,       
      enemiesDefeated: simulatedCombatants.filter(c => c.type !== 'player' && c.hp.current <= 0).length,     
      enemiesEscaped: simulatedCombatants.filter(c => c.type !== 'player' && c.hp.current > 0).length,       
      highlights: [],
      combatantStats: {}
    };

    // Map tracking to combatantStats
    Object.entries(tracking).forEach(([id, t]) => {
      if (finalStats.combatantStats) {
        finalStats.combatantStats[id] = t;
      }
    });

    // Simple highlights
    if (finalStats.playersFallen === 0) {
      finalStats.highlights.push({ icon: 'Shield', label: 'Flawless Victory', value: 'No party members fell' });
    } else {
      finalStats.highlights.push({ icon: 'Skull', label: 'Battle Scars', value: `${finalStats.playersFallen} fallen hero${finalStats.playersFallen > 1 ? 'es' : ''}` });
    }

    setEncounterStats(finalStats);
    setShowSummary(true);
    setIsEncounterActive(false);

    if (isDbAvailable && encounterId) {
      await api.encounters.update(encounterId, {
        currentRound: 1,
        currentTurnIndex: 0,
        isEncounterActive: false,
        showSummary: true,
        encounterStats: finalStats,
        completedAt: new Date().toISOString(),
      });
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const health = await api.health.check();
      setIsDbAvailable(!!health.dbAvailable);

      if (health.dbAvailable && encounterId) {
        const data = await api.encounters.list();
        const current = data.find((e: Encounter) => e.id === encounterId);
        if (current) {
          setShowSummary(!!current.showSummary);
          setIsEncounterActive(!!current.isEncounterActive);
          setCurrentRound(current.currentRound || 1);
          setCurrentTurnIndex(current.currentTurnIndex || 0);
          setEncounterName(current.name);
        }

        const combatantsData = await api.combatants.list(encounterId);
        setCombatants(combatantsData);
      } else if (!encounterId) {
        setCombatants(prev => prev.length > 0 ? prev : INITIAL_COMBATANTS);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
      setIsDbAvailable(false);
      if (!encounterId) {
        setCombatants(prev => prev.length > 0 ? prev : INITIAL_COMBATANTS);
      }
    }
  }, [encounterId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      if (encounterId) {
        socket.emit('join-encounter', encounterId);
      }
    });

    socket.on('encounter-updated', (data: { encounterId: string }) => {
      if (data.encounterId === encounterId) {
        fetchData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [encounterId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateCombatant = async (updated: Combatant) => {
    const combatantWithEncounter = { ...updated, encounterId: encounterId || undefined };
    setCombatants(prev => prev.map(c => c.id === updated.id ? combatantWithEncounter : c));

    if (isDbAvailable) {
      try {
        await api.combatants.update(updated.id, combatantWithEncounter);
      } catch (e) {
        console.error("Failed to update combatant in DB", e);
      }
    }
  };

  const deleteCombatant = async (id: string) => {
    setCombatants(prev => prev.filter(c => c.id !== id));
    if (isDbAvailable) {
      try {
        await api.combatants.delete(id);
      } catch (e) {
        console.error("Failed to delete combatant from DB", e);
      }
    }
  };

  const nextTurn = async () => {
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    if (sorted.length === 0) return;

    let nextIndex = currentTurnIndex + 1;
    let nextRound = currentRound;

    if (nextIndex >= sorted.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    const nextCombatant = sorted[nextIndex];
    const updatedCombatants = combatants.map(c => ({
      ...c,
      isCurrentTurn: c.id === nextCombatant.id
    }));

    setCombatants(updatedCombatants);
    setCurrentRound(nextRound);
    setCurrentTurnIndex(nextIndex);

    if (isDbAvailable && encounterId) {
      try {
        await api.encounters.update(encounterId, {
          name: encounterName,
          currentRound: nextRound,
          currentTurnIndex: nextIndex,
          isEncounterActive: true
        });

        await Promise.all(updatedCombatants.map(c =>
          api.combatants.update(c.id, { ...c, encounterId })
        ));
      } catch (e) {
        console.error("Failed to update turn in DB", e);
      }
    }
  };

  const handleFinishInitiative = useCallback((updatedCombatants: Combatant[]) => {
    const sorted = [...updatedCombatants].sort((a, b) => b.initiative - a.initiative);
    let finalCombatants = [...updatedCombatants];
    if (sorted.length > 0) {
      const firstId = sorted[0].id;
      finalCombatants = updatedCombatants.map(c => ({ ...c, isCurrentTurn: c.id === firstId }));
    }
    setCombatants(finalCombatants);
    setIsEncounterActive(true);
    setShowSummary(false);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    if (isDbAvailable && encounterId) {
      const encId = encounterId;
      // Combatants first, then encounter — deliberate ordering to prevent
      // another client seeing isEncounterActive:true with uninitialized initiatives
      Promise.all(finalCombatants.map(c => api.combatants.update(c.id, { ...c, encounterId: encId })))
        .then(() => api.encounters.update(encId, {
          currentRound: 1, currentTurnIndex: 0,
          isEncounterActive: true, showSummary: false,
        }))
        .catch(e => console.error('Failed to sync initiative to DB', e));
    }
  }, [encounterId, isDbAvailable]);

  const handleEndEncounter = useCallback(async (stats: EncounterStats) => {
    setEncounterStats(stats);
    setIsEncounterActive(false);
    setShowSummary(true);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    const updated = combatants.map(c => ({ ...c, isCurrentTurn: false }));
    setCombatants(updated);
    if (isDbAvailable && encounterId) {
      try {
        await api.encounters.update(encounterId, {
          currentRound: 1, currentTurnIndex: 0,
          isEncounterActive: false, showSummary: true,
          encounterStats: stats,
          completedAt: new Date().toISOString(),
        });
        await Promise.all(updated.map(c => api.combatants.update(c.id, { ...c, encounterId })));
      } catch (e) {
        console.error('Failed to sync end encounter to DB', e);
      }
    }
  }, [combatants, isDbAvailable, encounterId]);

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    if (isDbAvailable && encounterId) {
      api.encounters.update(encounterId, { showSummary: false }).catch(console.error);
    }
  }, [isDbAvailable, encounterId]);

  return {
    combatants,
    setCombatants,
    encounterName,
    setEncounterName,
    currentRound,
    setCurrentRound,
    currentTurnIndex,
    setCurrentTurnIndex,
    isEncounterActive,
    setIsEncounterActive,
    showSummary,
    setShowSummary,
    isDbAvailable,
    updateCombatant,
    deleteCombatant,
    nextTurn,
    fetchData,
    isSimulating,
    runSimulation,
    encounterStats,
    setEncounterStats,
    handleFinishInitiative,
    handleEndEncounter,
    handleCloseSummary,
  };
}
