import { useState, useCallback, useEffect } from 'react';
import type { SessionBoard, SessionBoardProposal } from '../types';
import {
  createBoardFromProposal,
  saveBoardToStorage,
  loadBoardFromStorage,
  toggleEntityStatus,
  advanceStateMachine,
  setStateMachineTimer,
  clearStateMachineTimer,
  cycleToggle,
  setToggleIndex,
  toggleWidgetCollapsed,
  addWidget,
  removeWidget,
  editItemLocation,
  cycleItemState,
  toggleReferenceEntry,
  toggleAllReferenceEntries,
  cycleNpcStatus,
  toggleChecklistItem,
} from '../lib/sessionBoardUtils';

const ACTIVE_BOARD_ID_KEY = 'session-board-active-id';

export function useSessionBoard() {
  const [board, setBoard] = useState<SessionBoard | null>(() => {
    const activeId = localStorage.getItem(ACTIVE_BOARD_ID_KEY);
    if (!activeId) return null;
    return loadBoardFromStorage(activeId);
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Persist whenever board changes
  useEffect(() => {
    if (!board) return;
    saveBoardToStorage(board);
    localStorage.setItem(ACTIVE_BOARD_ID_KEY, board.id);
  }, [board]);

  // Ctrl+Shift+B keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const startBoardFromProposal = useCallback((name: string, proposal: SessionBoardProposal) => {
    const newBoard = createBoardFromProposal(name, proposal);
    setBoard(newBoard);
    setIsOpen(true);
    setIsConfigOpen(false);
  }, []);

  const updateBoard = useCallback((updater: (b: SessionBoard) => SessionBoard) => {
    setBoard(prev => prev ? updater(prev) : prev);
  }, []);

  const moveBoard = useCallback((position: { x: number; y: number }) => {
    updateBoard(b => ({ ...b, position }));
  }, [updateBoard]);

  const minimizeBoard = useCallback((minimized: boolean) => {
    updateBoard(b => ({ ...b, minimized }));
  }, [updateBoard]);

  const handleToggleEntity = useCallback((widgetId: string, entryId: string) => {
    updateBoard(b => toggleEntityStatus(b, widgetId, entryId));
  }, [updateBoard]);

  const handleAdvanceState = useCallback((widgetId: string, toIndex: number) => {
    updateBoard(b => advanceStateMachine(b, widgetId, toIndex));
  }, [updateBoard]);

  const handleSetTimer = useCallback((widgetId: string, durationMs: number) => {
    updateBoard(b => setStateMachineTimer(b, widgetId, durationMs));
  }, [updateBoard]);

  const handleClearTimer = useCallback((widgetId: string) => {
    updateBoard(b => clearStateMachineTimer(b, widgetId));
  }, [updateBoard]);

  const handleCycleToggle = useCallback((widgetId: string) => {
    updateBoard(b => cycleToggle(b, widgetId));
  }, [updateBoard]);

  const handleSetToggle = useCallback((widgetId: string, index: number) => {
    updateBoard(b => setToggleIndex(b, widgetId, index));
  }, [updateBoard]);

  const handleToggleCollapsed = useCallback((widgetId: string) => {
    updateBoard(b => toggleWidgetCollapsed(b, widgetId));
  }, [updateBoard]);

  const handleAddWidget = useCallback((widget: Parameters<typeof addWidget>[1]) => {
    updateBoard(b => addWidget(b, widget));
  }, [updateBoard]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    updateBoard(b => removeWidget(b, widgetId));
  }, [updateBoard]);

  const handleEditItemLocation = useCallback((widgetId: string, itemId: string, location: string) => {
    updateBoard(b => editItemLocation(b, widgetId, itemId, location));
  }, [updateBoard]);

  const handleCycleItemState = useCallback((widgetId: string, itemId: string) => {
    updateBoard(b => cycleItemState(b, widgetId, itemId));
  }, [updateBoard]);

  const handleRevealEntry = useCallback((widgetId: string, entryId: string) => {
    updateBoard(b => toggleReferenceEntry(b, widgetId, entryId));
  }, [updateBoard]);

  const handleRevealAll = useCallback((widgetId: string) => {
    updateBoard(b => toggleAllReferenceEntries(b, widgetId));
  }, [updateBoard]);

  const handleCycleNpcStatus = useCallback((widgetId: string, factionId: string, npcId: string) => {
    updateBoard(b => cycleNpcStatus(b, widgetId, factionId, npcId));
  }, [updateBoard]);

  const handleToggleChecklistItem = useCallback((widgetId: string, itemId: string) => {
    updateBoard(b => toggleChecklistItem(b, widgetId, itemId));
  }, [updateBoard]);

  const resetBoard = useCallback(() => {
    setBoard(null);
    localStorage.removeItem(ACTIVE_BOARD_ID_KEY);
    setIsOpen(false);
  }, []);

  return {
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
    handleCycleToggle,
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
  };
}
