import React from 'react';
import { LogEntry, LogEventType } from '../types';
import { cn } from '../lib/utils';

const EVENT_LABEL: Record<LogEventType, string> = {
  round_start: '—',
  turn_start: '▶',
  damage: '💢',
  heal: '💚',
  condition_applied: '⚑',
  condition_removed: '✓',
  creature_downed: '💀',
  creature_stabilized: '❤️',
  death_save_pass: '✓ Save',
  death_save_fail: '✗ Save',
  death_save_nat20: '★ Nat 20',
  death_save_nat1: '✗✗ Nat 1',
  encounter_end: '★',
  spell_cast: '✦',
  action_used: '⚡',
  concentration_start: '◎',
  concentration_end: '◌',
};

const EVENT_COLOR: Partial<Record<LogEventType, string>> = {
  damage: 'text-error',
  heal: 'text-emerald-400',
  condition_applied: 'text-amber-400',
  condition_removed: 'text-outline',
  creature_downed: 'text-error',
  death_save_fail: 'text-error',
  death_save_nat1: 'text-error',
  death_save_pass: 'text-emerald-400',
  death_save_nat20: 'text-primary',
  creature_stabilized: 'text-emerald-400',
  spell_cast: 'text-violet-400',
  action_used: 'text-sky-400',
  concentration_start: 'text-violet-300',
  concentration_end: 'text-outline',
};

function formatEntry(e: LogEntry): string {
  switch (e.type) {
    case 'round_start': return `Round ${e.detail ?? ''}`;
    case 'turn_start': return `${e.actorName}'s turn`;
    case 'damage': return e.actionName
      ? `${e.actorName} → ${e.actionName} → ${e.targetName ?? e.actorName} [${e.value} dmg]`
      : `${e.targetName ?? e.actorName} takes ${e.value} damage`;
    case 'heal': return e.actionName
      ? `${e.actorName} → ${e.actionName} → ${e.targetName ?? e.actorName} [+${e.value} hp]`
      : `${e.actorName} heals ${e.value} HP`;
    case 'condition_applied': return `${e.targetName ?? e.actorName}: ${e.detail} applied`;
    case 'condition_removed': return `${e.targetName ?? e.actorName}: ${e.detail} removed`;
    case 'spell_cast': {
      const lvl = e.detail ? (e.detail === '0' ? ' (cantrip)' : ` (lvl ${e.detail})`) : '';
      return `${e.actorName} casts ${e.actionName}${lvl}`;
    }
    case 'action_used': return `${e.actorName} uses ${e.actionName}`;
    case 'concentration_start': return `${e.actorName} concentrates on ${e.detail}`;
    case 'concentration_end': return `${e.actorName} loses concentration on ${e.detail}`;
    case 'creature_downed': return `${e.actorName} falls!`;
    case 'creature_stabilized': return `${e.actorName} stabilized`;
    case 'death_save_pass': return `${e.actorName}: death save passed`;
    case 'death_save_fail': return `${e.actorName}: death save failed`;
    case 'death_save_nat20': return `${e.actorName}: Nat 20 — back in the fight!`;
    case 'death_save_nat1': return `${e.actorName}: Nat 1 — two failures!`;
    default: return e.actorName;
  }
}

interface CombatLogProps {
  entries: LogEntry[];
}

export const CombatLog: React.FC<CombatLogProps> = ({ entries }) => {
  if (entries.length === 0) {
    return <p className="text-xs text-outline italic text-center py-4">No events yet.</p>;
  }
  return (
    <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
      {entries.slice(0, 50).map(e => (
        <div key={e.id} className={cn(
          "flex items-start gap-2 py-1 text-[11px]",
          e.type === 'round_start' && "border-t border-outline-variant/10 pt-2 mt-1"
        )}>
          <span className="shrink-0 font-mono text-[9px] text-outline/50 w-14 text-right">{e.type === 'round_start' ? '' : `R${e.round}`}</span>
          <span className={cn("shrink-0", EVENT_COLOR[e.type] ?? 'text-outline')}>{EVENT_LABEL[e.type]}</span>
          <span className="text-on-surface/70">{formatEntry(e)}</span>
        </div>
      ))}
    </div>
  );
};
