import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveEncounterModal } from '../components/SaveEncounterModal';

vi.mock('../api/client', () => ({
  api: {
    hue: {
      getConfig: vi.fn().mockResolvedValue({
        scenes: [{ id: 'dungeon', label: 'Dungeon', colors: ['#111111', '#222222', '#333333'] }],
      }),
    },
  },
}));

describe('SaveEncounterModal', () => {
  it('saves the selected Hue preset with the encounter', async () => {
    const onSave = vi.fn();

    render(<SaveEncounterModal isOpen onClose={vi.fn()} onSave={onSave} />);

    const preset = await screen.findByLabelText('Hue preset');
    fireEvent.change(preset, { target: { value: 'dungeon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Encounter' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('', '', '', '', [], 'dungeon'));
  });

  it('shows the configured colors for the selected Hue preset', async () => {
    render(<SaveEncounterModal isOpen onClose={vi.fn()} onSave={vi.fn()} />);

    const preset = await screen.findByLabelText('Hue preset');
    fireEvent.change(preset, { target: { value: 'dungeon' } });
    expect(await screen.findByTestId('hue-preset-colors')).toHaveAttribute('aria-label', 'Dungeon colors');
    expect(screen.getByTestId('hue-preset-color-0')).toHaveStyle({ backgroundColor: '#111111' });
    expect(screen.getByTestId('hue-preset-color-1')).toHaveStyle({ backgroundColor: '#222222' });
    expect(screen.getByTestId('hue-preset-color-2')).toHaveStyle({ backgroundColor: '#333333' });
  });
});
