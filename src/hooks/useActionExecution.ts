import { useCallback, useState } from 'react';
import type { Combatant, LogEntry, MonsterAction, Spell } from '../types';
import { applyDamage, applyHeal } from '../lib/combatantUtils';

export interface ActionApplication {
  targetIds: string[];
  effect: 'damage' | 'heal' | 'none';
  amount: number;
  amountPerTarget?: Record<string, number>;
  actionName: string;
  actionCategory: MonsterAction['category'];
  conditionsToAdd: string[];
  durationRounds?: number;
  applyConcentration: boolean;
  damageType?: string;
}

interface ActionExecutionParams {
  combatants: Combatant[];
  spells: Spell[];
  handleUpdateCombatant: (combatant: Combatant, damageType?: string, actionName?: string) => void;
  handleUpdateSpellSlot: (playerId: string, level: number, used: number) => void;
  triggerConCheck: (combatantId: string, dc: number) => void;
  addLogEntry: (entry: Omit<LogEntry, 'id' | 'round' | 'timestamp'>) => void;
}

export function useActionExecution({
  combatants,
  spells,
  handleUpdateCombatant,
  handleUpdateSpellSlot,
  triggerConCheck,
  addLogEntry,
}: ActionExecutionParams) {
  const [actionModal, setActionModal] = useState<{ action: MonsterAction; actor: Combatant } | null>(null);

  const openActionModal = useCallback((action: MonsterAction, actor: Combatant) => {
    setActionModal({ action, actor });
  }, []);

  const closeActionModal = useCallback(() => setActionModal(null), []);

  const handleActionApply = useCallback((params: ActionApplication) => {
    const { targetIds, effect, amount, amountPerTarget, actionName, actionCategory, conditionsToAdd, durationRounds, damageType } = params;
    const actorCombatant = actionModal?.actor;

    if (actorCombatant) {
      const spellLevel = actionCategory === 'spell'
        ? spells.find(spell => spell.name.toLowerCase() === actionName.toLowerCase())?.level
        : undefined;
      addLogEntry({
        type: actionCategory === 'spell' ? 'spell_cast' : 'action_used',
        actorName: actorCombatant.name,
        actorId: actorCombatant.id,
        actionName,
        actionCategory: actionCategory as LogEntry['actionCategory'],
        detail: spellLevel != null ? String(spellLevel) : undefined,
      });
    }

    const pending = new Map<string, Combatant>(combatants.map(combatant => [combatant.id, { ...combatant }]));

    if (params.applyConcentration && actorCombatant) {
      const actor = pending.get(actorCombatant.id);
      if (actor?.concentratingOn) {
        addLogEntry({
          type: 'concentration_end',
          actorName: actorCombatant.name,
          actorId: actorCombatant.id,
          detail: actor.concentratingOn,
        });
        if (actor.concentrationTargets) {
          for (const [targetId, appliedConditions] of Object.entries(actor.concentrationTargets)) {
            const target = pending.get(targetId);
            if (!target || appliedConditions.length === 0) continue;
            const conditions = target.conditions.filter(condition => !appliedConditions.includes(condition));
            const conditionTimers = { ...(target.conditionTimers ?? {}) };
            appliedConditions.forEach(condition => { delete conditionTimers[condition]; });
            pending.set(targetId, { ...target, conditions, conditionTimers: Object.keys(conditionTimers).length > 0 ? conditionTimers : undefined });
          }
        }
      }
    }

    const newConcentrationTargets: Record<string, string[]> = {};

    for (const targetId of targetIds) {
      const target = pending.get(targetId);
      if (!target) continue;

      let updated: Combatant = { ...target };
      const targetAmount = amountPerTarget ? (amountPerTarget[targetId] ?? 0) : amount;
      if (effect === 'damage' && targetAmount > 0) {
        const result = applyDamage(target, targetAmount, damageType);
        updated = result.updated;
        if (target.concentratingOn && result.actualDamage > 0) {
          triggerConCheck(targetId, Math.max(10, Math.floor(result.actualDamage / 2)));
        }
      } else if (effect === 'heal' && targetAmount > 0) {
        updated = applyHeal(target, targetAmount);
      }

      if (conditionsToAdd.length > 0) {
        const applicableConditions = conditionsToAdd.filter(condition =>
          !(target.conditionImmunities ?? []).some(immunity => immunity.toLowerCase().includes(condition.toLowerCase()))
        );
        const existing = new Set(updated.conditions);
        applicableConditions.forEach(condition => existing.add(condition));
        const timers = { ...(updated.conditionTimers ?? {}) };
        if (durationRounds && durationRounds > 0) applicableConditions.forEach(condition => { timers[condition] = durationRounds; });
        updated = { ...updated, conditions: [...existing], conditionTimers: Object.keys(timers).length > 0 ? timers : updated.conditionTimers };
        if (params.applyConcentration && applicableConditions.length > 0) newConcentrationTargets[targetId] = applicableConditions;
      }

      pending.set(targetId, updated);
    }

    if (params.applyConcentration && actorCombatant) {
      const actor = pending.get(actorCombatant.id);
      if (actor) {
        const newConditions = [...actor.conditions.filter(condition => condition !== 'concentrating'), 'concentrating'];
        const timers = { ...(actor.conditionTimers ?? {}) };
        if (durationRounds && durationRounds > 0) timers.concentrating = durationRounds;
        pending.set(actor.id, { ...actor, conditions: newConditions, conditionTimers: Object.keys(timers).length > 0 ? timers : actor.conditionTimers, concentratingOn: actionName, concentrationTargets: newConcentrationTargets });
        addLogEntry({ type: 'concentration_start', actorName: actorCombatant.name, actorId: actorCombatant.id, detail: actionName });
      }
    }

    if (actionCategory === 'ability' && actorCombatant?.type === 'player') {
      const actor = pending.get(actorCombatant.id);
      const entry = actor?.featureUses
        ? Object.entries(actor.featureUses).find(([, feature]) => feature.name.toLowerCase() === actionName.toLowerCase() && feature.used < feature.total)
        : undefined;
      if (actor && entry) {
        const [featureId, feature] = entry;
        pending.set(actor.id, {
          ...actor,
          featureUses: { ...actor.featureUses, [featureId]: { ...feature, used: feature.used + 1 } },
        });
      }
    }

    for (const [id, updated] of pending) {
      const original = combatants.find(combatant => combatant.id === id);
      if (original && JSON.stringify(original) !== JSON.stringify(updated)) {
        const isDamageTarget = effect === 'damage' && targetIds.includes(id);
        handleUpdateCombatant(updated, isDamageTarget ? damageType : undefined, actionName);
      }
    }

    if (params.actionCategory === 'spell' && actorCombatant?.type === 'player' && actorCombatant.playerId) {
      const spell = spells.find(candidate => candidate.name.toLowerCase() === params.actionName.toLowerCase());
      if (spell && spell.level > 0) {
        const slot = actorCombatant.spellSlots?.[spell.level];
        if (slot && slot.used < slot.total) handleUpdateSpellSlot(actorCombatant.playerId, spell.level, slot.used + 1);
      }
    }

    closeActionModal();
  }, [actionModal, addLogEntry, closeActionModal, combatants, handleUpdateCombatant, handleUpdateSpellSlot, spells, triggerConCheck]);

  return { actionModal, openActionModal, closeActionModal, handleActionApply };
}
