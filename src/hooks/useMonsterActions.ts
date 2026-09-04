import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Combatant, MonsterTemplate } from '../types';
import { uuid } from '../lib/utils';
import { api } from '../api/client';

export interface MonsterActionsParams {
  monsters: MonsterTemplate[];
  setMonsters: React.Dispatch<React.SetStateAction<MonsterTemplate[]>>;
  isDbAvailable: boolean;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  currentEncounterId: string | null;
  combatants: Combatant[];
  setCombatants: React.Dispatch<React.SetStateAction<Combatant[]>>;
  setEditingMonsterId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMonsterEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navigate: ReturnType<typeof useNavigate>;
}

export function useMonsterActions(params: MonsterActionsParams) {
  const {
    monsters, setMonsters,
    isDbAvailable,
    setIsSaving,
    currentEncounterId,
    setCombatants,
    setEditingMonsterId,
    setIsMonsterEditModalOpen,
    navigate,
  } = params;

  const handleCopyMonster = (monster: MonsterTemplate) => {
    const copy: MonsterTemplate = {
      ...monster,
      id: uuid(),
      name: monster.name + ' (Copy)',
    };
    setMonsters(prev => [...prev, copy]);
    setEditingMonsterId(copy.id);
    setIsMonsterEditModalOpen(true);

    if (isDbAvailable) {
      api.monsters.create(copy)
        .catch((e: unknown) => console.error('Failed to save monster copy to DB', e));
    }
  };

  const handleUpdateMonster = (updated: MonsterTemplate) => {
    setMonsters(prev => prev.map(m => m.id === updated.id ? updated : m));
    setIsMonsterEditModalOpen(false);

    if (isDbAvailable) {
      api.monsters.update(updated.id, updated)
        .catch((e: unknown) => console.error('Failed to update monster in DB', e));
    }
  };

  const handleDeleteMonster = async (id: string) => {
    const original = monsters.find(m => m.id === id);
    setMonsters(prev => prev.filter(m => m.id !== id));
    setIsSaving(true);
    try {
      if (isDbAvailable) await api.monsters.delete(id);
    } catch (e) {
      console.error('Failed to delete monster', e);
      if (original) setMonsters(prev => [...prev, original]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllMonsters = async () => {
    setMonsters([]);
    if (isDbAvailable) {
      try {
        await api.monsters.deleteAll();
      } catch (e) {
        console.error('Failed to delete all monsters from DB', e);
      }
    }
  };

  const handleAddMonsterToEncounter = async (monster: MonsterTemplate, initiative = 10, count = 1, hidden = false, waveId = 'default') => {
    const newCombatants: Combatant[] = Array.from({ length: count }, (_, i) => ({
      id: uuid(),
      name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
      type: 'monster' as const,
      initiative,
      hp: { current: monster.hp, max: monster.hp },
      ac: monster.ac,
      speed: monster.speed,
      subtitle: `${monster.type} • CR ${monster.cr}`,
      avatar: monster.image,
      conditions: [],
      tags: monster.tags ? [...monster.tags] : [],
      stats: { ...monster.stats },
      vulnerabilities: monster.vulnerabilities ? [...monster.vulnerabilities] : [],
      resistances: monster.resistances ? [...monster.resistances] : [],
      damageImmunities: monster.damageImmunities ? [...monster.damageImmunities] : [],
      conditionImmunities: monster.conditionImmunities ? [...monster.conditionImmunities] : [],
      actions: monster.actions ? [...monster.actions] : [],
      abilities: monster.abilities ? [...monster.abilities] : [],
      spells: monster.spells ? [...monster.spells] : [],
      hidden,
      waveId,
    }));

    setCombatants(prev => [...prev, ...newCombatants]);

    if (isDbAvailable && currentEncounterId) {
      try {
        await Promise.all(newCombatants.map(c => api.combatants.create({ ...c, encounterId: currentEncounterId })));
      } catch (e) {
        console.error('Failed to add combatant to DB', e);
      }
    }
  };

  const handleImportMonsters = async (newMonsters: MonsterTemplate[]) => {
    setMonsters(prev => {
      const result = [...prev];
      for (const incoming of newMonsters) {
        const existingIdx = result.findIndex(m => m.name.toLowerCase() === incoming.name.toLowerCase());
        if (existingIdx >= 0) {
          result[existingIdx] = { ...incoming, id: result[existingIdx].id };
        } else {
          result.push(incoming);
        }
      }
      return result;
    });

    if (isDbAvailable) {
      try {
        await Promise.all(newMonsters.map(m => api.monsters.create(m)));
      } catch (e) {
        console.error('Failed to save imported monsters to DB', e);
      }
    }

    navigate('/monsters');
  };

  return {
    handleCopyMonster,
    handleUpdateMonster,
    handleDeleteMonster,
    handleDeleteAllMonsters,
    handleAddMonsterToEncounter,
    handleImportMonsters,
  };
}
