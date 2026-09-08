import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const harness = vi.hoisted(() => ({ state: {} as Record<string, any> }));
vi.mock('../hooks/useAppState', () => ({ useAppState: () => harness.state }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'admin' }, loading: false }) }));
vi.mock('../hooks/useHueEffects', () => ({ useHueEffects: () => {} }));
vi.mock('../hooks/useRouterSync', () => ({ useRouterSync: () => {} }));
vi.mock('../hooks/useActionExecution', () => ({ useActionExecution: () => ({ actionModal: null }) }));
vi.mock('../hooks/useSoundboard', () => ({ useSoundboard: () => ({ playingIds: new Set() }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showError: vi.fn() }) }));
vi.mock('../api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../api/client')>(),
  api: { sounds: { list: async () => [] } },
}));
vi.mock('../components/Sidebar', () => ({ Sidebar: ({ youtubeId }: { youtubeId?: string }) => youtubeId ? <span>Music launcher</span> : null }));
vi.mock('../components/ModalsContainer', () => ({ ModalsContainer: () => null }));
vi.mock('../components/EncounterCreator', () => ({ EncounterCreator: () => null }));
vi.mock('../components/ActionExecutionModal', () => ({ ActionExecutionModal: () => null }));
vi.mock('../components/WhatsNewModal', () => ({ WhatsNewModal: () => null, hasSeenWhatsNew: () => true }));
vi.mock('../components/HelpModal', () => ({ HelpModal: () => null }));
vi.mock('../components/AddEnemyModal', () => ({ AddEnemyModal: () => null }));
vi.mock('../components/SessionStatsModal', () => ({ SessionStatsModal: () => null }));
vi.mock('../components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../components/SessionBoard', () => ({ SessionBoard: () => <span>Board widget</span> }));
vi.mock('../components/FloatingMusicPlayer', () => ({ FloatingMusicPlayer: () => <span>Music widget</span> }));
vi.mock('../components/HueSettingsPanel', () => ({ HueSettingsPanel: () => null }));
vi.mock('../components/FoundrySettingsPanel', () => ({ FoundrySettingsPanel: () => null }));
vi.mock('../components/HomeAssistantSettingsPanel', () => ({ HomeAssistantSettingsPanel: () => null }));

beforeEach(() => {
  localStorage.clear();
  harness.state = {
    activeTab: 'settings', currentEncounterId: 'a', currentRound: 1,
    currentTurnIndex: 0, combatants: [], monsters: [], spells: [], players: [],
    savedEncounters: [{ id: 'a', name: 'Test', notes: { general: 'Keep these notes', rounds: [] } }],
    activeSoundIds: [], activeYoutubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', combatLog: [],
    isDbAvailable: false, fetchData: vi.fn(), syncPlayerLog: vi.fn(),
  };
});
afterEach(cleanup);

const app = (path = '/settings') => <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>;

it('disables optional widgets and music launch controls, persists preferences, and restores widgets', () => {
  const view = render(app());
  expect(screen.getByText('Board widget')).toBeInTheDocument();
  expect(screen.getByText('Music widget')).toBeInTheDocument();
  for (const name of ['Session board', 'DM notes', 'Ambient music']) {
    expect(screen.getByRole('switch', { name })).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name }));
  }
  expect(screen.queryByText('Board widget')).not.toBeInTheDocument();
  expect(screen.queryByText('Music widget')).not.toBeInTheDocument();
  expect(screen.queryByText('Music launcher')).not.toBeInTheDocument();
  view.unmount();
  const restored = render(app());
  for (const name of ['Session board', 'DM notes', 'Ambient music']) {
    expect(screen.getByRole('switch', { name })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name }));
  }
  expect(screen.getByText('Board widget')).toBeInTheDocument();
  expect(screen.getByText('Music widget')).toBeInTheDocument();
  restored.unmount();
  render(app('/encounters/a'));
  expect(screen.getByRole('region', { name: 'DM sticky note' })).toBeInTheDocument();
  expect(screen.getByDisplayValue('Keep these notes')).toBeInTheDocument();
});

it('does not render disabled DM notes or its reopen button', () => {
  localStorage.setItem('optionalFeatures', JSON.stringify({ sessionBoard: true, dmNotes: false, ambientMusic: true }));
  render(app('/encounters/a'));
  expect(screen.queryByRole('region', { name: 'DM sticky note' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'DM Note' })).not.toBeInTheDocument();
});
