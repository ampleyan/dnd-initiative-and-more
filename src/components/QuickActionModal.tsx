import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Combatant } from '../types';
import { applyDamage, applyHeal } from '../lib/combatantUtils';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatant: Combatant | null;
  onUpdate: (updated: Combatant) => void;
  displayName?: string;
  onConcentrationCheck?: (dc: number) => void;
  initialMode?: 'damage' | 'heal' | 'tempHp';
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  combatant,
  onUpdate,
  displayName,
  onConcentrationCheck,
  initialMode,
}) => {
  const [value, setValue] = useState<string>('');
  const [tempValue, setTempValue] = useState<string>('');
  const [initValue, setInitValue] = useState<string>('');
  const tempInputRef = useRef<HTMLInputElement>(null);
  const damageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (combatant) {
      setInitValue(combatant.initiative.toString());
      setValue('');
      setTempValue('');
    }
  }, [combatant]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      if (initialMode === 'tempHp') tempInputRef.current?.focus();
      else damageInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen, initialMode]);

  if (!combatant) return null;

  const currentTemp = combatant.tempHp ?? 0;

  const handleDamage = () => {
    const amount = parseInt(value) || 0;
    if (amount <= 0) return;
    const { updated, actualDamage } = applyDamage(combatant, amount);
    onUpdate(updated);
    if (combatant.concentratingOn && actualDamage > 0) {
      onConcentrationCheck?.(Math.max(10, Math.floor(actualDamage / 2)));
    }
    setValue('');
    onClose();
  };

  const handleHeal = () => {
    const amount = parseInt(value) || 0;
    if (amount <= 0) return;
    onUpdate(applyHeal(combatant, amount));
    setValue('');
    onClose();
  };

  const handleAddTempHp = () => {
    const amount = parseInt(tempValue) || 0;
    const newTemp = Math.max(currentTemp, amount);
    onUpdate({ ...combatant, tempHp: newTemp });
    setTempValue('');
    onClose();
  };

  const handleInitChange = () => {
    const newInit = parseInt(initValue) || 0;
    onUpdate({ ...combatant, initiative: newInit });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Quick Actions: ${displayName ?? combatant.name}`}>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-bold text-outline">Damage / Healing</label>
            {currentTemp > 0 && (
              <span className="text-[10px] font-bold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full">
                {currentTemp} Temp HP
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={damageInputRef}
              type="number"
              className="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
              placeholder="Amount..."
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (initialMode === 'heal' ? handleHeal() : handleDamage())}
            />
            {initialMode !== 'heal' && (
              <button onClick={handleDamage} className="px-4 py-2 bg-error text-on-error rounded-lg font-bold text-xs hover:bg-error/90 transition-colors">
                Damage
              </button>
            )}
            {initialMode !== 'damage' && (
              <button onClick={handleHeal} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-500 transition-colors">
                Heal
              </button>
            )}
          </div>
          {currentTemp > 0 && (
            <p className="text-[10px] text-sky-400/70 italic">Damage will consume Temp HP first</p>
          )}
        </div>

        <div className="space-y-3 pt-4 border-t border-outline-variant/10">
          <label className="text-[10px] uppercase font-bold text-outline">Temporary HP</label>
          <div className="flex gap-2">
            <input
              ref={tempInputRef}
              type="number"
              className="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-sky-400"
              placeholder="Amount..."
              value={tempValue}
              onChange={e => setTempValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTempHp()}
            />
            <button onClick={handleAddTempHp} className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-lg font-bold text-xs hover:bg-sky-500/30 transition-colors border border-sky-500/20">
              Set Temp HP
            </button>
            {currentTemp > 0 && (
              <button onClick={() => { onUpdate({ ...combatant, tempHp: 0 }); onClose(); }} className="px-3 py-2 bg-surface-container-high text-outline rounded-lg font-bold text-xs hover:text-on-surface transition-colors">
                Clear
              </button>
            )}
          </div>
          <p className="text-[10px] text-outline/60">Takes the higher value if you already have Temp HP</p>
        </div>

        <div className="space-y-3 pt-4 border-t border-outline-variant/10">
          <label className="text-[10px] uppercase font-bold text-outline">Change Initiative</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
              value={initValue}
              onChange={e => setInitValue(e.target.value)}
            />
            <button onClick={handleInitChange} className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-lg font-bold text-xs hover:bg-surface-bright transition-colors">
              Update
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
