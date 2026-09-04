import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Combatant, Player, Spell, ClassFeature, SpellSlots } from '../types';
import { uuid } from '../lib/utils';
import { defaultSpellSlots } from '../lib/spellSlotDefaults';
import { api } from '../api/client';

export interface PlayerActionsParams {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  spells: Spell[];
  setSpells: React.Dispatch<React.SetStateAction<Spell[]>>;
  classFeatures: ClassFeature[];
  setClassFeatures: React.Dispatch<React.SetStateAction<ClassFeature[]>>;
  isDbAvailable: boolean;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  currentEncounterId: string | null;
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  playersRef: React.MutableRefObject<Player[]>;
  navigate: ReturnType<typeof useNavigate>;
}

export function usePlayerActions(params: PlayerActionsParams) {
  const {
    players, setPlayers,
    spells, setSpells,
    classFeatures, setClassFeatures,
    isDbAvailable,
    setIsSaving,
    currentEncounterId,
    combatants, setCombatants,
    playersRef,
    navigate,
  } = params;

  const syncCombatantsFromPlayer = (saved: Player) => {
    setCombatants(prev => prev.map(c => {
      const isMatch = c.playerId === saved.id ||
        (c.type === 'player' && c.name.toLowerCase() === saved.name.toLowerCase());
      if (!isMatch) return c;
      const mergedSlots: SpellSlots | undefined = saved.spellSlots
        ? Object.fromEntries(
            Object.entries(saved.spellSlots).map(([lvl, s]) => [
              lvl,
              { total: s!.total, used: c.spellSlots?.[Number(lvl)]?.used ?? 0 },
            ])
          )
        : c.spellSlots;
      const updated: Combatant = {
        ...c,
        playerId: saved.id,
        hp: { ...c.hp, max: saved.hp_max },
        ac: saved.ac,
        speed: saved.speed,
        subtitle: saved.subtitle,
        avatar: saved.avatar,
        stats: { ...saved.stats },
        actions: saved.actions ?? [],
        abilities: saved.abilities ?? [],
        spells: saved.spells ?? [],
        spellSlots: mergedSlots,
      };
      if (isDbAvailable) {
        api.combatants.update(c.id, updated).catch(console.error);
      }
      return updated;
    }));
  };

  const handleImportPlayer = async (dndBeyondId: string, cobaltSession?: string) => {
    const character = await api.dndBeyond.importCharacter(dndBeyondId, cobaltSession) as Partial<Player>;

    const matchedSpellIds = (character.spells ?? [])
      .map((s: { name: string }) => spells.find(lib => lib.name.toLowerCase() === s.name.toLowerCase())?.id)
      .filter(Boolean) as string[];

    const { level, subtitle } = character;
    const defaultSlots = defaultSpellSlots(level ?? 1, subtitle ?? '');

    const saved = await api.players.create({ ...character, dndBeyondId, spellIds: matchedSpellIds, spellSlots: defaultSlots });
    setPlayers(prev => {
      const existing = prev.findIndex(p => p.dndBeyondId === saved.dndBeyondId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = saved;
        return next;
      }
      return [...prev, saved];
    });
    syncCombatantsFromPlayer(saved);
    return saved;
  };

  const handleCreatePlayer = async (data: Partial<Player>): Promise<Player> => {
    const saved = await api.players.create(data);
    setPlayers(prev => {
      const existing = prev.findIndex(p => p.id === saved.id || p.name === saved.name);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = saved;
        return next;
      }
      return [...prev, saved];
    });
    syncCombatantsFromPlayer(saved);
    return saved;
  };

  const handleUpdatePlayer = async (id: string, updates: Partial<Player>) => {
    const existing = players.find(p => p.id === id);
    const enriched = { ...existing, ...updates };
    if (updates.spells !== undefined) {
      enriched.spellIds = updates.spells
        .map(s => spells.find(lib => lib.name.toLowerCase() === s.name.toLowerCase())?.id)
        .filter(Boolean) as string[];
    }
    if (updates.abilities !== undefined) {
      enriched.featureIds = updates.abilities
        .map(a => classFeatures.find(f => f.name.toLowerCase() === a.name.toLowerCase())?.id)
        .filter(Boolean) as string[];
    }
    const saved = await api.players.update(id, enriched);
    setPlayers(prev => prev.map(p => p.id === id ? saved : p));
    return saved;
  };

  const handleUpdateSpellSlot = (playerId: string, level: number, used: number) => {
    const combatant = combatants.find(c => c.playerId === playerId);
    if (!combatant?.spellSlots?.[level]) return;
    const newSlots: SpellSlots = { ...combatant.spellSlots, [level]: { ...combatant.spellSlots[level]!, used } };
    playersRef.current = playersRef.current.map(p =>
      p.id === playerId ? { ...p, spellSlots: newSlots } : p
    );
    setCombatants(prev => prev.map(c => c.playerId === playerId ? { ...c, spellSlots: newSlots } : c));
    api.players.patch(playerId, { spellSlots: newSlots }).catch(console.error);
  };

  const handleRest = async (playerId: string, type: 'short' | 'long') => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const resetSlots = type === 'long' && player.spellSlots
      ? Object.fromEntries(
          Object.entries(player.spellSlots).map(([lvl, s]) => [lvl, { total: s?.total ?? 0, used: 0 }])
        ) as typeof player.spellSlots
      : player.spellSlots;

    const resetFeatureUses = player.featureUses
      ? Object.fromEntries(
          Object.entries(player.featureUses).map(([id, f]) =>
            type === 'long' || f.restType === 'short'
              ? [id, { ...f, used: 0 }]
              : [id, f]
          )
        ) as typeof player.featureUses
      : player.featureUses;

    api.players.patch(playerId, { spellSlots: resetSlots, featureUses: resetFeatureUses }).catch(console.error);
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, spellSlots: resetSlots, featureUses: resetFeatureUses } : p));
    setCombatants(prev => prev.map(c =>
      c.playerId === playerId
        ? { ...c, spellSlots: resetSlots, featureUses: resetFeatureUses }
        : c
    ));
  };

  const handleUpdateFeatureUse = async (playerId: string, featureId: string, used: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const entry = player.featureUses?.[featureId];
    if (!entry) return;
    const newFeatureUses = { ...player.featureUses, [featureId]: { ...entry, used } };
    api.players.patch(playerId, { featureUses: newFeatureUses }).catch(console.error);
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, featureUses: newFeatureUses } : p));
    setCombatants(prev => prev.map(c =>
      c.playerId === playerId ? { ...c, featureUses: newFeatureUses } : c
    ));
  };

  const handleRemovePlayer = async (id: string) => {
    const original = players.find(p => p.id === id);
    setPlayers(prev => prev.filter(p => p.id !== id));
    setIsSaving(true);
    try {
      await api.players.delete(id);
    } catch (e) {
      console.error('Failed to delete player', e);
      if (original) setPlayers(prev => [...prev, original]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportClassFeatures = async (features: ClassFeature[]) => {
    await api.classFeatures.bulkCreate(features);
    setClassFeatures(features);
  };

  const handleAddPlayerToEncounter = async (player: Player) => {
    const newCombatant: Combatant = {
      id: uuid(),
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
      spellIds: player.spellIds ?? [],
      featureIds: player.featureIds ?? [],
      playerId: player.id,
      spellSlots: { ...player.spellSlots },
      featureUses: { ...player.featureUses },
    };

    setCombatants(prev => [...prev, newCombatant]);
    navigate('/encounters');

    if (isDbAvailable && currentEncounterId) {
      try {
        await api.combatants.create({ ...newCombatant, encounterId: currentEncounterId });
      } catch (e) {
        console.error('Failed to add player combatant to DB', e);
      }
    }
  };

  const handleAddAllPlayersToEncounter = async () => {
    const existingNames = new Set(combatants.map(c => c.name.toLowerCase()));
    const toAdd = players.filter(p => !existingNames.has(p.name.toLowerCase()));
    if (toAdd.length === 0) return;
    const newCombatants = toAdd.map(p => ({
      id: uuid(),
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
      playerId: p.id,
      spellIds: p.spellIds ?? [],
      featureIds: p.featureIds ?? [],
      spellSlots: p.spellSlots ? { ...p.spellSlots } : undefined,
      featureUses: p.featureUses ? { ...p.featureUses } : undefined,
    }));
    setCombatants(prev => [...prev, ...newCombatants]);
    if (isDbAvailable && currentEncounterId) {
      try {
        await Promise.all(newCombatants.map(c =>
          api.combatants.create({ ...c, encounterId: currentEncounterId! })
        ));
      } catch (e) {
        console.error('Failed to add all players to DB', e);
      }
    }
  };

  const handleImportSpells = async (newSpells: Spell[]) => {
    setSpells(prev => [...prev, ...newSpells]);

    if (isDbAvailable) {
      try {
        await Promise.all(newSpells.map(s => api.spells.create(s)));
      } catch (e) {
        console.error('Failed to save imported spells to DB', e);
      }
    }

    navigate('/spells');
  };

  return {
    handleImportPlayer,
    handleCreatePlayer,
    handleUpdatePlayer,
    handleUpdateSpellSlot,
    handleUpdateFeatureUse,
    handleRest,
    handleRemovePlayer,
    handleImportClassFeatures,
    handleAddPlayerToEncounter,
    handleAddAllPlayersToEncounter,
    handleImportSpells,
  };
}
