import React from 'react';
import { Search, Swords, ChevronLeft, ChevronRight, Zap, ScrollText, Sparkles, BarChart2 } from 'lucide-react';
import { Combatant } from '../types';
import { AvatarImg } from './AvatarImg';
import { APP_NAME } from '../lib/appConfig';

interface TopBarProps {
  isPlayerView: boolean;
  isEncounterActive?: boolean;
  encounterName?: string;
  currentRound?: number;
  activeCombatant?: Combatant | null;
  onPrevTurn?: () => void;
  onNextTurn?: () => void;
  onToggleLog?: () => void;
  onShowWhatsNew?: () => void;
  onShowSessionStats?: () => void;
  onNavigateToEncounter?: () => void;
  isOnEncounterTab?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isPlayerView,
  isEncounterActive,
  encounterName,
  currentRound,
  activeCombatant,
  onPrevTurn,
  onNextTurn,
  onToggleLog,
  onShowWhatsNew,
  onShowSessionStats,
  onNavigateToEncounter,
  isOnEncounterTab,
}) => {
  return (
    <header className="sticky top-0 w-full bg-[#0A0C12]/90 backdrop-blur-xl z-40 flex items-center px-3 sm:px-8 h-14 sm:h-16 border-b border-white/5 gap-2 sm:gap-6">
      {/* Left controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleLog}
          className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
          title="Toggle combat log"
        >
          <ScrollText className="w-4 h-4" />
        </button>
        <button
          onClick={onShowSessionStats}
          className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
          title="Session Stats"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-white/10 shrink-0" />

      {/* Brand */}
      {!isPlayerView && (
        <>
          <span className="text-white font-headline font-bold text-base tracking-widest uppercase shrink-0">
            {APP_NAME}
          </span>
          <div className="w-px h-5 bg-white/10 shrink-0" />
        </>
      )}

      {/* Active encounter banner */}
      {isEncounterActive && encounterName && (
        <div className="flex-1 flex items-center gap-4 min-w-0">
          {/* Round */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg shrink-0">
            <Swords className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Round</span>
            <span className="text-sm font-headline font-bold text-white">{String(currentRound ?? 1).padStart(2, '0')}</span>
          </div>

          {/* Encounter name — clickable if not already on encounters tab */}
          <button
            onClick={!isOnEncounterTab ? onNavigateToEncounter : undefined}
            className={!isOnEncounterTab && onNavigateToEncounter
              ? "text-white font-headline font-bold text-sm truncate min-w-0 hover:text-primary transition-colors cursor-pointer"
              : "text-white font-headline font-bold text-sm truncate min-w-0 cursor-default"}
          >
            {encounterName}
          </button>

          {/* Active combatant */}
          {!isPlayerView && activeCombatant && (
            <button
              onClick={!isOnEncounterTab ? onNavigateToEncounter : undefined}
              className="flex items-center gap-2 px-3 py-1 bg-surface-container-highest rounded-lg border border-white/5 shrink-0 hover:border-primary/30 transition-colors"
            >
              <Zap className="w-3 h-3 text-primary animate-pulse shrink-0" />
              <AvatarImg
                src={activeCombatant.avatar}
                name={activeCombatant.name}
                className="w-6 h-6 rounded text-xs shrink-0"
              />
              <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">{activeCombatant.name}</span>
              <span className="text-[9px] text-outline uppercase tracking-wider shrink-0">Active</span>
            </button>
          )}

          {/* DM-only Prev / Next controls */}
          {!isPlayerView && (
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button
                onClick={onPrevTurn}
                className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors"
                title="Previous turn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNextTurn}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-on-primary transition-colors"
                title="Next turn"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onShowWhatsNew}
                className="p-2 rounded-lg text-outline/50 hover:text-outline hover:bg-surface-container-high transition-colors"
                title="What's New"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
