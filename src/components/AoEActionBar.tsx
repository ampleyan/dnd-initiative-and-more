import React, { useState } from 'react';
import { Zap, Heart, X, Target, Shield, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Combatant } from '../types';
import { CONDITIONS } from '../constants';

interface AoEActionBarProps {
  selectedCombatants: Combatant[];
  onApply: (updates: Combatant[]) => void;
  onApplyKeepSelection: (updates: Combatant[]) => void;
  onClear: () => void;
  onPerTarget: () => void;
}

export const AoEActionBar: React.FC<AoEActionBarProps> = ({
  selectedCombatants, onApply, onApplyKeepSelection, onClear, onPerTarget,
}) => {
  const [value, setValue] = useState('');
  const [halfDamage, setHalfDamage] = useState(false);
  const [showConditions, setShowConditions] = useState(false);

  const count = selectedCombatants.length;

  const applyDamage = () => {
    const raw = parseInt(value) || 0;
    if (raw <= 0) return;
    const amount = halfDamage ? Math.floor(raw / 2) : raw;
    const updated = selectedCombatants.map(c => {
      const tempAbsorb = Math.min(c.tempHp ?? 0, amount);
      const newTemp = (c.tempHp ?? 0) - tempAbsorb;
      const newHp = Math.max(0, c.hp.current - (amount - tempAbsorb));
      return { ...c, hp: { ...c.hp, current: newHp }, tempHp: newTemp };
    });
    onApply(updated);
    setValue('');
  };

  const applyHeal = () => {
    const amount = parseInt(value) || 0;
    if (amount <= 0) return;
    const updated = selectedCombatants.map(c => ({
      ...c,
      hp: { ...c.hp, current: Math.min(c.hp.max, c.hp.current + amount) },
    }));
    onApply(updated);
    setValue('');
  };

  const applyTempHp = () => {
    const amount = parseInt(value) || 0;
    if (amount <= 0) return;
    const updated = selectedCombatants.map(c => ({
      ...c,
      tempHp: Math.max(c.tempHp ?? 0, amount),
    }));
    onApplyKeepSelection(updated);
    setValue('');
  };

  const toggleCondition = (conditionId: string) => {
    const allHave = selectedCombatants.every(c => c.conditions.includes(conditionId));
    const updated = selectedCombatants.map(c => ({
      ...c,
      conditions: allHave
        ? c.conditions.filter(id => id !== conditionId)
        : c.conditions.includes(conditionId) ? c.conditions : [...c.conditions, conditionId],
    }));
    onApplyKeepSelection(updated);
  };

  const conditionActiveCount = (conditionId: string) =>
    selectedCombatants.filter(c => c.conditions.includes(conditionId)).length;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 bg-[#0f1419] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl max-w-3xl"
        >
          <AnimatePresence>
            {showConditions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 justify-center w-full pb-2 border-b border-white/10 overflow-hidden"
              >
                {CONDITIONS.map(cond => {
                  const activeCount = conditionActiveCount(cond.id);
                  const allActive = activeCount === count;
                  const someActive = activeCount > 0 && !allActive;
                  return (
                    <button
                      key={cond.id}
                      onClick={() => toggleCondition(cond.id)}
                      title={cond.description}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                        allActive
                          ? `${cond.color} text-white border-transparent`
                          : someActive
                          ? 'bg-white/10 text-white/70 border-white/20'
                          : 'bg-white/5 text-outline border-white/10 hover:border-white/30 hover:text-on-surface'
                      }`}
                    >
                      {cond.name}{someActive ? ` (${activeCount}/${count})` : ''}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="text-xs font-bold text-primary mr-1">{count} selected</span>

            <input
              type="number"
              min="0"
              className="w-20 bg-surface-container-high border-none rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-1 focus:ring-primary"
              placeholder="Amt"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyDamage()}
            />

            <label className="flex items-center gap-1.5 text-xs text-outline cursor-pointer select-none">
              <input
                type="checkbox"
                checked={halfDamage}
                onChange={e => setHalfDamage(e.target.checked)}
                className="accent-primary w-3.5 h-3.5"
              />
              ½ dmg
            </label>

            <button
              onClick={applyDamage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-error text-on-error rounded-xl font-bold text-xs hover:bg-error/90 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> Damage
            </button>

            <button
              onClick={applyHeal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-500 transition-colors"
            >
              <Heart className="w-3.5 h-3.5" /> Heal
            </button>

            <button
              onClick={applyTempHp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 text-white rounded-xl font-bold text-xs hover:bg-sky-600 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> Temp HP
            </button>

            <div className="w-px h-5 bg-white/10" />

            <button
              onClick={() => setShowConditions(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                showConditions
                  ? 'bg-violet-600 text-white'
                  : 'bg-surface-container-high border border-outline/20 text-outline hover:text-on-surface'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Conditions
            </button>

            <button
              onClick={onPerTarget}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high border border-outline/20 text-outline hover:text-on-surface rounded-xl font-bold text-xs transition-colors"
              title="Assign different values to each target"
            >
              <Target className="w-3.5 h-3.5" /> Per-target
            </button>

            <button
              onClick={onClear}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
