import type { SessionBoard, SessionWidget, SessionBoardProposal, EntityListData, StateMachineData, ToggleData, EntityListEntry, ItemTrackerData, ReferenceData, FactionBoardData, ChecklistData, NpcStatus } from '../types';
import { uuid } from './utils';

const STORAGE_KEY = 'session-board-';

// ── Creation ──────────────────────────────────────────────────────────────────

export function createBoardFromProposal(name: string, proposal: SessionBoardProposal): SessionBoard {
  const widgets: SessionWidget[] = [];

  if (proposal.entityList) {
    const entries: EntityListEntry[] = proposal.entityList.entries.map(e => ({
      ...e,
      id: uuid(),
    }));
    widgets.push({
      id: uuid(),
      type: 'entity-list',
      title: proposal.entityList.title,
      collapsed: false,
      data: { entries } satisfies EntityListData,
    });
  }

  if (proposal.stateMachine) {
    widgets.push({
      id: uuid(),
      type: 'state-machine',
      title: proposal.stateMachine.title,
      collapsed: false,
      data: {
        entityName: proposal.stateMachine.entityName,
        states: proposal.stateMachine.states,
        currentStateIndex: 0,
      } satisfies StateMachineData,
    });
  }

  if (proposal.toggle) {
    widgets.push({
      id: uuid(),
      type: 'toggle',
      title: proposal.toggle.title,
      collapsed: false,
      data: {
        values: proposal.toggle.values,
        currentIndex: 0,
      } satisfies ToggleData,
    });
  }

  return {
    id: uuid(),
    name,
    widgets,
    position: { x: 24, y: 80 },
    minimized: false,
  };
}

// ── localStorage ──────────────────────────────────────────────────────────────

export function saveBoardToStorage(board: SessionBoard): void {
  try {
    localStorage.setItem(STORAGE_KEY + board.id, JSON.stringify(board));
  } catch {
    // storage full — silently ignore
  }
}

export function loadBoardFromStorage(id: string): SessionBoard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + id);
    return raw ? (JSON.parse(raw) as SessionBoard) : null;
  } catch {
    return null;
  }
}

export function deleteBoardFromStorage(id: string): void {
  localStorage.removeItem(STORAGE_KEY + id);
}

// ── Immutable widget updates ──────────────────────────────────────────────────
// All update functions return a new SessionBoard — the hook calls saveBoardToStorage after.

export function updateWidget(board: SessionBoard, widgetId: string, updater: (w: SessionWidget) => SessionWidget): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id === widgetId ? updater(w) : w),
  };
}

export function toggleEntityStatus(board: SessionBoard, widgetId: string, entryId: string): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as EntityListData;
    return {
      ...w,
      data: {
        entries: data.entries.map(e =>
          e.id === entryId
            ? { ...e, status: e.status === 'frozen' ? 'freed' : 'frozen' }
            : e
        ),
      } satisfies EntityListData,
    };
  });
}

export function advanceStateMachine(board: SessionBoard, widgetId: string, toIndex: number): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as StateMachineData;
    return {
      ...w,
      data: {
        ...data,
        currentStateIndex: toIndex,
        timerEndsAt: undefined,
      } satisfies StateMachineData,
    };
  });
}

export function setStateMachineTimer(board: SessionBoard, widgetId: string, durationMs: number): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as StateMachineData;
    return {
      ...w,
      data: { ...data, timerEndsAt: Date.now() + durationMs } satisfies StateMachineData,
    };
  });
}

export function clearStateMachineTimer(board: SessionBoard, widgetId: string): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as StateMachineData;
    return { ...w, data: { ...data, timerEndsAt: undefined } satisfies StateMachineData };
  });
}

export function cycleToggle(board: SessionBoard, widgetId: string): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as ToggleData;
    return {
      ...w,
      data: {
        ...data,
        currentIndex: (data.currentIndex + 1) % data.values.length,
      } satisfies ToggleData,
    };
  });
}

