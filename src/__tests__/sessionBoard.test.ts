import { describe, it, expect, beforeEach } from 'vitest';
import { parseSessionBoard } from '../lib/adventureParser';
import {
  createBoardFromProposal,
  saveBoardToStorage,
  loadBoardFromStorage,
  toggleEntityStatus,
  advanceStateMachine,
  cycleToggle,
  editItemLocation,
  cycleItemState,
  toggleReferenceEntry,
  toggleAllReferenceEntries,
  cycleNpcStatus,
  toggleChecklistItem,
} from '../lib/sessionBoardUtils';
import type { ItemTrackerData, ReferenceData, FactionBoardData, ChecklistData } from '../types';
import type { SessionBoard } from '../types';

// ── parseSessionBoard ─────────────────────────────────────────────────────────

const STASIS_TEXT = `
#### P22. Ballroom
The eight **pixies** work for Zybilna as bakers, and they are frozen in time.
**Mercion**, a human cleric, was frozen in the ballroom alongside Zybilna.
**Ringlerun**, a human wizard, was frozen in area P23.
**Strongheart** was frozen just as Warduke blasted him through the wall.
`;

const JABBERWOCK_TEXT = `
A **jabberwock** is coiled around the cauldron. It has fed recently, and is sound asleep.
`;

const CROWN_TEXT = `
Most of the locked doors in the palace can be unlocked by placing the crown on the head of the
iron lion or iron hart. These are crown locks throughout the palace.
`;

describe('parseSessionBoard', () => {
  it('detects stasis entries from "frozen in time" lines', () => {
    const proposal = parseSessionBoard(STASIS_TEXT);
    expect(proposal.entityList).toBeDefined();
    const names = proposal.entityList!.entries.map(e => e.displayName);
    expect(names).toContain('pixies');
    expect(names).toContain('Mercion');
    expect(names).toContain('Ringlerun');
    expect(names).toContain('Strongheart');
  });

  it('sets all stasis entries to frozen status', () => {
    const proposal = parseSessionBoard(STASIS_TEXT);
    for (const entry of proposal.entityList!.entries) {
      expect(entry.status).toBe('frozen');
    }
  });

  it('pre-fills Zybilna true name as Natasha when text contains "Natasha"', () => {
    const text = STASIS_TEXT + '\nFreeing Zybilna by speaking her true name, Natasha, ends the effect.\n**Zybilna** is frozen in time near the cauldron.';
    const proposal = parseSessionBoard(text);
    const zybilna = proposal.entityList?.entries.find(e => e.displayName === 'Zybilna');
    expect(zybilna?.trueName).toBe('Natasha');
  });

  it('detects jabberwock state machine when asleep jabberwock text present', () => {
    const proposal = parseSessionBoard(JABBERWOCK_TEXT);
    expect(proposal.stateMachine).toBeDefined();
    expect(proposal.stateMachine!.entityName).toBe('Jabberwock');
    const labels = proposal.stateMachine!.states.map(s => s.label);
    expect(labels).toEqual(['Asleep', 'Awake', 'Fled']);
  });

  it('detects crown toggle when crown lock text present', () => {
    const proposal = parseSessionBoard(CROWN_TEXT);
    expect(proposal.toggle).toBeDefined();
    expect(proposal.toggle!.values).toHaveLength(3);
    expect(proposal.toggle!.values[0].label).toBe('Unplaced');
  });

  it('returns empty proposal for unrelated text', () => {
    const proposal = parseSessionBoard('The wizard casts fireball at the dragon.');
    expect(proposal.entityList).toBeUndefined();
    expect(proposal.stateMachine).toBeUndefined();
    expect(proposal.toggle).toBeUndefined();
  });
});

// ── createBoardFromProposal ───────────────────────────────────────────────────

