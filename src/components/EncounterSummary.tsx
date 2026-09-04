import React, { useState } from 'react';
import { Combatant, EncounterStats, Session } from '../types';
import { AvatarImg } from './AvatarImg';
import { Plus, Check, Link, Scroll, Swords, Zap, Shield, CircleSlash, FlameKindling } from 'lucide-react';

const DOT_COLORS: Record<string, { dot: string; label: string }> = {
  Shield:  { dot: 'var(--color-primary)', label: 'var(--color-primary)' },
  Swords:  { dot: 'var(--color-primary)', label: 'var(--color-primary)' },
  Star:    { dot: 'var(--color-primary)', label: 'var(--color-primary)' },
  Heart:   { dot: 'var(--color-error)', label: 'var(--color-error-container)' },
  Skull:   { dot: 'var(--color-error)', label: 'var(--color-error-container)' },
  Wind:    { dot: '#424753', label: '#c2c6d6' },
};

interface EncounterSummaryProps {
  encounterName: string;
  combatants: Combatant[];
  stats: EncounterStats | null;
  onClose: () => void;
  isDM: boolean;
  activeCampaignId?: string | null;
  sessions?: Session[];
  onCreateSession?: (name: string, date: string, notes: string) => Promise<Session | null>;
  onAssignEncounter?: (encounterId: string, sessionId: string | null) => Promise<void>;
  currentEncounterId?: string | null;
}

