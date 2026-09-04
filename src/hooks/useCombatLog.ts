import { useState, useCallback, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { uuid } from '../lib/utils';

export interface UseCombatLogReturn {
  combatLog: LogEntry[];
  setCombatLog: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  addLogEntry: (entry: Omit<LogEntry, 'id' | 'round'>) => void;
  combatLogRef: React.MutableRefObject<LogEntry[]>;
  addLogEntryRef: React.MutableRefObject<((entry: Omit<LogEntry, 'id' | 'round'>) => void) | null>;
}

/**
 * Self-contained combat log state. Keeps entries capped at 200.
 * Exposes stable refs so functions captured in closures (e.g. animation
 * callbacks) can always access the latest addLogEntry without stale refs.
 */
export function useCombatLog(currentRound: number): UseCombatLogReturn {
  const [combatLog, setCombatLog] = useState<LogEntry[]>([]);

  const combatLogRef = useRef<LogEntry[]>([]);
  const addLogEntryRef = useRef<((entry: Omit<LogEntry, 'id' | 'round'>) => void) | null>(null);

  const addLogEntry = useCallback((entry: Omit<LogEntry, 'id' | 'round'>) => {
    setCombatLog(prev => [
      { ...entry, id: `log-${uuid()}`, round: currentRound },
      ...prev.slice(0, 199),
    ]);
  }, [currentRound]);

  useEffect(() => { combatLogRef.current = combatLog; }, [combatLog]);
  useEffect(() => { addLogEntryRef.current = addLogEntry; }, [addLogEntry]);

  return { combatLog, setCombatLog, addLogEntry, combatLogRef, addLogEntryRef };
}
