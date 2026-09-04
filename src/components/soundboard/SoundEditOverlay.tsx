import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Sound, Spell } from '../../types';

interface SoundEditOverlayProps {
  sound: Sound;
  spells: Spell[];
  cat: { label: string; bg: string; color: string; border: string; typeBadge: string };
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<Sound, 'name' | 'category' | 'tags' | 'spellId' | 'volume' | 'isFavorite'>>) => Promise<void>;
  onVolumeChange: (sound: Sound, volume: number) => void;
}

export const SoundEditOverlay = React.memo<SoundEditOverlayProps>(({ sound, spells, cat, onDelete, onUpdate, onVolumeChange }) => {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || sound.tags.includes(t)) { setTagInput(''); return; }
    onUpdate(sound.id, { tags: [...sound.tags, t] });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    onUpdate(sound.id, { tags: sound.tags.filter(t => t !== tag) });
  };

  return (
    <div className="absolute inset-0 bg-surface-container-highest/90 backdrop-blur-[2px] rounded-2xl z-20 p-2 flex flex-col gap-1.5 animate-in fade-in duration-200 overflow-y-auto">
      <p className="text-[10px] font-bold text-on-surface truncate px-0.5 -mb-0.5 leading-tight">
        {sound.name}
      </p>
      <div className="flex justify-between items-start">
        <button
          onClick={() => onDelete(sound.id)}
          className="p-1.5 bg-error/20 text-error hover:bg-error/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${cat.bg} ${cat.color} border border-current/20`}>
          {cat.label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-[8px] font-bold text-outline uppercase tracking-widest px-1">Spell Link</div>
        <select
          value={sound.spellId ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onUpdate(sound.id, { spellId: e.target.value || null })}
          className="w-full bg-surface-container-high border border-outline/10 rounded-lg px-2 py-1 text-[10px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer"
        >
          <option value="">None</option>
          {[...spells].sort((a,b) => a.name.localeCompare(b.name)).map(sp => (
            <option key={sp.id} value={sp.id}>{sp.name} (Lvl {sp.level})</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[8px] font-bold text-outline uppercase tracking-widest px-1">
          <span>Volume</span>
          <span>{Math.round(sound.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={sound.volume}
          onClick={e => e.stopPropagation()}
          onChange={e => onVolumeChange(sound, parseFloat(e.target.value))}
          className="w-full h-1.5 accent-primary cursor-pointer bg-white/10 rounded-full"
        />
      </div>

      <div className="space-y-1">
        <div className="text-[8px] font-bold text-outline uppercase tracking-widest px-1">Tags</div>
        <div className="flex flex-wrap gap-1">
          {sound.tags.map(tag => (
            <span key={tag} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px]">
              {tag}
              <button
                onClick={e => { e.stopPropagation(); removeTag(tag); }}
                className="hover:text-error transition-colors leading-none"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={tagInput}
            onClick={e => e.stopPropagation()}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="add tag…"
            className="flex-1 bg-surface-container-high border border-outline/10 rounded px-1.5 py-0.5 text-[9px] text-on-surface placeholder-outline/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            onClick={e => { e.stopPropagation(); addTag(); }}
            className="px-1.5 py-0.5 bg-primary/20 text-primary hover:bg-primary/30 rounded text-[9px] font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
});

SoundEditOverlay.displayName = 'SoundEditOverlay';
