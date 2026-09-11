import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntitySelector } from '../components/import/EntitySelector';
import type { Player } from '../types';

const foundryPlayer: Player = {
  id: 'foundry-character-1',
  name: 'Makoa',
  dndBeyondId: 'foundry:character-1',
  hp_max: 30,
  ac: 16,
  speed: '30 ft.',
  subtitle: 'Wizard',
  avatar: '',
  stats: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
  actions: [],
  spells: [],
  abilities: [],
};

describe('EntitySelector import review', () => {
  it('does not import a staged player until the review is explicitly confirmed', async () => {
    const onImport = vi.fn();
    const user = userEvent.setup();

    render(
      <EntitySelector
        entities={[{ id: 'staged-player', name: foundryPlayer.name, type: 'Player', format: 'Foundry VTT', status: 'detected', data: foundryPlayer }]}
        monsters={[]}
        classFeatures={[]}
        existingEncounters={[]}
        players={[]}
        onImport={onImport}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /review & import/i }));

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByText('create')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm import/i }));

    expect(onImport).toHaveBeenCalledWith([], [], [], [], [foundryPlayer]);
  });
});
