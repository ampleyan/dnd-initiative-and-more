import { useState, useEffect, useCallback } from 'react';
import { MonsterTemplate } from '../types';
import { MONSTER_LIBRARY } from '../constants';
import { api } from '../api/client';

export function useMonsters() {
  const [monsters, setMonsters] = useState<MonsterTemplate[]>([]);
  const [isDbAvailable, setIsDbAvailable] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const health = await api.health.check();
      setIsDbAvailable(!!health.dbAvailable);

      if (health.dbAvailable) {
        const data = await api.monsters.list();
        if (data && data.length > 0) {
          setMonsters(data);
        } else {
          setMonsters(MONSTER_LIBRARY);
        }
      } else {
        setMonsters(MONSTER_LIBRARY);
      }
    } catch (e) {
      console.error("Failed to fetch monsters", e);
      setIsDbAvailable(false);
      setMonsters(MONSTER_LIBRARY);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateMonster = async (updated: MonsterTemplate) => {
    setMonsters(prev => prev.map(m => m.id === updated.id ? updated : m));
    if (isDbAvailable) {
      try {
        await api.monsters.update(updated.id, updated);
      } catch (e) {
        console.error("Failed to update monster in DB", e);
      }
    }
  };

  const addMonster = async (monster: MonsterTemplate) => {
    setMonsters(prev => [...prev, monster]);
    if (isDbAvailable) {
      try {
        await api.monsters.create(monster);
      } catch (e) {
        console.error("Failed to add monster to DB", e);
      }
    }
  };

  return { monsters, setMonsters, updateMonster, addMonster, fetchData };
}
