import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CombatantRow } from '../components/CombatantRow';
import type { Combatant } from '../types';

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
