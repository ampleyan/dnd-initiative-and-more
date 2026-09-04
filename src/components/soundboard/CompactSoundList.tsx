import React from 'react';
import { Play, Square, VolumeX, Repeat } from 'lucide-react';
import { Sound } from '../../types';
import { CATEGORIES, categoryMeta } from './constants';
import { LiveSettings, DEFAULT_LIVE } from './SoundCard';

interface CompactSoundListProps {
  sounds: Sound[];
  visible: Sound[];
  allCustomTags: string[];
  activeCategory: string;
  activeTag: string | null;
  playingIds: Set<string>;
  liveSettingsState: Record<string, LiveSettings>;
  onSetActiveCategory: (cat: string) => void;
  onSetActiveTag: (tag: string | null) => void;
  onTogglePlay: (sound: Sound) => void;
  onStopAll: () => void;
  onPatchLive: (id: string, patch: Partial<LiveSettings>) => void;
  onVolumeChange: (sound: Sound, value: number) => void;
}

export const CompactSoundList = React.memo<CompactSoundListProps>(({
  sounds, visible, allCustomTags,
  activeCategory, activeTag, playingIds, liveSettingsState,
  onSetActiveCategory, onSetActiveTag,
  onTogglePlay, onStopAll, onPatchLive, onVolumeChange,
}) => {
  return (
    <div className="flex flex-col h-full gap-2">
      {/* Category filter + stop-all */}
      <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none"
           style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => {
          const count = cat.id === 'all' ? sounds.length : sounds.filter(s => s.category === cat.id).length;
          if (count === 0 && cat.id !== 'all') return null;
          const CIcon = cat.Icon;
          return (
            <button
              key={cat.id}
              onClick={() => onSetActiveCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? `${cat.bg} ${cat.color} ring-1 ring-current/40`
                  : 'bg-surface-container-high/40 text-outline hover:text-on-surface border border-outline/10'
              }`}
            >
              <CIcon className="w-3 h-3" />
              {cat.label}
              <span className="opacity-40 font-mono ml-0.5">{count}</span>
            </button>
          );
        })}
        {playingIds.size > 0 && (
          <button
            onClick={onStopAll}
            className="ml-auto flex items-center gap-1 px-2 py-1 bg-error/10 text-error border border-error/20 rounded-lg text-[10px] font-bold"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop ({playingIds.size})
          </button>
        )}
      </div>

      {/* Custom tag filter */}
      {allCustomTags.length > 0 && (
        <div className="flex gap-1 overflow-x-auto shrink-0 pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => onSetActiveTag(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${activeTag === null ? 'bg-primary/20 text-primary' : 'text-outline hover:text-on-surface'}`}
          >All</button>
          {allCustomTags.map(tag => (
            <button
              key={tag}
              onClick={() => onSetActiveTag(activeTag === tag ? null : tag)}
              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${activeTag === tag ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-outline hover:text-on-surface'}`}
            >{tag}</button>
          ))}
        </div>
      )}

      {/* Sound list with always-visible controls */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
        {visible.length === 0 && (
          <div className="flex items-center justify-center py-12 text-outline/30 text-xs">No sounds</div>
        )}
        {visible.map(sound => {
          const isPlaying = playingIds.has(sound.id);
          const cat = categoryMeta(sound.category);
          const CatIcon = cat.Icon;
          const live: LiveSettings = liveSettingsState[sound.id] ?? DEFAULT_LIVE;

          return (
            <div
              key={sound.id}
              className={`rounded-xl border transition-all ${
                isPlaying
                  ? `${cat.bg} ${cat.border.replace('/30', '/50')}`
                  : 'bg-surface-container border-outline/10 hover:border-outline/25'
              }`}
            >
              {/* Row 1: play + icon + name + loop + repeat */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <button
                  onClick={() => onTogglePlay(sound)}
                  className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isPlaying
                      ? `${cat.bg} ${cat.color} border ${cat.border}`
                      : 'bg-surface-container-high border border-outline/15 hover:border-outline/40 text-outline hover:text-on-surface'
                  }`}
                >
                  {isPlaying
                    ? <Square className="w-3.5 h-3.5 fill-current" />
                    : <Play  className="w-3.5 h-3.5 fill-current" />}
                </button>
                <CatIcon className={`w-3.5 h-3.5 shrink-0 ${cat.color} opacity-70`} />
                <span className={`flex-1 min-w-0 text-xs font-semibold truncate ${isPlaying ? 'text-on-surface' : 'text-on-surface/80'}`}>
                  {sound.name}
                </span>
                <button
                  onClick={() => onPatchLive(sound.id, { loop: !live.loop })}
                  title="Loop"
                  className={`shrink-0 p-1 rounded transition-colors ${live.loop ? cat.color : 'text-outline/30 hover:text-outline'}`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
                <select
                  value={live.repeatSecs}
                  onChange={e => onPatchLive(sound.id, { repeatSecs: Number(e.target.value) })}
                  className="text-[10px] bg-surface-container border border-outline/10 rounded px-1.5 py-0.5 text-outline appearance-none cursor-pointer focus:outline-none w-16 shrink-0"
                >
                  <option value={0}>No rpt</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1 min</option>
                  <option value={120}>2 min</option>
                  <option value={300}>5 min</option>
                </select>
              </div>

              {/* Row 2: volume slider + L/R pan slider + 2D pad */}
              <div className="flex items-center gap-2 px-3 pb-2.5">
                <VolumeX className="w-3 h-3 text-outline/30 shrink-0" />
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={sound.volume}
                  onChange={e => onVolumeChange(sound, parseFloat(e.target.value))}
                  className="flex-1 h-1.5 accent-primary cursor-pointer min-w-0"
                />
                <span className="text-[10px] font-mono text-outline/50 w-7 text-right shrink-0">{Math.round(sound.volume * 100)}%</span>

                <span className="text-[9px] text-outline/30 shrink-0 ml-1">L</span>
                <input
                  type="range" min="-1" max="1" step="0.1"
                  value={live.panX}
                  onChange={e => onPatchLive(sound.id, { panX: Number(e.target.value) })}
                  className="w-16 h-1.5 accent-primary cursor-pointer shrink-0"
                />
                <span className="text-[9px] text-outline/30 shrink-0">R</span>

                {/* 2D panning pad */}
                <div
                  className="relative w-8 h-8 bg-surface-container-low rounded border border-outline/15 cursor-crosshair shrink-0 select-none ml-1"
                  title="2D spatial pan: drag to place"
                  onMouseDown={e => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const update = (cx: number, cy: number) => {
                      const x = Math.max(-1, Math.min(1, ((cx - rect.left) / rect.width) * 2 - 1));
                      const z = Math.max(-1, Math.min(1, ((cy - rect.top) / rect.height) * 2 - 1));
                      onPatchLive(sound.id, { panX: x, panZ: z });
                    };
                    update(e.clientX, e.clientY);
                    const onMove = (me: MouseEvent) => update(me.clientX, me.clientY);
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-outline/10 pointer-events-none" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-outline/10 pointer-events-none" />
                  <span className="absolute top-0.5 left-0.5 text-[6px] text-outline/20 leading-none pointer-events-none">L</span>
                  <span className="absolute top-0.5 right-0.5 text-[6px] text-outline/20 leading-none pointer-events-none">R</span>
                  <span className="absolute bottom-0.5 left-0.5 text-[6px] text-outline/20 leading-none pointer-events-none">F</span>
                  <span className="absolute bottom-0.5 right-0.5 text-[6px] text-outline/20 leading-none pointer-events-none">B</span>
                  <div
                    className={`absolute w-2 h-2 rounded-full border border-current -translate-x-1/2 -translate-y-1/2 pointer-events-none ${cat.color}`}
                    style={{ left: `${((live.panX + 1) / 2) * 100}%`, top: `${((live.panZ + 1) / 2) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CompactSoundList.displayName = 'CompactSoundList';
