import React from 'react';
import { Plus, UserPlus } from 'lucide-react';
import type { Combatant, Player } from '../types';

interface ParticipantControlsProps {
  players: Player[];
  combatants: Combatant[];
  onAddPlayer: (player: Player) => void | Promise<void>;
  onAddMonsters: () => void;
}

export function ParticipantControls({ players, combatants, onAddPlayer, onAddMonsters }: ParticipantControlsProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState('');
  const picker = React.useRef<HTMLDetailsElement>(null);
  const available = players.filter(player => !combatants.some(c => c.type === 'player' &&
    (c.playerId === player.id || (!c.playerId && c.name.toLowerCase() === player.name.toLowerCase()))));
  const chosen = available.filter(player => selected.has(player.id));

  const add = async (toAdd: Player[]) => {
    if (adding) return;
    setAdding(true);
    setError('');
    try {
      for (const player of toAdd) await onAddPlayer(player);
      setSelected(new Set());
      if (picker.current) picker.current.open = false;
    } catch {
      setError('Could not add players. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return <div className="flex flex-wrap items-start gap-2 mr-auto">
    <button type="button" onClick={onAddMonsters} className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20">
      <Plus className="h-4 w-4" /> Monsters
    </button>
    <details ref={picker} className="relative" onKeyDown={event => {
      if (event.key === 'Escape' && picker.current) {
        picker.current.open = false;
        picker.current.querySelector('summary')?.focus();
      }
    }}>
      <summary role="button" className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20">
        <UserPlus className="h-4 w-4" /> Players
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-outline/30 bg-surface-container-highest p-3 shadow-xl">
        <p className="mb-2 text-xs font-bold text-on-surface">Add players to encounter</p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {players.length === 0 && <p className="text-xs text-outline">Create players in the library first.</p>}
          {players.map(player => {
            const present = !available.some(p => p.id === player.id);
            return <label key={player.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-surface-container">
              <input type="checkbox" disabled={present || adding} checked={present || selected.has(player.id)} onChange={event => {
                const checked = event.target.checked;
                setSelected(previous => {
                  const next = new Set(previous);
                  if (checked) next.add(player.id);
                  else next.delete(player.id);
                  return next;
                });
              }} />
              <span className="min-w-0 break-words">{player.name}{present && <span className="block text-xs text-outline">Already added</span>}</span>
            </label>;
          })}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={adding || chosen.length === 0} onClick={() => add(chosen)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-40">Add selected ({chosen.length})</button>
          <button type="button" disabled={adding || available.length === 0} onClick={() => add(available)} className="rounded-lg border border-outline/30 px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-40">Add all ({available.length})</button>
        </div>
      </div>
    </details>
  </div>;
}
