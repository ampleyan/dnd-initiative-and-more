import React from 'react';
import { Volume2, VolumeX, Repeat, Timer, Star } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { Sound, Spell } from '../../types';
import { SoundEditOverlay } from './SoundEditOverlay';

export interface LiveSettings {
  loop: boolean;
  repeatSecs: number;
  panX: number;
  panZ: number;
}

export const DEFAULT_LIVE: LiveSettings = { loop: false, repeatSecs: 0, panX: 0, panZ: 0 };

interface CategoryMeta {
  id: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  gradient: string;
  typeBadge: string;
  Icon: LucideIcon;
}

interface SoundCardProps {
  sound: Sound;
  spells: Spell[];
  isPlaying: boolean;
  live: LiveSettings;
  isManageMode: boolean;
  cat: CategoryMeta;
  linkedSpell?: Spell | null;
  onTogglePlay: (sound: Sound) => void;
  onVolumeChange: (sound: Sound, value: number) => void;
  onPatchLive: (id: string, patch: Partial<LiveSettings>) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<Sound, 'name' | 'category' | 'tags' | 'spellId' | 'volume' | 'isFavorite'>>) => Promise<void>;
}

export const SoundCard = React.memo<SoundCardProps>(({
  sound, spells, isPlaying, live, isManageMode, cat, linkedSpell,
  onTogglePlay, onVolumeChange, onPatchLive, onDelete, onUpdate,
}) => {
  const CatIcon = cat.Icon;

  return (
    <div
      className={`group relative aspect-square flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 ${
        isPlaying
          ? `${cat.bg} ${cat.border.replace('30', '80')} ${cat.glow} scale-[1.02] z-10 shadow-2xl ring-2 ring-current/60 animate-pulse-ring`
          : `bg-surface-container ${cat.border} hover:bg-surface-container-high hover:scale-[1.02] hover:shadow-xl`
      } ${isManageMode ? 'ring-2 ring-warning/30 ring-offset-2 ring-offset-background' : ''}`}
    >
      {/* Category gradient background */}
      {cat.gradient !== 'transparent' && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: `linear-gradient(to top, ${cat.gradient} 0%, transparent 70%)` }}
        />
      )}

      {/* Watermark icon */}
      <CatIcon className={`absolute -bottom-3 -right-3 w-14 h-14 pointer-events-none ${cat.color} opacity-[0.07]`} />

      {/* Type badge */}
      {cat.typeBadge && (
        <div className={`absolute top-2 left-2 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${cat.bg} ${cat.color} border border-current/20 leading-none z-[1]`}>
          {cat.typeBadge}
        </div>
      )}

      {/* Favorite indicator */}
      {!!sound.isFavorite && !isManageMode && (
        <div className="absolute top-2 left-2 z-[1]">
          <Star className="w-3 h-3 text-amber-400 fill-current" />
        </div>
      )}

      {/* Loop/repeat active indicator */}
      {(live.loop || live.repeatSecs > 0) && (
        <div className={`absolute top-2 z-[1] ${sound.isFavorite && !isManageMode ? 'right-2' : 'right-2'}`}>
          <Repeat className={`w-3 h-3 ${isPlaying ? cat.color : 'text-outline/40'}`} />
        </div>
      )}

      {/* Waveform playing indicator */}
      {isPlaying && (
        <div className="absolute top-2 right-2 z-20 flex items-end gap-[2px] h-4">
          {(['bar-1', 'bar-2', 'bar-3', 'bar-4'] as const).map(cls => (
            <div key={cls} className={`w-[3px] rounded-full ${cls} ${cat.color.replace('text-', 'bg-')}`} style={{ height: '100%' }} />
          ))}
        </div>
      )}

      {/* Edit Mode Overlays */}
      {isManageMode && (
        <SoundEditOverlay
          sound={sound}
          spells={spells}
          cat={cat}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onVolumeChange={onVolumeChange}
        />
      )}

      {/* Main Button Area */}
      <button
        onClick={() => !isManageMode && onTogglePlay(sound)}
        disabled={isManageMode}
        className="flex-1 flex flex-col items-center justify-center p-4 text-center overflow-hidden cursor-pointer relative z-[1]"
      >
        <div className={`p-2 rounded-xl mb-3 transition-transform duration-500 ${isPlaying ? 'scale-110' : 'group-hover:scale-110'}`}>
          {isPlaying ? (
            <Volume2 className={`w-9 h-9 ${cat.color}`} />
          ) : (
            <CatIcon className={`w-9 h-9 ${cat.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
          )}
        </div>
        
        <div className="w-full">
          <p className={`text-xs font-bold leading-tight break-words px-1 ${isPlaying ? 'text-on-surface' : 'text-on-surface/80'}`}>
            {sound.name}
          </p>
          {linkedSpell && (
            <p className={`text-[10px] font-headline uppercase tracking-widest mt-1 opacity-60 truncate ${isPlaying ? 'text-primary' : 'text-outline'}`}>
              ✦ {linkedSpell.name}
            </p>
          )}
        </div>
      </button>

      {/* Hover playback controls */}
      {!isManageMode && (
        <div className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-1.5 bg-surface-container-highest/95 backdrop-blur-sm rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10 space-y-1.5">
          {/* Volume + star row */}
          <div className="flex items-center gap-1.5">
            <VolumeX className="w-3 h-3 text-outline/30 shrink-0" />
            <input
              type="range" min="0" max="1" step="0.05"
              value={sound.volume}
              onClick={e => e.stopPropagation()}
              onChange={e => onVolumeChange(sound, parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary cursor-pointer pointer-events-auto"
            />
            <span className="text-[9px] font-mono text-outline/50 w-6 text-right shrink-0">{Math.round(sound.volume * 100)}</span>
            <button
              onClick={e => { e.stopPropagation(); onUpdate(sound.id, { isFavorite: sound.isFavorite ? 0 : 1 }); }}
              title={sound.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`p-0.5 rounded shrink-0 transition-colors pointer-events-auto ${sound.isFavorite ? 'text-amber-400' : 'text-outline/30 hover:text-amber-400'}`}
            >
              <Star className={`w-3 h-3 ${sound.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
          {/* Loop + Repeat row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onPatchLive(sound.id, { loop: !live.loop }); }}
              title="Loop"
              className={`p-0.5 rounded transition-colors shrink-0 pointer-events-auto ${live.loop ? 'text-primary' : 'text-outline/30 hover:text-outline'}`}
            >
              <Repeat className="w-3 h-3" />
            </button>
            <Timer className="w-3 h-3 text-outline/30 shrink-0" />
            <select
              value={live.repeatSecs}
              onClick={e => e.stopPropagation()}
              onChange={e => onPatchLive(sound.id, { repeatSecs: Number(e.target.value) })}
              className="flex-1 text-[9px] bg-surface-container border border-outline/10 rounded px-1 py-0.5 text-outline appearance-none cursor-pointer focus:outline-none pointer-events-auto"
            >
              <option value={0}>No repeat</option>
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 1 min</option>
              <option value={120}>Every 2 min</option>
              <option value={300}>Every 5 min</option>
            </select>
          </div>
          {/* Panning pad row */}
          <div className="flex items-center gap-2">
            {/* 2D pad */}
            <div
              className="relative w-10 h-10 bg-surface-container rounded-md border border-outline/15 cursor-crosshair shrink-0 select-none pointer-events-auto"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const update = (cx: number, cy: number) => {
                  const x = Math.max(-1, Math.min(1, ((cx - rect.left) / rect.width) * 2 - 1));
                  const z = Math.max(-1, Math.min(1, ((cy - rect.top)  / rect.height) * 2 - 1));
                  onPatchLive(sound.id, { panX: x, panZ: z });
                };
                update(e.clientX, e.clientY);
                const onMove = (me: MouseEvent) => update(me.clientX, me.clientY);
                const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              {/* Grid crosshair */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-outline/10" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-outline/10" />
              </div>
              {/* Corner labels */}
              <span className="absolute top-0.5 left-0.5 text-[6px] text-outline/20 leading-none">L</span>
              <span className="absolute top-0.5 right-0.5 text-[6px] text-outline/20 leading-none">R</span>
              <span className="absolute bottom-0.5 left-0.5 text-[6px] text-outline/20 leading-none">F</span>
              <span className="absolute bottom-0.5 right-0.5 text-[6px] text-outline/20 leading-none">B</span>
              {/* Dot */}
              <div
                className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md border border-white/20 ${
                  live.panX === 0 && live.panZ === 0
                    ? 'bg-outline/40'
                    : isPlaying ? cat.color.replace('text-', 'bg-') : 'bg-primary'
                }`}
                style={{
                  left: `${((live.panX ?? 0) + 1) / 2 * 100}%`,
                  top:  `${((live.panZ ?? 0) + 1) / 2 * 100}%`,
                }}
              />
            </div>
            {/* Position readout + reset */}
            <div className="flex-1 space-y-0.5">
              <div className="text-[8px] font-mono text-outline/40 leading-tight">
                {live.panX === 0 && live.panZ === 0
                  ? 'Center'
                  : `${live.panX < 0 ? 'L' : live.panX > 0 ? 'R' : '·'}${Math.abs(Math.round(live.panX * 100))} · ${live.panZ < 0 ? 'Front' : live.panZ > 0 ? 'Back' : '·'}${Math.abs(Math.round(live.panZ * 100))}`
                }
              </div>
              <button
                onClick={e => { e.stopPropagation(); onPatchLive(sound.id, { panX: 0, panZ: 0 }); }}
                className="text-[8px] text-outline/25 hover:text-primary transition-colors leading-tight pointer-events-auto"
              >
                reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category indicator bar at bottom */}
      <div className={`absolute bottom-0 left-3 right-3 h-1 rounded-t-full ${cat.color.replace('text', 'bg')} opacity-40 group-hover:opacity-0 transition-opacity`} />
    </div>
  );
});

SoundCard.displayName = 'SoundCard';
