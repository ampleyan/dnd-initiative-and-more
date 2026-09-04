import { Combatant, EncounterStats, LogEntry } from '../types';

export type CombatantTracking = Record<string, {
  damageTaken: number;
  healingReceived: number;
  damageDone: number;
  kills: number;
  name: string;
  type: string;
}>;

export function computeEncounterStats(
  combatants: Combatant[],
  rounds: number,
  tracking: CombatantTracking
): EncounterStats {
  const players = combatants.filter(c => c.type === 'player');
  const monsters = combatants.filter(c => (c.type === 'monster' || c.type === 'npc') && !c.isFriendly);

  const playersAlive = players.filter(c => c.hp.current > 0).length;
  const playersFallen = players.filter(c => c.hp.current <= 0).length;
  const enemiesDefeated = monsters.filter(c => c.hp.current <= 0).length;
  const enemiesEscaped = monsters.filter(c => c.hp.current > 0).length;

  const highlights: EncounterStats['highlights'] = [];

  if (playersFallen === 0 && players.length > 0) {
    highlights.push({ icon: 'Shield', label: 'Flawless Victory', value: 'No party members fell' });
  }
  if (playersFallen > 0) {
    const fallen = players.filter(c => c.hp.current <= 0).map(c => c.name).join(', ');
    highlights.push({ icon: 'Skull', label: 'Fell in Battle', value: fallen });
  }
  if (enemiesDefeated === monsters.length && monsters.length > 0) {
    highlights.push({ icon: 'Swords', label: 'Total Annihilation', value: 'All enemies defeated' });
  }
  if (enemiesEscaped > 0) {
    highlights.push({ icon: 'Wind', label: 'Enemies Escaped', value: `${enemiesEscaped} foe${enemiesEscaped > 1 ? 's' : ''} fled` });
  }

  const lowestHpPlayer = [...players].sort((a, b) => (a.hp.current / a.hp.max) - (b.hp.current / b.hp.max))[0];
  const closestCallRatio = lowestHpPlayer && lowestHpPlayer.hp.max > 0 ? lowestHpPlayer.hp.current / lowestHpPlayer.hp.max : 1;
  if (lowestHpPlayer && lowestHpPlayer.hp.current > 0 && closestCallRatio < 0.5) {
    highlights.push({ icon: 'Heart', label: 'Close Call', value: `${lowestHpPlayer.name} at ${lowestHpPlayer.hp.current}/${lowestHpPlayer.hp.max} HP` });
  }

  const highestHpPlayer = [...players].sort((a, b) => (b.hp.current / b.hp.max) - (a.hp.current / a.hp.max))[0];
  if (highestHpPlayer && highestHpPlayer.hp.current > 0 && players.length > 1) {
    highlights.push({ icon: 'Star', label: 'Top Survivor', value: `${highestHpPlayer.name} — ${highestHpPlayer.hp.current}/${highestHpPlayer.hp.max} HP remaining` });
  }

  const combatantStats: EncounterStats['combatantStats'] = {};
  for (const [id, t] of Object.entries(tracking)) {
    const c = combatants.find(c => c.id === id);
    combatantStats[id] = { name: c?.name ?? id, type: c?.type ?? 'player', ...t };
  }
  return { totalRounds: rounds, playersAlive, playersFallen, enemiesDefeated, enemiesEscaped, highlights, combatantStats };
}

