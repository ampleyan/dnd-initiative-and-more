import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const harness = vi.hoisted(() => ({
  state: {} as Record<string, any>,
  update: vi.fn(),
  showError: vi.fn(),
  user: { role: 'admin' },
}));

vi.mock('../hooks/useAppState', () => ({ useAppState: () => harness.state }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: harness.user, loading: false }) }));
vi.mock('../hooks/useHueEffects', () => ({ useHueEffects: () => {} }));
vi.mock('../hooks/useRouterSync', () => ({ useRouterSync: () => {} }));
vi.mock('../hooks/useActionExecution', () => ({ useActionExecution: () => ({ actionModal: null }) }));
vi.mock('../hooks/useSoundboard', () => ({ useSoundboard: () => ({ playingIds: new Set() }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showError: harness.showError }) }));
vi.mock('../api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../api/client')>(),
  api: { encounters: { update: (...args: unknown[]) => harness.update(...args) }, sounds: { list: async () => [] } },
}));
vi.mock('../components/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../components/MainContent', () => ({ MainContent: () => null }));
vi.mock('../components/ModalsContainer', () => ({ ModalsContainer: () => null }));
vi.mock('../components/EncounterCreator', () => ({ EncounterCreator: () => null }));
vi.mock('../components/ActionExecutionModal', () => ({ ActionExecutionModal: () => null }));
vi.mock('../components/WhatsNewModal', () => ({ WhatsNewModal: () => null, hasSeenWhatsNew: () => true }));
vi.mock('../components/HelpModal', () => ({ HelpModal: () => null }));
vi.mock('../components/AddEnemyModal', () => ({ AddEnemyModal: () => null }));
vi.mock('../components/SessionStatsModal', () => ({ SessionStatsModal: () => null }));
vi.mock('../components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../components/SessionBoard', () => ({ SessionBoard: () => null }));

const emptyNotes = () => ({ general: '', rounds: [] });
const encounter = (id: string, general = '') => ({ id, name: id, notes: { general, rounds: [] }, lastModified: '' });
const app = () => <MemoryRouter initialEntries={['/encounters/a']}><App /></MemoryRouter>;
const openNotes = () => fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
const generalField = () => screen.getByPlaceholderText('Notes for this encounter…');

beforeEach(() => {
  vi.clearAllMocks();
  harness.update.mockResolvedValue({});
  harness.state = {
    activeTab: 'encounters', currentEncounterId: 'a', currentRound: 1,
    currentTurnIndex: 0, combatants: [], monsters: [], spells: [], players: [],
    savedEncounters: [], activeSoundIds: [], activeYoutubeUrl: '', combatLog: [],
    isDbAvailable: true, fetchData: vi.fn(), syncPlayerLog: vi.fn(),
    setSavedEncounters: (update: any) => {
      harness.state.savedEncounters = update(harness.state.savedEncounters);
    },
  };
});

afterEach(cleanup);

describe('encounter notes', () => {
  it('restores notes when the encounter arrives after the initial render', () => {
    const view = render(app());
    openNotes();
    expect(generalField()).toHaveValue('');
    expect(generalField()).toBeDisabled();
    harness.state.savedEncounters = [encounter('a', 'Saved before refresh')];
    view.rerender(app());
    expect(generalField()).toHaveValue('Saved before refresh');
    expect(generalField()).toBeEnabled();
  });

  it('updates the encounter cache and restores saved notes after remount', async () => {
    harness.state.savedEncounters = [encounter('a')];
    const view = render(app());
    openNotes();
    fireEvent.change(generalField(), { target: { value: 'Keep this note' } });
    await waitFor(() => expect(harness.update).toHaveBeenCalledWith('a', {
      notes: { ...emptyNotes(), general: 'Keep this note' },
    }));
    await waitFor(() => expect(harness.state.savedEncounters[0].notes.general).toBe('Keep this note'));
    view.unmount();
    render(app());
    openNotes();
    expect(generalField()).toHaveValue('Keep this note');
  });

  it('keeps pending saves attached to their encounter when switching', async () => {
    let finishFirst: () => void;
    harness.update.mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }));
    harness.state.savedEncounters = [encounter('a'), encounter('b', 'B notes')];
    const view = render(app());
    openNotes();
    fireEvent.change(generalField(), { target: { value: 'A first' } });
    await waitFor(() => expect(harness.update).toHaveBeenCalledTimes(1));
    fireEvent.change(generalField(), { target: { value: 'A latest' } });
    harness.state.currentEncounterId = 'b';
    view.rerender(app());
    expect(generalField()).toHaveValue('B notes');
    fireEvent.change(generalField(), { target: { value: 'B latest' } });
    await act(async () => { finishFirst!(); });
    await waitFor(() => {
      expect(harness.state.savedEncounters[0].notes.general).toBe('A latest');
      expect(harness.state.savedEncounters[1].notes.general).toBe('B latest');
    });
    expect(generalField()).toHaveValue('B latest');
  });

  it('retains the draft and warns before refresh when a save fails', async () => {
    harness.update.mockRejectedValue(new Error('Network unavailable'));
    harness.state.savedEncounters = [encounter('a')];
    render(app());
    openNotes();
    fireEvent.change(generalField(), { target: { value: 'Unsaved note' } });
    await waitFor(() => expect(harness.showError).toHaveBeenCalled());
    expect(generalField()).toHaveValue('Unsaved note');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('saves readouts and NPC actions for their round while preserving existing text', async () => {
    harness.state.savedEncounters = [{
      ...encounter('a'), notes: { general: '', rounds: [{ round: 2, text: 'Old NPC plan' }, { round: 3, text: 'Later plan' }] },
    }];
    render(app());
    openNotes();
    expect(screen.getByRole('textbox', { name: 'NPC actions for round 2' })).toHaveValue('Old NPC plan');
    fireEvent.change(screen.getByRole('textbox', { name: 'Readout for round 2' }), { target: { value: 'The doors swing open.' } });
    await waitFor(() => expect(harness.update).toHaveBeenLastCalledWith('a', { notes: {
      general: '', rounds: [{ round: 2, text: 'Old NPC plan', readout: 'The doors swing open.' }, { round: 3, text: 'Later plan' }],
    } }));
    expect(screen.getByRole('textbox', { name: 'NPC actions for round 3' })).toHaveValue('Later plan');
  });

  it('clears the refresh warning after a successful retry', async () => {
    harness.update.mockRejectedValueOnce(new Error('Connection lost'));
    harness.state.savedEncounters = [encounter('a')];
    render(app());
    openNotes();
    fireEvent.change(generalField(), { target: { value: 'Draft' } });
    await waitFor(() => expect(harness.showError).toHaveBeenCalled());
    fireEvent.change(generalField(), { target: { value: 'Retried draft' } });
    await waitFor(() => expect(harness.state.savedEncounters[0].notes.general).toBe('Retried draft'));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('retains notes and reports unavailable persistence without sending a request', async () => {
    harness.state.savedEncounters = [encounter('a')];
    harness.state.isDbAvailable = false;
    render(app());
    openNotes();
    fireEvent.change(generalField(), { target: { value: 'Offline draft' } });
    expect(generalField()).toHaveValue('Offline draft');
    expect(harness.showError).toHaveBeenCalled();
    expect(harness.update).not.toHaveBeenCalled();
  });
});
