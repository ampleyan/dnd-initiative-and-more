import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { uuid } from '../lib/utils';
import type { SessionWidget, ItemTrackerData, ReferenceData, FactionBoardData, ChecklistData } from '../types';

const WBTW_ITEMS: ItemTrackerData = {
  items: [
    { id: uuid(), name: 'Unicorn Horn', location: 'Unknown', states: [] },
    { id: uuid(), name: 'Crown', location: "Maiden's Pond (P8)", states: ['Silver needles', 'Golden roses'] },
    { id: uuid(), name: 'Cauldron Poem', location: 'Unknown', states: [] },
    { id: uuid(), name: 'Staff of Power', location: 'With Ringlerun (P23)', states: ['Frozen', 'Retrieved', 'Safe'] },
  ],
};

const WBTW_REFERENCE: ReferenceData = {
  entries: [
    { id: uuid(), label: 'Zybilna (archfey)', value: 'Natasha', hint: 'NOT Iggwilv, NOT Tasha', revealed: false },
    { id: uuid(), label: 'Ringlerun', value: 'Ringlerun', hint: 'Same as known name', revealed: false },
    { id: uuid(), label: 'Mercion', value: 'Mercion', hint: '', revealed: false },
    { id: uuid(), label: 'Strongheart', value: 'Strongheart', hint: '', revealed: false },
    { id: uuid(), label: 'Bloodybeak', value: 'Bloodybeak', hint: 'Thinnings knows this', revealed: false },
  ],
};

const WBTW_FACTIONS: FactionBoardData = {
  factions: [
    {
      id: uuid(), name: 'League of Malevolence', color: 'bg-red-700',
      npcs: [
        { id: uuid(), name: 'Kelek', location: 'P31', status: 'active' },
        { id: uuid(), name: 'Warduke', location: 'P31', status: 'active' },
        { id: uuid(), name: 'Zargash', location: 'P30', status: 'active' },
        { id: uuid(), name: 'Zarak', location: 'Thither', status: 'active' },
        { id: uuid(), name: 'Skylla', location: 'Motherhorn', status: 'active' },
      ],
    },
    {
      id: uuid(), name: "Valor's Call", color: 'bg-blue-600',
      npcs: [
        { id: uuid(), name: 'Mercion', location: 'P22', status: 'frozen' },
        { id: uuid(), name: 'Ringlerun', location: 'P23', status: 'frozen' },
        { id: uuid(), name: 'Strongheart', location: 'P13 (air)', status: 'frozen' },
        { id: uuid(), name: 'Elkhorn', location: 'Thither', status: 'active' },
        { id: uuid(), name: 'Molliver', location: 'Yon', status: 'active' },
      ],
    },
    {
      id: uuid(), name: 'Hourglass Coven', color: 'bg-purple-700',
      npcs: [
        { id: uuid(), name: 'Bavlorna', location: 'Ch.2 (if fled)', status: 'fled' },
        { id: uuid(), name: 'Skabatha', location: 'Ch.3 (if fled)', status: 'fled' },
        { id: uuid(), name: 'Endelyn', location: 'Ch.4 (if fled)', status: 'fled' },
      ],
    },
  ],
};

const WBTW_CHECKLIST: ChecklistData = {
  items: [
    { id: uuid(), label: 'Horn + true name = frees from stasis', checked: false, source: 'From Thinnings (P15)' },
    { id: uuid(), label: "Zybilna's true name is Natasha", checked: false, source: 'Hidden in poster map border' },
    { id: uuid(), label: 'Cauldron can be destroyed with flame tongue / frost brand', checked: false },
    { id: uuid(), label: 'Cauldron can be destroyed with horn + poem', checked: false },
    { id: uuid(), label: '"Witch Queen\'s Cauldron" poem obtained', checked: false },
    { id: uuid(), label: 'Crown must go on Wrath first (not Envy) to transform', checked: false },
    { id: uuid(), label: 'Ritual book grants door access without crown (P49)', checked: false },
    { id: uuid(), label: "Thinnings's rhyme learned (from Demitasse, P19)", checked: false },
  ],
};

