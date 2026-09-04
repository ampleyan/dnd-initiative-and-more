import React from 'react';
import { Edit2, Sparkles, Shield, Heart, Zap, ArrowDown, EyeOff, Wind, ChevronDown, ChevronUp, Swords, UserPlus, X, Search, Trash2, BookOpen, Target, GripVertical, RotateCcw, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { DragControls } from 'motion/react';
import { Combatant, MonsterTemplate } from '../types';
import { cn } from '../lib/utils';
import { getSpellSaveDc, applyDamage, applyHeal } from '../lib/combatantUtils';
import { INITIATIVE_COLORS, CONDITIONS } from '../constants';
import { AvatarImg } from './AvatarImg';
import { TurnTimer } from './TurnTimer';

const ICON_MAP: Record<string, any> = {
  ArrowDown,
  Zap,
  EyeOff,
  Heart,
  Sparkles,
  Wind,
  Target,
};

const ATTACK_DISADVANTAGE_CONDITIONS = new Set([
  'blinded', 'frightened', 'poisoned', 'prone', 'restrained', 'disadvantaged',
]);

interface DeathSaveProps {
  deathSaves: { successes: number; failures: number; stable: boolean };
  onUpdate: (ds: { successes: number; failures: number; stable: boolean }) => void;
}

const DeathSavePips: React.FC<DeathSaveProps> = ({ deathSaves, onUpdate }) => {
  if (deathSaves.stable) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Heart className="w-3 h-3 text-emerald-400" />
        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Stable</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 mt-1">
      <div className="flex gap-0.5">
        {[0,1,2].map(i => (
          <button
            key={`f${i}`}
            onClick={e => { e.stopPropagation(); onUpdate({ ...deathSaves, failures: i < deathSaves.failures ? i : i + 1 }); }}
            className={cn("w-3.5 h-3.5 rounded-full border transition-colors", i < deathSaves.failures ? "bg-error border-error" : "border-error/40 hover:border-error/80")}
          />
        ))}
      </div>
      <div className="flex gap-0.5">
        {[0,1,2].map(i => (
          <button
            key={`s${i}`}
            onClick={e => { e.stopPropagation(); onUpdate({ ...deathSaves, successes: i < deathSaves.successes ? i : i + 1 }); }}
            className={cn("w-3.5 h-3.5 rounded-full border transition-colors", i < deathSaves.successes ? "bg-emerald-400 border-emerald-400" : "border-emerald-400/40 hover:border-emerald-400/80")}
          />
        ))}
      </div>
    </div>
  );
};

interface DeathSaveBannerProps {
  onPass: () => void;
  onFail: () => void;
  onNat20: () => void;
  onNat1: () => void;
}

const DeathSaveBanner: React.FC<DeathSaveBannerProps> = ({ onPass, onFail, onNat20, onNat1 }) => {
  const handleRoll = () => {
    const roll = 1 + Math.floor(Math.random() * 20);
    if (roll === 1) onNat1();
    else if (roll === 20) onNat20();
    else if (roll >= 10) onPass();
    else onFail();
  };
  return (
    <div className="mt-2 flex items-center gap-2 p-2 bg-error/10 border border-error/20 rounded-xl flex-wrap" onClick={e => e.stopPropagation()}>
      <span className="text-[10px] font-black uppercase tracking-wider text-error/80 mr-1">Death Save</span>
      <button onClick={handleRoll} title="Roll d20 (10+ pass)" className="px-2 py-1 text-[10px] font-bold bg-primary text-on-primary rounded-lg hover:brightness-110">🎲 Roll</button>
      <button onClick={onPass} className="px-2 py-1 text-[10px] font-bold bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-600/30 hover:bg-emerald-600/30">Pass</button>
      <button onClick={onFail} className="px-2 py-1 text-[10px] font-bold bg-error/20 text-error rounded-lg border border-error/30 hover:bg-error/30">Fail</button>
      <button onClick={onNat20} className="px-2 py-1 text-[10px] font-bold bg-primary/20 text-primary rounded-lg border border-primary/30 hover:bg-primary/30">Nat 20</button>
      <button onClick={onNat1} className="px-2 py-1 text-[10px] font-bold bg-error/20 text-outline rounded-lg border border-outline/20 hover:bg-error/30">Nat 1</button>
    </div>
  );
};

