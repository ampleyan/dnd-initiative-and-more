import React from 'react';
import { Grip, Minus, StickyNote, X } from 'lucide-react';

interface DmStickyNoteProps {
  encounterId: string;
  value: string;
  onChange: (value: string) => void;
}

type Position = { x: number; y: number };

function getPosition(id: string): Position {
  try {
    const saved = localStorage.getItem(`dm-sticky-position-${id}`);
    if (saved) return JSON.parse(saved) as Position;
  } catch {}
  return { x: Math.max(8, window.innerWidth - 304), y: 88 };
}

export const DmStickyNote: React.FC<DmStickyNoteProps> = ({ encounterId, value, onChange }) => {
  const [position, setPosition] = React.useState(() => getPosition(encounterId));
  const [collapsed, setCollapsed] = React.useState(false);
  const [closed, setClosed] = React.useState(() => localStorage.getItem(`dm-sticky-closed-${encounterId}`) === 'true');
  const drag = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    setPosition(getPosition(encounterId));
    setClosed(localStorage.getItem(`dm-sticky-closed-${encounterId}`) === 'true');
    setCollapsed(false);
  }, [encounterId]);

  React.useEffect(() => {
    localStorage.setItem(`dm-sticky-position-${encounterId}`, JSON.stringify(position));
  }, [encounterId, position]);

  if (closed) {
    return (
      <button
        onClick={() => { setClosed(false); localStorage.removeItem(`dm-sticky-closed-${encounterId}`); }}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 shadow-xl"
      >
        <StickyNote className="h-4 w-4" /> DM Note
      </button>
    );
  }

  return (
    <section className="fixed z-50 h-52 w-72 min-h-20 min-w-60 resize overflow-auto rounded-xl border border-amber-300/40 bg-amber-100 text-slate-900 shadow-2xl" style={{ left: position.x, top: position.y }} aria-label="DM sticky note">
      <div
        className="flex cursor-move items-center gap-2 border-b border-amber-900/15 bg-amber-200/80 px-3 py-2"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX - position.x, y: event.clientY - position.y };
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          setPosition({
            x: Math.max(8, Math.min(window.innerWidth - 296, event.clientX - drag.current.x)),
            y: Math.max(56, Math.min(window.innerHeight - 56, event.clientY - drag.current.y)),
          });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <Grip className="h-4 w-4 text-amber-900/60" />
        <span className="flex-1 text-xs font-black uppercase tracking-widest">DM Note</span>
        <button
          onPointerDown={event => event.stopPropagation()}
          onClick={() => setCollapsed(current => !current)}
          className="rounded p-1 hover:bg-amber-300"
          title={collapsed ? 'Expand note' : 'Collapse note'}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onPointerDown={event => event.stopPropagation()}
          onClick={() => { setClosed(true); localStorage.setItem(`dm-sticky-closed-${encounterId}`, 'true'); }}
          className="rounded p-1 hover:bg-amber-300"
          title="Close note"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!collapsed && (
        <textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="Write a tip, reminder, or scene cue..."
          className="h-[calc(100%-41px)] min-h-10 w-full resize-none bg-amber-50/70 p-3 text-sm leading-relaxed outline-none placeholder:text-amber-900/45"
          aria-label="DM note text"
        />
      )}
    </section>
  );
};
