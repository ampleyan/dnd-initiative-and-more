import React, { useState, useEffect, useMemo } from 'react';
import { Save, PlusCircle, Trash2, Search } from 'lucide-react';
import { Modal } from './Modal';
import { MonsterTemplate, MonsterAction, Spell } from '../types';
import { CR_TABLE } from '../constants/crTable';

interface EditMonsterModalProps {
  isOpen: boolean;
  onClose: () => void;
  monster: MonsterTemplate | null;
  onSave: (updated: MonsterTemplate) => void;
  spellLibrary?: Spell[];
}

export const EditMonsterModal: React.FC<EditMonsterModalProps> = ({
  isOpen,
  onClose,
  monster,
  onSave,
  spellLibrary = [],
}) => {
  const [formData, setFormData] = useState<MonsterTemplate | null>(null);
  const [showCrBanner, setShowCrBanner] = useState(false);
  const [autoFilled, setAutoFilled] = useState<{ hp: boolean; ac: boolean }>({ hp: false, ac: false });
  const [prevCr, setPrevCr] = useState<string>('');
  const [spellSearch, setSpellSearch] = useState('');
  const [showSpellLibrary, setShowSpellLibrary] = useState(false);

  useEffect(() => {
    if (monster) {
      setFormData({ 
        ...monster,
        actions: monster.actions || [],
        abilities: monster.abilities || [],
        spells: monster.spells || [],
        tags: monster.tags || [],
      });
      setPrevCr(monster.cr ?? '');
      setShowCrBanner(false);
      setAutoFilled({ hp: false, ac: false });
    }
  }, [monster]);

  const filteredLibrarySpells = useMemo(() => {
    if (!spellSearch.trim()) return [];
    const q = spellSearch.toLowerCase();
    // Prefer higher quality sources if possible, but first just match name
    return spellLibrary
      .filter(s => s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // Exact match first
        if (a.name.toLowerCase() === q) return -1;
        if (b.name.toLowerCase() === q) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  }, [spellLibrary, spellSearch]);

  if (!formData) return null;

  const handleActionChange = (index: number, field: keyof MonsterAction, value: string) => {
    if (!formData.actions) return;
    const newActions = [...formData.actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setFormData({ ...formData, actions: newActions });
  };

  const handleAbilityChange = (index: number, field: keyof MonsterAction, value: string) => {
    if (!formData.abilities) return;
    const newAbilities = [...formData.abilities];
    newAbilities[index] = { ...newAbilities[index], [field]: value };
    setFormData({ ...formData, abilities: newAbilities });
  };

  const handleSpellChange = (index: number, field: keyof MonsterAction, value: string) => {
    if (!formData.spells) return;
    const newSpells = [...formData.spells];
    newSpells[index] = { ...newSpells[index], [field]: value };
    setFormData({ ...formData, spells: newSpells });
  };

  const addAction = () => {
    const newActions: MonsterAction[] = [...(formData.actions || []), { name: 'New Action', description: '', category: 'attack' }];
    setFormData({ ...formData, actions: newActions });
  };

  const addAbility = () => {
    const newAbilities: MonsterAction[] = [...(formData.abilities || []), { name: 'New Ability', description: '', category: 'ability' }];
    setFormData({ ...formData, abilities: newAbilities });
  };

  const addSpell = () => {
    const newSpells: MonsterAction[] = [...(formData.spells || []), { name: 'New Spell', description: 'Level 1', category: 'spell' }];
    setFormData({ ...formData, spells: newSpells });
  };

  const removeAction = (index: number) => {
    const newActions = (formData.actions || []).filter((_, i) => i !== index);
    setFormData({ ...formData, actions: newActions });
  };

  const removeAbility = (index: number) => {
    const newAbilities = (formData.abilities || []).filter((_, i) => i !== index);
    setFormData({ ...formData, abilities: newAbilities });
  };

  const removeSpell = (index: number) => {
    const newSpells = (formData.spells || []).filter((_, i) => i !== index);
    setFormData({ ...formData, spells: newSpells });
  };

  const handleApplyCr = (forcedCr?: string) => {
    if (!formData) return;
    const targetCr = forcedCr || formData.cr;
    const oldCrStats = CR_TABLE[prevCr] || CR_TABLE['1'];
    const newCrStats = CR_TABLE[targetCr];
    if (!newCrStats) return;

    // HP Scaling (Ratio-based midpoint matching)
    const oldMid = (oldCrStats.hpMin + oldCrStats.hpMax) / 2;
    const newMid = (newCrStats.hpMin + newCrStats.hpMax) / 2;
    const hpRatio = newMid / oldMid;
    const newHp = Math.round(formData.hp * hpRatio);

    // AC Scaling (Offset-based suggested matching)
    const acOffset = newCrStats.acSuggested - oldCrStats.acSuggested;
    const newAc = formData.ac + acOffset;

    setFormData({
      ...formData,
      cr: targetCr,
      hp: newHp,
      ac: newAc,
      xp: newCrStats.xp
    });
    setAutoFilled({ hp: true, ac: true });
    setShowCrBanner(false);
    setPrevCr(targetCr);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Monster: ${formData.name}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Name</label>
            <input
              className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">CR</label>
            <input
              className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              value={formData.cr}
              onChange={e => {
                const newCr = e.target.value;
                setFormData({ ...formData, cr: newCr });
                if (newCr !== prevCr && CR_TABLE[newCr]) {
                  setShowCrBanner(true);
                } else {
                  setShowCrBanner(false);
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-outline uppercase tracking-widest">Avatar URL</label>
          <div className="flex gap-4 items-center">
            {formData.avatar && (
              <img src={formData.avatar} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface-container-high" />
            )}
            <input
              className="flex-1 bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              value={formData.avatar || ''}
              onChange={e => setFormData({ ...formData, avatar: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        {showCrBanner && CR_TABLE[formData.cr] && (
          <div className="flex items-center justify-between gap-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col">
              <span className="text-blue-400 text-xs font-bold">Scale stats to CR {formData.cr}?</span>
              <span className="text-outline text-[10px]">Adjusts HP (ratio) and AC (offset) based on DMG guidelines.</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleApplyCr()}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors"
              >Scale Now</button>
              <button
                onClick={() => { setShowCrBanner(false); setPrevCr(formData.cr); }}
                className="px-3 py-1 bg-white/10 text-outline text-xs font-bold rounded-lg hover:bg-white/20 transition-colors"
              >Ignore</button>
            </div>
          </div>
        )}
        {showCrBanner && !CR_TABLE[formData.cr] && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400">
            CR "{formData.cr}" is not in the standard table — auto-calculation unavailable.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">HP</label>
            <input
              type="number"
              className={`w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50${autoFilled.hp ? ' ring-2 ring-blue-500/50' : ''}`}
              value={formData.hp}
              onChange={e => {
                setFormData({ ...formData, hp: parseInt(e.target.value) || 0 });
                setAutoFilled(prev => ({ ...prev, hp: false }));
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">AC</label>
            <input
              type="number"
              className={`w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50${autoFilled.ac ? ' ring-2 ring-blue-500/50' : ''}`}
              value={formData.ac}
              onChange={e => {
                setFormData({ ...formData, ac: parseInt(e.target.value) || 0 });
                setAutoFilled(prev => ({ ...prev, ac: false }));
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Speed</label>
            <input
              className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              value={formData.speed}
              onChange={e => setFormData({ ...formData, speed: e.target.value })}
            />
          </div>
        </div>

        {CR_TABLE[formData.cr] && (
          <div className="flex gap-4 text-[10px] text-outline p-2 bg-white/5 rounded-lg border border-white/5">
            <span>Prof Bonus: <strong className="text-white">+{CR_TABLE[formData.cr].profBonus}</strong></span>
            <span>Save DC: <strong className="text-white">{CR_TABLE[formData.cr].saveDC}</strong></span>
            <span>XP: <strong className="text-white">{CR_TABLE[formData.cr].xp.toLocaleString()}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.keys(formData.stats).map((stat) => (
            <div key={stat} className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest block text-center">{stat}</label>
              <input
                type="number"
                className="w-full bg-surface-container-high border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-primary/50"
                value={formData.stats[stat as keyof typeof formData.stats]}
                onChange={e => setFormData({
                  ...formData,
                  stats: { ...formData.stats, [stat]: parseInt(e.target.value) || 0 }
                })}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-outline uppercase tracking-widest">Skills</label>
          <input
            className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            value={formData.skills || ''}
            onChange={e => setFormData({ ...formData, skills: e.target.value })}
            placeholder="e.g. Perception +5, Stealth +7"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-outline uppercase tracking-widest">Tags</label>
          <input
            className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            value={(formData.tags ?? []).join(', ')}
            onChange={e => setFormData({
              ...formData,
              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
            })}
            placeholder="e.g. undead, legendary, spellcaster"
          />
        </div>

        {/* Combat Traits */}
        <div className="space-y-2 pt-1 border-t border-outline-variant/10">
          <label className="text-xs font-bold text-outline uppercase tracking-widest">Combat Traits <span className="font-normal text-outline/60 normal-case tracking-normal">(comma-separated)</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              { key: 'vulnerabilities',     label: 'Vulnerabilities',      color: 'text-rose-400' },
              { key: 'resistances',         label: 'Resistances',          color: 'text-sky-400' },
              { key: 'damageImmunities',    label: 'Damage Immunities',    color: 'text-purple-400' },
              { key: 'conditionImmunities', label: 'Condition Immunities', color: 'text-amber-400' },
            ] as const).map(({ key, label, color }) => (
              <div key={key} className="space-y-1">
                <label className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</label>
                <input
                  className="w-full bg-surface-container-high border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
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

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Abilities</label>
            <button onClick={addAbility} className="text-primary hover:text-primary/80 transition-colors">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {formData.abilities?.map((ability, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/ability">
                <button
                  onClick={() => removeAbility(idx)}
                  className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/ability:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input
                  className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0"
                  value={ability.name}
                  onChange={e => handleAbilityChange(idx, 'name', e.target.value)}
                  placeholder="Ability Name"
                />
                <textarea
                  className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 resize-none"
                  value={ability.description}
                  onChange={e => handleAbilityChange(idx, 'description', e.target.value)}
                  placeholder="Ability Description"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Spells</label>
            <div className="relative flex-1 max-w-[200px] ml-4">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-outline" />
              <input
                className="w-full bg-surface-container border border-white/10 rounded-lg pl-7 pr-2 py-1 text-[10px] focus:outline-none focus:border-primary/50"
                placeholder="Search to add spell..."
                value={spellSearch}
                onChange={e => {
                  setSpellSearch(e.target.value);
                  setShowSpellLibrary(true);
                }}
                onFocus={() => setShowSpellLibrary(true)}
              />
              {showSpellLibrary && filteredLibrarySpells.length > 0 && (
                <div className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredLibrarySpells.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-[10px] hover:bg-primary/10 border-b border-white/5 last:border-none flex justify-between items-center"
                      onClick={() => {
                        const newSpells: MonsterAction[] = [...(formData.spells || []), { 
                          name: s.name, 
                          description: s.level === 0 ? 'Cantrip' : `Level ${s.level}`, 
                          category: 'spell' 
                        }];
                        setFormData({ ...formData, spells: newSpells });
                        setSpellSearch('');
                        setShowSpellLibrary(false);
                      }}
                    >
                      <span className="font-bold">{s.name}</span>
                      <span className="text-outline">{s.level === 0 ? 'Cantrip' : `Lvl ${s.level}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => {
                addSpell();
                setShowSpellLibrary(false);
              }} 
              className="text-violet-400 hover:text-violet-300 transition-colors ml-2"
              title="Add custom spell"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {formData.spells?.map((spell, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/spell border-l-2 border-violet-500/30">
                <button
                  onClick={() => removeSpell(idx)}
                  className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/spell:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input
                  className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0"
                  value={spell.name}
                  onChange={e => handleSpellChange(idx, 'name', e.target.value)}
                  placeholder="Spell Name"
                />
                <textarea
                  className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 resize-none"
                  value={spell.description}
                  onChange={e => handleSpellChange(idx, 'description', e.target.value)}
                  placeholder="Spell Info (e.g. Level 1, 1/day, At will)"
                  rows={1}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">Actions</label>
            <button onClick={addAction} className="text-primary hover:text-primary/80 transition-colors">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {formData.actions?.map((action, idx) => (
              <div key={idx} className="p-3 bg-surface-container rounded-lg space-y-2 relative group/action">
                <button
                  onClick={() => removeAction(idx)}
                  className="absolute top-2 right-2 text-outline hover:text-error opacity-100 sm:opacity-0 sm:group-hover/action:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <input
                  className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0"
                  value={action.name}
                  onChange={e => handleActionChange(idx, 'name', e.target.value)}
                  placeholder="Action Name"
                />
                <textarea
                  className="w-full bg-transparent border-none p-0 text-xs text-outline focus:ring-0 resize-none"
                  value={action.description}
                  onChange={e => handleActionChange(idx, 'description', e.target.value)}
                  placeholder="Action Description"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-outline hover:text-white text-sm font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
          >
            <Save className="w-4 h-4" /> Save Monster
          </button>
        </div>
      </div>
    </Modal>
  );
};
