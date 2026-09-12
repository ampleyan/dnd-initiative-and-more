import { Combatant, EncounterWave, TurnLedgerInput, TurnLedgerItem } from '../types';

export function getCombatantLayout(cs: Combatant[]) {
  const mainSorted = cs.filter(c => !c.ownerId).sort((a, b) => b.initiative - a.initiative);
  const companionsByOwner = new Map<string, Combatant[]>();
  cs.filter(c => c.ownerId).forEach(c => {
    if (!companionsByOwner.has(c.ownerId!)) companionsByOwner.set(c.ownerId!, []);
    companionsByOwner.get(c.ownerId!)!.push(c);
  });
  const allSorted = mainSorted.flatMap(c => [c, ...(companionsByOwner.get(c.id) ?? [])]);
  return { mainSorted, companionsByOwner, allSorted };
}

export function sortWithCompanions(cs: Combatant[]): Combatant[] {
  return getCombatantLayout(cs).allSorted;
}

/**
 * Apply damage to a combatant, accounting for temp HP and (for players) death saves.
 * D&D 5e: damage taken while at 0 HP is an automatic death save failure;
 * the third failure kills the character.
 * Returns { updated, actualDamage } where actualDamage is post-tempHP absorption.
 */
function matchesDamageType(values: string[] | undefined, damageType?: string) {
  if (!damageType) return false;
  const type = damageType.toLowerCase();
  return (values ?? []).some(value => value.toLowerCase().includes(type));
}

export function applyDamage(c: Combatant, amount: number, damageType?: string): { updated: Combatant; actualDamage: number } {
  const immune = matchesDamageType(c.damageImmunities, damageType);
  const vulnerable = matchesDamageType(c.vulnerabilities, damageType);
  const resistant = matchesDamageType(c.resistances, damageType);
  const adjustedAmount = immune ? 0 : vulnerable && !resistant ? amount * 2 : resistant && !vulnerable ? Math.floor(amount / 2) : amount;
  const tempHp = c.tempHp ?? 0;
  const tempAbsorb = Math.min(tempHp, adjustedAmount);
  const newTemp = tempHp - tempAbsorb;
  const newCurrent = Math.max(0, c.hp.current - (adjustedAmount - tempAbsorb));
  const actualDamage = adjustedAmount - tempAbsorb;
  const wasDown = c.hp.current === 0;
  let updated: Combatant = { ...c, hp: { ...c.hp, current: newCurrent }, tempHp: newTemp };
  if (c.type === 'player') {
    if (wasDown && c.deathSaves && !c.deathSaves.stable) {
      const failures = Math.min(3, c.deathSaves.failures + 1);
      updated = { ...updated, deathSaves: { ...c.deathSaves, failures } };
      if (failures >= 3) {
        updated = { ...updated, tags: [...c.tags.filter(t => t !== 'dead'), 'dead'] };
      }
    } else if (newCurrent === 0 && !c.deathSaves) {
      updated = { ...updated, deathSaves: { successes: 0, failures: 0, stable: false } };
    }
  }
  return { updated, actualDamage };
}

/**
 * Apply healing. Heal above 0 HP clears death saves and the 'dead' tag.
 */
export function applyHeal(c: Combatant, amount: number): Combatant {
  const newCurrent = Math.min(c.hp.max, c.hp.current + amount);
  let updated: Combatant = { ...c, hp: { ...c.hp, current: newCurrent } };
  if (newCurrent > 0 && (c.deathSaves || c.tags.includes('dead'))) {
    updated = { ...updated, deathSaves: undefined, tags: c.tags.filter(t => t !== 'dead') };
  }
  return updated;
}

export function getSpellSaveDc(combatant: Combatant): number | null {
  const allText = [...(combatant.abilities ?? []), ...(combatant.actions ?? []), ...(combatant.spells ?? [])]
    .map(a => a.description).join(' ');
  const m = allText.match(/spell save dc (\d+)/i);
  return m ? Number(m[1]) : null;
}

export function getDisplayNames(combatants: Combatant[]): Map<string, string> {
  const nameCounts = new Map<string, number>();
  combatants.forEach(c => nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1));

  const nameIndices = new Map<string, number>();
  const result = new Map<string, string>();
  combatants.forEach(c => {
    if (nameCounts.get(c.name)! > 1) {
      const idx = (nameIndices.get(c.name) ?? 0) + 1;
      nameIndices.set(c.name, idx);
      result.set(c.id, `${c.name} #${idx}`);
    } else {
      result.set(c.id, c.name);
    }
  });
  return result;
}

/**
 * Resets legendary action charges to max when a combatant's turn starts.
 * Returns the same object reference if no legendary actions are defined.
 */
export function applyTurnStart(combatant: Combatant): Combatant {
  if (!combatant.legendaryActions) return combatant;
  return {
    ...combatant,
    legendaryActions: { ...combatant.legendaryActions, remaining: combatant.legendaryActions.max },
  };
}

