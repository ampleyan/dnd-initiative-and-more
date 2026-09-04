import { Combatant } from '../types';

export function sortWithCompanions(cs: Combatant[]): Combatant[] {
  const mains = cs.filter(c => !c.ownerId).sort((a, b) => b.initiative - a.initiative);
  const byOwner = new Map<string, Combatant[]>();
  cs.filter(c => c.ownerId).forEach(c => {
    if (!byOwner.has(c.ownerId!)) byOwner.set(c.ownerId!, []);
    byOwner.get(c.ownerId!)!.push(c);
  });
  const result: Combatant[] = [];
  for (const c of mains) {
    result.push(c);
    result.push(...(byOwner.get(c.id) ?? []));
  }
  return result;
}

/**
 * Apply damage to a combatant, accounting for temp HP and (for players) death saves.
 * D&D 5e: damage taken while at 0 HP is an automatic death save failure;
 * the third failure kills the character.
 * Returns { updated, actualDamage } where actualDamage is post-tempHP absorption.
 */
export function applyDamage(c: Combatant, amount: number): { updated: Combatant; actualDamage: number } {
  const tempHp = c.tempHp ?? 0;
  const tempAbsorb = Math.min(tempHp, amount);
  const newTemp = tempHp - tempAbsorb;
  const newCurrent = Math.max(0, c.hp.current - (amount - tempAbsorb));
  const actualDamage = amount - tempAbsorb;
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
