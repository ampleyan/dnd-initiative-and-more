import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, ChevronDown, ChevronUp, Clock, Heart, Shield, Skull, Sparkles, Swords, Users, Wand2, Zap } from 'lucide-react';
import { AnimationLevel, Combatant, LogEntry } from '../types';
import { DAMAGE_COLORS, DamageType } from '../lib/damageTypes';
import { AvatarImg } from './AvatarImg';
import { CombatLog } from './CombatLog';
import { cn } from '../lib/utils';
import { CONDITIONS, INITIATIVE_COLORS } from '../constants';

function initiativeColor(initiative: number): string {
  const idx = Math.min(Math.max(Math.floor(initiative), 1), 20) - 1;
  return INITIATIVE_COLORS[19 - idx];
}


const BENEFICIAL_IDS = new Set(['blessed', 'hasted', 'concentrating', 'raging', 'inspired']);
const ATTACK_DISADVANTAGE_CONDITIONS = new Set(['blinded', 'frightened', 'poisoned', 'prone', 'restrained', 'disadvantaged']);

interface DamagePillProps {
  delta: number;
  isBig: boolean;
  pillKey: number;
}

const DamagePill: React.FC<DamagePillProps> = ({ delta, isBig, pillKey }) => (
  <div className="absolute top-2 right-2 z-20 pointer-events-none pill-float" key={pillKey}>
    <span className={cn(
      'inline-block text-xs font-extrabold rounded-lg px-2 py-0.5',
      delta < 0
        ? isBig ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,.7)]'
                : 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,.5)]'
        : 'bg-emerald-400 text-slate-900 shadow-[0_0_14px_rgba(52,211,153,.5)]'
    )}>
      {delta < 0 ? '−' : '+'}{Math.abs(delta)}
    </span>
  </div>
);

interface ParticleBurstProps {
  particles: Array<{ id: number; combatantId: string; color: string; dx: number; dy: number }>;
  combatantId: string;
}

const ParticleBurst: React.FC<ParticleBurstProps> = ({ particles, combatantId }) => (
  <>
    {particles
      .filter(p => p.combatantId === combatantId)
      .map(p => (
        <span
          key={p.id}
          className="particle-burst"
          style={{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            backgroundColor: p.color,
            top: '50%',
            left: '50%',
          } as React.CSSProperties}
        />
      ))}
  </>
);

interface DeathSavesViewProps {
  ds: { successes: number; failures: number; stable: boolean };
  large?: boolean;
}

const DeathSavesView: React.FC<DeathSavesViewProps> = ({ ds, large }) => {
  if (ds.stable) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Heart className={cn('text-emerald-400', large ? 'w-4 h-4' : 'w-3 h-3')} />
        <span className={cn('font-black text-emerald-400 uppercase tracking-wider', large ? 'text-xs' : 'text-[10px]')}>Stable</span>
      </div>
    );
  }
  const size = large ? 'w-3 h-3' : 'w-2.5 h-2.5';
  return (
    <div className={cn('flex items-center gap-2.5 mt-1.5', large && 'mt-2')}>
      <span className={cn('font-black uppercase tracking-wider text-red-300', large ? 'text-[10px]' : 'text-[8px]')}>Death Save</span>
      <div className="flex items-center gap-0.5" title="Failures">
        {[0, 1, 2].map(i => (
          <span key={`f${i}`} className={cn('rounded-full border', size, i < ds.failures ? 'bg-error border-error' : 'border-error/40')} />
        ))}
      </div>
      <span className="text-outline/40 text-[10px]">/</span>
      <div className="flex items-center gap-0.5" title="Successes">
        {[0, 1, 2].map(i => (
          <span key={`s${i}`} className={cn('rounded-full border', size, i < ds.successes ? 'bg-emerald-400 border-emerald-400' : 'border-emerald-400/40')} />
        ))}
      </div>
    </div>
  );
};

interface PlayerViewProps {
  combatants: Combatant[];
  currentTurnIndex: number;
  isEncounterActive: boolean;
  currentRound: number;
  encounterName: string;
  backgroundImage?: string;
  backgroundOpacity?: number;
  panelOpacity?: number;
  animationLevel?: AnimationLevel;
  displayNames?: Map<string, string>;
  showOrderInName?: boolean;
  pendingConChecks?: Record<string, number>;
  combatLog?: LogEntry[];
}

const STATUS = {
  healthy:  { label: 'Healthy',  barColor: '#34d399' },
  hurt:     { label: 'Hurt',     barColor: '#fbbf24' },
  bloodied: { label: 'Bloodied', barColor: '#ef4444' },
  down:     { label: 'Down',     barColor: '#6b7280' },
} as const;

function status(c: Combatant) {
  if (c.hp.current <= 0) return STATUS.down;
  const pct = c.hp.max > 0 ? c.hp.current / c.hp.max : 1;
  if (pct > 0.5) return STATUS.healthy;
  if (pct > 0.25) return STATUS.hurt;
  return STATUS.bloodied;
}

function hpPct(c: Combatant) {
  return c.hp.max > 0 ? Math.max(0, Math.min(1, c.hp.current / c.hp.max)) : 0;
}

