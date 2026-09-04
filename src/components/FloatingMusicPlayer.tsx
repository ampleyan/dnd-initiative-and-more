import React, { useRef, useCallback, useEffect, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useLocalState } from '../hooks/useLocalState';

const STORAGE_KEY = 'floatingMusicPlayer.position';
const WIDGET_W = 280;
const HEADER_H = 28;
const EXPANDED_H = 158 + HEADER_H;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function defaultPosition(): { x: number; y: number } {
  return {
    x: 16,
    y: Math.max(16, window.innerHeight - EXPANDED_H - 24),
  };
}

interface FloatingMusicPlayerProps {
  youtubeId: string;
  isPaused: boolean;
}

export const FloatingMusicPlayer: React.FC<FloatingMusicPlayerProps> = ({ youtubeId, isPaused }) => {
  const isMobile = window.innerWidth < 768;
  const [collapsed, setCollapsed] = useState(() => isMobile);
  // Use separate storage key on mobile so desktop positions don't pollute; pin below sticky header
  const [position, setPosition] = useLocalState<{ x: number; y: number }>(
    isMobile ? `${STORAGE_KEY}.mobile` : STORAGE_KEY,
    isMobile ? { x: window.innerWidth - WIDGET_W - 8, y: Math.max(0, window.innerHeight - HEADER_H - 70) } : defaultPosition()
  );
  const dragOffset = useRef({ x: 0, y: 0 });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const fn = isPaused ? 'pauseVideo' : 'playVideo';
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: fn, args: [] }),
      '*',
    );
  }, [isPaused]);

  useEffect(() => { isFirstRender.current = true; }, [youtubeId]);

  useEffect(() => {
    const clampToViewport = () => {
      setPosition(prev => {
        const maxX = Math.max(0, window.innerWidth - WIDGET_W);
        const maxY = Math.max(0, window.innerHeight - HEADER_H);
        // If mobile position got stuck at 0 (viewport wasn't ready during init), reset to bottom
        if (isMobile && prev.y < 50 && window.innerHeight > 200) {
          return { x: maxX, y: Math.max(0, window.innerHeight - HEADER_H - 70) };
        }
        return { x: clamp(prev.x, 0, maxX), y: clamp(prev.y, 0, maxY) };
      });
    };
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [setPosition, isMobile]);

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      setPosition({
        x: clamp(ev.clientX - dragOffset.current.x, 0, window.innerWidth - WIDGET_W),
        y: clamp(ev.clientY - dragOffset.current.y, 0, window.innerHeight - HEADER_H),
      });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [position]);

  const iframeSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&loop=1&playlist=${youtubeId}&enablejsapi=1&controls=1`;

  return (
    <>
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        style={!collapsed
          ? {
              position: 'fixed',
              left: position.x,
              top: position.y + HEADER_H,
              width: WIDGET_W,
              height: 158,
              border: '1px solid rgba(255,255,255,0.1)',
              borderTop: 'none',
              borderRadius: '0 0 0.75rem 0.75rem',
              zIndex: 50,
            }
          : {
              position: 'fixed',
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
              bottom: 0,
              left: 0,
              zIndex: -1,
              border: 'none',
            }
        }
        allow="autoplay; encrypted-media"
        title="background-music"
      />

      <div
        style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 50, width: WIDGET_W }}
        className={`shadow-2xl border border-white/10 ${collapsed ? 'rounded-xl overflow-hidden' : 'rounded-t-xl'}`}
      >
        <div
          onPointerDown={onDragStart}
          className="flex items-center justify-between px-3 py-1.5 bg-[#0f1419] cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="w-3.5 h-3.5 text-outline shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-outline font-bold truncate">Ambient Music</span>
            {collapsed && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
          </div>
          <button
            onClick={() => setCollapsed(v => !v)}
            onPointerDown={e => e.stopPropagation()}
            className="text-outline hover:text-on-surface text-xs ml-4 px-1"
            title={collapsed ? 'Expand' : 'Minimize'}
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
      </div>
    </>
  );
};
