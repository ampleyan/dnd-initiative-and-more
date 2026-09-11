import { LogEntry } from '../types';

const PUBLIC_EVENT_TYPES = new Set<LogEntry['type']>([
  'turn_start',
  'creature_revealed',
  'condition_applied',
  'condition_removed',
  'creature_downed',
]);

function isLogEntry(entry: unknown): entry is LogEntry {
  return typeof entry === 'object'
    && entry !== null
    && typeof (entry as LogEntry).id === 'string'
    && typeof (entry as LogEntry).round === 'number'
    && typeof (entry as LogEntry).type === 'string'
    && typeof (entry as LogEntry).actorName === 'string';
}

export function toPlayerLog(entries: unknown[], visibleCombatantIds?: Set<string>): LogEntry[] {
  return entries.flatMap(entry => {
    if (!isLogEntry(entry) || !PUBLIC_EVENT_TYPES.has(entry.type)) return [];
    if (visibleCombatantIds && (!entry.actorId || !visibleCombatantIds.has(entry.actorId))) return [];

    return [{
      id: entry.id,
      round: entry.round,
      type: entry.type,
      actorName: entry.actorName,
      actorId: entry.actorId,
      detail: entry.type === 'condition_applied' || entry.type === 'condition_removed' ? entry.detail : undefined,
    }];
  });
}
