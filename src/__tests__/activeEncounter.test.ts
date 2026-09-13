import { describe, expect, it } from 'vitest';
import { selectPersistedActiveEncounter } from '../hooks/useAppState';
import type { Encounter } from '../types';

const activeEncounter: Encounter = {
  id: 'active-encounter',
  name: 'P50. Vault',
  lastModified: '2026-09-13T10:00:00.000Z',
  isEncounterActive: true,
  currentRound: 2,
  combatants: [],
};

describe('selectPersistedActiveEncounter', () => {
  it('restores the persisted active encounter when no encounter is selected', () => {
    expect(selectPersistedActiveEncounter([activeEncounter], null)).toBe(activeEncounter);
  });

  it('does not replace an encounter selected by the route', () => {
    expect(selectPersistedActiveEncounter([activeEncounter], 'route-encounter')).toBeNull();
  });
});
