import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainContent } from '../components/MainContent';
import { AddEnemyModal } from '../components/AddEnemyModal';
import type { Combatant, MonsterTemplate } from '../types';

const requests = vi.hoisted(() => ({ reveal: vi.fn(), conceal: vi.fn(), get: vi.fn(), error: vi.fn() }));
vi.mock('../api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../api/client')>(),
  api: { encounters: { revealWave: requests.reveal, concealWave: requests.conceal, get: requests.get } },
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showError: requests.error }) }));
vi.mock('../components/CombatantRow', () => ({ CombatantRow: () => null }));
vi.mock('../components/TacticalSummary', () => ({ TacticalSummary: () => null }));

const monster = { id: 'goblin', name: 'Goblin', type: 'humanoid', cr: '1/4', hp: 7, ac: 15, stats: { dex: 14 } } as MonsterTemplate;
const combatant = (id: string, waveId: string, hidden: boolean, type: 'monster' | 'player' = 'monster') => ({
  id, name: id, waveId, hidden, type, hp: { current: 7, max: 7 }, initiative: 10, conditions: [],
}) as Combatant;

function contentProps(overrides = {}) {
  return {
    activeTab: 'encounters', currentEncounterId: 'a', encounterName: 'Encounter A', currentRound: 2,
    currentTurnIndex: -1, isEncounterActive: true, savedEncounters: [], players: [], monsters: [],
    combatants: [combatant('one', 'Gate guards', true), combatant('two', 'Roof archers', false)],
    displayNames: new Map(), handleLoadEncounter: vi.fn(), ...overrides,
  } as unknown as React.ComponentProps<typeof MainContent>;
}

beforeEach(() => {
  vi.clearAllMocks();
  requests.reveal.mockResolvedValue({ success: true });
  requests.conceal.mockResolvedValue({ success: true });
  requests.get.mockResolvedValue({ id: 'a' });
});
afterEach(cleanup);

describe('NPC waves', () => {
  it('creates distinct named waves and lets the DM choose initial visibility', () => {
    const onAdd = vi.fn();
    render(<AddEnemyModal isOpen onClose={vi.fn()} monsters={[monster]} onAdd={onAdd} existingWaves={['default']} />);
    fireEvent.click(screen.getByRole('button', { name: /Goblin/ }));
    fireEvent.change(screen.getByLabelText('Wave name'), { target: { value: 'Gate guards' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add / }));
    expect(onAdd).toHaveBeenLastCalledWith(monster, expect.any(Number), 1, true, 'Gate guards');
    fireEvent.click(screen.getByRole('button', { name: /Goblin/ }));
    fireEvent.change(screen.getByLabelText('Wave name'), { target: { value: 'Roof archers' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start concealed' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add / }));
    expect(onAdd).toHaveBeenLastCalledWith(monster, expect.any(Number), 1, false, 'Roof archers');
  });

  it('reveals and conceals waves independently and keeps revealed groups available', async () => {
    const props = contentProps();
    render(<MainContent {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Gate guards' }));
    await waitFor(() => expect(requests.reveal).toHaveBeenCalledWith('a', 'Gate guards'));
    await waitFor(() => expect(props.handleLoadEncounter).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Conceal Roof archers' }));
    await waitFor(() => expect(requests.conceal).toHaveBeenCalledWith('a', 'Roof archers'));
  });

  it('offers both controls for a mixed wave without grouping players', () => {
    render(<MainContent {...contentProps({ combatants: [
      combatant('one', 'Mixed', true), combatant('two', 'Mixed', false), combatant('hero', 'Heroes', false, 'player'),
    ] })} />);
    expect(screen.getByRole('button', { name: 'Reveal Mixed' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Conceal Mixed' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Conceal Heroes' })).not.toBeInTheDocument();
  });

  it('reports wave update failures', async () => {
    requests.conceal.mockRejectedValue(new Error('Connection lost'));
    render(<MainContent {...contentProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conceal Roof archers' }));
    await waitFor(() => expect(requests.error).toHaveBeenCalled());
  });

  it('does not reload the old encounter when a wave request finishes after switching', async () => {
    let finishRequest: () => void;
    requests.reveal.mockImplementationOnce(() => new Promise<void>(resolve => { finishRequest = resolve; }));
    const props = contentProps();
    const view = render(<MainContent {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Gate guards' }));
    view.rerender(<MainContent {...props} currentEncounterId="b" />);
    await act(async () => { finishRequest!(); });
    expect(requests.reveal).toHaveBeenCalledWith('a', 'Gate guards');
    expect(props.handleLoadEncounter).not.toHaveBeenCalled();
  });
});

describe('current round notes', () => {
  it('shows separate readout and NPC action blocks only for the current round', () => {
    const props = contentProps({ encounterNotes: { general: '', rounds: [
      { round: 2, text: 'Guards attack.', readout: 'The gate opens.' },
      { round: 3, text: 'Archers arrive.', readout: 'A horn sounds.' },
    ] } });
    const view = render(<MainContent {...props} />);
    expect(screen.getByText('R2 · Readout')).toBeInTheDocument();
    expect(screen.getByText('R2 · NPC actions')).toBeInTheDocument();
    expect(screen.getByText('The gate opens.')).toBeInTheDocument();
    expect(screen.queryByText('A horn sounds.')).not.toBeInTheDocument();
    view.rerender(<MainContent {...props} currentRound={3} />);
    expect(screen.getByText('R3 · Readout')).toBeInTheDocument();
    expect(screen.getByText('Archers arrive.')).toBeInTheDocument();
    expect(screen.queryByText('Guards attack.')).not.toBeInTheDocument();
  });
});
