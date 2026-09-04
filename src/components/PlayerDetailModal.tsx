import React, { useState } from 'react';
import { X, User, Sword, Sparkles, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, MonsterAction } from '../types';

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function ActionList({ items, emptyLabel }: { items: MonsterAction[]; emptyLabel: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (items.length === 0) {
    return <p className="text-[11px] text-outline/50 italic">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const key = `${item.name}-${i}`;
        const isOpen = expanded === key;
        return (
          <div key={key} className="rounded-lg bg-surface-container-high border border-white/5 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-xs font-bold text-on-surface">{item.name}</span>
              {item.description ? (isOpen ? <ChevronUp className="w-3 h-3 text-outline shrink-0" /> : <ChevronDown className="w-3 h-3 text-outline shrink-0" />) : null}
            </button>
            {isOpen && item.description && (
              <div className="px-3 pb-3">
                <p className="text-[11px] text-outline/80 leading-relaxed">{item.description}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({ player, onClose }) => {
  const [tab, setTab] = useState<'actions' | 'abilities' | 'spells'>('actions');

  const stats = player?.stats ?? {};
  const statKeys: Array<[string, string]> = [
    ['str', 'STR'], ['dex', 'DEX'], ['con', 'CON'],
    ['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA'],
  ];

  const tabItems = {
    actions: player?.actions ?? [],
    abilities: player?.abilities ?? [],
    spells: player?.spells ?? [],
  };

  const tabLabels: Array<{ key: 'actions' | 'abilities' | 'spells'; label: string; icon: React.ReactNode; color: string }> = [
    { key: 'actions', label: 'Actions', icon: <Sword className="w-3 h-3" />, color: 'text-rose-400' },
    { key: 'abilities', label: 'Abilities', icon: <Shield className="w-3 h-3" />, color: 'text-amber-400' },
    { key: 'spells', label: 'Spells', icon: <Sparkles className="w-3 h-3" />, color: 'text-violet-400' },
  ];

  return (
    <AnimatePresence>
      {player && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface-container rounded-3xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-high flex items-center gap-4 shrink-0">
              {player.avatar ? (
                <img src={player.avatar} alt={player.name} className="w-14 h-14 rounded-2xl object-cover border border-white/10 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-headline font-bold text-on-surface truncate">{player.name}</h3>
                <p className="text-xs text-outline truncate">{player.subtitle || 'No class info'}</p>
                {player.level && (
                  <p className="text-[10px] text-primary/80 font-bold mt-0.5">Level {player.level}</p>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-outline hover:text-on-surface shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stat pills */}
            <div className="px-6 py-3 flex gap-3 flex-wrap border-b border-outline-variant/10 shrink-0">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-outline/60 text-[10px] uppercase font-bold">HP</span>
                <span className="text-on-surface font-bold">{player.hp_max}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-outline/60 text-[10px] uppercase font-bold">AC</span>
                <span className="text-on-surface font-bold">{player.ac}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-outline/60 text-[10px] uppercase font-bold">Speed</span>
                <span className="text-on-surface font-bold">{player.speed || '30 ft.'}</span>
              </div>
              {player.passivePerception && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-outline/60 text-[10px] uppercase font-bold">PP</span>
                  <span className="text-on-surface font-bold">{player.passivePerception}</span>
                </div>
              )}
            </div>

            {/* Ability scores */}
            {Object.keys(stats).length > 0 && (
              <div className="px-6 py-3 grid grid-cols-3 sm:grid-cols-6 gap-2 border-b border-outline-variant/10 shrink-0">
                {statKeys.map(([key, label]) => {
                  const val = stats[key as keyof typeof stats] ?? 10;
                  return (
                    <div key={key} className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] uppercase font-bold text-outline/60">{label}</span>
                      <span className="text-sm font-bold text-on-surface">{val}</span>
                      <span className="text-[10px] text-outline">{mod(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabs */}
            <div className="px-6 pt-3 flex gap-1 shrink-0">
              {tabLabels.map(({ key, label, icon, color }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    tab === key
                      ? `bg-surface-container-highest ${color}`
                      : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {icon} {label}
                  <span className="text-[10px] opacity-60">({tabItems[key].length})</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex-1">
              <ActionList
                items={tabItems[tab]}
                emptyLabel={
                  tab === 'actions' ? 'No actions imported. Refresh from D&D Beyond to populate.' :
                  tab === 'abilities' ? 'No class features imported.' :
                  'No spells imported.'
                }
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