export function enrichStatsFromLog(
  stats: EncounterStats,
  log: LogEntry[]
): EncounterStats {
  const deathSavePasses = log.filter(e => e.type === 'death_save_pass').length;
  const deathSaveNat20s = log.filter(e => e.type === 'death_save_nat20');
  const highlights = [...(stats.highlights ?? [])];
  if (deathSavePasses > 0) {
    highlights.push({ icon: 'Heart', label: 'Death Saves', value: `${deathSavePasses} save${deathSavePasses > 1 ? 's' : ''} passed` });
  }
  for (const entry of deathSaveNat20s) {
    highlights.push({ icon: 'Star', label: 'Back from the Brink', value: `${entry.actorName} rolled a Natural 20!` });
  }

  const actionStats: EncounterStats['actionStats'] = {};
  for (const entry of log) {
    if (!entry.actionName) continue;
    const key = `${entry.actorId ?? entry.actorName}::${entry.actionName}`;
    if (!actionStats[key]) {
      actionStats[key] = {
        name: entry.actionName,
        category: entry.actionCategory ?? 'custom',
        actorName: entry.actorName,
        totalDamage: 0,
        totalHealing: 0,
        count: 0,
      };
    }
    actionStats[key].count += 1;
    if (entry.type === 'damage') actionStats[key].totalDamage += entry.value ?? 0;
    if (entry.type === 'heal') actionStats[key].totalHealing += entry.value ?? 0;
  }

  const damageEntries = log.filter(e => e.type === 'damage' && (e.value ?? 0) > 0);
  if (damageEntries.length > 0) {
    const biggest = damageEntries.reduce((max, e) => (e.value ?? 0) > (max.value ?? 0) ? e : max);
    highlights.push({
      icon: 'Swords',
      label: 'Largest Hit',
      value: `${biggest.actorName} → ${biggest.targetName ?? '?'} for ${biggest.value}${biggest.actionName ? ` (${biggest.actionName})` : ''}`,
    });
  }

  const targetCounts: Record<string, { name: string; count: number }> = {};
  for (const entry of log.filter(e => e.type === 'damage' && e.targetId)) {
    const id = entry.targetId!;
    if (!targetCounts[id]) targetCounts[id] = { name: entry.targetName ?? id, count: 0 };
    targetCounts[id].count += 1;
  }
  const mostTargeted = Object.values(targetCounts).sort((a, b) => b.count - a.count)[0];
  if (mostTargeted && mostTargeted.count >= 2) {
    highlights.push({
      icon: 'Shield',
      label: 'Most Targeted',
      value: `${mostTargeted.name} — attacked ${mostTargeted.count} time${mostTargeted.count > 1 ? 's' : ''}`,
    });
  }

  const healingDoneById: Record<string, number> = {};
  for (const entry of log.filter(e => e.type === 'heal' && e.actorId)) {
    healingDoneById[entry.actorId!] = (healingDoneById[entry.actorId!] ?? 0) + (entry.value ?? 0);
  }

  const timesTargetedById: Record<string, number> = {};
  for (const entry of log.filter(e => e.type === 'damage' && e.targetId)) {
    timesTargetedById[entry.targetId!] = (timesTargetedById[entry.targetId!] ?? 0) + 1;
  }

  const combatantStats: EncounterStats['combatantStats'] = {};
  for (const [id, cs] of Object.entries(stats.combatantStats ?? {})) {
    combatantStats[id] = {
      ...cs,
      healingDone: healingDoneById[id] ?? 0,
      timesTargeted: timesTargetedById[id] ?? 0,
    };
  }
  for (const [id, healingDone] of Object.entries(healingDoneById)) {
    if (!combatantStats[id]) {
      const entry = log.find(e => e.actorId === id);
      combatantStats[id] = {
        name: entry?.actorName ?? id,
        type: 'player',
        damageTaken: 0,
        healingReceived: 0,
        damageDone: 0,
        kills: 0,
        healingDone,
        timesTargeted: timesTargetedById[id] ?? 0,
      };
    }
  }

  const damageByType: Record<string, number> = {};
  for (const entry of log.filter(e => e.type === 'damage' && e.damageType && (e.value ?? 0) > 0)) {
    const t = entry.damageType!;
    damageByType[t] = (damageByType[t] ?? 0) + (entry.value ?? 0);
  }

  return { ...stats, combatantStats: Object.keys(combatantStats).length > 0 ? combatantStats : stats.combatantStats, highlights, actionStats, damageByType };
}