function lerpHex(hex1: string, hex2: string, t: number): string {
  const p = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${mix(p(hex1,1),p(hex2,1))}${mix(p(hex1,3),p(hex2,3))}${mix(p(hex1,5),p(hex2,5))}`;
}

function healthColor(c: Combatant): string {
  if (c.hp.current <= 0) return STATUS.down.barColor;
  const pct = c.hp.max > 0 ? c.hp.current / c.hp.max : 1;
  if (pct > 0.5) return lerpHex(STATUS.healthy.barColor, STATUS.hurt.barColor, 1 - (pct - 0.5) / 0.5);
  if (pct > 0.25) return STATUS.hurt.barColor;
  return STATUS.bloodied.barColor;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  combatants, currentTurnIndex, isEncounterActive, currentRound, encounterName, backgroundImage, backgroundOpacity = 0.22, panelOpacity = 0.92, animationLevel = 'minimal', displayNames, showOrderInName, pendingConChecks, combatLog,
}) => {
  const panelBg = `rgba(18,22,28,${panelOpacity})`;
  const activeBg = `rgba(40,48,58,${Math.min(1, panelOpacity + 0.03)})`;
  const emptyBg = `rgba(18,22,28,${Math.max(0, panelOpacity - 0.12)})`;
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [portraitsOpen, setPortraitsOpen] = useState(true);
  const [expandedAbilities, setExpandedAbilities] = useState<Set<string>>(new Set());

  const prevHpRef = useRef<Map<string, number>>(new Map());
  const [dmgEvents, setDmgEvents] = useState<Array<{ combatantId: string; delta: number; key: number; damageType?: string }>>([]);
  const [particles, setParticles] = useState<Array<{ id: number; combatantId: string; color: string; dx: number; dy: number }>>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const newEvents: Array<{ combatantId: string; delta: number; key: number; damageType?: string }> = [];
    const reversedLog = combatLog ? [...combatLog].reverse() : [];
    combatants.forEach(c => {
      const prev = prevHpRef.current.get(c.id);
      if (prev !== undefined && prev !== c.hp.current) {
        const delta = c.hp.current - prev;
        const recentLog = reversedLog.find(e =>
          (delta < 0 ? e.type === 'damage' : e.type === 'heal') && e.targetId === c.id
        );
        const damageType = delta >= 0 ? 'heal' : (recentLog?.damageType ?? 'generic');
        newEvents.push({ combatantId: c.id, delta, key: Date.now() + Math.random(), damageType });
      }
      prevHpRef.current.set(c.id, c.hp.current);
    });
    if (newEvents.length > 0) {
      setDmgEvents(prev => [...prev, ...newEvents]);
      if (animationLevel === 'full') {
        const newParticles = newEvents.flatMap(ev => {
          const color = DAMAGE_COLORS[(ev.damageType as DamageType) ?? 'generic']?.particle ?? '#ef4444';
          return Array.from({ length: 7 }, (_, i) => ({
            id: Date.now() + i + Math.random(),
            combatantId: ev.combatantId,
            color,
            dx: (Math.random() - 0.5) * 80,
            dy: (Math.random() - 0.5) * 80,
          }));
        });
        setParticles(prev => [...prev, ...newParticles]);
        timers.push(setTimeout(() => {
          setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id)));
        }, 900));
      }
      timers.push(setTimeout(() => {
        setDmgEvents(prev => prev.filter(e => !newEvents.find(n => n.key === e.key)));
      }, 1800));
    }
    return () => timers.forEach(clearTimeout);
  }, [combatants, combatLog, animationLevel]);

  const sorted = useMemo(() => {
    const mains = [...combatants].filter(c => !c.ownerId).sort((a, b) => b.initiative - a.initiative);
    const byOwner = new Map<string, Combatant[]>();
    combatants.filter(c => c.ownerId).forEach(c => {
      if (!byOwner.has(c.ownerId!)) byOwner.set(c.ownerId!, []);
      byOwner.get(c.ownerId!)!.push(c);
    });
    const result: Combatant[] = [];
    for (const c of mains) { result.push(c); result.push(...(byOwner.get(c.id) ?? [])); }
    return result;
  }, [combatants]);

  const activeIdx = sorted.findIndex(c => c.isCurrentTurn);
  const nextIdx = isEncounterActive && sorted.length > 1
    ? (activeIdx >= 0 ? (activeIdx + 1) % sorted.length : 0)
    : -1;
  const next = nextIdx >= 0 ? sorted[nextIdx] : null;

  const players = combatants.filter(c => c.type === 'player' && !c.ownerId);
  const enemies = combatants.filter(c => c.type !== 'player' && !c.ownerId);
  const aliveEnemies = enemies.filter(e => e.hp.current > 0).length;
  const downEnemies = enemies.length - aliveEnemies;
  const avgPartyHp    = players.length > 0
    ? players.reduce((s, p) => s + hpPct(p), 0) / players.length
    : 0;

  const activeCombatant = isEncounterActive ? sorted.find(c => c.isCurrentTurn) ?? null : null;
  const activeCombatantConditions = new Set(activeCombatant?.conditions ?? []);

  const allConditions = useMemo(() => {
    const map = new Map<string, string[]>();
    combatants.forEach(c => {
      c.conditions.forEach(condId => {
        if (!map.has(condId)) map.set(condId, []);
        map.get(condId)!.push(c.name);
      });
    });
    return Array.from(map.entries()).map(([id, names]) => ({
      condition: CONDITIONS.find(cd => cd.id === id),
      names,
      isBeneficial: BENEFICIAL_IDS.has(id),
      isOnActiveCombatant: activeCombatantConditions.has(id),
    })).filter(entry => entry.condition != null)
      .sort((a, b) => {
        if (a.isOnActiveCombatant !== b.isOnActiveCombatant) return a.isOnActiveCombatant ? -1 : 1;
        return 0;
      });
  }, [combatants, activeCombatantConditions]);

  const customTagEntries = useMemo(() => {
    const map = new Map<string, { names: string[]; description: string; isOnActiveCombatant: boolean }>();
    combatants.forEach(c => {
      const descs = c.customTagDescriptions ?? {};
      c.tags.forEach(tag => {
        if (!descs[tag]) return;
        if (!map.has(tag)) map.set(tag, { names: [], description: descs[tag], isOnActiveCombatant: false });
        map.get(tag)!.names.push(c.name);
        if (activeCombatant?.id === c.id) map.get(tag)!.isOnActiveCombatant = true;
      });
    });
    return Array.from(map.entries()).map(([tag, data]) => ({ tag, ...data }));
  }, [combatants, activeCombatant]);

  return (
    <>
    <style>{`
      @keyframes pillFloat {
        0%   { transform: translateY(0) scale(1.1); opacity: 1; }
        15%  { transform: translateY(-6px) scale(1); opacity: 1; }
        75%  { transform: translateY(-28px) scale(.9); opacity: .85; }
        100% { transform: translateY(-42px) scale(.85); opacity: 0; }
      }
      @keyframes cardFlashDmg {
        0%   { box-shadow: 0 0 24px rgba(239,68,68,.35); border-color: rgba(239,68,68,.55); background: rgba(239,68,68,.15); }
        100% { box-shadow: none; border-color: rgba(255,255,255,0.07); background: transparent; }
      }
      @keyframes cardFlashBig {
        0%,15% { box-shadow: 0 0 36px rgba(220,38,38,.5); border-color: rgba(220,38,38,.7); background: rgba(220,38,38,.22); }
        100%   { box-shadow: none; border-color: rgba(255,255,255,0.07); background: transparent; }
      }
      @keyframes cardFlashHeal {
        0%   { box-shadow: 0 0 20px rgba(52,211,153,.3); border-color: rgba(52,211,153,.5); background: rgba(52,211,153,.1); }
        100% { box-shadow: none; border-color: rgba(255,255,255,0.07); background: transparent; }
      }
      .card-flash-dmg  { animation: cardFlashDmg .45s ease-out forwards; }
      .card-flash-big  { animation: cardFlashBig .5s ease-out forwards; }
      .card-flash-heal { animation: cardFlashHeal .45s ease-out forwards; }
      .pill-float { animation: pillFloat 1.7s cubic-bezier(.22,.61,.36,1) forwards; }
      @keyframes cardFlashTyped {
        0%   { box-shadow: 0 0 28px var(--flash-glow); border-color: var(--flash-border); background: var(--flash-bg); }
        100% { box-shadow: none; border-color: rgba(255,255,255,0.07); background: transparent; }
      }
      @keyframes particleBurst {
        0%   { transform: translate(0,0) scale(1); opacity: 1; }
        100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
      }
      .card-flash-typed { animation: cardFlashTyped .5s ease-out forwards; }
      .particle-burst   { animation: particleBurst .8s ease-out forwards; position: absolute; width: 6px; height: 6px; border-radius: 50%; pointer-events: none; }
    `}</style>
    <div className="fixed inset-0 z-50 bg-surface-container-lowest overflow-y-auto overflow-x-hidden">

      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none select-none" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-[#080c11] via-[#0f1419] to-[#09101e]" />
        {backgroundImage && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: backgroundOpacity,
            }}
          />
        )}
        <div className="absolute inset-0 bg-[#0a0d12]/35" />
        <div className="absolute top-[-10%] left-[15%] w-[700px] h-[700px] rounded-full bg-indigo-950/40 blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[400px] rounded-full bg-blue-950/30 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[600px] h-[200px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Encounter Ended Banner */}
      {!isEncounterActive && combatants.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 py-3 bg-surface-container-highest/95 backdrop-blur-md border-b border-primary/20 shadow-lg">
          <Swords className="w-5 h-5 text-primary" />
          <span className="font-headline font-black text-base text-on-surface uppercase tracking-widest">Encounter Ended</span>
          <Swords className="w-5 h-5 text-primary" />
        </div>
      )}

      {/* Main — 3-column layout: conditions | initiative list | right sidebar */}
      <main className="relative z-10 pt-8 pb-10 px-4 md:px-6 max-w-7xl mx-auto
                       grid grid-cols-12 gap-5 mt-2 items-start">

        {/* ── Left: Active Conditions + Combat Log ── */}
        <aside className="col-span-12 lg:col-span-4 lg:sticky lg:top-8 flex flex-col gap-3">
          <div className="rounded-xl border border-outline-variant/15 overflow-hidden backdrop-blur-md flex flex-col"
               style={{ backgroundColor: panelBg }}>
            <div className="bg-surface-container/40 px-5 py-4 border-b border-outline-variant/10 shrink-0">
              <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Active Conditions
              </h3>
            </div>
            <div className={cn(
              "overflow-y-auto custom-scrollbar p-3",
              combatLog && combatLog.length > 0 ? "max-h-[calc(50vh-4rem)]" : "max-h-[calc(100vh-12rem)]"
            )}>
              {allConditions.length === 0 && customTagEntries.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant/50 italic font-body text-center py-6">
                  No active conditions
                </p>
              ) : (
                <div className="space-y-2">
                  {allConditions.map(({ condition, names, isBeneficial, isOnActiveCombatant }) => (
                    <div
                      key={condition!.id}
                      className={cn(
                        'rounded-lg px-3 py-2.5 border transition-all duration-200',
                        isOnActiveCombatant
                          ? isBeneficial
                            ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/25'
                            : 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/25'
                          : isBeneficial
                            ? 'border-emerald-900/40 bg-surface-container/20'
                            : 'border-red-900/40 bg-surface-container/20',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isBeneficial ? 'bg-emerald-400' : 'bg-red-400',
                          )} />
                          <span className={cn(
                            'font-headline font-bold text-xs',
                            isOnActiveCombatant
                              ? isBeneficial ? 'text-emerald-300' : 'text-red-300'
                              : isBeneficial ? 'text-emerald-500' : 'text-red-500',
                          )}>
                            {condition!.name}
                          </span>
                          {isOnActiveCombatant && (
                            <span className={cn(
                              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0',
                              isBeneficial
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400',
                            )}>
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-on-surface-variant/50 font-body shrink-0 text-right max-w-[45%] truncate">
                          {names.join(', ')}
                        </span>
                      </div>
                      <p className={cn(
                        'text-[10px] font-body leading-relaxed pl-4',
                        isOnActiveCombatant
                          ? isBeneficial ? 'text-emerald-200/80' : 'text-red-200/80'
                          : 'text-on-surface-variant/55',
                      )}>
                        {condition!.description}
                      </p>
                    </div>
                  ))}
                  {customTagEntries.map(({ tag, description, names, isOnActiveCombatant }) => (
                    <div
                      key={tag}
                      className={cn(
                        'rounded-lg px-3 py-2.5 border transition-all duration-200',
                        isOnActiveCombatant
                          ? 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/25'
                          : 'border-violet-900/40 bg-surface-container/20',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-violet-400" />
                          <span className={cn(
                            'font-headline font-bold text-xs',
                            isOnActiveCombatant ? 'text-violet-300' : 'text-violet-500',
                          )}>
                            {tag}
                          </span>
                          {isOnActiveCombatant && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 bg-violet-500/20 text-violet-400">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-on-surface-variant/50 font-body shrink-0 text-right max-w-[45%] truncate">
                          {names.join(', ')}
                        </span>
                      </div>
                      <p className={cn(
                        'text-[10px] font-body leading-relaxed pl-4',
                        isOnActiveCombatant ? 'text-violet-200/80' : 'text-on-surface-variant/55',
                      )}>
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Combat Log (shown when DM enables "Log to Players") */}
          {combatLog && combatLog.length > 0 && (
            <div className="rounded-xl border border-outline-variant/15 overflow-hidden backdrop-blur-md"
                 style={{ backgroundColor: panelBg }}>
              <div className="bg-surface-container/40 px-4 py-2.5 border-b border-outline-variant/10 flex items-center gap-2 shrink-0">
                <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-outline">Combat Log</span>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar">
                <CombatLog entries={combatLog} />
              </div>
            </div>
          )}
        </aside>

        {/* ── Right sidebar: Next in Order + Tactical Summary ── */}
        <aside className="col-span-12 lg:col-span-3 space-y-4 lg:sticky lg:top-8 lg:order-last">

          {/* Next in Order */}
          {next ? (
            <div className="rounded-xl border border-outline-variant/15 overflow-hidden backdrop-blur-md"
                 style={{ backgroundColor: panelBg }}>
              <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                <h3 className="font-headline font-bold text-[11px] text-on-surface-variant
                               flex items-center gap-2 uppercase tracking-widest">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Next in Order
                </h3>
                <div className="flex flex-col items-center px-3 py-1.5 bg-surface-container-highest rounded-lg border border-primary/20 min-w-[48px]">
                  <span className="font-headline text-[8px] text-primary/70 uppercase tracking-widest leading-none mb-0.5">Round</span>
                  <span className="font-headline text-xl font-black text-primary leading-none tabular-nums">
                    {currentRound}
                  </span>
                </div>
              </div>
              <div className="p-3 flex items-center gap-3">
                <AvatarImg src={next.avatar} name={next.name}
                           className="w-10 h-10 rounded-lg shrink-0 text-xs" />
                <div className="min-w-0">
                  <p className="font-headline font-bold text-on-surface truncate">{displayNames?.get(next.id) ?? next.name}</p>
                  <p className="text-[10px] font-headline text-on-surface-variant uppercase tracking-widest">
                    {next.type === 'player' ? 'Player' : 'Enemy'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-outline-variant/10 backdrop-blur-md px-4 py-3"
                 style={{ backgroundColor: emptyBg }}>
              <p className="text-[11px] text-on-surface-variant/40 font-body text-center">
                No next combatant
              </p>
            </div>
          )}

          {/* Tactical Summary (collapsible) */}
          <div className="rounded-xl border border-outline-variant/15 overflow-hidden backdrop-blur-md"
               style={{ backgroundColor: panelBg }}>
            <button
              onClick={() => setSummaryOpen(v => !v)}
              className="w-full bg-primary/5 px-4 py-3 border-b border-outline-variant/10
                         flex items-center justify-between hover:bg-primary/10 transition-colors"
            >
              <h3 className="font-headline font-bold text-sm text-primary flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Tactical Summary
              </h3>
              {summaryOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-primary/60" />
                : <ChevronDown className="w-3.5 h-3.5 text-primary/60" />}
            </button>

            {summaryOpen && (
              <div className="p-4 space-y-4">
                {players.length > 0 && (
                  <div className="pt-3 border-t border-outline-variant/10 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant font-body">Party HP</span>
                      <span className={cn('font-bold font-headline',
                        avgPartyHp > 0.5 ? 'text-emerald-400' :
                        avgPartyHp > 0.25 ? 'text-amber-400' : 'text-red-400',
                      )}>
                        {Math.round(avgPartyHp * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700',
                          avgPartyHp > 0.5 ? 'bg-emerald-400' :
                          avgPartyHp > 0.25 ? 'bg-amber-400' : 'bg-red-400',
                        )}
                        style={{ width: `${avgPartyHp * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-outline-variant/10 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div>
                      <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">Party</div>
                      <div className="font-headline font-bold text-sm">{players.length}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skull className="w-3.5 h-3.5 text-error shrink-0" />
                    <div>
                      <div className="text-[9px] text-on-surface-variant uppercase tracking-widest">Foes</div>
                      <div className="font-headline font-bold text-sm text-error">{enemies.length}</div>
                      {enemies.length > 0 && (
                        <div className="text-[8px] text-on-surface-variant/60 leading-none mt-0.5">
                          {aliveEnemies} up · {downEnemies} down
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Monster Portraits — shows the active monster's portrait full-size */}
          {(() => {
            const activeMonster = activeCombatant?.type === 'monster' && activeCombatant.avatar ? activeCombatant : null;
            if (!activeMonster) return null;
            const isDead = activeMonster.hp.current <= 0;
            return (
              <div className="rounded-xl border border-outline-variant/15 overflow-hidden backdrop-blur-md"
                   style={{ backgroundColor: panelBg }}>
                <button
                  onClick={() => setPortraitsOpen(v => !v)}
                  className="w-full bg-primary/5 px-4 py-3 border-b border-outline-variant/10
                             flex items-center justify-between hover:bg-primary/10 transition-colors"
                >
                  <h3 className="font-headline font-bold text-sm text-primary flex items-center gap-2">
                    <Swords className="w-3.5 h-3.5" />
                    {activeMonster.name}
                  </h3>
                  {portraitsOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-primary/60" />
                    : <ChevronDown className="w-3.5 h-3.5 text-primary/60" />}
                </button>

                {portraitsOpen && (
                  <div className={cn('relative w-full', isDead && 'grayscale opacity-60')}>
                    <AvatarImg
                      src={activeMonster.avatar}
                      name={activeMonster.name}
                      className="w-full aspect-square object-cover text-6xl"
                    />
                    {isDead && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Skull className="w-12 h-12 text-red-400/80" />
                      </div>
                    )}
                  </div>
                )}
                {portraitsOpen && (() => {
                  const vuln = activeMonster.vulnerabilities ?? [];
                  const res  = activeMonster.resistances ?? [];
                  const dimm = activeMonster.damageImmunities ?? [];
                  const cimm = activeMonster.conditionImmunities ?? [];
                  if (!vuln.length && !res.length && !dimm.length && !cimm.length) return null;
                  return (
                    <div className="border-t border-white/8 px-3 py-2 flex flex-col gap-1">
                      {vuln.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-rose-500/10">
                          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Zap className="w-3 h-3" />Vuln</span>
                          <div className="flex flex-wrap gap-1">{vuln.map(v => <span key={v} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-200 bg-rose-500/20 capitalize">{v}</span>)}</div>
                        </div>
                      )}
                      {res.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sky-500/10">
                          <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Shield className="w-3 h-3" />Resist</span>
                          <div className="flex flex-wrap gap-1">{res.map(r => <span key={r} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-sky-200 bg-sky-500/20 capitalize">{r}</span>)}</div>
                        </div>
                      )}
                      {dimm.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-purple-500/10">
                          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Swords className="w-3 h-3" />Immune</span>
                          <div className="flex flex-wrap gap-1">{dimm.map(i => <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-purple-200 bg-purple-500/20 capitalize">{i}</span>)}</div>
                        </div>
                      )}
                      {cimm.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10">
                          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Activity className="w-3 h-3" />Cond Imm</span>
                          <div className="flex flex-wrap gap-1">{cimm.map(i => <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-200 bg-amber-500/20 capitalize">{i}</span>)}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Friendly NPC abilities/spells on their turn */}
          {isEncounterActive && activeCombatant?.isFriendly && activeCombatant.type !== 'player' && (() => {
            const entries = [
              ...(activeCombatant.actions ?? []),
              ...(activeCombatant.abilities ?? []),
              ...(activeCombatant.spells ?? []),
            ].filter(a => a.category === 'spell' || a.category === 'ability');
            if (entries.length === 0) return null;
            return (
              <div className="rounded-xl border border-emerald-500/20 overflow-hidden backdrop-blur-md"
                   style={{ backgroundColor: panelBg }}>
                <div className="bg-emerald-500/8 px-4 py-3 border-b border-emerald-500/15">
                  <h3 className="font-headline font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    {activeCombatant.name} — Abilities & Spells
                  </h3>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {entries.map((a, i) => {
                    const key = `${a.name}-${i}`;
                    const open = expandedAbilities.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => setExpandedAbilities(prev => {
                          const next = new Set(prev);
                          open ? next.delete(key) : next.add(key);
                          return next;
                        })}
                        className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-on-surface">{a.name}</span>
                          {open ? <ChevronUp className="w-3 h-3 text-outline shrink-0" /> : <ChevronDown className="w-3 h-3 text-outline shrink-0" />}
                        </div>
                        {open && (
                          <p className="text-[11px] text-outline/80 mt-1 leading-relaxed font-body">{a.description}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </aside>

        {/* ── Center: Initiative Order ── */}
        <section className="col-span-12 lg:col-span-5 space-y-3 lg:order-none">
{sorted.length === 0 && (
            <div className="py-14 rounded-xl border border-outline-variant/10
                            bg-surface-container/30 backdrop-blur-md text-center">
              <div className="relative inline-block mb-4">
                <Clock className="w-10 h-10 text-primary/40 mx-auto" />
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
              </div>
              <p className="text-on-surface font-headline font-bold text-sm mb-1">Awaiting DM</p>
              <p className="text-outline text-xs font-body">Your Dungeon Master is preparing the encounter…</p>
            </div>
          )}

          {/* pv-3: Active combatant hero banner */}
          {isEncounterActive && activeCombatant && (
            <div className={cn(
              'rounded-xl border px-4 py-3 flex items-center gap-3 backdrop-blur-sm',
              activeCombatant.type === 'player'
                ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                : 'border-error/25 bg-error/6'
            )}>
              <div className="relative shrink-0">
                <AvatarImg src={activeCombatant.avatar} name={activeCombatant.name}
                           className="w-9 h-9 rounded-lg text-xs" />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Active</p>
                <p className="font-headline font-bold text-sm text-on-surface truncate leading-tight">
                  {displayNames?.get(activeCombatant.id) ?? activeCombatant.name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {activeCombatant.type === 'player' ? (
                  <>
                    <p className="text-[9px] uppercase tracking-widest text-outline mb-0.5">HP</p>
                    <p className="font-headline font-bold text-sm leading-none" style={{ color: healthColor(activeCombatant) }}>
                      {activeCombatant.hp.current}<span className="text-outline/50 text-xs">/{activeCombatant.hp.max}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] uppercase tracking-widest text-outline mb-0.5">Status</p>
                    <p className="font-headline font-bold text-sm leading-none" style={{ color: healthColor(activeCombatant) }}>
                      {status(activeCombatant).label}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}


          <div className="space-y-2">
            {sorted.map((c, qi) => {
              const isActive = isEncounterActive && !!c.isCurrentTurn;
              const s = status(c);
              const accentColor = initiativeColor(c.initiative);
              const isPlayer = c.type === 'player';
              const queueIndex = qi + 1;

              const evt = dmgEvents.find(e => e.combatantId === c.id);
              const isBig = evt ? evt.delta < -20 : false;
              let flashClass = '';
              let flashStyle: React.CSSProperties = {};
              if (evt && animationLevel !== 'none') {
                if (animationLevel === 'minimal' || !evt.damageType) {
                  flashClass = evt.delta > 0 ? 'card-flash-heal'
                    : isBig ? 'card-flash-big'
                    : 'card-flash-dmg';
                } else {
                  const dtype = evt.damageType as DamageType;
                  const colors = DAMAGE_COLORS[dtype] ?? DAMAGE_COLORS.generic;
                  flashClass = evt.delta > 0 ? 'card-flash-heal' : 'card-flash-typed';
                  flashStyle = {
                    '--flash-glow': colors.glow,
                    '--flash-border': colors.border,
                    '--flash-bg': colors.bg,
                  } as React.CSSProperties;
                }
              }

              if (c.ownerId) {
                const pct = hpPct(c);
                const barColor = healthColor(c);
                return (
                  <div key={c.id} className={cn(
                    'ml-8 relative overflow-visible flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-lg border transition-all duration-300',
                    isActive
                      ? 'border-primary/40 ring-1 ring-primary/20 shadow-md'
                      : 'border-white/5',
                    flashClass,
                  )} style={{ backgroundColor: isActive ? activeBg : panelBg, ...flashStyle }}>
                    {evt && isPlayer && <DamagePill delta={evt.delta} isBig={isBig} pillKey={evt.key} />}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5"
                         style={{ backgroundColor: accentColor, opacity: isActive ? 1 : 0.5 }} />
                    <AvatarImg src={c.avatar} name={c.name} className="w-8 h-8 rounded-lg shrink-0 text-[10px]" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-headline font-bold text-sm truncate" style={{ color: healthColor(c) }}>{displayNames?.get(c.id) ?? c.name}</h4>
                      <div className="h-1 w-full mt-1 rounded-full overflow-hidden bg-black/40">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: barColor }}
                          animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: barColor }} />
                      <span className="text-[9px] font-black uppercase whitespace-nowrap" style={{ color: barColor }}>{s.label}</span>
                    </div>
                    {animationLevel === 'full' && <ParticleBurst particles={particles} combatantId={c.id} />}
                  </div>
                );
              }

              if (isActive) {
                return (
                  <div key={c.id} className={cn('relative overflow-visible rounded-xl border border-white/10 ring-1 ring-primary/30 shadow-lg', flashClass)} style={{ ...flashStyle, backgroundColor: activeBg }}>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
                         style={{ backgroundColor: accentColor, boxShadow: `4px 0 20px ${accentColor}66` }} />
                    <div className="pl-5 pr-5 py-5 flex items-center gap-5">
                      <div className="relative shrink-0">
                        <AvatarImg src={c.avatar} name={c.name} className="w-16 h-16 rounded-lg text-xl" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                             style={{ backgroundColor: isPlayer ? 'rgba(96,165,250,0.2)' : 'rgba(239,68,68,0.2)', border: `1px solid ${isPlayer ? 'rgba(96,165,250,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                          {isPlayer
                            ? <Shield className="w-2.5 h-2.5 text-blue-400" />
                            : <Skull className="w-2.5 h-2.5 text-red-400" />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <h3 className="font-headline text-xl font-bold leading-tight truncate" style={{ color: healthColor(c) }}>
                              {showOrderInName && (
                                <span className="font-headline font-black mr-2" style={{ color: accentColor }}>#{queueIndex}</span>
                              )}
                              {displayNames?.get(c.id) ?? c.name}
                            </h3>
                            {c.polymorphForm && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30 w-fit mt-1">
                                <Wand2 className="w-3 h-3 text-violet-400 shrink-0" />
                                <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">Polymorphed · {c.polymorphForm.originalName}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                            {!showOrderInName && (
                              <div>
                                <div className="text-[9px] font-headline uppercase tracking-widest text-white/40">#</div>
                                <div className="font-headline text-xl font-bold" style={{ color: accentColor }}>{queueIndex}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-headline">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: healthColor(c) }} />
                              <span className="font-black" style={{ color: healthColor(c) }}>{s.label}</span>
                            </div>
                            {isPlayer && (
                              <span className="text-white/50 flex items-center gap-1.5">
                                {c.hp.current} / {c.hp.max} HP
                                {!!c.tempHp && <span className="text-cyan-400 font-bold">+{c.tempHp} THP</span>}
                              </span>
                            )}
                          </div>
                          {isPlayer && (
                            <div className="h-1.5 w-full rounded-full overflow-hidden bg-black/40">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: healthColor(c) }}
                                animate={{ width: `${hpPct(c) * 100}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                              />
                            </div>
                          )}
                          {isPlayer && c.deathSaves && c.hp.current <= 0 && (
                            <DeathSavesView ds={c.deathSaves} large />
                          )}
                          {isPlayer && c.concentratingOn && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                              <span className="text-[10px] text-violet-300 font-bold">{c.concentratingOn}</span>
                            </div>
                          )}
                          {(() => {
                            const disadvNames = c.conditions
                              .filter(id => ATTACK_DISADVANTAGE_CONDITIONS.has(id))
                              .map(id => CONDITIONS.find(cd => cd.id === id)?.name ?? id);
                            if (disadvNames.length === 0) return null;
                            return (
                              <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25">
                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wide shrink-0">⚠ Disadv. attacks</span>
                                <span className="text-[9px] text-amber-300/70 truncate">· {disadvNames.join(', ')}</span>
                              </div>
                            );
                          })()}
                          {isPlayer && pendingConChecks?.[c.id] != null && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 rounded-xl overflow-hidden border-2 border-amber-500/80 shadow-xl shadow-amber-900/40"
                            >
                              <div className="bg-amber-500/25 px-4 py-2.5 flex items-center gap-3">
                                <motion.div
                                  animate={{ opacity: [1, 0.2, 1] }}
                                  transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                                  className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"
                                />
                                <div>
                                  <p className="text-sm font-black text-amber-200 uppercase tracking-wider">CON Save Required!</p>
                                  <p className="text-xs text-amber-400/80">DC {pendingConChecks[c.id]} — concentration at risk</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {(c.conditions.length > 0 || Object.keys(c.customTagDescriptions ?? {}).filter(t => c.tags.includes(t)).length > 0) && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {c.conditions.map(condId => {
                            const isBen = BENEFICIAL_IDS.has(condId);
                            return (
                              <span key={condId}
                                    className={cn(
                                      'px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-tighter text-center whitespace-nowrap',
                                      isBen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
                                    )}>
                                {condId}
                              </span>
                            );
                          })}
                          {c.tags.filter(t => c.customTagDescriptions?.[t]).map(tag => (
                            <span key={tag} className="px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-tighter text-center whitespace-nowrap bg-violet-500/15 text-violet-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Hunter's Mark reveals traits */}
                    {!isPlayer && c.conditions.includes('hunters-mark') && (() => {
                      const vuln = c.vulnerabilities ?? [];
                      const res  = c.resistances ?? [];
                      const dimm = c.damageImmunities ?? [];
                      const cimm = c.conditionImmunities ?? [];
                      if (!vuln.length && !res.length && !dimm.length && !cimm.length) return null;
                      return (
                        <div className="border-t border-white/8 px-4 py-2 flex flex-col gap-1">
                          {vuln.length > 0 && <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-rose-500/10"><span className="text-[9px] font-bold text-rose-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />Vuln</span><div className="flex flex-wrap gap-1">{vuln.map(v => <span key={v} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-rose-200 bg-rose-500/20 capitalize">{v}</span>)}</div></div>}
                          {res.length > 0 && <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-sky-500/10"><span className="text-[9px] font-bold text-sky-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Shield className="w-2.5 h-2.5" />Resist</span><div className="flex flex-wrap gap-1">{res.map(r => <span key={r} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-200 bg-sky-500/20 capitalize">{r}</span>)}</div></div>}
                          {dimm.length > 0 && <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-purple-500/10"><span className="text-[9px] font-bold text-purple-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Swords className="w-2.5 h-2.5" />Immune</span><div className="flex flex-wrap gap-1">{dimm.map(i => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-purple-200 bg-purple-500/20 capitalize">{i}</span>)}</div></div>}
                          {cimm.length > 0 && <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10"><span className="text-[9px] font-bold text-amber-300 uppercase tracking-wide w-20 shrink-0 flex items-center gap-1"><Activity className="w-2.5 h-2.5" />Cond Imm</span><div className="flex flex-wrap gap-1">{cimm.map(i => <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-200 bg-amber-500/20 capitalize">{i}</span>)}</div></div>}
                        </div>
                      );
                    })()}
                    {evt && isPlayer && <DamagePill delta={evt.delta} isBig={isBig} pillKey={evt.key} />}
                    {animationLevel === 'full' && <ParticleBurst particles={particles} combatantId={c.id} />}
                  </div>
                );
              }

              return (
                <div
                  key={c.id}
                  className={cn(
                    'relative overflow-visible rounded-lg flex items-center gap-4 pl-5 pr-5 py-3',
                    'border border-white/8 transition-all duration-200',
                    c.hp.current <= 0 && !isPlayer && 'opacity-35 py-1.5',
                    c.hp.current <= 0 && isPlayer && 'opacity-40',
                    flashClass,
                  )}
                  style={{ backgroundColor: panelBg, ...flashStyle }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1"
                       style={{ backgroundColor: accentColor, opacity: 0.7 }} />
                  <AvatarImg src={c.avatar} name={c.name} className={cn('rounded shrink-0', c.hp.current <= 0 && !isPlayer ? 'w-6 h-6 text-[8px]' : 'w-10 h-10 text-sm')} />

                  {c.hp.current <= 0 && !isPlayer ? (
                    /* Collapsed downed enemy strip */
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <h4 className="font-headline text-xs text-on-surface-variant/60 truncate line-through">
                        {displayNames?.get(c.id) ?? c.name}
                      </h4>
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-500/60 shrink-0 ml-2">Down</span>
                    </div>
                  ) : (
                    <>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isPlayer
                        ? <Shield className="w-3 h-3 text-blue-400/70 shrink-0" />
                        : <Skull className="w-3 h-3 text-red-400/40 shrink-0" />}
                      <h4 className="font-headline font-bold text-sm truncate" style={{ color: healthColor(c) }}>
                        {showOrderInName && (
                          <span className="font-headline font-black mr-1.5" style={{ color: accentColor }}>#{queueIndex}</span>
                        )}
                        {displayNames?.get(c.id) ?? c.name}
                      </h4>
                      {isPlayer && !!c.tempHp && (
                        <span className="text-[9px] font-bold text-cyan-400 shrink-0">+{c.tempHp} THP</span>
                      )}
                    </div>
                    {isPlayer && c.hp.current > 0 && (
                      <div className="h-1 w-full mt-1.5 rounded-full overflow-hidden bg-black/40">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${hpPct(c) * 100}%`, backgroundColor: healthColor(c) }}
                        />
                      </div>
                    )}
                    {isPlayer && c.deathSaves && c.hp.current <= 0 && (
                      <DeathSavesView ds={c.deathSaves} />
                    )}
                    {(c.polymorphForm || c.conditions.length > 0 || c.tags.some(t => c.customTagDescriptions?.[t]) || (isPlayer && c.concentratingOn)) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.polymorphForm && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-tight bg-violet-500/20 border border-violet-500/30 text-violet-400">
                            <Wand2 className="w-2.5 h-2.5 shrink-0" />Polymorphed
                          </span>
                        )}
                        {c.conditions.map(condId => {
                          const isBen = BENEFICIAL_IDS.has(condId);
                          return (
                            <span key={condId} className={cn(
                              'px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-tight',
                              isBen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
                            )}>
                              {condId}
                            </span>
                          );
                        })}
                        {c.tags.filter(t => c.customTagDescriptions?.[t]).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-tight bg-violet-500/15 text-violet-400">
                            {tag}
                          </span>
                        ))}
                        {isPlayer && c.concentratingOn && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold rounded bg-violet-500/15 text-violet-300">
                            <Sparkles className="w-2.5 h-2.5" />{c.concentratingOn}
                          </span>
                        )}
                      </div>
                    )}
                    {isPlayer && pendingConChecks?.[c.id] != null && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 rounded-lg overflow-hidden border-2 border-amber-500/70 shadow-lg shadow-amber-900/30"
                      >
                        <div className="bg-amber-500/20 px-3 py-1.5 flex items-center gap-2">
                          <motion.div
                            animate={{ opacity: [1, 0.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                          />
                          <span className="text-xs font-black text-amber-200 uppercase tracking-wide">CON Save DC {pendingConChecks[c.id]}!</span>
                        </div>
                      </motion.div>
                    )}
                    {/* Hunter's Mark reveals traits on inactive row */}
                    {!isPlayer && c.conditions.includes('hunters-mark') && (() => {
                      const vuln = c.vulnerabilities ?? [];
                      const res  = c.resistances ?? [];
                      const dimm = c.damageImmunities ?? [];
                      const cimm = c.conditionImmunities ?? [];
                      if (!vuln.length && !res.length && !dimm.length && !cimm.length) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vuln.map(v => <span key={v} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-rose-300 bg-rose-500/20 capitalize"><Zap className="w-2.5 h-2.5 shrink-0" />{v}</span>)}
                          {res.map(r => <span key={r} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-sky-300 bg-sky-500/20 capitalize"><Shield className="w-2.5 h-2.5 shrink-0" />{r}</span>)}
                          {dimm.map(i => <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-purple-300 bg-purple-500/20 capitalize"><Swords className="w-2.5 h-2.5 shrink-0" />{i}</span>)}
                          {cimm.map(i => <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-amber-300 bg-amber-500/20 capitalize"><Activity className="w-2.5 h-2.5 shrink-0" />{i}</span>)}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 border-l border-white/10 pl-3">
                    {!showOrderInName && (
                      <div className="text-center">
                        <div className="text-[9px] font-headline text-white/40">#</div>
                        <div className="font-headline font-bold text-sm" style={{ color: accentColor }}>{queueIndex}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: healthColor(c) }} />
                      <span className="text-[9px] font-black uppercase whitespace-nowrap" style={{ color: healthColor(c) }}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                  </>
                  )}
                  {evt && isPlayer && <DamagePill delta={evt.delta} isBig={isBig} pillKey={evt.key} />}
                  {animationLevel === 'full' && <ParticleBurst particles={particles} combatantId={c.id} />}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
    </>
  );
};

