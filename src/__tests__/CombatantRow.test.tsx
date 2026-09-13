import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CombatantRow } from '../components/CombatantRow';
import type { Combatant } from '../types';
import { FloatingMusicPlayer } from '../components/FloatingMusicPlayer';

const combatant: Combatant = {
  id: 'combatant-1',
  name: 'Bavlorna Blightstraw',
  type: 'monster',
  initiative: 17,
  hp: { current: 100, max: 100 },
  ac: 15,
  speed: '30 ft.',
  subtitle: 'Medium fey',
  avatar: '',
  conditions: ['blinded'],
  tags: [],
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
};

describe('CombatantRow', () => {
  it('allows closing ambient music when expanded or minimized', () => {
    const onClose = vi.fn();
    render(<FloatingMusicPlayer youtubeId="abcdefghijk" isPaused={false} onTogglePause={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close ambient music' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Expand'));
    fireEvent.click(screen.getByRole('button', { name: 'Close ambient music' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows Foundry sync status for a linked combatant', () => {
    const linked: Combatant = {
      ...combatant,
      foundrySync: { actorId: 'actor-1', lastSyncedAt: new Date(Date.now() - 30_000).toISOString(), pending: false },
    };
    render(
      <CombatantRow
        combatant={linked}
        isActive={false}
        queueIndex={1}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onQuickAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByTitle(/Foundry synced/)).toBeInTheDocument();
    expect(screen.queryByText(/actor-1/)).toBeNull();
  });

  it('warns when Foundry sync is stale', () => {
    const stale: Combatant = {
      ...combatant,
      foundrySync: { actorId: 'actor-1', lastSyncedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), pending: false },
    };
    render(
      <CombatantRow
        combatant={stale}
        isActive={false}
        queueIndex={1}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onQuickAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Foundry sync stale')).toBeInTheDocument();
  });

  it('shows pending state when a Foundry sync is in flight', () => {
    const pending: Combatant = {
      ...combatant,
      foundrySync: { actorId: 'actor-1', lastSyncedAt: new Date(Date.now() - 5_000).toISOString(), pending: true },
    };
    render(
      <CombatantRow
        combatant={pending}
        isActive={false}
        queueIndex={1}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onQuickAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Foundry sync pending')).toBeInTheDocument();
  });

  it('allows condition tooltips to extend beyond the row', () => {
    const { container } = render(
      <CombatantRow
        combatant={combatant}
        isActive={false}
        queueIndex={1}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onQuickAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(container.firstElementChild).not.toHaveClass('overflow-hidden');
  });
});
