import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HueSettingsPanel } from '../components/HueSettingsPanel';

const mocks = vi.hoisted(() => ({ extract: vi.fn(), getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock('../lib/hueImagePalette', () => ({ paletteFromImage: mocks.extract }));
vi.mock('../api/client', () => ({ api: { hue: {
  getConfig: mocks.getConfig, saveConfig: mocks.saveConfig, getLights: vi.fn().mockResolvedValue({}),
} } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockResolvedValue({ username: 'paired', lightIds: [], scenes: [
    { id: 'forest', label: 'Forest', colors: ['#112233'] },
    { id: 'cave', label: 'Cave', colors: ['#445566'] },
  ] });
  mocks.saveConfig.mockResolvedValue({ ok: true });
  mocks.extract.mockResolvedValue(['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']);
});
afterEach(cleanup);

async function openGenerator() {
  render(<HueSettingsPanel enabled onToggleEnabled={vi.fn()} syncSceneColorEnabled={false} onToggleSyncScene={vi.fn()} enabledEffects={{}} onToggleEffect={vi.fn()} effectTargets={{}} onToggleTarget={vi.fn()} />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Generate from image' }))[0]);
  fireEvent.change(screen.getByLabelText('Palette image'), { target: { files: [new File(['image'], 'forest.png', { type: 'image/png' })] } });
}

it('previews all colors without saving, allows editing, then persists only the selected scene palette', async () => {
  await openGenerator();
  const color = await screen.findByLabelText('Preview color 6');
  expect(mocks.saveConfig).not.toHaveBeenCalled();
  fireEvent.change(color, { target: { value: '#abcdef' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
  await waitFor(() => expect(mocks.saveConfig).toHaveBeenCalledWith({ scenes: [
    { id: 'forest', label: 'Forest', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#abcdef'] },
    { id: 'cave', label: 'Cave', colors: ['#445566'] },
  ] }));
  await waitFor(() => expect(screen.queryByLabelText('Palette image')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Forest color 6')).toHaveValue('#abcdef');
});

it('keeps the saved scene unchanged on save failure and allows retry', async () => {
  mocks.saveConfig.mockRejectedValueOnce(new Error('Connection lost'));
  await openGenerator();
  fireEvent.click(await screen.findByRole('button', { name: 'Save palette' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(screen.getByLabelText('Forest color 1')).toHaveValue('#112233');
  expect(screen.getByLabelText('Preview color 6')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
  await waitFor(() => expect(screen.queryByLabelText('Palette image')).not.toBeInTheDocument());
});

it('reports decode failures and lets the user cancel without changing the scene', async () => {
  mocks.extract.mockRejectedValueOnce(new Error('Cannot read image'));
  await openGenerator();
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot read image');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(mocks.saveConfig).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Forest color 1')).toHaveValue('#112233');
});

it('ignores an image result that finishes after cancellation', async () => {
  let finish!: (colors: string[]) => void;
  mocks.extract.mockReturnValueOnce(new Promise<string[]>(resolve => { finish = resolve; }));
  await openGenerator();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Generate from image' })[0]);
  await act(async () => { finish(['#ff0000']); });
  expect(screen.queryByLabelText('Preview color 1')).not.toBeInTheDocument();
  expect(mocks.saveConfig).not.toHaveBeenCalled();
});

it('locks scene mutations while saving and light selection sends no stale scene data', async () => {
  let finish!: (value: { ok: boolean }) => void;
  mocks.saveConfig.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await openGenerator();
  fireEvent.click(await screen.findByRole('button', { name: 'Save palette' }));
  expect(screen.getByRole('button', { name: 'Add scene' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByLabelText('Cave color 1')).toBeDisabled();
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Deselect all' })[0]); });
  expect(mocks.saveConfig).toHaveBeenLastCalledWith({ lightIds: [] });
  await act(async () => { finish({ ok: true }); });
  expect(screen.getByLabelText('Forest color 6')).toHaveValue('#00ffff');
});
