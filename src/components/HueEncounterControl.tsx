import React, { useEffect, useRef, useState } from 'react';
import { Check, Lightbulb, Loader2 } from 'lucide-react';
import { api } from '../api/client';

export const HUE_ENCOUNTER_PRESETS = [
  { id: 'battle', label: 'Battle', colors: ['#7f1d1d', '#ea580c', '#facc15'] },
  { id: 'calm', label: 'Calm', colors: ['#172554', '#2563eb', '#14b8a6'] },
  { id: 'danger', label: 'Danger', colors: ['#450a0a', '#dc2626', '#fb7185'] },
  { id: 'victory', label: 'Victory', colors: ['#713f12', '#eab308', '#4ade80'] },
] as const;

interface HueEncounterControlProps {
  enabled: boolean;
  preset?: string;
  onPresetChange?: (preset: string) => Promise<void> | void;
}

export const HueEncounterControl: React.FC<HueEncounterControlProps> = ({ enabled, preset, onPresetChange }) => {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const appliedPresetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !preset || !HUE_ENCOUNTER_PRESETS.some(item => item.id === preset) || appliedPresetRef.current === preset) return;
    const selected = HUE_ENCOUNTER_PRESETS.find(item => item.id === preset);
    if (!selected) return;
    appliedPresetRef.current = preset;
    api.hue.setSceneColor({ colors: selected.colors, hueEnabled: true }).catch(() => {});
  }, [enabled, preset]);

  if (!enabled) return null;

  const applyPreset = async (selectedPreset: typeof HUE_ENCOUNTER_PRESETS[number]) => {
    setApplying(selectedPreset.id);
    setApplied(null);
    try {
      await api.hue.setSceneColor({ colors: selectedPreset.colors, hueEnabled: true });
      appliedPresetRef.current = selectedPreset.id;
      setApplied(selectedPreset.id);
      await onPresetChange?.(selectedPreset.id);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(value => !value)}
        title="Hue scene control"
        aria-label="Hue scene control"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors ${open ? 'bg-amber-400/15 border-amber-400/40 text-amber-300' : 'border-outline/20 text-outline hover:text-on-surface'}`}
      >
        <Lightbulb className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Hue</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-44 rounded-xl border border-white/10 bg-[#0d0f14]/95 p-2 shadow-2xl backdrop-blur">
          <p className="px-2 pb-1.5 text-[9px] font-black uppercase tracking-widest text-outline">Scene mood</p>
          <div className="grid grid-cols-2 gap-1">
            {HUE_ENCOUNTER_PRESETS.map(presetOption => {
              const isApplying = applying === presetOption.id;
              const isApplied = applied === presetOption.id;
              return (
                <button
                  key={presetOption.id}
                  onClick={() => applyPreset(presetOption)}
                  disabled={applying !== null}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[10px] font-bold text-on-surface transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="flex gap-0.5">
                    {presetOption.colors.map(color => <span key={color} className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />)}
                  </span>
                  <span className="flex-1">{presetOption.label}</span>
                  {isApplying && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  {isApplied && <Check className="h-3 w-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
