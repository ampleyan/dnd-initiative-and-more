import React, { useEffect, useId, useRef, useState } from 'react';
import { paletteFromImage } from '../lib/hueImagePalette';

interface HueImagePaletteProps {
  onSave: (colors: string[]) => Promise<boolean>;
}

export const HueImagePalette: React.FC<HueImagePaletteProps> = ({ onSave }) => {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const inputId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { request.current++; }, []);

  const close = () => {
    request.current++;
    setOpen(false);
    setColors([]);
    setError('');
    setBusy(false);
    trigger.current?.focus();
  };

  const generate = async (file: File) => {
    const id = ++request.current;
    setBusy(true);
    setError('');
    setColors([]);
    try {
      const palette = await paletteFromImage(file);
      if (request.current === id) setColors(palette);
    } catch (failure) {
      if (request.current === id) setError(failure instanceof Error ? failure.message : 'Could not generate a palette.');
    } finally {
      if (request.current === id) setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (await onSave(colors)) close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the palette.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-3">
    <button ref={trigger} type="button" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-lg border border-primary/30 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">Generate from image</button>
    {open && <div className="space-y-3 rounded-xl border border-primary/20 bg-black/20 p-3">
      <p className="text-xs text-outline">Choose an image to preview up to six colors. Adjust them before replacing this scene’s palette.</p>
      <label htmlFor={inputId} className="block text-xs font-bold text-on-surface">Palette image</label>
      <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={busy} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void generate(file);
      }} className="block w-full min-w-0 text-xs text-outline file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-on-surface" />
      <p className="text-[10px] text-outline">PNG, JPEG, WebP, GIF or AVIF · up to 20 MB · processed on this device</p>
      {busy && <p role="status" className="text-xs text-outline">Processing…</p>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {colors.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {colors.map((color, index) => <input key={index} type="color" aria-label={`Preview color ${index + 1}`} value={color} disabled={busy} onChange={event => setColors(previous => previous.map((item, i) => i === index ? event.target.value : item))} className="h-10 w-full cursor-pointer rounded border border-white/10 bg-transparent" />)}
      </div>}
      <div className="flex gap-2">
        {colors.length > 0 && <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">Save palette</button>}
        <button type="button" onClick={close} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-outline hover:text-on-surface">Cancel</button>
      </div>
    </div>}
  </div>;
};