export const EncounterSummary: React.FC<EncounterSummaryProps> = ({
  encounterName,
  combatants,
  stats,
  onClose,
  isDM,
  activeCampaignId,
  sessions,
  onCreateSession,
  onAssignEncounter,
  currentEncounterId,
}) => {
  const [addingToSession, setAddingToSession] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [showRecapForm, setShowRecapForm] = useState(false);
  const [recapName, setRecapName] = useState(`Recap: ${encounterName}`);
  const [recapNotes, setRecapNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const players = combatants.filter(c => c.type === 'player');
  const monsters = combatants.filter(c => c.type === 'monster');
  const allDefeated = monsters.length > 0 && monsters.every(m => m.hp.current <= 0);
  const allFallen = players.length > 0 && players.every(p => p.hp.current <= 0);

  const outcome = allFallen ? 'DEFEAT' : allDefeated ? 'VICTORY' : 'COMPLETE';
  const outcomeColors = allFallen
    ? { border: 'border-error/30', bg: 'bg-error/10', text: 'text-error' }
    : { border: 'border-primary/20', bg: 'bg-primary/10', text: 'text-primary' };

  const mvpScore = (p: Combatant) => {
    const survivalPct = p.hp.max > 0 ? p.hp.current / p.hp.max : 0;
    const combatantStat = stats?.combatantStats?.[p.id];
    const maxDamage = Math.max(1, ...players.map(x => stats?.combatantStats?.[x.id]?.damageDone ?? 0));
    const damagePct = (combatantStat?.damageDone ?? 0) / maxDamage;
    return survivalPct * 0.4 + damagePct * 0.6;
  };
  const sortedPlayers = [...players].sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = sortedPlayers[0] ?? null;
  const otherPlayers = sortedPlayers.slice(1);
  const maxDamageAllPlayers = Math.max(1, ...sortedPlayers.map(x => stats?.combatantStats?.[x.id]?.damageDone ?? 0));

  const hpPct = (c: Combatant) => c.hp.max > 0 ? Math.round((c.hp.current / c.hp.max) * 100) : 0;

  const totalRounds = stats?.totalRounds ?? 1;
  const enemiesDefeated = stats?.enemiesDefeated ?? 0;
  const playersAlive = stats?.playersAlive ?? players.filter(p => p.hp.current > 0).length;
  const highlights = stats?.highlights ?? [];
  const roundDurations = stats?.roundDurations ?? [];
  const totalMs = roundDurations.reduce((a, b) => a + b, 0);

  const generateRecap = () => {
    const outcomeStr = allFallen ? 'a tragic defeat' : allDefeated ? 'a hard-won victory' : 'the end of combat';
    const notes = `The party faced ${encounterName}. 
It was ${outcomeStr} after ${totalRounds} rounds.
${mvp ? `${mvp.name} was the MVP, dealing significant damage.` : ''}
${enemiesDefeated} enemies were defeated.
${playersAlive} party members survived.`;
    setRecapNotes(notes);
  };

  const handleAddToSession = async () => {
    if (!selectedSessionId || !currentEncounterId || !onAssignEncounter) return;
    setAddingToSession(true);
    await onAssignEncounter(currentEncounterId, selectedSessionId);
    setAddingToSession(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2000);
  };

  const handleCreateRecapSession = async () => {
    if (!activeCampaignId || !onCreateSession || !recapName.trim()) return;
    setAddingToSession(true);
    const date = new Date().toISOString().slice(0, 10);
    const session = await onCreateSession(recapName.trim(), date, recapNotes.trim());
    if (session && currentEncounterId && onAssignEncounter) {
      await onAssignEncounter(currentEncounterId, session.id);
    }
    setAddingToSession(false);
    setShowRecapForm(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2000);
  };

  const fmtDuration = (ms: number) => {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };


  // es-1: CR→XP lookup and per-player reward
  const CR_XP: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
    '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
    '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
    '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
    '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
    '21': 33000, '22': 41000, '23': 50000, '24': 62000,
    '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
  };
  const totalXp = combatants
    .filter(c => c.type === 'monster' && c.hp.current <= 0)
    .reduce((sum, c) => {
      const match = c.subtitle?.match(/CR\s+([\d\/]+)/i);
      const xp = match ? (CR_XP[match[1]] ?? 0) : 0;
      return sum + xp;
    }, 0);
  const xpPerPlayer = players.length > 0 ? Math.round(totalXp / players.length) : 0;

  return (
    <div className="min-h-full bg-surface-container-lowest px-6 py-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className={`${outcomeColors.bg} ${outcomeColors.border} border rounded-[2px] px-[9px] py-[3px] shrink-0`}>
          <span className={`${outcomeColors.text} text-[10px] font-bold uppercase tracking-[1px] font-['Space_Grotesk',sans-serif]`}>
            {outcome}
          </span>
        </div>
        <h1 className="text-[18px] sm:text-[24px] font-bold tracking-[-0.6px] text-on-surface leading-tight font-['Space_Grotesk',sans-serif]">
          <span className="text-on-surface-variant font-normal text-[14px] mr-1">Results:</span>
          <span className="text-primary">{encounterName}</span>
        </h1>
      </div>

      {/* Summary Stats — compact 4-col row, round timing integrated */}
      <div className={`grid gap-2 mb-4 ${roundDurations.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {/* Rounds */}
        <div className="bg-surface-container rounded-lg p-3 overflow-hidden relative">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-[1.2px] font-['Space_Grotesk',sans-serif] mb-0.5">Rounds</p>
          <p className="text-on-surface text-[28px] sm:text-[32px] font-bold leading-tight font-['Space_Grotesk',sans-serif]">
            {String(totalRounds).padStart(2, '0')}
          </p>
          <div className="h-[3px] w-8 bg-primary rounded-full mt-1" />
        </div>
        {/* Enemies */}
        <div className="bg-surface-container rounded-lg p-3 overflow-hidden relative">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-[1.2px] font-['Space_Grotesk',sans-serif] mb-0.5">Defeated</p>
          <p className="text-on-surface text-[28px] sm:text-[32px] font-bold leading-tight font-['Space_Grotesk',sans-serif]">
            {String(enemiesDefeated).padStart(2, '0')}
          </p>
          <div className="h-[3px] w-8 bg-error rounded-full mt-1" />
          {xpPerPlayer > 0 && (
            <p className="text-[9px] text-primary/70 font-['Space_Grotesk',sans-serif] mt-1 font-semibold">+{xpPerPlayer.toLocaleString()} XP/player</p>
          )}
        </div>
        {/* Party */}
        <div className="bg-surface-container rounded-lg p-3 overflow-hidden relative">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-[1.2px] font-['Space_Grotesk',sans-serif] mb-0.5">Standing</p>
          <p className="text-on-surface text-[28px] sm:text-[32px] font-bold leading-tight font-['Space_Grotesk',sans-serif]">
            {String(playersAlive).padStart(2, '0')}
          </p>
          <div className="h-[3px] w-8 bg-primary rounded-full mt-1" />
        </div>
        {/* Duration (inline round timing) */}
        {roundDurations.length > 0 && (
          <div className="bg-surface-container rounded-lg p-3 overflow-hidden relative">
            <p className="text-on-surface-variant text-[10px] uppercase tracking-[1.2px] font-['Space_Grotesk',sans-serif] mb-0.5">Duration</p>
            <p className="text-primary text-[28px] sm:text-[32px] font-bold leading-tight font-['Space_Grotesk',sans-serif]">
              {fmtDuration(totalMs)}
            </p>
            {roundDurations.length > 1 && (
              <div className="flex gap-1 mt-1 items-end">
                {roundDurations.map((ms, i) => {
                  const pct = totalMs > 0 ? ms / totalMs : 1 / roundDurations.length;
                  const ms_s = Math.round(ms / 1000);
                  const label = ms_s >= 60 ? `R${i+1}: ${Math.floor(ms_s/60)}m${ms_s%60}s` : `R${i+1}: ${ms_s}s`;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5" title={label}>
                      <div
                        className="w-4 rounded-md bg-primary/60 hover:bg-primary transition-colors"
                        style={{ height: `${Math.max(6, Math.round(pct * 40))}px` }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Combatant Performance */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.5px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">
              Combatant Performance
            </h2>
            <span className="text-[11px] text-on-surface-variant/60">
              {players.length} Heroes • {enemiesDefeated} Defeated
            </span>
          </div>

          {/* MVP Card */}
          {mvp && (
            <div className="bg-surface-container-high border-l-4 border-primary rounded-lg overflow-hidden">
              {/* MVP label bar */}
              <div className="bg-primary/10 px-3 py-1 flex items-center gap-2">
                <span className="text-primary text-[10px] font-bold uppercase tracking-[1px] font-['Space_Grotesk',sans-serif]">
                  ✦ Encounter MVP
                </span>
              </div>
              {/* MVP body */}
              <div className="p-4 flex gap-4 items-start">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shadow-[0_0_0_3px_rgba(173,198,255,0.2)]">
                    <AvatarImg src={mvp.avatar} name={mvp.name} className="w-full h-full" />
                  </div>
                  <div className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-[2px] ${mvp.hp.current > 0 ? 'bg-primary' : 'bg-error'}`}>
                    <span className={`text-[9px] font-bold uppercase font-['Space_Grotesk',sans-serif] ${mvp.hp.current > 0 ? 'text-[#002e69]' : 'text-white'}`}>
                      {mvp.hp.current > 0 ? 'Top Survivor' : 'Downed'}
                    </span>
                  </div>
                </div>
                {/* Stats */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-bold tracking-[-0.5px] text-on-surface leading-tight font-['Space_Grotesk',sans-serif]">
                    {mvp.name}
                  </h3>
                  {mvp.subtitle && <p className="text-[12px] text-on-surface-variant mb-2">"{mvp.subtitle}"</p>}

                  <div className="grid grid-cols-5 gap-3 border-t border-outline-variant/10 pt-2 mb-2">
                    <div>
                      <p className="text-on-surface-variant text-[9px] uppercase tracking-[1px] font-['Space_Grotesk',sans-serif] mb-0.5">HP</p>
                      <p className="text-primary text-[16px] font-semibold leading-tight">
                        {mvp.hp.current}<span className="text-on-surface-variant text-[11px]">/{mvp.hp.max}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant text-[9px] uppercase tracking-[1px] font-['Space_Grotesk',sans-serif] mb-0.5">Dmg Dealt</p>
                      <p className="text-amber-400 text-[16px] font-semibold leading-tight">{stats?.combatantStats?.[mvp.id]?.damageDone ?? 0}</p>
                      <div className="h-[2px] bg-surface-container rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${((stats?.combatantStats?.[mvp.id]?.damageDone ?? 0) / maxDamageAllPlayers) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-on-surface-variant text-[9px] uppercase tracking-[1px] font-['Space_Grotesk',sans-serif] mb-0.5">Dmg Taken</p>
                      <p className="text-on-surface text-[16px] font-semibold leading-tight">{stats?.combatantStats?.[mvp.id]?.damageTaken ?? (mvp.hp.max - mvp.hp.current)}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant text-[9px] uppercase tracking-[1px] font-['Space_Grotesk',sans-serif] mb-0.5">Healed</p>
                      <p className="text-emerald-400 text-[16px] font-semibold leading-tight">{stats?.combatantStats?.[mvp.id]?.healingDone ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant text-[9px] uppercase tracking-[1px] font-['Space_Grotesk',sans-serif] mb-0.5">Kills</p>
                      <p className="text-primary text-[16px] font-semibold leading-tight">{stats?.combatantStats?.[mvp.id]?.kills ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant text-[9px] uppercase tracking-[-0.5px] font-['Space_Grotesk',sans-serif]">Survivability</span>
                      <span className="text-primary text-[9px] font-['Space_Grotesk',sans-serif]">{hpPct(mvp)}%</span>
                    </div>
                    <div className="h-[4px] bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${hpPct(mvp)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other combatant cards */}
          {otherPlayers.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {otherPlayers.map(c => {
                const maxDmg = Math.max(1, ...sortedPlayers.map(x => stats?.combatantStats?.[x.id]?.damageDone ?? 0));
                const dmgPct = ((stats?.combatantStats?.[c.id]?.damageDone ?? 0) / maxDmg) * 100;
                return (
                <div key={c.id} className="bg-surface-container-low rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex gap-3 items-center">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-outline-variant/10 shrink-0">
                      <AvatarImg src={c.avatar} name={c.name} className="w-full h-full" />
                      {c.hp.current <= 0 && (
                        <div className="absolute inset-0 bg-error/20 flex items-end justify-center pb-0.5">
                          <span className="text-[7px] font-black uppercase text-red-300 bg-error/60 px-1 rounded-sm">Down</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-bold text-on-surface leading-tight font-['Space_Grotesk',sans-serif] truncate">{c.name}</h4>
                      <p className="text-[10px] uppercase tracking-[1px] text-on-surface-variant truncate">{c.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-on-surface-variant">HP</span>
                      <span className="text-[11px] font-semibold text-on-surface">{c.hp.current}<span className="text-on-surface-variant">/{c.hp.max}</span></span>
                    </div>
                    <div className="h-[3px] bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${hpPct(c)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-5 gap-2 border-t border-outline-variant/10 pt-1.5">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">Dealt</p>
                        <p className="text-[13px] font-semibold text-amber-400">{stats?.combatantStats?.[c.id]?.damageDone ?? 0}</p>
                        <div className="h-[2px] bg-surface-container-highest rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-amber-400/60 rounded-full" style={{ width: `${dmgPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">Taken</p>
                        <p className="text-[13px] font-semibold text-on-surface">{stats?.combatantStats?.[c.id]?.damageTaken ?? (c.hp.max - c.hp.current)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">Healed</p>
                        <p className="text-[13px] font-semibold text-emerald-400">{stats?.combatantStats?.[c.id]?.healingDone ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">Heal Rcv</p>
                        <p className="text-[13px] font-semibold text-emerald-300">{stats?.combatantStats?.[c.id]?.healingReceived ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">Kills</p>
                        <p className="text-[13px] font-semibold text-on-surface">{stats?.combatantStats?.[c.id]?.kills ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Combat Highlights */}
        <div className="lg:col-span-4">
          <div className="glass-panel rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-on-surface-variant" />
              <span className="text-[13px] font-bold uppercase tracking-[0.9px] text-on-surface-variant font-['Space_Grotesk',sans-serif]">
                Combat Highlights
              </span>
            </div>

            {highlights.length > 0 ? (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-2 bottom-4 w-[2px] bg-outline-variant/20" />

                <div className="flex flex-col gap-3">
                  {highlights.map((h, i) => {
                    const colors = DOT_COLORS[h.icon] ?? DOT_COLORS['Wind'];
                    return (
                      <div key={i} className="pl-6 relative">
                        {/* Dot */}
                        <div
                          className="absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-surface-container-lowest flex items-center justify-center"
                          style={{ backgroundColor: colors.dot }}
                        />
                        <p
                          className="text-[11px] font-semibold uppercase tracking-[-0.6px] leading-tight mb-0.5"
                          style={{ color: colors.label }}
                        >
                          {h.label}
                        </p>
                        <p className="text-[12px] text-on-surface/80 leading-snug">{h.value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-on-surface-variant italic">No highlights recorded.</p>
            )}

            {isDM && activeCampaignId && (
              <div className="border-t border-outline-variant/10 pt-3 flex flex-col gap-3">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Campaign Integration</p>
                
                {!showRecapForm ? (
                  <div className="space-y-2">
                    {sessions && sessions.length > 0 && (
                      <div className="flex gap-2">
                        <select
                          value={selectedSessionId}
                          onChange={e => setSelectedSessionId(e.target.value)}
                          className="flex-1 bg-surface-container border border-outline-variant/20 rounded px-2 py-1.5 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select Session...</option>
                          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button
                          onClick={handleAddToSession}
                          disabled={!selectedSessionId || addingToSession || isSuccess}
                          className="bg-primary text-on-primary px-3 py-1.5 rounded text-[12px] font-bold disabled:opacity-50 transition-all hover:bg-primary/80"
                        >
                          {isSuccess ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => { setShowRecapForm(true); generateRecap(); }}
                      className="w-full border border-dashed border-outline-variant/30 hover:border-primary rounded py-1.5 text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                      <Scroll className="w-3.5 h-3.5" />
                      Create Recap Session
                    </button>
                  </div>
                ) : (
                  <div className="bg-surface-container p-3 rounded border border-outline-variant/20 space-y-2">
                    <input
                      type="text"
                      value={recapName}
                      onChange={e => setRecapName(e.target.value)}
                      placeholder="Session Name"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1.5 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <textarea
                      value={recapNotes}
                      onChange={e => setRecapNotes(e.target.value)}
                      placeholder="Session Recap..."
                      rows={3}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1.5 text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateRecapSession}
                        disabled={addingToSession || !recapName.trim()}
                        className="flex-1 bg-primary text-[#002e69] rounded py-1.5 text-[11px] font-bold uppercase tracking-[1px]"
                      >
                        {addingToSession ? 'Creating...' : 'Save Recap'}
                      </button>
                      <button
                        onClick={() => setShowRecapForm(false)}
                        className="px-3 bg-surface-container-highest text-on-surface-variant rounded py-1.5 text-[11px] font-bold uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {isSuccess && <p className="text-[10px] text-[#4ade80] font-bold animate-pulse">Successfully updated campaign!</p>}
              </div>
            )}

            {isDM && (
              <button
                onClick={onClose}
                className="w-full bg-surface-container-highest rounded py-2 text-[12px] font-bold uppercase tracking-[1.2px] text-on-surface hover:bg-surface-container-high transition-colors font-['Space_Grotesk',sans-serif]"
              >
                Close Summary
              </button>
            )}
            {!isDM && (
              <p className="text-center text-on-surface-variant text-sm italic">Waiting for DM to close…</p>
            )}
          </div>
        </div>
      </div>

      {/* Damage by Type */}
      {stats?.damageByType && Object.keys(stats.damageByType).length > 0 && (() => {
        const DAMAGE_COLORS: Record<string, string> = {
          fire: '#f97316', cold: '#38bdf8', lightning: '#a78bfa', acid: '#84cc16',
          poison: '#4ade80', necrotic: '#818cf8', radiant: '#fbbf24', thunder: '#60a5fa',
          force: '#f472b6', psychic: '#e879f9', piercing: '#94a3b8', slashing: '#f87171',
          bludgeoning: '#fb923c', healing: '#4ade80',
        };
        const entries = Object.entries(stats.damageByType!).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, [, v]) => s + v, 0);
        return (
          <div className="mt-4 bg-surface-container rounded-lg p-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-on-surface-variant font-['Space_Grotesk',sans-serif] mb-3">
              Damage by Type
            </h2>
            <div className="text-[10px] text-on-surface-variant/60 font-semibold mb-1">Total: {total.toLocaleString()} dmg</div>
            <div className="flex gap-0.5 h-5 rounded-full overflow-hidden mb-3">
              {entries.map(([type, val]) => (
                <div
                  key={type}
                  className="h-full transition-all"
                  style={{ width: `${(val / total) * 100}%`, backgroundColor: DAMAGE_COLORS[type.toLowerCase()] ?? '#94a3b8' }}
                  title={`${type}: ${val}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {entries.map(([type, val]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DAMAGE_COLORS[type.toLowerCase()] ?? '#94a3b8' }} />
                  <span className="text-[11px] text-on-surface-variant capitalize">{type}</span>
                  <span className="text-[11px] font-semibold text-on-surface">{val}</span>
                  <span className="text-[10px] text-on-surface-variant/50">{Math.round((val / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Action Breakdown */}
      {stats?.actionStats && Object.keys(stats.actionStats).length > 0 && (() => {
        const entries = Object.values(stats.actionStats!);

        const topByDamage = [...entries]
          .sort((a, b) => b.totalDamage - a.totalDamage)
          .slice(0, 5)
          .filter(e => e.totalDamage > 0);

        const topByCount = [...entries]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const maxDamage = topByDamage[0]?.totalDamage ?? 1;

        const categoryColor = (cat: string) => {
          switch (cat) {
            case 'attack':  return 'bg-rose-900/60 text-rose-300';
            case 'spell':   return 'bg-violet-900/60 text-violet-300';
            case 'ability': return 'bg-amber-900/60 text-amber-300';
            default:        return 'bg-slate-700/60 text-slate-300';
          }
        };

        return (
          <div className="mt-4 bg-surface-container rounded-lg p-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[1px] text-on-surface-variant font-['Space_Grotesk',sans-serif] mb-3">
              Action Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {topByDamage.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant/60 tracking-widest mb-2">Top by Damage</p>
                  <div className="space-y-2">
                    {topByDamage.map((entry, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[12px] text-on-surface truncate">{entry.name}</span>
                            <span className={`text-[9px] font-bold px-1 rounded ${categoryColor(entry.category)}`}>{entry.category}</span>
                          </div>
                          <p className="text-[9px] text-on-surface-variant mb-1 truncate">{entry.actorName}</p>
                          <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div
                              className="h-full bg-error rounded-full"
                              style={{ width: `${(entry.totalDamage / maxDamage) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-on-surface/70 w-10 text-right shrink-0">{entry.totalDamage}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase font-bold text-on-surface-variant/60 tracking-widest mb-2">Top by Use Count</p>
                <div className="space-y-2">
                  {topByCount.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-on-surface truncate">{entry.name}</span>
                          <span className={`text-[9px] font-bold px-1 rounded ${categoryColor(entry.category)}`}>{entry.category}</span>
                        </div>
                        <p className="text-[9px] text-on-surface-variant truncate">{entry.actorName}</p>
                      </div>
                      <span className="text-[11px] font-mono text-primary shrink-0">{entry.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