interface AddWidgetPanelProps {
  onAdd: (widget: Omit<SessionWidget, 'id'>) => void;
}

type WidgetChoice = 'entity-list' | 'state-machine' | 'toggle' | 'item-tracker' | 'reference' | 'faction-board' | 'checklist';

const WIDGET_LABELS: Record<WidgetChoice, string> = {
  'entity-list': 'Entity List',
  'state-machine': 'State Machine',
  'toggle': 'Toggle',
  'item-tracker': 'Item Tracker',
  'reference': 'True Names',
  'faction-board': 'Faction Board',
  'checklist': 'Checklist',
};

export const AddWidgetPanel: React.FC<AddWidgetPanelProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);

  const addDefault = (type: WidgetChoice, data?: any) => {
    const defaults: Record<WidgetChoice, any> = {
      'entity-list': { entries: [] },
      'state-machine': { entityName: 'Creature', states: [{ label: 'Asleep', color: 'bg-blue-600' }, { label: 'Awake', color: 'bg-amber-500' }], currentStateIndex: 0 },
      'toggle': { values: [{ label: 'A', color: 'bg-zinc-500' }, { label: 'B', color: 'bg-primary' }], currentIndex: 0 },
      'item-tracker': { items: [] },
      'reference': { entries: [] },
      'faction-board': { factions: [] },
      'checklist': { items: [] },
    };
    onAdd({ type, title: WIDGET_LABELS[type], collapsed: false, data: data ?? defaults[type] });
    setOpen(false);
  };

  return (
    <div className="relative flex-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center justify-center gap-1 py-1.5 text-xs text-outline',
          'hover:text-on-surface border border-dashed border-outline-variant/30',
          'hover:border-outline rounded-xl transition-colors'
        )}
      >
        <Plus className="w-3 h-3" /> Widget
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#0D1117] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">Add Widget</span>
            <button onClick={() => setOpen(false)} className="text-outline hover:text-on-surface">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="p-1 space-y-0.5">
            {(['entity-list', 'state-machine', 'toggle'] as WidgetChoice[]).map(type => (
              <button key={type} onClick={() => addDefault(type)}
                className="w-full text-left px-3 py-1.5 text-xs text-outline hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors">
                {WIDGET_LABELS[type]}
              </button>
            ))}
            <div className="h-px bg-white/8 my-1" />
            <p className="px-3 py-0.5 text-[10px] text-outline/60 uppercase tracking-wider">WBtW Palace</p>
            <div className="flex items-center gap-1 px-1">
              <button onClick={() => addDefault('item-tracker')}
                className="flex-1 text-left px-2 py-1.5 text-xs text-outline hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors">
                Items
              </button>
              <button onClick={() => addDefault('item-tracker', WBTW_ITEMS)}
                className="text-[9px] text-primary hover:text-on-surface px-1.5 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap">
                +WBtW
              </button>
            </div>
            <div className="flex items-center gap-1 px-1">
              <button onClick={() => addDefault('reference')}
                className="flex-1 text-left px-2 py-1.5 text-xs text-outline hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors">
                True Names
              </button>
              <button onClick={() => addDefault('reference', WBTW_REFERENCE)}
                className="text-[9px] text-primary hover:text-on-surface px-1.5 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap">
                +WBtW
              </button>
            </div>
            <div className="flex items-center gap-1 px-1">
              <button onClick={() => addDefault('faction-board')}
                className="flex-1 text-left px-2 py-1.5 text-xs text-outline hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors">
                Factions
              </button>
              <button onClick={() => addDefault('faction-board', WBTW_FACTIONS)}
                className="text-[9px] text-primary hover:text-on-surface px-1.5 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap">
                +WBtW
              </button>
            </div>
            <div className="flex items-center gap-1 px-1">
              <button onClick={() => addDefault('checklist')}
                className="flex-1 text-left px-2 py-1.5 text-xs text-outline hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors">
                Checklist
              </button>
              <button onClick={() => addDefault('checklist', WBTW_CHECKLIST)}
                className="text-[9px] text-primary hover:text-on-surface px-1.5 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap">
                +WBtW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