/**
 * Returns true if the transition from sorted[currentIndex] to sorted[nextIndex]
 * crosses initiative count 20 — the trigger for a lair action reminder.
 *
 * Fires in two cases:
 * 1. Normal crossing: currentIndex's initiative > 20 AND nextIndex's initiative ≤ 20.
 * 2. Round wrap (nextIndex === 0): any combatant has initiative ≤ 20, meaning the
 *    initiative-20 window existed somewhere in the round.
 */
export function shouldTriggerLairAction(
  sorted: Combatant[],
  currentIndex: number,
  nextIndex: number,
): boolean {
  if (nextIndex === 0) {
    return sorted.some(c => c.initiative <= 20);
  }
  const endingInit = sorted[currentIndex]?.initiative ?? 0;
  const nextInit = sorted[nextIndex]?.initiative ?? 0;
  return endingInit > 20 && nextInit <= 20;
}

export function deriveTurnReminders(combatant: Combatant, sorted: Combatant[] = [], currentIndex = 0, lairActionsEnabled = false): string[] {
  const reminders: string[] = [];
  if (combatant.concentratingOn) reminders.push(`Maintain concentration: ${combatant.concentratingOn}`);
  const expiring = combatant.conditions.filter(condition => (combatant.conditionTimers?.[condition] ?? Infinity) <= 1);
  if (expiring.length) reminders.push(`Expires at turn end: ${expiring.join(', ')}`);
  if (combatant.legendaryActions && combatant.legendaryActions.remaining === combatant.legendaryActions.max) reminders.push(`Legendary actions restored: ${combatant.legendaryActions.remaining}`);
  const nextIndex = sorted.length ? (currentIndex + 1) % sorted.length : 0;
  if (lairActionsEnabled && shouldTriggerLairAction(sorted, currentIndex, nextIndex)) reminders.push('Lair action at initiative 20');
  return reminders;
}

export function evaluateWaveAvailability(
  waves: EncounterWave[],
  combatants: Combatant[],
  round: number,
): EncounterWave[] {
  return waves.map(wave => {
    const kind = wave.trigger?.kind;

    if (!kind || kind === 'round') {
      const available = wave.revealRound !== undefined ? round >= wave.revealRound : true;
      return { ...wave, available };
    }

    if (kind === 'manual') {
      return { ...wave, available: true };
    }

    if (kind === 'boss-bloodied') {
      const targetId = wave.trigger!.combatantId;
      const bosses = combatants.filter(c => c.legendaryActions && (!targetId || c.id === targetId));
      const available = bosses.some(c => c.hp.current > 0 && c.hp.current <= c.hp.max / 2);
      return { ...wave, available };
    }

    if (kind === 'combatant-defeated') {
      const targetId = wave.trigger!.combatantId;
      if (targetId) {
        const target = combatants.find(c => c.id === targetId);
        return { ...wave, available: target !== undefined && target.hp.current <= 0 };
      }
      const available = combatants.some(c => c.type !== 'player' && c.hp.current <= 0);
      return { ...wave, available };
    }

    return { ...wave, available: false };
  });
}

export function deriveTurnLedger({ combatants, currentTurnIndex, currentRound, lairActionsEnabled = false }: TurnLedgerInput): TurnLedgerItem[] {
  const current = combatants[currentTurnIndex];
  if (!current) return [];

  const items: TurnLedgerItem[] = [];
  if (current.legendaryActions && current.legendaryActions.remaining === current.legendaryActions.max) {
    items.push({ id: `${current.id}:legendary-actions`, phase: 'start', severity: 'info', label: `Legendary actions restored: ${current.legendaryActions.remaining}`, combatantId: current.id });
  }
  if (current.concentratingOn) {
    items.push({ id: `${current.id}:concentration`, phase: 'current', severity: 'attention', label: `Maintain concentration: ${current.concentratingOn}`, combatantId: current.id });
  }
  if (current.reactionUsed) {
    items.push({ id: `${current.id}:reaction`, phase: 'current', severity: 'info', label: 'Reaction used', combatantId: current.id });
  }
  for (const condition of current.conditions) {
    if ((current.conditionTimers?.[condition] ?? Infinity) <= 1) {
      items.push({ id: `${current.id}:${condition}`, phase: 'end', severity: 'attention', label: `Expires at turn end: ${condition}`, combatantId: current.id });
    }
  }
  const nextIndex = combatants.length ? (currentTurnIndex + 1) % combatants.length : 0;
  if (lairActionsEnabled && shouldTriggerLairAction(combatants, currentTurnIndex, nextIndex)) {
    items.push({ id: `lair:${currentRound}:${currentTurnIndex}`, phase: 'crossing', severity: 'attention', label: 'Lair action at initiative 20' });
  }
  return items;
}
