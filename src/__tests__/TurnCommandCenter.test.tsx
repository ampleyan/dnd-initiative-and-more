import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TurnCommandCenter } from '../components/TurnCommandCenter';
import type { Combatant } from '../types';

const combatant = (id: string, name: string, hp: number, maxHp: number): Combatant => ({
  id,
  name,
  type: 'monster',
  initiative: 14,
  hp: { current: hp, max: maxHp },
  ac: 15,
  speed: '30 ft.',
  subtitle: 'Medium humanoid',
  avatar: '',
  conditions: [],
  tags: [],
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
});

describe('TurnCommandCenter', () => {
  it('shows the derived turn state and invokes the existing turn handlers', () => {
    const onPreviousTurn = vi.fn();
    const onNextTurn = vi.fn();
    const active = { ...combatant('active', 'Aura Rose', 12, 20), tempHp: 5, conditions: ['blinded'] };
    const next = combatant('next', 'Artemis', 18, 18);

    render(
      <TurnCommandCenter
        currentRound={3}
        activeCombatant={active}
        nextCombatant={next}
        onPreviousTurn={onPreviousTurn}
        onNextTurn={onNextTurn}
      />,
    );

    expect(screen.getByText('Round 3')).toBeInTheDocument();
    expect(screen.getByText('Aura Rose')).toBeInTheDocument();
    expect(screen.getByText('12 / 20 HP')).toBeInTheDocument();
    expect(screen.getByText('+5 temp HP')).toBeInTheDocument();
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expect(screen.getByText('Artemis')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next turn' }));

    expect(onPreviousTurn).toHaveBeenCalledOnce();
    expect(onNextTurn).toHaveBeenCalledOnce();
  });

  it('launches an active combatant action through the supplied action flow', () => {
    const onUseAction = vi.fn();
    const active = { ...combatant('active', 'Aura Rose', 12, 20), actions: [{ name: 'Bite', description: 'Attack' }] };
    render(<TurnCommandCenter currentRound={1} activeCombatant={active} onPreviousTurn={vi.fn()} onNextTurn={vi.fn()} onUseAction={onUseAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bite' }));
    expect(onUseAction).toHaveBeenCalledWith(active, active.actions[0]);
  });
});
