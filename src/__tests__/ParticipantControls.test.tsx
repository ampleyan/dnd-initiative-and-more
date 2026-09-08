import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ParticipantControls } from '../components/ParticipantControls';
import type { Combatant, Player } from '../types';
import { useCombatActions, type CombatActionsParams } from '../hooks/useCombatActions';

vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showError: vi.fn() }) }));

afterEach(cleanup);

it('removes a mixed selection together and preserves the surviving active turn', () => {
  const setCombatants = vi.fn();
  const setCurrentTurnIndex = vi.fn();
  const { result } = renderHook(() => useCombatActions({
    combatants: [
      { id: 'a', type: 'player', initiative: 20 },
      { id: 'b', type: 'monster', initiative: 15 },
      { id: 'c', type: 'monster', initiative: 10, isCurrentTurn: true },
    ] as Combatant[],
    currentTurnIndex: 2, isEncounterActive: true, isDbAvailable: false,
    setCombatants, setCurrentTurnIndex, setSelectedCombatantId: vi.fn(), setIsEditModalOpen: vi.fn(),
  } as unknown as CombatActionsParams));
  act(() => result.current.handleDeleteCombatant(['a', 'b']));
  expect(setCombatants).toHaveBeenCalledWith([expect.objectContaining({ id: 'c', isCurrentTurn: true })]);
  expect(setCurrentTurnIndex).toHaveBeenCalledWith(0);
});

it('adds only chosen players who are not already in the encounter', async () => {
  const onAddPlayer = vi.fn();
  render(<ParticipantControls players={[{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }] as Player[]}
    combatants={[{ id: 'c', playerId: 'a', type: 'player', name: 'Alice' }] as Combatant[]}
    onAddPlayer={onAddPlayer} onAddMonsters={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Players' }));
  expect(screen.getByRole('checkbox', { name: /Alice/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Bob/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Add selected (1)' }));
  await waitFor(() => expect(onAddPlayer).toHaveBeenCalledTimes(1));
  expect(onAddPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
});

it('opens monsters directly and adds all available players', async () => {
  const onAddPlayer = vi.fn();
  const onAddMonsters = vi.fn();
  render(<ParticipantControls players={[{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }] as Player[]}
    combatants={[]} onAddPlayer={onAddPlayer} onAddMonsters={onAddMonsters} />);
  fireEvent.click(screen.getByRole('button', { name: 'Monsters' }));
  expect(onAddMonsters).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Players' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add all (2)' }));
  await waitFor(() => expect(onAddPlayer).toHaveBeenCalledTimes(2));
});
