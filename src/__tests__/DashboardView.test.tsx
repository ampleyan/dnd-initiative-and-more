import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardView } from '../components/DashboardView';
import type { Campaign, Encounter, Player, Session } from '../types';

const encounter: Encounter = {
  id: 'encounter-1',
  name: 'Goblin Ambush',
  lastModified: '2026-09-12T18:00:00.000Z',
  combatants: [],
};

const campaign: Campaign = {
  id: 'campaign-1',
  name: 'The Amber Road',
  description: 'A journey through dangerous trade routes.',
  createdAt: '2026-09-01T18:00:00.000Z',
};

const player: Player = {
  id: 'player-1',
  name: 'Mira',
  level: 3,
  class: 'Ranger',
  hp_max: 24,
  hp_current: 24,
  ac: 15,
  speed: '30 ft.',
  subtitle: 'Wood elf',
  avatar: '',
  stats: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
};

const session: Session = {
  id: 'session-1',
  campaignId: campaign.id,
  name: 'The Old Mill',
  date: '2099-09-20T18:00:00.000Z',
  notes: '',
  createdAt: '2026-09-01T18:00:00.000Z',
};

const renderDashboard = (overrides: Partial<React.ComponentProps<typeof DashboardView>> = {}) => {
  const props: React.ComponentProps<typeof DashboardView> = {
    isEncounterActive: false,
    currentEncounterId: null,
    encounterName: '',
    currentRound: 0,
    combatants: [],
    savedEncounters: [],
    monsters: [],
    players: [],
    spells: [],
    setActiveTab: vi.fn(),
    setIsEncounterCreatorOpen: vi.fn(),
    handleLoadEncounter: vi.fn(),
    ...overrides,
  };

  return { ...props, view: render(<DashboardView {...props} />) };
};

describe('DashboardView', () => {
  it('shows the active encounter and routes its primary action to encounters', () => {
    const { setActiveTab } = renderDashboard({
      isEncounterActive: true,
      currentEncounterId: encounter.id,
      encounterName: encounter.name,
      currentRound: 4,
      savedEncounters: [encounter],
    });

    expect(screen.getByRole('heading', { name: 'Goblin Ambush' })).toBeInTheDocument();
    expect(screen.getByText('Round 4 is in progress.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume encounter' }));

    expect(setActiveTab).toHaveBeenCalledWith('encounters');
  });

  it('offers a contextual resume action for a saved encounter when combat is inactive', () => {
    const { handleLoadEncounter } = renderDashboard({ savedEncounters: [encounter] });

    fireEvent.click(screen.getByRole('button', { name: /^Resume Goblin Ambush$/i }));

    expect(handleLoadEncounter).toHaveBeenCalledWith(encounter);
  });

  it('offers the upcoming session as the next contextual action when no encounter is active', () => {
    renderDashboard({ campaigns: [campaign], sessions: [session] });

    expect(screen.getByRole('button', { name: /next.*old mill/i })).toBeInTheDocument();
  });

  it('shows guided setup actions when no campaign, players, or encounters exist', () => {
    const { setActiveTab, setIsEncounterCreatorOpen } = renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Import Players' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Encounter' }));

    expect(setActiveTab).toHaveBeenCalledWith('import');
    expect(setIsEncounterCreatorOpen).toHaveBeenCalledWith(true);
  });

  it('keeps campaign, recent encounter, and player actions reachable by accessible names', () => {
    const setActiveTab = vi.fn();
    const onSelectCampaign = vi.fn();
    const { handleLoadEncounter } = renderDashboard({
      campaigns: [campaign],
      activeCampaignId: campaign.id,
      savedEncounters: [encounter],
      players: [player],
      setActiveTab,
      onSelectCampaign,
    });

    expect(screen.getByRole('button', { name: /open lore/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Goblin Ambush.*Draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 member.*Party/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open lore/i }));
    fireEvent.click(screen.getByRole('button', { name: /Goblin Ambush.*Draft/i }));
    fireEvent.click(screen.getByRole('button', { name: /1 member.*Party/i }));

    expect(onSelectCampaign).toHaveBeenCalledWith(campaign.id);
    expect(handleLoadEncounter).toHaveBeenCalledWith(encounter);
    expect(setActiveTab).toHaveBeenCalledWith('import');
  });
});