describe('createBoardFromProposal', () => {
  it('creates a board with three widgets from a full proposal', () => {
    const proposal = parseSessionBoard(STASIS_TEXT + JABBERWOCK_TEXT + CROWN_TEXT);
    const board = createBoardFromProposal('Test Board', proposal);
    expect(board.name).toBe('Test Board');
    expect(board.widgets.length).toBeGreaterThanOrEqual(1);
    expect(board.widgets.every(w => w.id)).toBe(true);
  });

  it('assigns unique IDs to all entity list entries', () => {
    const proposal = parseSessionBoard(STASIS_TEXT);
    const board = createBoardFromProposal('Board', proposal);
    const entityWidget = board.widgets.find(w => w.type === 'entity-list');
    expect(entityWidget).toBeDefined();
    const data = entityWidget!.data as import('../types').EntityListData;
    const ids = data.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── localStorage persistence ──────────────────────────────────────────────────

describe('saveBoardToStorage / loadBoardFromStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a board through localStorage', () => {
    const board: SessionBoard = {
      id: 'test-1',
      name: 'Ch. 5',
      widgets: [],
      position: { x: 100, y: 200 },
      minimized: false,
    };
    saveBoardToStorage(board);
    const loaded = loadBoardFromStorage('test-1');
    expect(loaded).toEqual(board);
  });

  it('returns null when board not found', () => {
    expect(loadBoardFromStorage('missing')).toBeNull();
  });
});

// ── toggleEntityStatus ────────────────────────────────────────────────────────

describe('toggleEntityStatus', () => {
  it('flips frozen to freed', () => {
    const board = createBoardFromProposal('B', {
      entityList: { title: 'Stasis', entries: [{ displayName: 'Mercion', status: 'frozen' }] },
    });
    const w = board.widgets[0];
    const next = toggleEntityStatus(board, w.id, (w.data as import('../types').EntityListData).entries[0].id);
    const data = next.widgets[0].data as import('../types').EntityListData;
    expect(data.entries[0].status).toBe('freed');
  });

  it('flips freed back to frozen', () => {
    const board = createBoardFromProposal('B', {
      entityList: { title: 'Stasis', entries: [{ displayName: 'Mercion', status: 'freed' }] },
    });
    const w = board.widgets[0];
    const next = toggleEntityStatus(board, w.id, (w.data as import('../types').EntityListData).entries[0].id);
    const data = next.widgets[0].data as import('../types').EntityListData;
    expect(data.entries[0].status).toBe('frozen');
  });
});

// ── advanceStateMachine ───────────────────────────────────────────────────────

describe('advanceStateMachine', () => {
  it('advances to next state', () => {
    const board = createBoardFromProposal('B', {
      stateMachine: {
        title: 'Jabberwock',
        entityName: 'Jabberwock',
        states: [{ label: 'Asleep', color: 'bg-blue-600' }, { label: 'Awake', color: 'bg-amber-500' }, { label: 'Fled', color: 'bg-green-600' }],
      },
    });
    const w = board.widgets[0];
    const next = advanceStateMachine(board, w.id, 1);
    const data = next.widgets[0].data as import('../types').StateMachineData;
    expect(data.currentStateIndex).toBe(1);
  });

  it('sets to explicit index from any starting state', () => {
    const board = createBoardFromProposal('B', {
      stateMachine: {
        title: 'Jabberwock',
        entityName: 'Jabberwock',
        states: [{ label: 'Asleep', color: 'bg-blue-600' }, { label: 'Fled', color: 'bg-green-600' }],
      },
    });
    const w = board.widgets[0];
    const next = advanceStateMachine(board, w.id, 0);
    const data = next.widgets[0].data as import('../types').StateMachineData;
    expect(data.currentStateIndex).toBe(0);
  });
});

// ── cycleToggle ───────────────────────────────────────────────────────────────

describe('cycleToggle', () => {
  it('cycles from 0 to 1', () => {
    const board = createBoardFromProposal('B', {
      toggle: { title: 'Crown', values: [{ label: 'Unplaced', color: 'bg-zinc-500' }, { label: 'Envy', color: 'bg-yellow-500' }, { label: 'Wrath', color: 'bg-slate-400' }] },
    });
    const w = board.widgets[0];
    const next = cycleToggle(board, w.id);
    const data = next.widgets[0].data as import('../types').ToggleData;
    expect(data.currentIndex).toBe(1);
  });

  it('wraps from last back to 0', () => {
    const board = createBoardFromProposal('B', {
      toggle: { title: 'Crown', values: [{ label: 'A', color: '' }, { label: 'B', color: '' }] },
    });
    const w = board.widgets[0];
    const after1 = cycleToggle(board, w.id);
    const after2 = cycleToggle(after1, w.id);
    const data = after2.widgets[0].data as import('../types').ToggleData;
    expect(data.currentIndex).toBe(0);
  });
});

// ── Helpers for new widget types ─────────────────────────────────────────────

function makeBoard(widgetData: unknown, type: string) {
  return {
    id: 'b1', name: 'Test', position: { x: 0, y: 0 }, minimized: false,
    widgets: [{ id: 'w1', type: type as any, title: 'Test', collapsed: false, data: widgetData }],
  };
}

// ── editItemLocation ──────────────────────────────────────────────────────────

describe('editItemLocation', () => {
  it('updates location for the matching item', () => {
    const board = makeBoard({
      items: [
        { id: 'i1', name: 'Horn', location: 'Unknown', states: [] },
        { id: 'i2', name: 'Crown', location: 'P8', states: [] },
      ],
    } satisfies ItemTrackerData, 'item-tracker');
    const next = editItemLocation(board as any, 'w1', 'i1', 'Party inventory');
    const data = next.widgets[0].data as ItemTrackerData;
    expect(data.items[0].location).toBe('Party inventory');
    expect(data.items[1].location).toBe('P8');
  });

  it('leaves board unchanged when widgetId does not match', () => {
    const board = makeBoard({ items: [{ id: 'i1', name: 'Horn', location: 'A', states: [] }] } satisfies ItemTrackerData, 'item-tracker');
    const next = editItemLocation(board as any, 'wrong', 'i1', 'B');
    expect((next.widgets[0].data as ItemTrackerData).items[0].location).toBe('A');
  });
});

// ── cycleItemState ────────────────────────────────────────────────────────────

describe('cycleItemState', () => {
  it('advances currentStateIndex', () => {
    const board = makeBoard({
      items: [{ id: 'i1', name: 'Crown', location: 'P8', states: ['Silver', 'Golden'], currentStateIndex: 0 }],
    } satisfies ItemTrackerData, 'item-tracker');
    const next = cycleItemState(board as any, 'w1', 'i1');
    expect((next.widgets[0].data as ItemTrackerData).items[0].currentStateIndex).toBe(1);
  });

  it('wraps from last state back to 0', () => {
    const board = makeBoard({
      items: [{ id: 'i1', name: 'Crown', location: 'P8', states: ['Silver', 'Golden'], currentStateIndex: 1 }],
    } satisfies ItemTrackerData, 'item-tracker');
    const next = cycleItemState(board as any, 'w1', 'i1');
    expect((next.widgets[0].data as ItemTrackerData).items[0].currentStateIndex).toBe(0);
  });

  it('does nothing when item has no states', () => {
    const board = makeBoard({
      items: [{ id: 'i1', name: 'Horn', location: 'Unknown', states: [] }],
    } satisfies ItemTrackerData, 'item-tracker');
    const next = cycleItemState(board as any, 'w1', 'i1');
    expect((next.widgets[0].data as ItemTrackerData).items[0]).toEqual((board.widgets[0].data as ItemTrackerData).items[0]);
  });
});

// ── toggleReferenceEntry ──────────────────────────────────────────────────────

describe('toggleReferenceEntry', () => {
  it('reveals a hidden entry', () => {
    const board = makeBoard({
      entries: [{ id: 'e1', label: 'Zybilna', value: 'Natasha', revealed: false }],
    } satisfies ReferenceData, 'reference');
    const next = toggleReferenceEntry(board as any, 'w1', 'e1');
    expect((next.widgets[0].data as ReferenceData).entries[0].revealed).toBe(true);
  });

  it('hides a revealed entry', () => {
    const board = makeBoard({
      entries: [{ id: 'e1', label: 'Zybilna', value: 'Natasha', revealed: true }],
    } satisfies ReferenceData, 'reference');
    const next = toggleReferenceEntry(board as any, 'w1', 'e1');
    expect((next.widgets[0].data as ReferenceData).entries[0].revealed).toBe(false);
  });
});

// ── toggleAllReferenceEntries ─────────────────────────────────────────────────

describe('toggleAllReferenceEntries', () => {
  it('reveals all when any is hidden', () => {
    const board = makeBoard({
      entries: [
        { id: 'e1', label: 'A', value: 'a', revealed: true },
        { id: 'e2', label: 'B', value: 'b', revealed: false },
      ],
    } satisfies ReferenceData, 'reference');
    const next = toggleAllReferenceEntries(board as any, 'w1');
    const entries = (next.widgets[0].data as ReferenceData).entries;
    expect(entries.every(e => e.revealed)).toBe(true);
  });

  it('hides all when all are revealed', () => {
    const board = makeBoard({
      entries: [
        { id: 'e1', label: 'A', value: 'a', revealed: true },
        { id: 'e2', label: 'B', value: 'b', revealed: true },
      ],
    } satisfies ReferenceData, 'reference');
    const next = toggleAllReferenceEntries(board as any, 'w1');
    const entries = (next.widgets[0].data as ReferenceData).entries;
    expect(entries.every(e => !e.revealed)).toBe(true);
  });
});

// ── cycleNpcStatus ────────────────────────────────────────────────────────────

describe('cycleNpcStatus', () => {
  it('advances status: frozen → freed', () => {
    const board = makeBoard({
      factions: [{ id: 'f1', name: 'Valor', color: 'bg-blue-600',
        npcs: [{ id: 'n1', name: 'Mercion', location: 'P22', status: 'frozen' }] }],
    } satisfies FactionBoardData, 'faction-board');
    const next = cycleNpcStatus(board as any, 'w1', 'f1', 'n1');
    expect((next.widgets[0].data as FactionBoardData).factions[0].npcs[0].status).toBe('freed');
  });

  it('wraps from allied back to unknown', () => {
    const board = makeBoard({
      factions: [{ id: 'f1', name: 'Valor', color: 'bg-blue-600',
        npcs: [{ id: 'n1', name: 'Mercion', location: 'P22', status: 'allied' }] }],
    } satisfies FactionBoardData, 'faction-board');
    const next = cycleNpcStatus(board as any, 'w1', 'f1', 'n1');
    expect((next.widgets[0].data as FactionBoardData).factions[0].npcs[0].status).toBe('unknown');
  });
});

// ── toggleChecklistItem ───────────────────────────────────────────────────────

describe('toggleChecklistItem', () => {
  it('checks an unchecked item', () => {
    const board = makeBoard({
      items: [{ id: 'c1', label: 'Find the crown', checked: false }],
    } satisfies ChecklistData, 'checklist');
    const next = toggleChecklistItem(board as any, 'w1', 'c1');
    expect((next.widgets[0].data as ChecklistData).items[0].checked).toBe(true);
  });

  it('unchecks a checked item', () => {
    const board = makeBoard({
      items: [{ id: 'c1', label: 'Find the crown', checked: true }],
    } satisfies ChecklistData, 'checklist');
    const next = toggleChecklistItem(board as any, 'w1', 'c1');
    expect((next.widgets[0].data as ChecklistData).items[0].checked).toBe(false);
  });

  it('does not affect other items', () => {
    const board = makeBoard({
      items: [
        { id: 'c1', label: 'Task A', checked: false },
        { id: 'c2', label: 'Task B', checked: true },
      ],
    } satisfies ChecklistData, 'checklist');
    const next = toggleChecklistItem(board as any, 'w1', 'c1');
    const data = next.widgets[0].data as ChecklistData;
    expect(data.items[0].checked).toBe(true);
    expect(data.items[1].checked).toBe(true);
  });
});
