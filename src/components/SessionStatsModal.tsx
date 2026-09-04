import React, { useEffect, useState } from 'react';
import { X, Swords, Clock, Shield, TrendingUp, Skull, Heart } from 'lucide-react';
import { EncounterStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client';

interface SessionEncounter {
  id: string;
  name: string;
  completedAt: string;
  stats: EncounterStats | null;
}

interface SessionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const SessionStatsModal: React.FC<SessionStatsModalProps> = ({ isOpen, onClose }) => {
  const [encounters, setEncounters] = useState<SessionEncounter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.sessionStats.get()
      .then(d => setEncounters((d as { encounters?: SessionEncounter[] }).encounters ?? []))
      .catch(() => setEncounters([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Aggregate across all encounters
  const totals = encounters.reduce(
    (acc, enc) => {
      const s = enc.stats;
      if (!s) return acc;
      acc.rounds += s.totalRounds ?? 0;
      acc.enemiesDefeated += s.enemiesDefeated ?? 0;
      acc.playersFallen += s.playersFallen ?? 0;
      const totalMs = (s.roundDurations ?? []).reduce((a, b) => a + b, 0);
      acc.totalMs += totalMs;
      if (s.combatantStats) {
        for (const [id, cs] of Object.entries(s.combatantStats)) {
          const e = acc.combatantStats[id] ?? { damageDone: 0, damageTaken: 0, healingReceived: 0, kills: 0, name: id };
          acc.combatantStats[id] = {
            name: cs.name || e.name,
            damageDone: e.damageDone + cs.damageDone,
            damageTaken: e.damageTaken + cs.damageTaken,
            healingReceived: e.healingReceived + cs.healingReceived,
            kills: e.kills + cs.kills,
          };
        }
      }
      return acc;
    },
    { rounds: 0, enemiesDefeated: 0, playersFallen: 0, totalMs: 0, combatantStats: {} as Record<string, { name: string; damageDone: number; damageTaken: number; healingReceived: number; kills: number }> }
  );

  // Per-encounter: resolve combatant names from first occurrence
  useEffect(() => {
    // backfill names from log entries if possible — skip for now, IDs are opaque
  }, [encounters]);

  const sortedPlayers = Object.entries(totals.combatantStats)
    .sort((a, b) => b[1].damageDone - a[1].damageDone);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#0f1419] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="font-headline font-bold text-on-surface text-lg">Session Stats</h2>
                <p className="text-[11px] text-outline">All sessions · {encounters.length} encounter{encounters.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 custom-scrollbar space-y-6">
              {loading && <p className="text-outline text-sm text-center py-8">Loading…</p>}
              {!loading && encounters.length === 0 && (
                <p className="text-outline text-sm text-center py-8 italic">No completed encounters yet.</p>
              )}

              {!loading && encounters.length > 0 && (
                <>
                  {/* Session totals */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Swords className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Encounters</span>
                      </div>
                      <p className="text-3xl font-headline font-bold text-on-surface">{encounters.length}</p>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Rounds</span>
                      </div>
                      <p className="text-3xl font-headline font-bold text-on-surface">{totals.rounds}</p>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Skull className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Defeated</span>
                      </div>
                      <p className="text-3xl font-headline font-bold text-on-surface">{totals.enemiesDefeated}</p>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Total Time</span>
                      </div>
                      <p className="text-3xl font-headline font-bold text-on-surface">{fmtDuration(totals.totalMs)}</p>
                    </div>
                  </div>

                  {/* Per-player totals */}
                  {sortedPlayers.length > 0 && (
                    <section>
                      <h3 className="text-[11px] uppercase tracking-widest text-outline font-bold mb-3">Combatant Totals</h3>
                      <div className="space-y-2">
                        {sortedPlayers.map(([id, cs]) => (
                          <div key={id} className="flex items-center gap-4 bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-3">
                            <span className="text-sm font-bold text-on-surface w-36 truncate shrink-0">{cs.name !== id ? cs.name : id.slice(0, 8)}</span>
                            <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Dealt</p>
                                <p className="text-sm font-bold text-red-400">{cs.damageDone}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Taken</p>
                                <p className="text-sm font-bold text-on-surface">{cs.damageTaken}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Healed</p>
                                <p className="text-sm font-bold text-emerald-400">{cs.healingReceived}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Kills</p>
                                <p className="text-sm font-bold text-primary">{cs.kills}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Per-encounter breakdown */}
                  <section>
                    <h3 className="text-[11px] uppercase tracking-widest text-outline font-bold mb-3">Encounter Breakdown</h3>
                    <div className="space-y-2">
                      {encounters.map(enc => {
                        const s = enc.stats;
                        const totalMs = (s?.roundDurations ?? []).reduce((a, b) => a + b, 0);
                        const avgMs = s?.roundDurations?.length ? totalMs / s.roundDurations.length : 0;
                        return (
                          <div key={enc.id} className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-on-surface">{enc.name}</span>
                              <span className="text-[10px] text-outline">{fmtTime(enc.completedAt)}</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Rounds</p>
                                <p className="text-xs font-bold text-on-surface">{s?.totalRounds ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Enemies</p>
                                <p className="text-xs font-bold text-on-surface">{s?.enemiesDefeated ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Fallen</p>
                                <p className="text-xs font-bold text-red-400">{s?.playersFallen ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Duration</p>
                                <p className="text-xs font-bold text-amber-400">{totalMs ? fmtDuration(totalMs) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-outline uppercase tracking-wider">Avg Round</p>
                                <p className="text-xs font-bold text-outline">{avgMs ? fmtDuration(avgMs) : '—'}</p>
                              </div>
                            </div>
                            {s?.roundDurations && s.roundDurations.length > 0 && (
                              <div className="mt-2 flex gap-1 flex-wrap">
                                {s.roundDurations.map((ms, i) => (
                                  <span key={i} className="text-[9px] bg-surface-container-high rounded px-1.5 py-0.5 text-outline">
                                    R{i + 1} {fmtDuration(ms)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
