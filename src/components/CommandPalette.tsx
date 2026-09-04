import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, ChevronRight, Heart, Swords, Sparkles, BookOpen, Upload, Settings, Map, Music } from 'lucide-react';
import { cn } from '../lib/utils';
import { Combatant, MonsterTemplate } from '../types';
import { AvatarImg } from './AvatarImg';

type CommandItem = {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  accentColor?: string;
  action: () => void;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  combatants: Combatant[];
  monsters: MonsterTemplate[];
  isEncounterActive: boolean;
  currentEncounterId: string | null;
  displayNames: Map<string, string>;
  onNavigate: (path: string) => void;
  onNextTurn: () => void;
  onPrevTurn: () => void;
  onHealAll: () => void;
  onClearConditions: () => void;
  onAddMonster: (m: MonsterTemplate) => void;
  onSelectCombatant: (id: string) => void;
  onQuickDamage: (id: string) => void;
  onQuickHeal: (id: string) => void;
}

export const CommandPalette: React.FC<Props> = ({
  isOpen,
  onClose,
  combatants,
  monsters,
  isEncounterActive,
  currentEncounterId,
  displayNames,
  onNavigate,
  onNextTurn,
  onPrevTurn,
  onHealAll,
  onClearConditions,
  onAddMonster,
  onSelectCombatant,
  onQuickDamage,
  onQuickHeal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const sorted = useMemo(
    () => [...combatants].filter(c => !c.ownerId).sort((a, b) => b.initiative - a.initiative),
    [combatants]
  );

  const items = useMemo((): CommandItem[] => {
    const q = query.toLowerCase().trim();
    const result: CommandItem[] = [];

    // Natural language: "damage Rose 8" / "heal Aura 5"
    const dmgMatch = q.match(/^(?:damage|dmg)\s+(.+?)\s+(\d+)$/);
    const healMatch = q.match(/^heal\s+(.+?)\s+(\d+)$/);
    if (dmgMatch || healMatch) {
      const m = (dmgMatch || healMatch)!;
      const nameQ = m[1];
      const isDmg = !!dmgMatch;
      const matching = sorted.filter(c =>
        (displayNames.get(c.id) ?? c.name).toLowerCase().includes(nameQ)
      );
      matching.slice(0, 6).forEach(c => {
        const name = displayNames.get(c.id) ?? c.name;
        result.push({
          id: `quick-${isDmg ? 'dmg' : 'heal'}-${c.id}`,
          group: isDmg ? 'Quick Damage' : 'Quick Heal',
          label: `${isDmg ? 'Damage' : 'Heal'} ${name}`,
          sublabel: `${c.hp.current}/${c.hp.max} HP`,
          icon: isDmg ? <Swords className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />,
          accentColor: isDmg ? 'text-red-400' : 'text-emerald-400',
          action: () => { isDmg ? onQuickDamage(c.id) : onQuickHeal(c.id); onClose(); },
        });
      });
      return result;
    }

    // Combat actions
    if (isEncounterActive) {
      const combatActions: CommandItem[] = [
        {
          id: 'next-turn',
          group: 'Combat',
          label: 'Next Turn',
          sublabel: 'Space · →',
          icon: <ChevronRight className="w-3.5 h-3.5" />,
          accentColor: 'text-primary',
          action: () => { onNextTurn(); onClose(); },
        },
        {
          id: 'prev-turn',
          group: 'Combat',
          label: 'Prev Turn',
          sublabel: '←',
          icon: <ChevronRight className="w-3.5 h-3.5 rotate-180" />,
          accentColor: 'text-outline',
          action: () => { onPrevTurn(); onClose(); },
        },
        {
          id: 'heal-all',
          group: 'Combat',
          label: 'Heal All to Full',
          icon: <Heart className="w-3.5 h-3.5" />,
          accentColor: 'text-emerald-400',
          action: () => { onHealAll(); onClose(); },
        },
        {
          id: 'clear-conditions',
          group: 'Combat',
          label: 'Clear All Conditions',
          icon: <Sparkles className="w-3.5 h-3.5" />,
          accentColor: 'text-amber-400',
          action: () => { onClearConditions(); onClose(); },
        },
      ];
      combatActions
        .filter(a => !q || a.label.toLowerCase().includes(q))
        .forEach(a => result.push(a));

      // Combatants
      sorted
        .filter(c => !q || (displayNames.get(c.id) ?? c.name).toLowerCase().includes(q))
        .slice(0, 6)
        .forEach(c => {
          const name = displayNames.get(c.id) ?? c.name;
          const pct = c.hp.max > 0 ? c.hp.current / c.hp.max : 0;
          result.push({
            id: `combatant-${c.id}`,
            group: 'Combatants',
            label: name,
            sublabel: `${c.hp.current}/${c.hp.max} HP · AC ${c.ac}`,
            icon: <AvatarImg src={c.avatar} name={name} className="w-5 h-5 rounded text-[9px] shrink-0" />,
            accentColor: pct < 0.33 ? 'text-red-400' : pct < 0.66 ? 'text-amber-400' : 'text-emerald-400',
            action: () => { onSelectCombatant(c.id); onClose(); },
          });
        });
    }

    // Monsters from library (add to encounter)
    if (currentEncounterId) {
      monsters
        .filter(m => !q || m.name.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach(m => {
          result.push({
            id: `monster-${m.id}`,
            group: 'Add to Encounter',
            label: m.name,
            sublabel: `CR ${m.cr} · ${m.type} · ${m.hp} HP`,
            icon: <AvatarImg src={m.image} name={m.name} className="w-5 h-5 rounded text-[9px] shrink-0" />,
            accentColor: 'text-violet-400',
            action: () => { onAddMonster(m); onClose(); },
          });
        });
    }

    // Navigation
    const navItems: CommandItem[] = [
      { id: 'nav-encounters', group: 'Navigate', label: 'Encounters',      icon: <Swords className="w-3.5 h-3.5" />,   accentColor: 'text-violet-400', action: () => { onNavigate('/encounters'); onClose(); } },
      { id: 'nav-monsters',   group: 'Navigate', label: 'Monster Library', icon: <BookOpen className="w-3.5 h-3.5" />, accentColor: 'text-red-400',    action: () => { onNavigate('/monsters'); onClose(); } },
      { id: 'nav-spells',     group: 'Navigate', label: 'Spells',          icon: <Sparkles className="w-3.5 h-3.5" />, accentColor: 'text-sky-400',    action: () => { onNavigate('/spells'); onClose(); } },
      { id: 'nav-campaigns',  group: 'Navigate', label: 'Campaigns',       icon: <Map className="w-3.5 h-3.5" />,      accentColor: 'text-teal-400',   action: () => { onNavigate('/campaigns'); onClose(); } },
      { id: 'nav-import',     group: 'Navigate', label: 'Import',          icon: <Upload className="w-3.5 h-3.5" />,   accentColor: 'text-sky-400',    action: () => { onNavigate('/import'); onClose(); } },
      { id: 'nav-settings',   group: 'Navigate', label: 'Settings',        icon: <Settings className="w-3.5 h-3.5" />, accentColor: 'text-amber-400',  action: () => { onNavigate('/settings'); onClose(); } },
      { id: 'nav-soundboard', group: 'Navigate', label: 'Soundboard',      icon: <Music className="w-3.5 h-3.5" />,    accentColor: 'text-pink-400',   action: () => { onNavigate('/soundboard'); onClose(); } },
    ];
    navItems
      .filter(n => !q || n.label.toLowerCase().includes(q))
      .forEach(n => result.push(n));

    return result;
  }, [query, isEncounterActive, sorted, displayNames, monsters, currentEncounterId,
      onNextTurn, onPrevTurn, onHealAll, onClearConditions, onAddMonster,
      onSelectCombatant, onQuickDamage, onQuickHeal, onNavigate, onClose]);

  useEffect(() => {
    setSelectedIdx(prev => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && items[selectedIdx]) items[selectedIdx].action();
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const grouped = useMemo(() => {
    const groups: { name: string; items: (CommandItem & { globalIdx: number })[] }[] = [];
    let cur = '';
    let idx = 0;
    for (const item of items) {
      if (item.group !== cur) { cur = item.group; groups.push({ name: item.group, items: [] }); }
      groups[groups.length - 1].items.push({ ...item, globalIdx: idx++ });
    }
    return groups;
  }, [items]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[560px] bg-[#0E1119] border border-white/10 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
              <Search className="w-4 h-4 text-outline/40 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search monsters, navigate, damage Rose 8…"
                className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-outline/30"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="text-[10px] font-mono text-outline/35 bg-surface-container border border-white/8 rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1.5 custom-scrollbar">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-outline/35">No results for "{query}"</div>
              ) : (
                grouped.map(group => (
                  <div key={group.name}>
                    <div className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-[0.18em] uppercase text-outline/35">
                      {group.name}
                    </div>
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        data-idx={item.globalIdx}
                        onMouseEnter={() => setSelectedIdx(item.globalIdx)}
                        onClick={item.action}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-xl text-left transition-colors',
                          selectedIdx === item.globalIdx ? 'bg-primary/10' : 'hover:bg-white/4'
                        )}
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <div className={cn(
                          'w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center shrink-0 transition-colors',
                          selectedIdx === item.globalIdx && item.accentColor ? item.accentColor : 'text-outline/40'
                        )}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium truncate transition-colors',
                            selectedIdx === item.globalIdx ? 'text-on-surface' : 'text-on-surface/65'
                          )}>
                            {item.label}
                          </p>
                          {item.sublabel && (
                            <p className="text-[11px] text-outline/45 truncate">{item.sublabel}</p>
                          )}
                        </div>
                        {selectedIdx === item.globalIdx && (
                          <kbd className="text-[10px] font-mono text-outline/40 bg-surface-container border border-white/8 rounded px-1.5 py-0.5 shrink-0">↵</kbd>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 bg-[#090B10]">
              {[['↑↓', 'navigate'], ['↵', 'select'], ['⌘K', 'toggle']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-[10px] text-outline/35">
                  <kbd className="bg-surface-container border border-white/8 rounded px-1 py-0.5 font-mono text-[9px]">{key}</kbd>
                  {label}
                </div>
              ))}
              <span className="ml-auto text-[10px] text-outline/25 font-mono">damage Rose 8 · heal Aura 5</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