interface CombatantRowProps {
  combatant: Combatant;
  isActive: boolean;
  queueIndex: number;
  onEdit: () => void;
  onStatus: () => void;
  onQuickAction: (mode?: 'damage' | 'heal') => void;
  onUpdate: (updated: Combatant) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSelect?: () => void;
  displayName?: string;
  showOrderInName?: boolean;
  addLogEntry?: (entry: Omit<import('../types').LogEntry, 'id' | 'round'>) => void;
  pendingConCheckDc?: number;
  onConCheckDismiss?: () => void;
  onConCheckFail?: () => void;
  onConcentrationCheckTriggered?: (dc: number) => void;
  companions?: Combatant[];
  monsters?: MonsterTemplate[];
  onAddCompanion?: (template: { name: string; hp: number; ac: number; avatar?: string; subtitle?: string; stats?: Combatant['stats'] }) => void;
  onUpdateCompanion?: (c: Combatant) => void;
  onRemoveCompanion?: (id: string) => void;
  onRemove?: () => void;
  onEditLibrary?: () => void;
  onRevertPolymorph?: (combatant: Combatant) => void;
  groupActive?: boolean;
  visibleInlineActions?: Set<string>;
  turnStartedAt?: number;
  isSelected?: boolean;
  isPanelSelected?: boolean;
  onToggleSelect?: () => void;
  multiSelectMode?: boolean;
  dragControls?: DragControls;
}

