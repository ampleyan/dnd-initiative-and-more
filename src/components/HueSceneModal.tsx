import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { HueScene } from '../lib/hueScenes';

interface HueSceneModalProps {
  scenes: HueScene[];
  currentSceneId?: string;
  applying: string | null;
  applied: string | null;
  onApply: (scene: HueScene) => void;
  onClose: () => void;
}

export const HueSceneModal: React.FC<HueSceneModalProps> = ({ scenes, currentSceneId, applying, applied, onApply, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="hue-scenes-title">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 id="hue-scenes-title" className="font-headline text-lg font-bold text-on-surface">Hue Scenes</h2>
          <p className="text-[11px] text-outline">Choose the mood for this encounter.</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-outline hover:bg-white/10 hover:text-on-surface" aria-label="Close Hue scenes"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {scenes.map(scene => {
          const busy = applying === scene.id;
          const selected = currentSceneId === scene.id;
          return <button key={scene.id} onClick={() => onApply(scene)} disabled={applying !== null} className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'} disabled:opacity-60`}>
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-on-surface">{scene.label}</span>{busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : applied === scene.id || selected ? <Check className="h-4 w-4 text-emerald-400" /> : null}</div>
            <div className="flex gap-1.5">{scene.colors.map((color, index) => <span key={`${scene.id}-${index}`} className="h-8 flex-1 rounded-md border border-white/10" style={{ backgroundColor: color }} />)}</div>
          </button>;
        })}
      </div>
    </div>
  </div>
);
