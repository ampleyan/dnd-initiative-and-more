import React, { useCallback, useRef, useState } from 'react';
import { Music, Square, Star, Volume2 } from 'lucide-react';
import { Sound } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  combat:  'text-red-400 bg-red-500/15 border-red-500/30',
  magic:   'text-violet-400 bg-violet-500/15 border-violet-500/30',
  ambient: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
  nature:  'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  ui:      'text-sky-400 bg-sky-500/15 border-sky-500/30',
  custom:  'text-outline bg-surface-container border-outline/20',
};

function catCls(cat: string) {
  return CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.custom;
}

interface Props {
  sounds: Sound[];
  combatants: { type: string; hp: { current: number }; initiative?: number; name?: string }[];
  currentTurnIndex: number;
  isEncounterActive: boolean;
  onUpdateSound: (id: string, patch: Partial<Pick<Sound, 'tags'>>) => Promise<void>;
}

export const EncounterSoundpad: React.FC<Props> = ({
  sounds,
  combatants,
  currentTurnIndex,
  isEncounterActive,
  onUpdateSound,
}) => {
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const favourites = sounds.filter(s => s.tags.includes('favourite'));

  // Derived tactical info
  const sorted = [...combatants].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  const nextUp: { name?: string } | null = isEncounterActive ? (sorted[(currentTurnIndex + 1) % sorted.length] ?? null) : null;
  const remainingFoes = combatants.filter(c => c.type === 'monster' && c.hp.current > 0).length;

  const togglePlay = useCallback((sound: Sound) => {
    const existing = audioRefs.current.get(sound.id);
    if (existing) {
      existing.pause();
      existing.currentTime = 0;
      audioRefs.current.delete(sound.id);
      setPlayingIds(prev => { const s = new Set(prev); s.delete(sound.id); return s; });
      return;
    }
    const audio = new Audio(sound.url);
    audio.volume = Math.min(1, Math.max(0, sound.volume));
    audio.play().catch(console.error);
    audio.onended = () => {
      audioRefs.current.delete(sound.id);
      setPlayingIds(prev => { const s = new Set(prev); s.delete(sound.id); return s; });
    };
    audioRefs.current.set(sound.id, audio);
    setPlayingIds(prev => new Set(prev).add(sound.id));
  }, []);

  const stopAll = useCallback(() => {
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    audioRefs.current.clear();
    setPlayingIds(new Set());
  }, []);

  const toggleFavourite = useCallback(async (sound: Sound) => {
    const hasFav = sound.tags.includes('favourite');
    const newTags = hasFav
      ? sound.tags.filter(t => t !== 'favourite')
      : [...sound.tags, 'favourite'];
    await onUpdateSound(sound.id, { tags: newTags });
  }, [onUpdateSound]);

  return (
    <div className="bg-[#12141C] border border-white/5 rounded-2xl p-3 mb-2">
      {/* Header row: tactical info + stop button */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <span className="text-red-400 text-[10px] font-black">☠</span>
            </div>
            <span className="text-white font-black text-sm">{remainingFoes}</span>
            <span className="text-outline/40 text-[9px] uppercase tracking-widest">foes</span>
          </div>

          {nextUp && (
            <>
              <div className="w-px h-3 bg-outline/20" />
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span className="text-primary text-[9px]">⚡</span>
                </div>
                <span className="text-on-surface/70 text-[11px] font-bold truncate max-w-[100px]">{nextUp.name}</span>
                <span className="text-outline/40 text-[9px] uppercase tracking-widest">next</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {playingIds.size > 0 && (
            <button
              onClick={stopAll}
              className="flex items-center gap-1 px-2 py-1 bg-error/10 text-error border border-error/20 rounded-lg text-[10px] font-bold hover:bg-error/20 transition-all"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              Stop ({playingIds.size})
            </button>
          )}
          <div className="flex items-center gap-1">
            <Music className="w-3 h-3 text-pink-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-pink-400/60">Soundpad</span>
          </div>
        </div>
      </div>

      {/* Favourite sounds grid */}
      {favourites.length === 0 ? (
        <div className="flex items-center gap-2 py-2 px-1 text-outline/30">
          <Star className="w-3.5 h-3.5" />
          <span className="text-[10px]">Tag sounds as <code className="bg-white/5 px-1 rounded">favourite</code> in the Soundboard to show them here</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
          {favourites.map(sound => {
            const isPlaying = playingIds.has(sound.id);
            const cls = catCls(sound.category);
            return (
              <button
                key={sound.id}
                onClick={() => togglePlay(sound)}
                className={`relative group flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all active:scale-95 ${
                  isPlaying
                    ? cls + ' scale-95 shadow-lg'
                    : 'bg-surface-container border-white/5 hover:bg-surface-container-high hover:border-white/10'
                }`}
              >
                {isPlaying && (
                  <div className="absolute inset-0 rounded-xl animate-ping bg-current opacity-[0.04]" />
                )}
                <div className="relative">
                  {isPlaying
                    ? <Volume2 className={`w-4 h-4 ${cls.split(' ')[0]}`} />
                    : <Music className="w-4 h-4 text-outline/40 group-hover:text-outline/70 transition-colors" />
                  }
                </div>
                <span className={`text-[9px] font-bold leading-tight text-center line-clamp-2 w-full ${isPlaying ? cls.split(' ')[0] : 'text-on-surface/60 group-hover:text-on-surface/90'}`}>
                  {sound.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* All sounds quick-access: show non-favourite playing ones */}
      {sounds.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 flex-wrap">
          <span className="text-[8px] uppercase tracking-widest text-outline/30 mr-1">All</span>
          {sounds.filter(s => !s.tags.includes('favourite')).map(sound => {
            const isPlaying = playingIds.has(sound.id);
            const cls = catCls(sound.category);
            return (
              <button
                key={sound.id}
                onClick={() => togglePlay(sound)}
                title={sound.name}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-bold transition-all ${
                  isPlaying
                    ? cls
                    : 'bg-surface-container border-white/5 text-outline/50 hover:text-on-surface/70 hover:bg-surface-container-high'
                }`}
              >
                {isPlaying && <Volume2 className="w-2.5 h-2.5" />}
                <span className="truncate max-w-[80px]">{sound.name}</span>
              </button>
            );
          })}
          {sounds.filter(s => !s.tags.includes('favourite')).length === 0 && (
            <span className="text-[8px] text-outline/20 italic">All sounds are in favourites</span>
          )}
        </div>
      )}
    </div>
  );
};
