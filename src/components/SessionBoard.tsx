import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Settings, Minus, RotateCcw, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSessionBoard } from '../hooks/useSessionBoard';
import { SessionBoardConfigModal } from './SessionBoardConfigModal';
import {
  EntityListWidget,
  StateMachineWidget,
  ToggleWidget,
  ItemTrackerWidget,
  ReferenceWidget,
  FactionBoardWidget,
  ChecklistWidget,
} from './SessionBoardWidgets';
import { AddWidgetPanel } from './AddWidgetPanel';
import type { EntityListData, StateMachineData, ToggleData } from '../types';

export interface SessionBoardHandle {
  open: () => void;
}

interface SessionBoardProps {
  isEncounterActive: boolean;
  hideTrigger?: boolean;
}

export const SessionBoard = forwardRef<SessionBoardHandle, SessionBoardProps>(({ isEncounterActive, hideTrigger = false }, ref) => {
  const {
    board,
    isOpen,
    setIsOpen,
    isConfigOpen,
    setIsConfigOpen,
    startBoardFromProposal,
    moveBoard,
    minimizeBoard,
    handleToggleEntity,
    handleAdvanceState,
    handleSetTimer,
    handleClearTimer,
    handleSetToggle,
    handleToggleCollapsed,
    handleAddWidget,
    handleRemoveWidget,
    resetBoard,
    handleEditItemLocation,
    handleCycleItemState,
    handleRevealEntry,
    handleRevealAll,
    handleCycleNpcStatus,
    handleToggleChecklistItem,
  } = useSessionBoard();

  useImperativeHandle(ref, () => ({
    open: () => { board ? setIsOpen(true) : setIsConfigOpen(true); },
  }), [board, setIsOpen, setIsConfigOpen]);

  // Auto-minimize once when combat starts; intentionally omits board so the DM
  // can re-open the board during combat without it immediately re-minimizing.
  React.useEffect(() => {
    if (!isEncounterActive) return;
    minimizeBoard(true);
  }, [isEncounterActive, minimizeBoard]);

  // ── Drag handling ─────────────────────────────────────────────────────────────
  const dragOffset = useRef({ x: 0, y: 0 });

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!board) return;
    dragOffset.current = {
      x: e.clientX - board.position.x,
      y: e.clientY - board.position.y,
    };
    const onMove = (ev: PointerEvent) => {
      moveBoard({
        x: Math.max(0, Math.min(window.innerWidth - 320, ev.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [board, moveBoard]);

  // ── Minimized strip summary ───────────────────────────────────────────────────
  const getMinimizedSummary = () => {
    if (!board) return '';
    return board.widgets.map(w => {
      if (w.type === 'entity-list') {
        const d = w.data as EntityListData;
        const frozen = d.entries.filter(e => e.status === 'frozen').length;
        return `❄️ ${frozen}`;
      }
      if (w.type === 'state-machine') {
        const d = w.data as StateMachineData;
        return `🐉 ${d.states[d.currentStateIndex].label}`;
      }
      if (w.type === 'toggle') {
        const d = w.data as ToggleData;
        return `👑 ${d.values[d.currentIndex].label.split(' ')[0]}`;
      }
      return '';
    }).filter(Boolean).join(' · ');
  };

  if (!isOpen && !board) {
    return (
      <>
        {!hideTrigger && (
          <button
            onClick={() => setIsConfigOpen(true)}
            className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 px-3 py-2 bg-surface-container-high border border-outline-variant/20 rounded-xl text-xs text-outline hover:text-on-surface hover:border-outline transition-all shadow-lg"
            title="Open Session Board (Ctrl+Shift+B)"
          >
            <Settings className="w-3.5 h-3.5" /> Session Board
          </button>
        )}
        <SessionBoardConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onStart={(name, proposal) => startBoardFromProposal(name, proposal)}
        />
      </>
    );
  }

  if (!board) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', left: board.position.x, top: board.position.y, zIndex: 200, width: 300 }}
            className="bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header / drag handle */}
            <div
              onPointerDown={onDragStart}
              className="flex items-center gap-2 px-3 py-2 bg-surface-container-high border-b border-outline-variant/10 cursor-grab active:cursor-grabbing select-none"
            >
              <GripHorizontal className="w-4 h-4 text-outline shrink-0" />
              <span className="text-sm font-semibold text-on-surface flex-1 truncate">{board.name}</span>
              {board.minimized && (
                <span className="text-xs text-outline truncate max-w-[120px]">{getMinimizedSummary()}</span>
              )}
              <button onClick={() => minimizeBoard(!board.minimized)}
                className="p-1 rounded hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
                title={board.minimized ? 'Expand' : 'Minimize'}>
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsConfigOpen(true)}
                className="p-1 rounded hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
                title="Configure">
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Widget list */}
            {!board.minimized && (
              <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {board.widgets.map(w => {
                  if (w.type === 'entity-list') return (
                    <EntityListWidget key={w.id} widget={w}
                      onToggleEntity={handleToggleEntity}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'state-machine') return (
                    <StateMachineWidget key={w.id} widget={w}
                      onAdvanceState={handleAdvanceState}
                      onSetTimer={handleSetTimer}
                      onClearTimer={handleClearTimer}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'toggle') return (
                    <ToggleWidget key={w.id} widget={w}
                      onSetToggle={handleSetToggle}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'item-tracker') return (
                    <ItemTrackerWidget key={w.id} widget={w}
                      onEditItemLocation={handleEditItemLocation}
                      onCycleItemState={handleCycleItemState}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'reference') return (
                    <ReferenceWidget key={w.id} widget={w}
                      onReveal={handleRevealEntry}
                      onRevealAll={handleRevealAll}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'faction-board') return (
                    <FactionBoardWidget key={w.id} widget={w}
                      onCycleNpcStatus={handleCycleNpcStatus}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  if (w.type === 'checklist') return (
                    <ChecklistWidget key={w.id} widget={w}
                      onToggleItem={handleToggleChecklistItem}
                      onToggleCollapsed={handleToggleCollapsed}
                      onRemove={handleRemoveWidget} />
                  );
                  return null;
                })}

                {board.widgets.length === 0 && (
                  <p className="text-xs text-outline text-center py-4">No widgets yet. Add one below.</p>
                )}

                {/* + Widget / Reset row */}
                <div className="flex gap-1 pt-1">
                  <AddWidgetPanel onAdd={widget => handleAddWidget(widget)} />
                  <button
                    onClick={resetBoard}
                    className="px-2 py-1.5 text-xs text-outline hover:text-error transition-colors"
                    title="Reset board">
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SessionBoardConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onStart={(name, proposal) => startBoardFromProposal(name, proposal)}
      />
    </>
  );
});
