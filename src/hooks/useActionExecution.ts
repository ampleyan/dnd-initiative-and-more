import { useCallback, useState } from 'react';
import type { Combatant, LogEntry, MonsterAction, Spell } from '../types';

export interface ActionApplication {
  targetIds: string[];
  effect: 'damage' | 'heal' | 'none';
  amount: number;
  amountPerTarget?: Record<string, number>;
  actionName: string;
  actionCategory: MonsterAction['category'];
  conditionsToAdd: string[];
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
    const { targetIds, effect, amount, amountPerTarget, actionName, actionCategory, conditionsToAdd, damageType } = params;
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
            pending.set(targetId, { ...target, conditions: target.conditions.filter(condition => !appliedConditions.includes(condition)) });
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
        const tempAbsorb = Math.min(target.tempHp ?? 0, targetAmount);
        const newTemp = (target.tempHp ?? 0) - tempAbsorb;
        const actualDamage = targetAmount - tempAbsorb;
        const newHp = Math.max(0, target.hp.current - actualDamage);
        updated = { ...updated, hp: { ...target.hp, current: newHp }, tempHp: newTemp };
        if (target.concentratingOn && actualDamage > 0) {
          triggerConCheck(targetId, Math.max(10, Math.floor(actualDamage / 2)));
        }
      } else if (effect === 'heal' && targetAmount > 0) {
        const newHp = Math.min(target.hp.max, target.hp.current + targetAmount);
        updated = { ...updated, hp: { ...target.hp, current: newHp } };
      }

      if (conditionsToAdd.length > 0) {
        const existing = new Set(updated.conditions);
        conditionsToAdd.forEach(condition => existing.add(condition));
        updated = { ...updated, conditions: [...existing] };
        if (params.applyConcentration) newConcentrationTargets[targetId] = conditionsToAdd;
      }

      pending.set(targetId, updated);
    }

    if (params.applyConcentration && actorCombatant) {
      const actor = pending.get(actorCombatant.id);
      if (actor) {
        const newConditions = [...actor.conditions.filter(condition => condition !== 'concentrating'), 'concentrating'];
        pending.set(actor.id, { ...actor, conditions: newConditions, concentratingOn: actionName, concentrationTargets: newConcentrationTargets });
        addLogEntry({ type: 'concentration_start', actorName: actorCombatant.name, actorId: actorCombatant.id, detail: actionName });
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
