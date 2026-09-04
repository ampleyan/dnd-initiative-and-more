import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Timer, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SessionWidget, EntityListData, StateMachineData, ToggleData, ItemTrackerData, ReferenceData, FactionBoardData, ChecklistData, NpcStatus } from '../types';

// ── EntityListWidget ──────────────────────────────────────────────────────────

interface EntityListWidgetProps {
  widget: SessionWidget;
  onToggleEntity: (widgetId: string, entryId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const EntityListWidget: React.FC<EntityListWidgetProps> = ({
  widget, onToggleEntity, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as EntityListData;
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const frozenCount = data.entries.filter(e => e.status === 'frozen').length;

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high cursor-pointer select-none"
        onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <span className="text-xs text-outline">❄️ {frozenCount}/{data.entries.length}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-error/20 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="divide-y divide-outline-variant/10 max-h-64 overflow-y-auto custom-scrollbar">
          {data.entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-highest/50">
              <button
                onClick={() => onToggleEntity(widget.id, entry.id)}
                className={cn(
                  'shrink-0 w-5 h-5 rounded-full border-2 transition-colors',
                  entry.status === 'frozen'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-green-500 bg-green-500/20'
                )}
                title={entry.status === 'frozen' ? 'Mark as freed' : 'Mark as frozen'}
              />
              <span className={cn('text-xs flex-1', entry.status === 'freed' && 'line-through text-outline')}>
                {entry.displayName}
              </span>
              {entry.trueName && (
                <button
                  onClick={() => toggleReveal(entry.id)}
                  className="p-1 text-outline hover:text-on-surface transition-colors"
                  title={revealedIds.has(entry.id) ? 'Hide true name' : 'Reveal true name'}
                >
                  {revealedIds.has(entry.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              )}
              {entry.trueName && revealedIds.has(entry.id) && (
                <span className="text-xs text-amber-400 font-mono">"{entry.trueName}"</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── StateMachineWidget ────────────────────────────────────────────────────────

interface StateMachineWidgetProps {
  widget: SessionWidget;
  onAdvanceState: (widgetId: string, toIndex: number) => void;
  onSetTimer: (widgetId: string, durationMs: number) => void;
  onClearTimer: (widgetId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const StateMachineWidget: React.FC<StateMachineWidgetProps> = ({
  widget, onAdvanceState, onSetTimer, onClearTimer, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as StateMachineData;
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerInput, setTimerInput] = useState('');
  const [showTimerInput, setShowTimerInput] = useState(false);
  const currentState = data.states[data.currentStateIndex];

  // Countdown tick
  useEffect(() => {
    if (!data.timerEndsAt) { setTimeLeft(null); return; }
    const tick = () => {
      const left = Math.max(0, data.timerEndsAt! - Date.now());
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data.timerEndsAt]);

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  const handleSetTimer = () => {
    const hoursMatch = timerInput.match(/(\d+)\s*h/);
    const minsMatch = timerInput.match(/(\d+)\s*m(?!s)/);
    const totalMins = parseInt(timerInput);
    let ms = 0;
    if (hoursMatch || minsMatch) {
      ms = ((hoursMatch ? parseInt(hoursMatch[1]) : 0) * 60 + (minsMatch ? parseInt(minsMatch[1]) : 0)) * 60000;
    } else if (!isNaN(totalMins)) {
      ms = totalMins * 60000;
    }
    if (ms > 0) { onSetTimer(widget.id, ms); setTimerInput(''); setShowTimerInput(false); }
  };

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high cursor-pointer select-none"
        onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full text-white', currentState.color)}>
          {currentState.label}
        </span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-error/20 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-3 py-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {data.states.map((state, i) => (
              <button
                key={i}
                onClick={() => onAdvanceState(widget.id, i)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full border transition-all',
                  i === data.currentStateIndex
                    ? cn('text-white border-transparent', state.color)
                    : 'text-outline border-outline-variant/30 hover:border-outline'
                )}
              >
                {state.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {timeLeft !== null ? (
              <>
                <span className="text-xs text-amber-400 font-mono">{formatTime(timeLeft)}</span>
                <button onClick={() => onClearTimer(widget.id)}
                  className="text-xs text-outline hover:text-on-surface transition-colors">clear</button>
              </>
            ) : (
              <button onClick={() => setShowTimerInput(v => !v)}
                className="flex items-center gap-1 text-xs text-outline hover:text-on-surface transition-colors">
                <Timer className="w-3 h-3" /> set timer
              </button>
            )}
          </div>
          {showTimerInput && timeLeft === null && (
            <div className="flex gap-1">
              <input
                type="text"
                value={timerInput}
                onChange={e => setTimerInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetTimer()}
                placeholder="e.g. 5h 30m or 90"
                className="flex-1 text-xs bg-surface-container px-2 py-1 rounded border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
              />
              <button onClick={handleSetTimer}
                className="text-xs px-2 py-1 bg-primary text-on-primary rounded hover:bg-primary/90 transition-colors">
                Start
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── ToggleWidget ──────────────────────────────────────────────────────────────

interface ToggleWidgetProps {
  widget: SessionWidget;
  onSetToggle: (widgetId: string, index: number) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const ToggleWidget: React.FC<ToggleWidgetProps> = ({
  widget, onSetToggle, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as ToggleData;
  const current = data.values[data.currentIndex];

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high cursor-pointer select-none"
        onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full text-white', current.color)}>
          {current.label}
        </span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-error/20 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-3 py-2 flex flex-wrap gap-1">
          {data.values.map((val, i) => (
            <button
              key={i}
              onClick={() => onSetToggle(widget.id, i)}
              className={cn(
                'text-xs px-2 py-1 rounded-full border transition-all',
                i === data.currentIndex
                  ? cn('text-white border-transparent', val.color)
                  : 'text-outline border-outline-variant/30 hover:border-outline'
              )}
            >
              {val.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ItemTrackerWidget ─────────────────────────────────────────────────────────

interface ItemTrackerWidgetProps {
  widget: SessionWidget;
  onEditItemLocation: (widgetId: string, itemId: string, location: string) => void;
  onCycleItemState: (widgetId: string, itemId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const ItemTrackerWidget: React.FC<ItemTrackerWidgetProps> = ({
  widget, onEditItemLocation, onCycleItemState, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as ItemTrackerData;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  return (
    <div className="border border-white/10 rounded-xl bg-[#0D1117] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5"
           onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-white/10 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {data.items.length === 0 && (
            <p className="text-xs text-outline text-center py-2">No items</p>
          )}
          {data.items.map(item => (
            <div key={item.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">{item.name}</p>
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => { onEditItemLocation(widget.id, item.id, editVal); setEditingId(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { onEditItemLocation(widget.id, item.id, editVal); setEditingId(null); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full bg-surface-container border border-primary/60 rounded px-1.5 py-0.5 text-xs text-on-surface outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(item.id); setEditVal(item.location); }}
                    className="text-xs text-outline hover:text-on-surface text-left truncate w-full"
                  >
                    {item.location || <span className="italic opacity-50">tap to set location</span>}
                  </button>
                )}
              </div>
              {item.states && item.states.length > 0 && (
                <button
                  onClick={() => onCycleItemState(widget.id, item.id)}
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-outline hover:text-on-surface border border-white/8 transition-colors"
                >
                  {item.states[item.currentStateIndex ?? 0]}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ReferenceWidget ───────────────────────────────────────────────────────────

interface ReferenceWidgetProps {
  widget: SessionWidget;
  onReveal: (widgetId: string, entryId: string) => void;
  onRevealAll: (widgetId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const ReferenceWidget: React.FC<ReferenceWidgetProps> = ({
  widget, onReveal, onRevealAll, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as ReferenceData;
  const allRevealed = data.entries.length > 0 && data.entries.every(e => e.revealed);

  return (
    <div className="border border-white/10 rounded-xl bg-[#0D1117] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5"
           onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        {!widget.collapsed && (
          <button
            onClick={e => { e.stopPropagation(); onRevealAll(widget.id); }}
            className="text-[10px] text-outline hover:text-on-surface transition-colors px-1 shrink-0"
          >
            {allRevealed ? 'hide all' : 'reveal all'}
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-white/10 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-3 pb-3 space-y-1.5">
          {data.entries.length === 0 && (
            <p className="text-xs text-outline text-center py-2">No entries</p>
          )}
          {data.entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-xs text-outline flex-1 truncate" title={entry.hint}>{entry.label}</span>
              <button
                onClick={() => onReveal(widget.id, entry.id)}
                title={entry.hint}
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded transition-colors border shrink-0",
                  entry.revealed
                    ? "text-on-surface border-white/20 bg-surface-container"
                    : "text-outline border-white/10 bg-surface-container hover:border-primary/40"
                )}
              >
                {entry.revealed ? entry.value : '• • •'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── FactionBoardWidget ────────────────────────────────────────────────────────

const STATUS_STYLES: Record<NpcStatus, string> = {
  unknown:  'bg-surface-container text-outline border-white/10',
  active:   'bg-amber-700/60 text-amber-300 border-amber-700/40',
  frozen:   'bg-blue-700/60 text-blue-200 border-blue-700/40',
  freed:    'bg-emerald-700/60 text-emerald-300 border-emerald-700/40',
  fled:     'bg-purple-700/60 text-purple-300 border-purple-700/40',
  defeated: 'bg-red-900/60 text-red-300 border-red-900/40',
  allied:   'bg-green-700/60 text-green-200 border-green-700/40',
};

interface FactionBoardWidgetProps {
  widget: SessionWidget;
  onCycleNpcStatus: (widgetId: string, factionId: string, npcId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const FactionBoardWidget: React.FC<FactionBoardWidgetProps> = ({
  widget, onCycleNpcStatus, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as FactionBoardData;
  const [collapsedFactions, setCollapsedFactions] = useState<Set<string>>(new Set());
  const toggleFaction = (id: string) => setCollapsedFactions(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="border border-white/10 rounded-xl bg-[#0D1117] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5"
           onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-white/10 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-2 pb-3 space-y-1">
          {data.factions.length === 0 && (
            <p className="text-xs text-outline text-center py-2">No factions</p>
          )}
          {data.factions.map(faction => (
            <div key={faction.id}>
              <button
                onClick={() => toggleFaction(faction.id)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", faction.color)} />
                <span className="text-xs font-bold text-on-surface flex-1 text-left">{faction.name}</span>
                <span className="text-[10px] text-outline">
                  {faction.npcs.filter(n => n.status === 'freed').length}✓ {faction.npcs.filter(n => n.status === 'frozen').length}❄
                </span>
              </button>
              {!collapsedFactions.has(faction.id) && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {faction.npcs.map(npc => (
                    <div key={npc.id} className="flex items-center gap-2 px-2 py-0.5">
                      <span className={cn("text-xs flex-1 truncate", npc.status === 'defeated' && 'line-through text-outline')}>
                        {npc.name}
                      </span>
                      <span className="text-[9px] text-outline truncate max-w-[70px]">{npc.location}</span>
                      <button
                        onClick={() => onCycleNpcStatus(widget.id, faction.id, npc.id)}
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors capitalize shrink-0",
                          STATUS_STYLES[npc.status]
                        )}
                      >
                        {npc.status}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ChecklistWidget ───────────────────────────────────────────────────────────

interface ChecklistWidgetProps {
  widget: SessionWidget;
  onToggleItem: (widgetId: string, itemId: string) => void;
  onToggleCollapsed: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

export const ChecklistWidget: React.FC<ChecklistWidgetProps> = ({
  widget, onToggleItem, onToggleCollapsed, onRemove,
}) => {
  const data = widget.data as ChecklistData;
  const checkedCount = data.items.filter(i => i.checked).length;

  return (
    <div className="border border-white/10 rounded-xl bg-[#0D1117] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/5"
           onClick={() => onToggleCollapsed(widget.id)}>
        {widget.collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-semibold text-on-surface flex-1">{widget.title}</span>
        <span className="text-[10px] text-outline shrink-0">{checkedCount}/{data.items.length}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(widget.id); }}
          className="p-1 rounded hover:bg-white/10 text-outline hover:text-error transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      {!widget.collapsed && (
        <div className="px-3 pb-3 space-y-1">
          {data.items.length === 0 && (
            <p className="text-xs text-outline text-center py-2">No items</p>
          )}
          {data.items.map(item => (
            <button
              key={item.id}
              onClick={() => onToggleItem(widget.id, item.id)}
              className="w-full flex items-start gap-2 text-left hover:bg-white/5 rounded-lg px-1.5 py-1 transition-colors group"
            >
              <div className={cn(
                "mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
                item.checked ? "bg-primary border-primary" : "border-white/30 group-hover:border-primary/60"
              )}>
                {item.checked && <span className="text-[9px] font-black text-on-primary leading-none">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs leading-tight", item.checked ? "line-through text-outline" : "text-on-surface")}>
                  {item.label}
                </p>
                {item.source && (
                  <p className="text-[10px] text-outline/60 mt-0.5">{item.source}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