export function setToggleIndex(board: SessionBoard, widgetId: string, index: number): SessionBoard {
  return updateWidget(board, widgetId, w => {
    const data = w.data as ToggleData;
    return { ...w, data: { ...data, currentIndex: index } satisfies ToggleData };
  });
}

// ── Item Tracker ──────────────────────────────────────────────────────────────

export function editItemLocation(board: SessionBoard, widgetId: string, itemId: string, location: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id !== widgetId ? w : {
      ...w,
      data: {
        ...(w.data as ItemTrackerData),
        items: (w.data as ItemTrackerData).items.map(it =>
          it.id !== itemId ? it : { ...it, location }
        ),
      },
    }),
  };
}

export function cycleItemState(board: SessionBoard, widgetId: string, itemId: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id !== widgetId ? w : {
      ...w,
      data: {
        ...(w.data as ItemTrackerData),
        items: (w.data as ItemTrackerData).items.map(it => {
          if (it.id !== itemId || !it.states?.length) return it;
          return { ...it, currentStateIndex: ((it.currentStateIndex ?? 0) + 1) % it.states.length };
        }),
      },
    }),
  };
}

// ── Reference ─────────────────────────────────────────────────────────────────

export function toggleReferenceEntry(board: SessionBoard, widgetId: string, entryId: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id !== widgetId ? w : {
      ...w,
      data: {
        ...(w.data as ReferenceData),
        entries: (w.data as ReferenceData).entries.map(e =>
          e.id !== entryId ? e : { ...e, revealed: !e.revealed }
        ),
      },
    }),
  };
}

export function toggleAllReferenceEntries(board: SessionBoard, widgetId: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => {
      if (w.id !== widgetId) return w;
      const data = w.data as ReferenceData;
      const allRevealed = data.entries.every(e => e.revealed);
      return {
        ...w,
        data: { ...data, entries: data.entries.map(e => ({ ...e, revealed: !allRevealed })) },
      };
    }),
  };
}

// ── Faction Board ─────────────────────────────────────────────────────────────

const NPC_STATUS_CYCLE: NpcStatus[] = ['unknown', 'active', 'frozen', 'freed', 'fled', 'defeated', 'allied'];

export function cycleNpcStatus(board: SessionBoard, widgetId: string, factionId: string, npcId: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id !== widgetId ? w : {
      ...w,
      data: {
        ...(w.data as FactionBoardData),
        factions: (w.data as FactionBoardData).factions.map(f => f.id !== factionId ? f : {
          ...f,
          npcs: f.npcs.map(n => n.id !== npcId ? n : {
            ...n,
            status: NPC_STATUS_CYCLE[(NPC_STATUS_CYCLE.indexOf(n.status) + 1) % NPC_STATUS_CYCLE.length],
          }),
        }),
      },
    }),
  };
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export function toggleChecklistItem(board: SessionBoard, widgetId: string, itemId: string): SessionBoard {
  return {
    ...board,
    widgets: board.widgets.map(w => w.id !== widgetId ? w : {
      ...w,
      data: {
        ...(w.data as ChecklistData),
        items: (w.data as ChecklistData).items.map(it =>
          it.id !== itemId ? it : { ...it, checked: !it.checked }
        ),
      },
    }),
  };
}

export function toggleWidgetCollapsed(board: SessionBoard, widgetId: string): SessionBoard {
  return updateWidget(board, widgetId, w => ({ ...w, collapsed: !w.collapsed }));
}

export function addWidget(board: SessionBoard, widget: Omit<SessionWidget, 'id'>): SessionBoard {
  return { ...board, widgets: [...board.widgets, { ...widget, id: uuid() }] };
}

export function removeWidget(board: SessionBoard, widgetId: string): SessionBoard {
  return { ...board, widgets: board.widgets.filter(w => w.id !== widgetId) };
}
