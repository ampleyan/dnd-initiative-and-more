import React from 'react';
import { Music, X } from 'lucide-react';
import { SoundboardScreen } from './SoundboardScreen';
import { Spell } from '../types';
import type { Sound } from '../types';
import type { LiveSettings } from '../hooks/useSoundboard';

interface DraggableSoundpadProps {
  isOpen: boolean;
  onClose: () => void;
  sounds?: Sound[];
  spells: Spell[];
  onAddSound?: (data: FormData) => Promise<void>;
  onUpdateSound?: (id: string, patch: Partial<Pick<Sound, 'name' | 'category' | 'tags' | 'spellId' | 'volume' | 'isFavorite'>>) => Promise<void>;
  onDeleteSound?: (id: string) => Promise<void>;
  onRefreshSounds?: () => Promise<void>;
  soundPlayingIds?: Set<string>;
  soundLiveSettings?: Record<string, LiveSettings>;
  onTogglePlay?: (sound: Sound) => void;
  onStopAllSounds?: () => void;
  onPatchLive?: (id: string, patch: unknown) => void;
  onSetVolume?: (id: string, volume: number) => void;
  masterVolume?: number;
  setMasterVolume?: (v: number) => void;
  isMuted?: boolean;
  setIsMuted?: (v: boolean) => void;
}

export const DraggableSoundpad: React.FC<DraggableSoundpadProps> = ({
  isOpen,
  onClose,
  sounds,
  spells,
  onAddSound,
  onUpdateSound,
  onDeleteSound,
  onRefreshSounds,
  soundPlayingIds,
  soundLiveSettings,
  onTogglePlay,
  onStopAllSounds,
  onPatchLive,
  onSetVolume,
  masterVolume,
  setMasterVolume,
  isMuted,
  setIsMuted,
}) => {
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ w: 480, h: 520 });
  const dragRef = React.useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = React.useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const x = Math.max(0, Math.min(window.innerWidth - 320, window.innerWidth - 500));
      const y = Math.max(0, Math.min(window.innerHeight - 280, window.innerHeight - 560));
      setPos({ x, y });
      setSize({ w: 480, h: 520 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-[100] bg-surface-container rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <header
        className="px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high shrink-0 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={e => {
          e.preventDefault();
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
          const onMove = (me: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = me.clientX - dragRef.current.startX;
            const dy = me.clientY - dragRef.current.startY;
            setPos({
              x: Math.max(0, dragRef.current.origX + dx),
              y: Math.max(0, dragRef.current.origY + dy),
            });
          };
          const onUp = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <h3 className="text-sm font-headline font-bold text-on-surface flex items-center gap-2">
          <Music className="w-4 h-4 text-pink-400" />
          Soundpad
        </h3>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          className="p-1.5 hover:bg-surface-container-highest rounded-full transition-colors text-outline hover:text-on-surface"
        >
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative">
        <SoundboardScreen
          sounds={sounds ?? []}
          spells={spells}
          onAdd={onAddSound ?? (async () => {})}
          onUpdate={onUpdateSound ?? (async () => {})}
          onDelete={onDeleteSound ?? (async () => {})}
          onRefresh={onRefreshSounds ?? (async () => {})}
          playingIds={soundPlayingIds ?? new Set()}
          liveSettings={soundLiveSettings ?? {}}
          onTogglePlay={onTogglePlay ?? (() => {})}
          onStopAll={onStopAllSounds ?? (() => {})}
          onPatchLive={onPatchLive ?? (() => {})}
          onSetVolume={onSetVolume ?? (() => {})}
          masterVolume={masterVolume}
          isMuted={isMuted}
          onMasterVolumeChange={setMasterVolume}
          onMuteToggle={setIsMuted}
          compact
        />
      </div>
      <div
        className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-outline/30 rounded-br-xl cursor-se-resize"
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
          const onMove = (me: MouseEvent) => {
            if (!resizeRef.current) return;
            const dw = me.clientX - resizeRef.current.startX;
            const dh = me.clientY - resizeRef.current.startY;
            setSize({
              w: Math.max(320, resizeRef.current.origW + dw),
              h: Math.max(280, resizeRef.current.origH + dh),
            });
          };
          const onUp = () => {
            resizeRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
    </div>
  );
};