export const CombatantRow: React.FC<CombatantRowProps> = ({
  combatant,
  isActive,
  queueIndex,
  onEdit,
  onStatus,
  onQuickAction,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onSelect,
  displayName,
  showOrderInName,
  addLogEntry,
  pendingConCheckDc,
  onConCheckDismiss,
  onConCheckFail,
  onConcentrationCheckTriggered,
  companions,
  monsters,
  onAddCompanion,
  onUpdateCompanion,
  onRemoveCompanion,
  onRemove,
  onEditLibrary,
  onRevertPolymorph,
  groupActive,
  visibleInlineActions,
  turnStartedAt,
  isSelected,
  isPanelSelected,
  onToggleSelect,
  multiSelectMode,
  dragControls,
}) => {
  const show = (action: string) => !visibleInlineActions || visibleInlineActions.has(action);
  const [editingHp, setEditingHp] = React.useState(false);
  const [addingCompanion, setAddingCompanion] = React.useState(false);
  const [companionSearch, setCompanionSearch] = React.useState('');
  const [hpInput, setHpInput] = React.useState('');
  const [dmgInput, setDmgInput] = React.useState('');
  const hpInputRef = React.useRef<HTMLInputElement>(null);
  const dmgInputRef = React.useRef<HTMLInputElement>(null);
  const cancellingRef = React.useRef(false);
  const commitHpEdit = () => {
    if (cancellingRef.current) { cancellingRef.current = false; setEditingHp(false); return; }
    setEditingHp(false);
    const raw = hpInput.trim();
    if (!raw) return;

    const tempHp = combatant.tempHp ?? 0;

    const tempMatch = raw.match(/^t\s*([+-]?\d+)$/i);
    if (tempMatch) {
      const n = parseInt(tempMatch[1]) || 0;
      const nextTemp = n < 0 ? Math.max(0, tempHp + n) : Math.max(tempHp, n);
      onUpdate({ ...combatant, tempHp: nextTemp });
      return;
    }

    if (raw.startsWith('-')) {
      const damage = Math.abs(parseInt(raw) || 0);
      if (damage === 0) return;
      const wasDown = combatant.hp.current === 0;
      const wasDeathSaves = combatant.deathSaves;
      const { updated, actualDamage } = applyDamage(combatant, damage);
      if (combatant.type === 'player' && wasDown && wasDeathSaves && !wasDeathSaves.stable) {
        addLogEntry?.({ type: 'death_save_fail', actorName: combatant.name, actorId: combatant.id });
      } else if (combatant.type === 'player' && !wasDeathSaves && updated.hp.current === 0) {
        addLogEntry?.({ type: 'creature_downed', actorName: combatant.name, actorId: combatant.id });
      }
      onUpdate(updated);
      if (actualDamage > 0) {
        onConcentrationCheckTriggered?.(Math.max(10, Math.floor(actualDamage / 2)));
      }
    } else if (raw.startsWith('+')) {
      const heal = parseInt(raw.slice(1)) || 0;
      if (heal === 0) return;
      onUpdate(applyHeal(combatant, heal));
    } else {
      const target = parseInt(raw);
      if (Number.isNaN(target)) return;
      const newCurrent = Math.max(0, Math.min(combatant.hp.max, target));
      if (newCurrent > combatant.hp.current) {
        onUpdate(applyHeal(combatant, newCurrent - combatant.hp.current));
      } else if (newCurrent < combatant.hp.current) {
        const { updated } = applyDamage(combatant, combatant.hp.current - newCurrent);
        onUpdate(updated);
      } else {
        onUpdate(combatant);
      }
    }
  };

  const applyQuickDamage = (amount: number) => {
    const tempHp = combatant.tempHp ?? 0;
    const tempAbsorb = Math.min(tempHp, amount);
    const newTemp = tempHp - tempAbsorb;
    const actualDamage = amount - tempAbsorb;
    const newCurrent = Math.max(0, combatant.hp.current - actualDamage);
    const updated: Combatant = { ...combatant, hp: { ...combatant.hp, current: newCurrent }, tempHp: newTemp };
    if (newCurrent === 0 && combatant.type === 'player' && !combatant.deathSaves) {
      onUpdate({ ...updated, deathSaves: { successes: 0, failures: 0, stable: false } });
    } else {
      onUpdate(updated);
    }
    if (actualDamage > 0) {
      onConcentrationCheckTriggered?.(Math.max(10, Math.floor(actualDamage / 2)));
    }
  };

  const commitDmgInput = () => {
    const amount = Math.abs(parseInt(dmgInput) || 0);
    setDmgInput('');
    if (amount === 0) return;
    applyQuickDamage(amount);
  };

  const beginTempHpEdit = () => {
    setHpInput(`t${combatant.tempHp ?? ''}`);
    setEditingHp(true);
    setTimeout(() => {
      hpInputRef.current?.focus();
      hpInputRef.current?.setSelectionRange(1, hpInputRef.current.value.length);
    }, 0);
  };

  const getInitiativeColor = (initiative: number) => {
    const idx = Math.min(Math.max(Math.floor(initiative), 1), 20) - 1;
    return INITIATIVE_COLORS[idx];
  };

  const initColor = getInitiativeColor(combatant.initiative);
  const barColor = combatant.polymorphForm ? '#8b5cf6' : initColor;

  const hpMax = combatant.hp.max || 1;
  const hpPct = Math.max(0, Math.min(1, combatant.hp.current / hpMax));
  const hpFillColor =
    hpPct > 0.75 ? 'rgba(16,185,129,1)'   // emerald
    : hpPct > 0.5 ? 'rgba(245,158,11,1)'  // amber
    : hpPct > 0.25 ? 'rgba(249,115,22,1)' // orange
    : 'rgba(239,68,68,1)';                 // red
  const hpBorderColor =
    hpPct > 0.75 ? 'rgba(16,185,129,0.5)'
    : hpPct > 0.5 ? 'rgba(245,158,11,0.5)'
    : hpPct > 0.25 ? 'rgba(249,115,22,0.5)'
    : 'rgba(239,68,68,0.5)';

  return (
    <>
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onSelect}
      className={cn(
        "group relative flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-2xl transition-all duration-300 w-full min-w-0 overflow-hidden",
        isActive
          ? "bg-surface-container-highest shadow-[0_0_40px_rgba(173,198,255,0.1)] ring-1 ring-primary/20"
          : isPanelSelected
          ? "bg-surface-container-high border border-primary/30 ring-1 ring-primary/20"
          : groupActive
          ? "bg-surface-container-low border border-primary/15 ring-1 ring-primary/10"
          : "bg-surface-container-low hover:bg-surface-container-high border border-white/5",
        onSelect && "cursor-pointer",
        combatant.tags.includes('dead') && "opacity-40 grayscale"
      )}
    >
      {/* HP background fill — drains right-to-left as HP falls */}
      {combatant.hp.current > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 rounded-2xl pointer-events-none transition-all duration-700"
          style={{
            width: `${hpPct * 100}%`,
            background: hpFillColor,
            opacity: isActive ? 0.10 : 0.06,
          }}
        />
      )}
      <div
        className={cn("absolute left-0 top-0 bottom-0 rounded-l-2xl", isActive ? "w-1.5 animate-pulse" : "w-1 opacity-50")}
        style={{ backgroundColor: barColor, boxShadow: isActive ? `4px 0 20px ${barColor}44` : undefined }}
      />
      
      {multiSelectMode && (
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect?.(); }}
          className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-primary border-primary text-on-primary' : 'border-outline/40 hover:border-primary'
          }`}
          aria-label={isSelected ? 'Deselect' : 'Select'}
        >
          {isSelected && <span className="text-[10px] font-bold leading-none">✓</span>}
        </button>
      )}

      {dragControls && !multiSelectMode && (
        <button
          onPointerDown={e => { e.stopPropagation(); dragControls.start(e); }}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
          aria-label="Drag to reorder"
          className="hidden sm:flex shrink-0 items-center justify-center w-4 h-8 -mr-1 rounded text-outline/40 hover:text-on-surface hover:bg-surface-container-highest cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex flex-col items-center justify-center w-8 sm:w-11 shrink-0">
        <span
          className="font-headline font-black text-xl leading-none"
          style={{ color: initColor }}
        >
          {queueIndex}
        </span>
        <span className="text-[8px] font-bold tabular-nums leading-none mt-0.5" style={{ color: initColor, opacity: 0.55 }}>
          {combatant.initiative}
        </span>
        <span className="text-[7px] font-bold uppercase tracking-widest leading-none mt-0.5" style={{ opacity: 0.3 }}>INIT</span>
      </div>

      {(onMoveUp || onMoveDown) && (show('moveUp') || show('moveDown')) && (
        <div className="hidden sm:flex flex-col gap-0.5 shrink-0 -ml-1 mr-0.5">
          {onMoveUp && show('moveUp') && (
            <button
              onClick={e => { e.stopPropagation(); onMoveUp(); }}
              title="Move up in order"
              className="p-0.5 rounded text-outline/50 hover:text-primary hover:bg-surface-container-highest transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveDown && show('moveDown') && (
            <button
              onClick={e => { e.stopPropagation(); onMoveDown(); }}
              title="Move down in order"
              className="p-0.5 rounded text-outline/50 hover:text-primary hover:bg-surface-container-highest transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className={cn("relative shrink-0 rounded-xl transition-all duration-300 p-0.5", isActive && "scale-105")}
            style={{ background: isActive ? undefined : (combatant.polymorphForm ? 'rgba(139,92,246,0.5)' : hpBorderColor) }}
          >
            <AvatarImg
              src={combatant.avatar}
              name={combatant.name}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-[10px] shrink-0"
            />
            {isActive && (
              <div className="absolute -bottom-1 -right-1 p-0.5 rounded bg-primary">
                <Zap className="w-2 h-2 text-on-primary" />
              </div>
            )}
            {combatant.isFriendly && (
              <div className="absolute -top-1 -left-1 p-0.5 rounded bg-emerald-500" title="Friendly">
                <Shield className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className={cn(
                "text-sm font-headline font-bold leading-none",
                isActive ? "text-on-surface" : "text-on-surface/80"
              )}>
                {showOrderInName && (
                  <span
                    className="font-headline font-black text-sm mr-1 leading-none"
                    style={{ color: initColor }}
                  >
                    #{queueIndex}
                  </span>
                )}
                <span className="flex items-center gap-0 min-w-0 overflow-hidden">
                  <span className={cn(
                    "text-sm font-headline font-bold leading-none truncate",
                    isActive ? "text-on-surface" : "text-on-surface/80"
                  )}>{displayName ?? combatant.name}</span>
                  {turnStartedAt && <TurnTimer startedAt={turnStartedAt} />}
                </span>
              </h3>
              {combatant.legendaryActions && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="text-[9px] text-outline uppercase tracking-wider font-bold mr-1">LA</span>
                  {Array.from({ length: combatant.legendaryActions.max }, (_, i) => (
                    <button
                      key={i}
                      onClick={e => {
                        e.stopPropagation();
                        const la = combatant.legendaryActions!;
                        if (i < la.remaining) {
                          // filled pip clicked → spend one charge
                          onUpdate({ ...combatant, legendaryActions: { ...la, remaining: la.remaining - 1 } });
                        } else {
                          // empty pip clicked → restore one charge
                          onUpdate({ ...combatant, legendaryActions: { ...la, remaining: Math.min(la.max, la.remaining + 1) } });
                        }
                      }}
                      title={i < combatant.legendaryActions.remaining ? 'Spend legendary action' : 'Restore legendary action'}
                      className={cn(
                        "w-3 h-3 rounded-full border transition-colors",
                        i < combatant.legendaryActions.remaining
                          ? "bg-amber-400 border-amber-400 hover:bg-amber-300"
                          : "border-amber-700/50 hover:border-amber-500"
                      )}
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                {combatant.polymorphForm && (
                  <div className="flex items-center gap-0.5 px-1.5 h-5 rounded-md bg-violet-500/20 border border-violet-500/30">
                    <Wand2 className="w-2.5 h-2.5 text-violet-400" />
                    <span className="text-[8px] font-bold text-violet-400 uppercase tracking-wider">Polymorphed</span>
                  </div>
                )}
                {combatant.conditions.map(cId => {
                  const condition = CONDITIONS.find(cond => cond.id === cId);
                  if (!condition) return null;
                  const Icon = ICON_MAP[condition.icon] || Sparkles;
                  const rounds = combatant.conditionTimers?.[cId];
                  return (
                    <div key={cId} className="group/tooltip relative">
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center border border-white/10 shadow-sm transition-transform hover:scale-110",
                        condition.color || "bg-surface-container-highest"
                      )}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      {rounds !== undefined && (
                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-black text-white shadow-lg">
                          {rounds} {rounds === 1 ? 'round' : 'rounds'}
                        </span>
                      )}
                      <div className="invisible group-hover/tooltip:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1A1C23] text-white rounded-xl border border-white/10 shadow-2xl z-50 min-w-[150px] pointer-events-none">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("w-2 h-2 rounded-full", condition.color)} />
                          <span className="text-[10px] font-black uppercase tracking-wider">{condition.name}</span>
                        </div>
                        <p className="text-[9px] text-outline leading-relaxed font-body">
                          {condition.description}
                        </p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1A1C23]" />
                      </div>
                    </div>
                  );
                })}
                {combatant.type === 'player' && combatant.spellSlots && (() => {
                  const levels = Object.values(combatant.spellSlots).filter(Boolean);
                  const total = levels.reduce((sum, slot) => sum + (slot?.total ?? 0), 0);
                  const used = levels.reduce((sum, slot) => sum + (slot?.used ?? 0), 0);
                  return total > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/25 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-black text-violet-300" title="Spell slots remaining">
                      ✦ {total - used}/{total}
                    </span>
                  ) : null;
                })()}
                {combatant.concentratingOn && (
                  <div className="group/tooltip relative">
                    <div className="flex items-center gap-0.5 px-1 h-5 rounded-md bg-violet-500/20 border border-violet-500/30">
                      <span className="text-[8px] font-bold text-violet-400">✦</span>
                    </div>
                    <div className="invisible group-hover/tooltip:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1A1C23] text-white rounded-xl border border-white/10 shadow-2xl z-50 whitespace-nowrap pointer-events-none">
                      <span className="text-[10px] text-violet-400 font-bold">Concentrating: </span>
                      <span className="text-[10px]">{combatant.concentratingOn}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-outline italic font-body truncate max-w-[120px] sm:max-w-none">{combatant.subtitle}</p>
            {isActive && (() => {
              const disadvNames = combatant.conditions
                .filter(id => ATTACK_DISADVANTAGE_CONDITIONS.has(id))
                .map(id => CONDITIONS.find(c => c.id === id)?.name ?? id);
              if (disadvNames.length === 0) return null;
              return (
                <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-wide shrink-0">⚠ Disadv. attacks</span>
                  <span className="text-[9px] text-amber-300/70 truncate">· {disadvNames.join(', ')}</span>
                </div>
              );
            })()}
            {combatant.type === 'player' && combatant.hp.current <= 0 && combatant.deathSaves && (
              <div>
                <DeathSavePips
                  deathSaves={combatant.deathSaves}
                  onUpdate={ds => {
                    const updated = { ...combatant, deathSaves: ds };
                    if (ds.failures >= 3) {
                      onUpdate({ ...updated, tags: [...combatant.tags.filter(t => t !== 'dead'), 'dead'] });
                    } else if (ds.successes >= 3) {
                      onUpdate({ ...updated, deathSaves: { ...ds, stable: true } });
                    } else {
                      onUpdate(updated);
                    }
                  }}
                />
                {isActive && !combatant.deathSaves.stable && (
                  <DeathSaveBanner
                    onPass={() => {
                      const s = (combatant.deathSaves!.successes ?? 0) + 1;
                      addLogEntry?.({ type: 'death_save_pass', actorName: combatant.name, actorId: combatant.id });
                      if (s >= 3) {
                        addLogEntry?.({ type: 'creature_stabilized', actorName: combatant.name, actorId: combatant.id });
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, successes: 3, stable: true } });
                      } else {
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, successes: s } });
                      }
                    }}
                    onFail={() => {
                      const f = (combatant.deathSaves!.failures ?? 0) + 1;
                      addLogEntry?.({ type: 'death_save_fail', actorName: combatant.name, actorId: combatant.id });
                      if (f >= 3) {
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, failures: 3 }, tags: [...combatant.tags.filter(t => t !== 'dead'), 'dead'] });
                      } else {
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, failures: f } });
                      }
                    }}
                    onNat20={() => {
                      addLogEntry?.({ type: 'death_save_nat20', actorName: combatant.name, actorId: combatant.id });
                      onUpdate({ ...combatant, hp: { ...combatant.hp, current: 1 }, deathSaves: undefined, tags: combatant.tags.filter(t => t !== 'dead') });
                    }}
                    onNat1={() => {
                      const f = Math.min(3, (combatant.deathSaves!.failures ?? 0) + 2);
                      addLogEntry?.({ type: 'death_save_nat1', actorName: combatant.name, actorId: combatant.id });
                      if (f >= 3) {
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, failures: 3 }, tags: [...combatant.tags.filter(t => t !== 'dead'), 'dead'] });
                      } else {
                        onUpdate({ ...combatant, deathSaves: { ...combatant.deathSaves!, failures: f } });
                      }
                    }}
                  />
                )}
              </div>
            )}
            <AnimatePresence>
              {pendingConCheckDc !== undefined && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-2 rounded-xl overflow-hidden border-2 border-amber-500/70 shadow-lg shadow-amber-900/30"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="bg-amber-500/20 px-3 py-2 flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
                      className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                    />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex-1">
                      Concentration — DC {pendingConCheckDc}
                    </span>
                  </div>
                  <div className="flex border-t border-amber-500/30">
                    <button
                      onClick={() => onConCheckDismiss?.()}
                      className="flex-1 py-2 text-xs font-black text-emerald-300 uppercase tracking-wide bg-emerald-500/10 hover:bg-emerald-500/25 transition-colors border-r border-amber-500/20"
                    >
                      ✓ Pass
                    </button>
                    <button
                      onClick={() => onConCheckFail?.()}
                      className="flex-1 py-2 text-xs font-black text-red-300 uppercase tracking-wide bg-red-500/10 hover:bg-red-500/25 transition-colors"
                    >
                      ✗ Fail
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 w-full sm:w-[min(38vw,560px)]">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-outline">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {combatant.ac}</span>
                {(() => { const dc = getSpellSaveDc(combatant); return dc !== null ? <span className="text-violet-400" title="Spell Save DC">DC {dc}</span> : null; })()}
              </div>
              <div className="flex items-center gap-1.5">
                {(combatant.tempHp ?? 0) > 0 ? (
                  <button
                    onClick={e => { e.stopPropagation(); beginTempHpEdit(); }}
                    title="Edit temp HP"
                    className="text-[10px] font-bold text-sky-400 bg-sky-400/10 hover:bg-sky-400/20 px-1.5 py-0.5 rounded transition-colors"
                  >
                    +{combatant.tempHp} THP
                  </button>
                ) : !editingHp && (
                  <button
                    onClick={e => { e.stopPropagation(); beginTempHpEdit(); }}
                    title="Add temp HP"
                    className="text-[10px] font-bold text-sky-400/40 hover:text-sky-400 hover:bg-sky-400/10 px-1 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    +T
                  </button>
                )}
                {editingHp ? (
                  <input
                    ref={hpInputRef}
                    type="text"
                    value={hpInput}
                    onChange={e => setHpInput(e.target.value)}
                    onBlur={commitHpEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.currentTarget.blur(); }
                      if (e.key === 'Escape') { cancellingRef.current = true; e.currentTarget.blur(); }
                    }}
                    className="w-24 text-[10px] font-bold text-center bg-surface-container-highest border border-primary/40 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="-8 / +4 / 14 / t10"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase cursor-pointer transition-colors",
                      (() => { const p = combatant.hp.max > 0 ? combatant.hp.current / combatant.hp.max : 0; return p > 0.66 ? 'text-emerald-400 hover:text-emerald-300' : p > 0.33 ? 'text-amber-400 hover:text-amber-300' : 'text-error hover:text-red-300'; })()
                    )}
                    onClick={e => {
                      e.stopPropagation();
                      setHpInput('');
                      setEditingHp(true);
                      setTimeout(() => hpInputRef.current?.focus(), 0);
                    }}
                    title="Click to edit HP"
                  >
                    {combatant.hp.current} / {combatant.hp.max}
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 w-full bg-surface-container-lowest rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  (() => { const p = combatant.hp.max > 0 ? combatant.hp.current / combatant.hp.max : 0; return p > 0.66 ? 'bg-emerald-500' : p > 0.33 ? 'bg-amber-500' : 'bg-error'; })()
                )}
                style={{ width: `${(combatant.hp.current / combatant.hp.max) * 100}%` }}
              />
            </div>
          </div>

          <div className="hidden sm:flex gap-1.5 min-w-[40px] justify-end">
            {/* Conditions moved next to name, but keeping a small indicator here if needed or removing it */}
          </div>

          <div className={cn("flex items-center gap-1 sm:gap-2 transition-opacity shrink-0 flex-wrap justify-end min-w-0 max-w-[38%] overflow-hidden", isActive ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100")}>
            <div className="hidden sm:flex gap-0.5">
              {show('companion') && onAddCompanion && (
                <button onClick={e => { e.stopPropagation(); setAddingCompanion(v => !v); setCompanionSearch(''); }} title="Add companion/minion" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-emerald-400 transition-colors">
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {combatant.polymorphForm && onRevertPolymorph && (
              <button
                onClick={e => { e.stopPropagation(); onRevertPolymorph(combatant); }}
                title="Revert polymorph"
                className="p-1.5 hover:bg-surface-container-highest rounded-lg text-violet-400 hover:text-violet-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {show('edit') && (
              <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit combatant" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-primary transition-colors">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onEditLibrary && (
              <button onClick={e => { e.stopPropagation(); onEditLibrary(); }} title="Edit library entry (spells, CR, actions…)" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-violet-400 transition-colors">
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove from encounter" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-error transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="hidden sm:block w-px h-4 bg-outline/20 shrink-0" />
            <div className="flex gap-0.5">
              <button
                onClick={e => { e.stopPropagation(); const waveId = combatant.waveId ?? (window.prompt('Wave name', 'reinforcements') || 'default'); onUpdate({ ...combatant, hidden: !combatant.hidden, waveId }); }}
                title={combatant.hidden ? 'Reveal to players' : 'Hide from players / assign wave'}
                className={cn('p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors', combatant.hidden ? 'text-amber-300' : 'text-outline hover:text-amber-300')}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
              {show('conditions') && (
                <button onClick={e => { e.stopPropagation(); onStatus(); }} title="Conditions" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-primary transition-colors">
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              {show('conditions') && combatant.conditions.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); onUpdate({ ...combatant, conditions: [], conditionTimers: undefined, concentratingOn: undefined }); }}
                  title="Clear all conditions"
                  className="p-1.5 hover:bg-surface-container-highest rounded-lg text-outline hover:text-error transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="hidden sm:block w-px h-4 bg-outline/20 shrink-0" />
            <div className="flex gap-0.5">
              {show('damage') && (
                <div className="hidden sm:contents">
                  <button
                    onClick={e => { e.stopPropagation(); applyQuickDamage(5); }}
                    title="Deal 5 damage"
                    className="px-1.5 py-1 text-[10px] font-bold text-error/70 hover:text-error bg-error/10 hover:bg-error/20 rounded-lg border border-error/20 transition-colors leading-none"
                  >-5</button>
                  <button
                    onClick={e => { e.stopPropagation(); applyQuickDamage(10); }}
                    title="Deal 10 damage"
                    className="px-1.5 py-1 text-[10px] font-bold text-error/70 hover:text-error bg-error/10 hover:bg-error/20 rounded-lg border border-error/20 transition-colors leading-none"
                  >-10</button>
                  <input
                    ref={dmgInputRef}
                    type="number"
                    min="0"
                    value={dmgInput}
                    onChange={e => setDmgInput(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') { commitDmgInput(); dmgInputRef.current?.blur(); }
                      if (e.key === 'Escape') { setDmgInput(''); dmgInputRef.current?.blur(); }
                    }}
                    onBlur={commitDmgInput}
                    placeholder="dmg"
                    title="Type damage and press Enter"
                    className="w-11 px-1 py-1 text-[10px] font-bold text-center text-error bg-error/10 border border-error/20 rounded-lg focus:outline-none focus:border-error/50 focus:ring-0 placeholder:text-error/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              )}
              {show('heal') && (
                <button onClick={e => { e.stopPropagation(); onQuickAction('heal'); }} title="Heal" className="p-1.5 hover:bg-surface-container-highest rounded-lg text-emerald-600/70 hover:text-emerald-400 transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>

    {/* Companion sub-rows */}
    {((companions && companions.length > 0) || addingCompanion) && (
      <div className="ml-10 space-y-1 mt-1">
        {companions?.map(companion => (
          <CompanionRow
            key={companion.id}
            companion={companion}
            onUpdate={onUpdateCompanion}
            onRemove={onRemoveCompanion}
          />
        ))}

        {/* Add companion panel */}
        {addingCompanion && (
          <div className="rounded-xl bg-surface-container border border-white/10 p-3 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-outline shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search monster library…"
                value={companionSearch}
                onChange={e => setCompanionSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-on-surface placeholder:text-outline/50"
              />
              <button onClick={() => setAddingCompanion(false)} className="text-outline hover:text-on-surface transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {companionSearch.length >= 1 && (() => {
              const results = (monsters ?? []).filter(m => m.name.toLowerCase().includes(companionSearch.toLowerCase())).slice(0, 12);
              return (
              <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                {results.length === 0 ? (
                  <p className="text-[11px] text-outline/50 italic text-center py-3">No matches</p>
                ) : results.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onAddCompanion?.({ name: m.name, hp: m.hp, ac: m.ac, avatar: m.image, subtitle: `${m.type} • CR ${m.cr}`, stats: m.stats });
                        setAddingCompanion(false);
                        setCompanionSearch('');
                      }}
                      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <AvatarImg src={m.image} name={m.name} className="w-7 h-7 rounded text-[10px] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-on-surface truncate">{m.name}</div>
                        <div className="text-[10px] text-outline">{m.type} · CR {m.cr} · {m.hp} HP</div>
                      </div>
                    </button>
                ))}
              </div>
              );
            })()}
          </div>
        )}
      </div>
    )}
  </>
  );
};

interface CompanionRowProps {
  companion: Combatant;
  onUpdate?: (c: Combatant) => void;
  onRemove?: (id: string) => void;
}

const CompanionRow: React.FC<CompanionRowProps> = ({ companion, onUpdate, onRemove }) => {
  const [editingHp, setEditingHp] = React.useState(false);
  const [hpInput, setHpInput] = React.useState('');
  const hpInputRef = React.useRef<HTMLInputElement>(null);

  const hpPct = companion.hp.max > 0 ? Math.max(0, Math.min(1, companion.hp.current / companion.hp.max)) : 0;
  const barColor = hpPct < 0.3 ? '#f87171' : hpPct < 0.6 ? '#fbbf24' : '#34d399';

  const commitHp = () => {
    setEditingHp(false);
    const raw = hpInput.trim();
    if (!raw) return;
    let next: number;
    if (raw.startsWith('-')) next = Math.max(0, companion.hp.current - (Math.abs(parseInt(raw)) || 0));
    else if (raw.startsWith('+')) next = Math.min(companion.hp.max, companion.hp.current + (parseInt(raw.slice(1)) || 0));
    else next = Math.max(0, Math.min(companion.hp.max, parseInt(raw) || companion.hp.current));
    onUpdate?.({ ...companion, hp: { ...companion.hp, current: next } });
  };

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-300',
      companion.isCurrentTurn
        ? 'border-primary/40 bg-surface-container-highest shadow-[0_0_20px_rgba(173,198,255,0.08)] ring-1 ring-primary/20'
        : 'border-white/5 bg-surface-container-low/60',
      companion.tags.includes('dead') && 'opacity-40 grayscale',
    )}>
      <div className={cn('w-px h-6 shrink-0 ml-1', companion.isCurrentTurn ? 'bg-primary/60' : 'bg-outline/20')} />
      <AvatarImg src={companion.avatar} name={companion.name} className="w-8 h-8 rounded-lg text-[10px] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-on-surface/90 truncate">{companion.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="h-1 flex-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${hpPct * 100}%`, backgroundColor: barColor }} />
          </div>
          {editingHp ? (
            <input
              ref={hpInputRef}
              autoFocus
              type="text"
              value={hpInput}
              onChange={e => setHpInput(e.target.value)}
              onBlur={commitHp}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditingHp(false); } }}
              className="w-16 text-[10px] font-bold text-center bg-surface-container-highest border border-primary/40 rounded px-1 py-0.5 outline-none"
              placeholder="-8 / +4"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-[10px] font-bold text-outline cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
              onClick={e => { e.stopPropagation(); setHpInput(''); setEditingHp(true); setTimeout(() => hpInputRef.current?.focus(), 0); }}
            >
              {companion.hp.current}/{companion.hp.max}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-outline shrink-0">
        <Shield className="w-3 h-3" /> {companion.ac}
      </div>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(companion.id); }}
          className="p-1 rounded hover:bg-error/10 text-outline/40 hover:text-error transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
