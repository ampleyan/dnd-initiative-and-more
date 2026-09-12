import React from 'react';
import { ChevronLeft, ChevronRight, Heart, Shield } from 'lucide-react';
import type { Combatant, MonsterAction } from '../types';
import { CONDITIONS } from '../constants';
import { AvatarImg } from './AvatarImg';
import { deriveTurnReminders } from '../lib/combatantUtils';

interface TurnCommandCenterProps {
  currentRound: number;
  activeCombatant: Combatant;
  nextCombatant?: Combatant;
  onPreviousTurn: () => void;
  onNextTurn: () => void;
  onUseAction?: (actor: Combatant, action: MonsterAction) => void;
  sortedCombatants?: Combatant[];
  currentTurnIndex?: number;
  lairActionsEnabled?: boolean;
}

export function TurnCommandCenter({
  currentRound,
  activeCombatant,
  nextCombatant,
  onPreviousTurn,
  onNextTurn,
  onUseAction,
  sortedCombatants,
  currentTurnIndex,
  lairActionsEnabled,
}: TurnCommandCenterProps) {
  const conditionNames = activeCombatant.conditions.map(conditionId =>
    CONDITIONS.find(condition => condition.id === conditionId)?.name ?? conditionId,
  );
  const actions = [...(activeCombatant.actions ?? []), ...(activeCombatant.abilities ?? []), ...(activeCombatant.spells ?? [])];
  const [showMore, setShowMore] = React.useState(false);
  const reminders = deriveTurnReminders(activeCombatant, sortedCombatants, currentTurnIndex, lairActionsEnabled);

  return (
    <section aria-label="Turn command center" className="mb-3 rounded-2xl border border-primary/30 bg-surface-container-low p-3 shadow-lg shadow-primary/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Round {currentRound}</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AvatarImg src={activeCombatant.avatar} name={activeCombatant.name} className="h-10 w-10 shrink-0 rounded-xl border border-primary/30 text-sm" />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-primary">Active turn</p>
            <p className="truncate text-sm font-bold text-on-surface">{activeCombatant.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-outline">
              <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-error" />{activeCombatant.hp.current} / {activeCombatant.hp.max} HP</span>
              <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />{activeCombatant.ac} AC</span>
              {(activeCombatant.tempHp ?? 0) > 0 && <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-sky-300">+{activeCombatant.tempHp} temp HP</span>}
              {conditionNames.map(conditionName => <span key={conditionName} className="rounded bg-violet-400/10 px-1.5 py-0.5 text-violet-300">{conditionName}</span>)}
            </div>
          </div>
        </div>

        {nextCombatant && nextCombatant.id !== activeCombatant.id && (
          <div className="hidden min-w-0 border-l border-outline/15 pl-3 sm:block">
            <p className="text-[9px] font-black uppercase tracking-widest text-outline">On deck</p>
            <p className="truncate text-xs font-bold text-on-surface/80">{nextCombatant.name}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={onPreviousTurn} aria-label="Previous turn" className="flex items-center gap-1 rounded-xl border border-outline/25 px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button type="button" onClick={onNextTurn} aria-label="Next turn" className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:brightness-110">
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {(actions.length > 0 || reminders.length > 0) && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-outline/15 pt-2">
        {reminders.map(reminder => <span key={reminder} className="rounded bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">{reminder}</span>)}
        {actions.slice(0, showMore ? actions.length : 4).map((action, index) => <button key={`${action.name}-${index}`} type="button" onClick={() => onUseAction?.(activeCombatant, action)} className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20">{action.name}</button>)}
        {actions.length > 4 && !showMore && <button type="button" onClick={() => setShowMore(true)} className="rounded-lg px-2 py-1 text-[10px] font-bold text-outline hover:text-on-surface">More actions</button>}
      </div>}
      <p className="mt-2 text-right text-[10px] text-outline">Space next · Shift+Space previous</p>
    </section>
  );
}
