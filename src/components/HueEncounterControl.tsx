import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { api } from '../api/client';
import { DEFAULT_HUE_SCENES, HueScene, normalizeHueScenes } from '../lib/hueScenes';
import { HueSceneModal } from './HueSceneModal';

export const HUE_ENCOUNTER_PRESETS = DEFAULT_HUE_SCENES;

interface HueEncounterControlProps {
  enabled: boolean;
  preset?: string;
  onPresetChange?: (preset: string) => Promise<void> | void;
}

export const HueEncounterControl: React.FC<HueEncounterControlProps> = ({ enabled, preset, onPresetChange }) => {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<HueScene[]>(DEFAULT_HUE_SCENES);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const appliedPresetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api.hue.getConfig().then(config => setScenes(normalizeHueScenes(config.scenes))).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    const selected = scenes.find(item => item.id === preset);
    if (!enabled || !selected || appliedPresetRef.current === preset) return;
    appliedPresetRef.current = preset ?? null;
    api.hue.setSceneColor({ colors: selected.colors, hueEnabled: true }).catch(() => {});
  }, [enabled, preset, scenes]);

  if (!enabled) return null;

  const applyPreset = async (selectedScene: HueScene) => {
    setApplying(selectedScene.id);
    setApplied(null);
    try {
      await api.hue.setSceneColor({ colors: selectedScene.colors, hueEnabled: true });
      appliedPresetRef.current = selectedScene.id;
      setApplied(selectedScene.id);
      await onPresetChange?.(selectedScene.id);
      setOpen(false);
    } finally {
      setApplying(null);
    }
  };

  return <>
    <button onClick={() => setOpen(true)} title="Hue scene control" aria-label="Hue scene control" aria-expanded={open} className="flex items-center gap-1.5 rounded-lg border border-outline/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-outline transition-colors hover:text-on-surface">
      <Lightbulb className="h-3.5 w-3.5" /><span className="hidden sm:inline">Hue</span>
    </button>
    {open && <HueSceneModal scenes={scenes} currentSceneId={preset} applying={applying} applied={applied} onApply={applyPreset} onClose={() => setOpen(false)} />}
  </>;
};
