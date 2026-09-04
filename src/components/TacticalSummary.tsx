import React, { useState } from 'react';
import { Skull, ChevronDown, ChevronRight, Shield, Swords } from 'lucide-react';
import { Combatant } from '../types';
import { AvatarImg } from './AvatarImg';
import { cn } from '../lib/utils';

interface TacticalSummaryProps {
  combatants: Combatant[];
  currentTurnIndex: number;
  isEncounterActive: boolean;
  currentRound?: number;
}

export const TacticalSummary: React.FC<TacticalSummaryProps> = ({
  combatants,
  currentTurnIndex,
  isEncounterActive,
  currentRound,
}) => {
  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const active = isEncounterActive ? sorted[currentTurnIndex] : null;
  const next = isEncounterActive ? sorted[(currentTurnIndex + 1) % sorted.length] : null;
  const remainingFoes = combatants.filter(c => c.type === 'monster' && c.hp.current > 0).length;

  if (!isEncounterActive) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-[#12141C] border border-white/5 rounded-2xl mb-2">
        <div className="flex items-center gap-1.5 text-outline/50">
          <Skull className="w-3.5 h-3.5 text-red-500/60" />
          <span className="text-xs font-bold">{remainingFoes} foe{remainingFoes !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-[10px] text-outline/30 font-bold uppercase tracking-wider">Not started</span>
      </div>
    );
  }

  const hpPct = active && active.hp.max > 0 ? Math.max(0, Math.min(100, (active.hp.current / active.hp.max) * 100)) : 0;
  const hpBarColor = hpPct > 66 ? 'bg-emerald-500' : hpPct > 33 ? 'bg-amber-500' : 'bg-error';

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 bg-[#12141C] border border-white/5 rounded-2xl mb-2">
      {/* Active combatant */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {active && (
          <>
            <AvatarImg
              src={active.avatar}
              name={active.name}
              className="w-9 h-9 rounded-xl border border-primary/30 shrink-0 text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-headline font-bold text-on-surface truncate">{active.name}</p>
                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 leading-none">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${hpBarColor}`} style={{ width: `${hpPct}%` }} />
                </div>
                <span className="text-[9px] font-bold tabular-nums text-outline/60 shrink-0">{active.hp.current}/{active.hp.max}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Round number */}
      <div className="flex flex-col items-center justify-center px-4 shrink-0 border-l border-r border-white/5">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-outline/40 leading-none mb-0.5">Round</span>
        <span className="text-2xl font-headline font-black text-amber-400 leading-none">{currentRound ?? 1}</span>
      </div>

      {/* Next combatant */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {next && next.id !== active?.id ? (
          <>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-black uppercase tracking-wider text-outline/40 mb-0.5 leading-none">Next</p>
              <p className="text-xs font-headline font-bold text-on-surface/60 truncate">{next.name}</p>
            </div>
            <AvatarImg
              src={next.avatar}
              name={next.name}
              className="w-8 h-8 rounded-xl border border-white/10 shrink-0 text-xs opacity-50"
            />
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-outline/30">
            <Skull className="w-3.5 h-3.5 text-red-500/40" />
            <span className="text-xs font-bold">{remainingFoes} left</span>
          </div>
        )}
      </div>
    </div>
  );
};
