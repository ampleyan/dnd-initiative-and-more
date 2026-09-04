import React, { useState, useEffect } from 'react';
import { Zap, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Combatant } from '../types';
import { AvatarImg } from './AvatarImg';
import { applyDamage, applyHeal } from '../lib/combatantUtils';

interface MultiTargetDamageModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatants: Combatant[];
  onApply: (updates: Combatant[]) => void;
}

export const MultiTargetDamageModal: React.FC<MultiTargetDamageModalProps> = ({
  isOpen,
  onClose,
  combatants,
  onApply,
}) => {
  const [mode, setMode] = useState<'damage' | 'heal'>('damage');
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      const init: Record<string, string> = {};
      combatants.forEach(c => { init[c.id] = ''; });
      setValues(init);
      setMode('damage');
    }
  }, [isOpen, combatants]);

  if (!isOpen) return null;

  const preview = (c: Combatant): number => {
    const amount = parseInt(values[c.id] ?? '') || 0;
    if (amount <= 0) return c.hp.current;
    if (mode === 'damage') {
      const tempAbsorb = Math.min(c.tempHp ?? 0, amount);
      return Math.max(0, c.hp.current - (amount - tempAbsorb));
    }
    return Math.min(c.hp.max, c.hp.current + amount);
  };

  const handleApply = () => {
    const updated = combatants
      .map(c => {
        const amount = parseInt(values[c.id] ?? '') || 0;
        if (amount <= 0) return null;
        return mode === 'damage' ? applyDamage(c, amount).updated : applyHeal(c, amount);
      })
      .filter(Boolean) as Combatant[];
    if (updated.length > 0) onApply(updated);
    onClose();
  };

  const anyFilled = combatants.some(c => parseInt(values[c.id] ?? '') > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-[#0f1419] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-headline font-bold text-on-surface">Per-Target</h2>
              <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
                <button
                  onClick={() => setMode('damage')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${mode === 'damage' ? 'bg-error text-on-error' : 'text-outline hover:text-on-surface'}`}
                >
                  <Zap className="w-3 h-3" /> Damage
                </button>
                <button
                  onClick={() => setMode('heal')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${mode === 'heal' ? 'bg-emerald-600 text-white' : 'text-outline hover:text-on-surface'}`}
                >
                  <Heart className="w-3 h-3" /> Heal
                </button>
              </div>
            </div>

            {/* Combatant rows */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {combatants.map(c => {
                const newHp = preview(c);
                const amount = parseInt(values[c.id] ?? '') || 0;
                const changed = amount > 0;
                const hpPct = Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100));
                const newPct = Math.max(0, Math.min(100, (newHp / c.hp.max) * 100));

                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <AvatarImg src={c.avatar} name={c.name} className="w-8 h-8 rounded-lg border border-white/10 shrink-0 text-xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface leading-none truncate mb-1.5">{c.name}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              mode === 'damage' ? 'bg-primary' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-outline shrink-0">
                          {c.hp.current}
                          {changed && (
                            <span className={mode === 'damage' ? 'text-error' : 'text-emerald-400'}>
                              {' '}→ {newHp}
                            </span>
                          )}
                          <span className="text-outline/40">/{c.hp.max}</span>
                        </span>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={values[c.id] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [c.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleApply()}
                      className="w-16 bg-surface-container-high border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary/50 shrink-0"
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-white/8">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-white/10 text-outline hover:text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!anyFilled}
                className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  mode === 'damage'
                    ? 'bg-error text-on-error hover:bg-error/90'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {mode === 'damage' ? <Zap className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                Apply All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
