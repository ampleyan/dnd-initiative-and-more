import React, { useState, useEffect } from 'react';
import { Swords, PlayCircle, Dices, UserPlus } from 'lucide-react';
import { Modal } from './Modal';
import { Combatant, Player } from '../types';
import { AvatarImg } from './AvatarImg';

interface CombatantRowProps {
  c: Combatant;
  initiatives: Record<string, string>;
  setInitiatives: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onRoll: (ids: string[]) => void;
}

const CombatantRow: React.FC<CombatantRowProps> = ({ c, initiatives, setInitiatives, onRoll }) => {
  const dexMod = Math.floor(((c.stats?.dex || 10) - 10) / 2);
  return (
    <div className="flex items-center gap-2 p-2 bg-surface-container rounded-xl border border-white/5">
      <AvatarImg src={c.avatar} name={c.name} className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-on-surface leading-none truncate">{c.name}</p>
        <p className="text-[9px] text-outline/60 mt-0.5">
          DEX {dexMod >= 0 ? `+${dexMod}` : dexMod}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onRoll([c.id])}
          className="p-1 hover:bg-surface-container-highest rounded text-outline/50 hover:text-primary transition-colors"
          title="Roll"
        >
          <Dices className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          className="w-12 bg-surface-container-highest border border-white/10 rounded-lg px-1 py-1 text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary"
          value={initiatives[c.id] || ''}
          placeholder="—"
          onChange={e => setInitiatives(prev => ({ ...prev, [c.id]: e.target.value }))}
        />
      </div>
    </div>
  );
};

interface InitiativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatants: Combatant[];
  onFinish: (updated: Combatant[]) => void;
  players?: Player[];
  onAddPlayer?: (player: Player) => void;
}

export const InitiativeModal: React.FC<InitiativeModalProps> = ({
  isOpen,
  onClose,
  combatants,
  onFinish,
  players,
  onAddPlayer,
}) => {
  const [initiatives, setInitiatives] = useState<Record<string, string>>({});

  // Full reset when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, string> = {};
    combatants.forEach(c => {
      initial[c.id] = c.initiative > 0 ? c.initiative.toString() : '';
    });
    setInitiatives(initial);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add new combatants without clearing already-typed values
  useEffect(() => {
    setInitiatives(prev => {
      const next = { ...prev };
      let changed = false;
      combatants.forEach(c => {
        if (!(c.id in next)) {
          next[c.id] = c.initiative > 0 ? c.initiative.toString() : '';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [combatants]);

  const rollFor = (ids: string[]) => {
    const rolled: Record<string, string> = { ...initiatives };
    combatants.filter(c => ids.includes(c.id)).forEach(c => {
      rolled[c.id] = (Math.floor(Math.random() * 20) + 1 + Math.floor(((c.stats?.dex || 10) - 10) / 2)).toString();
    });
    setInitiatives(rolled);
  };

  const handleFinish = () => {
    const updated = combatants.map(c => ({
      ...c,
      initiative: parseInt(initiatives[c.id]) || 0
    }));
    onFinish(updated);
  };

  const activePlayers = combatants.filter(c => c.type === 'player');
  const enemies = combatants.filter(c => c.type !== 'player');
  const rosterNotInEncounter = (players ?? []).filter(
    p => !combatants.some(c => c.playerId === p.id || c.name === p.name)
  );
  const playerIds = activePlayers.map(c => c.id);
  const enemyIds = enemies.map(c => c.id);
  const allIds = combatants.map(c => c.id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Roll Initiative">
      <div className="space-y-4">

        {/* Quick-roll header */}
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-2xl border border-primary/10">
          <Swords className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-on-surface flex-1">Ready for Battle?</span>
          <button
            onClick={() => rollFor(allIds)}
            className="px-4 py-1.5 bg-primary text-on-primary rounded-lg font-bold text-xs hover:scale-105 transition-transform"
          >
            Roll All
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">

          {/* Players */}
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Players</span>
              {activePlayers.length > 0 && (
                <button onClick={() => rollFor(playerIds)} className="text-[9px] font-bold text-outline/50 hover:text-primary transition-colors flex items-center gap-1">
                  <Dices className="w-3 h-3" /> Roll
                </button>
              )}
            </div>
            {activePlayers.length > 0 ? activePlayers.map(c => <CombatantRow key={c.id} c={c} initiatives={initiatives} setInitiatives={setInitiatives} onRoll={rollFor} />) : (
              <p className="text-[10px] text-outline/40 italic py-4 text-center">No players</p>
            )}
          </div>

          {/* Enemies */}
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-error/70">Enemies</span>
              {enemies.length > 0 && (
                <button onClick={() => rollFor(enemyIds)} className="text-[9px] font-bold text-outline/50 hover:text-error transition-colors flex items-center gap-1">
                  <Dices className="w-3 h-3" /> Roll
                </button>
              )}
            </div>
            {enemies.length > 0 ? enemies.map(c => <CombatantRow key={c.id} c={c} initiatives={initiatives} setInitiatives={setInitiatives} onRoll={rollFor} />) : (
              <p className="text-[10px] text-outline/40 italic py-4 text-center">No enemies</p>
            )}
          </div>
        </div>

        {/* Roster — players not yet in the encounter */}
        {rosterNotInEncounter.length > 0 && (
          <div className="border-t border-white/5 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-outline/60 mb-2">Add from Roster</p>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
              {rosterNotInEncounter.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 bg-surface-container rounded-xl border border-white/5">
                  <AvatarImg src={p.avatar} name={p.name} className="w-7 h-7 rounded-lg shrink-0" />
                  <p className="flex-1 text-sm font-bold text-on-surface truncate">{p.name}</p>
                  <button
                    onClick={() => onAddPlayer?.(p)}
                    className="p-1.5 hover:bg-primary/20 rounded-lg text-primary transition-colors"
                    title={`Add ${p.name}`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleFinish}
          className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <PlayCircle className="w-5 h-5" /> Begin Encounter
        </button>
      </div>
    </Modal>
  );
};
