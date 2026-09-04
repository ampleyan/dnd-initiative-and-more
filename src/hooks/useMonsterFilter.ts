import { useState, useMemo, useCallback } from 'react';
import { MonsterTemplate } from '../types';

export interface MonsterFilters {
  search: string;
  crRange: [number, number];
  types: string[];
  sources: string[];
  tags: string[];
  sizes: string[];
  traits: string[];
  groupBy: 'none' | 'cr' | 'type' | 'source';
}

export interface MonsterGroup {
  key: string;
  label: string;
  monsters: MonsterTemplate[];
}

const DEFAULT_FILTERS: MonsterFilters = {
  search: '',
  crRange: [0, 30],
  types: [],
  sources: [],
  tags: [],
  sizes: [],
  traits: [],
  groupBy: 'none',
};

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function parseSize(type: string): string {
  const first = type?.split(' ')[0] ?? '';
  return SIZES.find(s => first.toLowerCase() === s.toLowerCase()) ?? '';
}

function hasTrait(m: MonsterTemplate, trait: string): boolean {
  if (trait === 'legendary') return (m.actions ?? []).some(a => /legendary/i.test(a.name));
  if (trait === 'spellcaster') return (m.abilities ?? []).some(a => /spellcasting/i.test(a.name));
  if (trait === 'flying') return /fly/i.test(m.speed ?? '');
  if (trait === 'swarm') return /swarm/i.test(m.type ?? '');
  if (trait === 'undead') return /undead/i.test(m.type ?? '');
  if (trait === 'shapechanger') return (m.abilities ?? []).some(a => /shapechanger/i.test(a.name));
  return false;
}

function parseCR(cr: string): number {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

export function useMonsterFilter(monsters: MonsterTemplate[]) {
  const [filters, setFilters] = useState<MonsterFilters>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return monsters.filter(m => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !(m.type ?? '').toLowerCase().includes(q)) {
          return false;
        }
      }

      const cr = parseCR(m.cr ?? '0');
      if (cr < filters.crRange[0] || cr > filters.crRange[1]) return false;

      if (filters.types.length > 0 && !filters.types.includes(m.type ?? '')) return false;
      if (filters.sources.length > 0 && !filters.sources.includes(m.source ?? 'custom')) return false;

      if (filters.tags.length > 0) {
        const mTags = m.tags ?? [];
        if (!filters.tags.some(t => mTags.includes(t))) return false;
      }

      if (filters.sizes.length > 0) {
        if (!filters.sizes.includes(parseSize(m.type ?? ''))) return false;
      }

      if (filters.traits.length > 0) {
        if (!filters.traits.every(t => hasTrait(m, t))) return false;
      }

      return true;
    });
  }, [monsters, filters]);

  const grouped = useMemo((): MonsterGroup[] => {
    if (filters.groupBy === 'none') {
      return [{ key: 'all', label: 'All', monsters: filtered }];
    }

    const groupMap = new Map<string, MonsterTemplate[]>();
    for (const m of filtered) {
      const key =
        filters.groupBy === 'cr' ? (m.cr ?? '0') :
        filters.groupBy === 'type' ? (m.type ?? 'Unknown') :
        (m.source ?? 'custom');
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    }

    const entries = Array.from(groupMap.entries()).map(([key, monsters]) => ({
      key,
      label: filters.groupBy === 'cr' ? `CR ${key}` : key,
      monsters,
    }));

    if (filters.groupBy === 'cr') {
      entries.sort((a, b) => parseCR(a.key) - parseCR(b.key));
    } else {
      entries.sort((a, b) => a.label.localeCompare(b.label));
    }

    return entries;
  }, [filtered, filters.groupBy]);

  const availableTypes = useMemo(() =>
    Array.from(new Set(monsters.map(m => m.type).filter(Boolean))).sort() as string[],
    [monsters]
  );

  const availableSources = useMemo(() =>
    Array.from(new Set(monsters.map(m => m.source ?? 'custom').filter(Boolean))).sort() as string[],
    [monsters]
  );

  const availableTags = useMemo(() =>
    Array.from(new Set(monsters.flatMap(m => m.tags ?? []))).sort() as string[],
    [monsters]
  );

  const availableSizes = useMemo(() =>
    SIZES.filter(s => monsters.some(m => parseSize(m.type ?? '') === s)),
    [monsters]
  );

  const setSearch = useCallback((search: string) => setFilters(f => ({ ...f, search })), []);
  const setCrRange = useCallback((crRange: [number, number]) => setFilters(f => ({ ...f, crRange })), []);
  const setTypes = useCallback((types: string[]) => setFilters(f => ({ ...f, types })), []);
  const setSources = useCallback((sources: string[]) => setFilters(f => ({ ...f, sources })), []);
  const setTags = useCallback((tags: string[]) => setFilters(f => ({ ...f, tags })), []);
  const setSizes = useCallback((sizes: string[]) => setFilters(f => ({ ...f, sizes })), []);
  const setTraits = useCallback((traits: string[]) => setFilters(f => ({ ...f, traits })), []);
  const setGroupBy = useCallback((groupBy: MonsterFilters['groupBy']) => setFilters(f => ({ ...f, groupBy })), []);
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  return {
    filters,
    filtered,
    grouped,
    availableTypes,
    availableSources,
    availableTags,
    availableSizes,
    setSearch,
    setCrRange,
    setTypes,
    setSources,
    setTags,
    setSizes,
    setTraits,
    setGroupBy,
    resetFilters,
  };
}
