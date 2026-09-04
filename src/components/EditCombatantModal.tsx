import React, { useState, useEffect } from 'react';
import { Save, Trash2, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Modal } from './Modal';
import { Combatant, MonsterAction } from '../types';
import { CR_TABLE } from '../constants/crTable';

interface EditCombatantModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatant: Combatant | null;
  onSave: (updated: Combatant) => void;
  onDelete: (id: string) => void;
  displayName?: string;
}

const INPUT = 'w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50';
const LABEL = 'text-xs font-bold text-outline uppercase tracking-widest';

const CR_OPTIONS = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

function extractCrFromSubtitle(subtitle: string): string {
  const m = subtitle.match(/\bCR\s+([\d\/]+)/i);
  return m ? m[1] : '';
}

function setSubtitleCr(subtitle: string, newCr: string): string {
  if (/\bCR\s+[\d\/]+/i.test(subtitle)) return subtitle.replace(/\bCR\s+[\d\/]+/i, `CR ${newCr}`);
  return subtitle ? `${subtitle}, CR ${newCr}` : `CR ${newCr}`;
}

export const EditCombatantModal: React.FC<EditCombatantModalProps> = ({
  isOpen,
  onClose,
  combatant,
  onSave,
  onDelete,
  displayName,
}) => {
  const [formData, setFormData] = useState<Combatant | null>(null);
  const [prevCr, setPrevCr] = useState('');
  const [showCrBanner, setShowCrBanner] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [showBossSettings, setShowBossSettings] = useState(!!combatant?.legendaryActions);
  const [legendaryEnabled, setLegendaryEnabled] = useState(!!combatant?.legendaryActions);
  const [legendaryMax, setLegendaryMax] = useState(combatant?.legendaryActions?.max ?? 3);

  useEffect(() => {
    if (combatant) {
      setFormData({ ...combatant });
      const cr = extractCrFromSubtitle(combatant.subtitle);
      setPrevCr(cr);
      setShowCrBanner(false);
      setAutoFilled(false);
      setShowBossSettings(!!combatant.legendaryActions);
      setLegendaryEnabled(!!combatant.legendaryActions);
      setLegendaryMax(combatant.legendaryActions?.max ?? 3);
    }
  }, [combatant]);

  if (!formData) return null;

  const currentCr = extractCrFromSubtitle(formData.subtitle);

  const actions   = formData.actions   ?? [];
  const abilities = formData.abilities ?? [];
  const spells    = formData.spells    ?? [];

  const updateList = (
    key: 'actions' | 'abilities' | 'spells',
    index: number,
    field: keyof MonsterAction,
    value: string,
  ) => {
    const list = [...(formData[key] ?? [])];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, [key]: list });
  };

  const addItem = (key: 'actions' | 'abilities' | 'spells') => {
    const defaults: Record<typeof key, MonsterAction> = {
      actions:   { name: 'New Action',   description: '', category: 'attack' },
      abilities: { name: 'New Ability',  description: '', category: 'ability' },
      spells:    { name: 'New Spell',    description: 'Level 1', category: 'spell' },
    };
    setFormData({ ...formData, [key]: [...(formData[key] ?? []), defaults[key]] });
  };

  const removeItem = (key: 'actions' | 'abilities' | 'spells', index: number) => {
    setFormData({ ...formData, [key]: (formData[key] ?? []).filter((_, i) => i !== index) });
  };

  const handleApplyCr = () => {
    const newCrStats = CR_TABLE[currentCr];
    const oldCrStats = CR_TABLE[prevCr] || CR_TABLE['1'];
    if (!newCrStats) return;
    const hpRatio = ((newCrStats.hpMin + newCrStats.hpMax) / 2) / ((oldCrStats.hpMin + oldCrStats.hpMax) / 2);
    const acOffset = newCrStats.acSuggested - oldCrStats.acSuggested;
    const newMax = Math.max(1, Math.round(formData.hp.max * hpRatio));
    const newCurrent = Math.max(0, Math.round(formData.hp.current * hpRatio));
    setFormData({ ...formData, hp: { current: newCurrent, max: newMax }, ac: formData.ac + acOffset });
    setAutoFilled(true);
    setShowCrBanner(false);
    setPrevCr(currentCr);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${displayName ?? formData.name}`} size="xl">
      <div className="space-y-5">

        {/* Name + Subtitle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={LABEL}>Name</label>
            <input className={INPUT} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={LABEL}>Subtitle</label>
            <input className={INPUT} value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
          </div>
        </div>

        {/* CR field (monsters/NPCs only) */}
        {formData.type !== 'player' && (
          <div className="space-y-1">
            <label className={LABEL}>CR</label>
            <select
              className={INPUT}
              value={currentCr}
              onChange={e => {
                const newCr = e.target.value;
                const newSubtitle = setSubtitleCr(formData.subtitle, newCr);
                setFormData({ ...formData, subtitle: newSubtitle });
                if (newCr !== prevCr && CR_TABLE[newCr]) setShowCrBanner(true);
                else setShowCrBanner(false);
              }}
            >
              <option value="" disabled>Select CR</option>
              {CR_OPTIONS.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
            </select>
          </div>
        )}

        {/* CR scaling banner */}
        {showCrBanner && CR_TABLE[currentCr] && (
          <div className="flex items-center justify-between gap-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col">
              <span className="text-blue-400 text-xs font-bold">Scale stats to CR {currentCr}?</span>
              <span className="text-outline text-[10px]">Adjusts HP (ratio) and AC (offset) based on CR guidelines.</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleApplyCr} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors">Scale Now</button>
              <button onClick={() => { setShowCrBanner(false); setPrevCr(currentCr); }} className="px-3 py-1 bg-white/10 text-outline text-xs font-bold rounded-lg hover:bg-white/20 transition-colors">Ignore</button>
            </div>
          </div>
        )}

        {/* CR stat hints */}
        {formData.type !== 'player' && CR_TABLE[currentCr] && (
          <div className="flex gap-3 flex-wrap text-[10px] text-outline px-1">
            <span>Prof Bonus: <strong className="text-white">+{CR_TABLE[currentCr].profBonus}</strong></span>
            <span>Save DC: <strong className="text-white">{CR_TABLE[currentCr].saveDC}</strong></span>
            <span>XP: <strong className="text-white">{CR_TABLE[currentCr].xp.toLocaleString()}</strong></span>
          </div>
        )}

        {/* Avatar */}
        <div className="space-y-1">
          <label className={LABEL}>Avatar URL</label>
          <div className="flex gap-3 items-center">
            {formData.avatar && (
              <img src={formData.avatar} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface-container-high shrink-0" />
            )}
            <input className={`flex-1 ${INPUT.replace('w-full ', '')}`} value={formData.avatar || ''} onChange={e => setFormData({ ...formData, avatar: e.target.value })} placeholder="https://..." />
          </div>
        </div>

        {/* HP + AC + Speed */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className={LABEL}>Current HP</label>
            <input type="number" className={`${INPUT}${autoFilled ? ' ring-2 ring-blue-500/50' : ''}`} value={formData.hp.current} onChange={e => {
              const val = parseInt(e.target.value) || 0;
              setFormData({ ...formData, hp: { ...formData.hp, current: Math.max(0, Math.min(val, formData.hp.max)) } });
            }} />
          </div>
          <div className="space-y-1">
            <label className={LABEL}>Max HP</label>
            <input type="number" className={`${INPUT}${autoFilled ? ' ring-2 ring-blue-500/50' : ''}`} value={formData.hp.max} onChange={e => setFormData({ ...formData, hp: { ...formData.hp, max: parseInt(e.target.value) || 0 } })} />
          </div>
          <div className="space-y-1">
            <label className={LABEL}>Temp HP</label>
            <input type="number" className={INPUT} value={formData.tempHp ?? 0} onChange={e => setFormData({ ...formData, tempHp: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <label className={LABEL}>AC</label>
            <input type="number" className={`${INPUT}${autoFilled ? ' ring-2 ring-blue-500/50' : ''}`} value={formData.ac} onChange={e => setFormData({ ...formData, ac: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>Speed</label>
          <input className={INPUT} value={formData.speed ?? ''} onChange={e => setFormData({ ...formData, speed: e.target.value })} placeholder="30 ft." />
        </div>

        {/* Combat traits */}
        {formData.type !== 'player' && (
          <div className="space-y-2 pt-1 border-t border-outline-variant/10">
            <label className={LABEL}>Combat Traits <span className="font-normal text-outline/60 normal-case tracking-normal">(comma-separated)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { key: 'vulnerabilities',    label: 'Vulnerabilities',      color: 'text-rose-400' },
                { key: 'resistances',        label: 'Resistances',          color: 'text-sky-400' },
                { key: 'damageImmunities',   label: 'Damage Immunities',    color: 'text-purple-400' },
                { key: 'conditionImmunities',label: 'Condition Immunities', color: 'text-amber-400' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="space-y-1">
                  <label className={`${LABEL} ${color}`}>{label}</label>
                  <input
                    className={INPUT}
                    value={(formData[key] as string[] ?? []).join(', ')}
                    onChange={e => {
                      const vals = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setFormData({ ...formData, [key]: vals });
                    }}
                    placeholder="e.g. fire, cold"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ability scores */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.keys(formData.stats).map(stat => (
            <div key={stat} className="space-y-1">
              <label className={`${LABEL} block text-center`}>{stat}</label>
              <input
                type="number"
                className="w-full bg-surface-container-high border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-primary/50"
                value={formData.stats[stat as keyof typeof formData.stats]}
                onChange={e => setFormData({ ...formData, stats: { ...formData.stats, [stat]: parseInt(e.target.value) || 0 } })}
              />
            </div>
          ))}
        </div>

        {/* Abilities */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className={LABEL}>Abilities</label>
            <button onClick={() => addItem('abilities')} className="text-primary hover:text-primary/80 transition-colors">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {abilities.map((ability, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/ability">
                <button onClick={() => removeItem('abilities', idx)} className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/ability:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none" value={ability.name} onChange={e => updateList('abilities', idx, 'name', e.target.value)} placeholder="Ability Name" />
                <textarea className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 focus:outline-none resize-none" value={ability.description} onChange={e => updateList('abilities', idx, 'description', e.target.value)} placeholder="Ability Description" rows={2} />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className={LABEL}>Actions</label>
            <button onClick={() => addItem('actions')} className="text-primary hover:text-primary/80 transition-colors">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/action">
                <button onClick={() => removeItem('actions', idx)} className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/action:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none" value={action.name} onChange={e => updateList('actions', idx, 'name', e.target.value)} placeholder="Action Name" />
                <textarea className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 focus:outline-none resize-none" value={action.description} onChange={e => updateList('actions', idx, 'description', e.target.value)} placeholder="Action Description" rows={2} />
              </div>
            ))}
          </div>
        </div>

        {/* Spells */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className={LABEL}>Spells</label>
            <button onClick={() => addItem('spells')} className="text-violet-400 hover:text-violet-300 transition-colors">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {spells.map((spell, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/spell border-l-2 border-violet-500/30">
                <button onClick={() => removeItem('spells', idx)} className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/spell:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none" value={spell.name} onChange={e => updateList('spells', idx, 'name', e.target.value)} placeholder="Spell Name" />
                <textarea className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 focus:outline-none resize-none" value={spell.description} onChange={e => updateList('spells', idx, 'description', e.target.value)} placeholder="Level, notes (e.g. Level 2, 1/day)" rows={1} />
              </div>
            ))}
          </div>
        </div>

        {/* Boss Settings */}
        <div className="border border-white/8 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBossSettings(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-xs font-bold text-outline uppercase tracking-wider flex-1">Boss Settings</span>
            {showBossSettings
              ? <ChevronUp className="w-4 h-4 text-outline" />
              : <ChevronDown className="w-4 h-4 text-outline" />}
          </button>
          {showBossSettings && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-outline flex-1">Legendary Actions</label>
                <input
                  type="checkbox"
                  checked={legendaryEnabled}
                  onChange={e => {
                    setLegendaryEnabled(e.target.checked);
                    if (!e.target.checked) setLegendaryMax(3);
                  }}
                  className="w-4 h-4 rounded accent-primary"
                />
              </div>
              {legendaryEnabled && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-outline flex-1">Max charges (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={legendaryMax}
                    onChange={e => setLegendaryMax(Math.max(1, Math.min(5, parseInt(e.target.value) || 3)))}
                    className="w-16 text-center bg-surface-container border border-white/10 rounded-lg text-on-surface text-sm py-1 outline-none focus:border-primary/60"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-outline hover:text-white text-sm font-bold transition-colors">
            Cancel
          </button>
          <button onClick={() => { onSave({ ...formData, legendaryActions: legendaryEnabled ? { max: legendaryMax, remaining: legendaryMax } : undefined }); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95">
            <Save className="w-4 h-4" /> Save Changes
          </button>
          <button onClick={() => { onDelete(formData.id); onClose(); }} className="px-3 py-2.5 bg-error/10 text-error rounded-xl font-bold hover:bg-error hover:text-on-error transition-all" title="Delete combatant">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
