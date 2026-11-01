import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryBrowser } from '../components/soundboard/LibraryBrowser';
import { api } from '../api/client';

afterEach(() => vi.restoreAllMocks());

describe('LibraryBrowser imports', () => {
  it('imports selected ambience tracks and closes after refreshing sounds', async () => {
    const track = {
      id: 'rain-forest',
      name: 'Rain in the Forest',
      genre: 'Nature',
      defaultUrl: '/ambience/rain.mp3',
      variants: [],
    };
    const importAmbiences = vi.spyOn(api.sounds, 'importAmbiences').mockResolvedValue({ inserted: 1, skipped: 0, invalid: 0 });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    vi.spyOn(api.sounds, 'ambiences').mockResolvedValue([track]);

    render(<LibraryBrowser show onClose={onClose} sounds={[]} onRefresh={onRefresh} />);

    await screen.findByText('Rain in the Forest');
    await userEvent.click(screen.getByRole('button', { name: 'Select all visible' }));
    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));

    await waitFor(() => expect(importAmbiences).toHaveBeenCalledWith([
      { id: 'rain-forest', name: 'Rain in the Forest', url: '/ambience/rain.mp3', genre: 'Nature' },
    ]));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('imports selected local sounds through the local import route', async () => {
    const importBulkVisible = vi.spyOn(api.sounds, 'importBulkVisible').mockResolvedValue({ inserted: 1, skipped: 0, invalid: 0 });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    vi.spyOn(api.sounds, 'ambiences').mockResolvedValue([]);
    vi.spyOn(api.sounds, 'local').mockResolvedValue([
      { id: 'local-footsteps', name: 'Footsteps', category: 'foley', tags: [], volume: 0.8, url: '/sounds/footsteps.mp3', pack: 'Dungeon' },
    ]);

    render(<LibraryBrowser show onClose={onClose} sounds={[]} onRefresh={onRefresh} />);

    await userEvent.click(screen.getByRole('button', { name: /SFX Packs · local/ }));
    await screen.findByText('Footsteps');
    await userEvent.click(screen.getByRole('button', { name: /Footsteps/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));

    await waitFor(() => expect(importBulkVisible).toHaveBeenCalledWith('/api/sounds/local/import', ['local-footsteps']));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
