import { afterEach, describe, expect, it, vi } from 'vitest';
import { dominantColors, paletteFromImage } from '../lib/hueImagePalette';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('image scene palettes', () => {
  it('ranks colors by coverage, merges similar shades and ignores transparent pixels', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 250, 0, 0, 255, 255, 0, 0, 255,
      0, 0, 255, 255, 0, 255, 0, 0,
    ]);
    expect(dominantColors(pixels)).toEqual(['#fd0000', '#0000ff']);
  });

  it('returns at most six distinct colors and handles monochrome and transparent images', () => {
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255], [0, 0, 0]];
    expect(dominantColors(new Uint8ClampedArray(colors.flatMap(color => [...color, 255])))).toHaveLength(6);
    expect(dominantColors(new Uint8ClampedArray([255, 255, 255, 255]))).toEqual(['#ffffff']);
    expect(dominantColors(new Uint8ClampedArray([0, 0, 0, 0]))).toEqual([]);
  });

  it('rejects unsupported and oversized files before decoding', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    await expect(paletteFromImage(new File(['text'], 'file.txt', { type: 'text/plain' }))).rejects.toThrow(/image/i);
    const large = new File(['image'], 'large.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 21 * 1024 * 1024 });
    await expect(paletteFromImage(large)).rejects.toThrow(/20 MB/);
    expect(decode).not.toHaveBeenCalled();
  });

  it('releases decoded images even when canvas processing fails', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 160, height: 160, close }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(paletteFromImage(new File(['image'], 'scene.png', { type: 'image/png' }))).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
