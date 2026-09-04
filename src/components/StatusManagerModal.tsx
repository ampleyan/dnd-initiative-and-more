import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from './Modal';
import { Combatant, Spell } from '../types';
import { cn } from '../lib/utils';
import { CONDITIONS } from '../constants';

interface StatusManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatant: Combatant | null;
  onUpdate: (updated: Combatant) => void;
  spells?: Spell[];
  onBreakConcentration?: (actor: Combatant) => void;
}

export const StatusManagerModal: React.FC<StatusManagerModalProps> = ({
  isOpen,
  onClose,
  combatant,
  onUpdate,
  spells = [],
  onBreakConcentration,
}) => {
  const [newTag, setNewTag] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});
  const [conditionTimers, setConditionTimers] = React.useState<Record<string, string>>({});
  const [concentrationInput, setConcentrationInput] = useState(combatant?.concentratingOn ?? '');
  const [showSpellDropdown, setShowSpellDropdown] = useState(false);
  const prevCombatantId = useRef<string | null>(null);

  const concentrationSpells = spells.filter(s => s.duration?.toLowerCase().includes('concentration'));
  const spellSuggestions = concentrationSpells.filter(s =>
    concentrationInput.trim().length > 0 &&
    s.name.toLowerCase().includes(concentrationInput.toLowerCase())
  );

  useEffect(() => {
    if (combatant) {
      setConcentrationInput(combatant.concentratingOn ?? '');
      setConditionTimers(Object.fromEntries(Object.entries(combatant.conditionTimers ?? {}).map(([id, rounds]) => [id, String(rounds)])));
      prevCombatantId.current = combatant.id;
    }
  }, [combatant?.id, combatant?.concentratingOn, combatant?.conditionTimers]);

  if (!combatant) return null;

  const toggleCondition = (id: string) => {
    if (combatant.conditions.includes(id)) {
      const newTimers = { ...(combatant.conditionTimers ?? {}) };
      delete newTimers[id];
      onUpdate({ ...combatant, conditions: combatant.conditions.filter(c => c !== id), conditionTimers: newTimers });
    } else {
      const rounds = parseInt(conditionTimers[id] ?? '') || undefined;
      const newTimers = rounds
        ? { ...(combatant.conditionTimers ?? {}), [id]: rounds }
        : { ...(combatant.conditionTimers ?? {}) };
      onUpdate({ ...combatant, conditions: [...combatant.conditions, id], conditionTimers: newTimers });
    }
  };

  const addTag = () => {
    if (newTag && !combatant.tags.includes(newTag)) {
      const descs = { ...(combatant.customTagDescriptions ?? {}) };
      if (newTagDescription.trim()) descs[newTag] = newTagDescription.trim();
      onUpdate({ ...combatant, tags: [...combatant.tags, newTag], customTagDescriptions: descs });
      setNewTag('');
      setNewTagDescription('');
    }
  };

  const removeTag = (tag: string) => {
    const descs = { ...(combatant.customTagDescriptions ?? {}) };
    delete descs[tag];
    onUpdate({ ...combatant, tags: combatant.tags.filter(t => t !== tag), customTagDescriptions: descs });
  };

  const saveTagDescription = (tag: string) => {
    const descs = { ...(combatant.customTagDescriptions ?? {}) };
    const val = editingDescriptions[tag]?.trim();
    if (val) descs[tag] = val; else delete descs[tag];
    onUpdate({ ...combatant, customTagDescriptions: descs });
    setExpandedTag(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage ${combatant.name}`}>
      <div className="space-y-6">
        <section>
          <h4 className="text-[10px] uppercase font-bold text-outline mb-3 tracking-widest">Conditions</h4>
          <div className="grid grid-cols-2 gap-2">
            {CONDITIONS.map(condition => (
              <button
                key={condition.id}
                onClick={() => toggleCondition(condition.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  combatant.conditions.includes(condition.id)
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-surface-container-high border-outline-variant/10 text-outline hover:border-primary/30"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", condition.color)} />
                <span className="text-xs font-bold">{condition.name}</span>
                {!combatant.conditions.includes(condition.id) && (
                  <input
                    type="number"
                    min="1"
                    placeholder="∞"
                    value={conditionTimers[condition.id] ?? ''}
                    onChange={e => setConditionTimers(prev => ({ ...prev, [condition.id]: e.target.value }))}
                    onClick={e => e.stopPropagation()}
                    className="w-10 text-center text-[9px] bg-surface-container border border-outline-variant/20 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary ml-auto"
                    title="Rounds until expiry (blank = permanent)"
                  />
                )}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] uppercase font-bold text-outline mb-3 tracking-widest">Tags</h4>
          <div className="space-y-1.5 mb-4">
            {combatant.tags.map(tag => {
              const desc = combatant.customTagDescriptions?.[tag];
              const isExpanded = expandedTag === tag;
              return (
                <div key={tag} className="bg-surface-container-high rounded-xl border border-outline-variant/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-[10px] font-bold text-on-surface flex-1">{tag}</span>
                    {desc && !isExpanded && (
                      <span className="text-[9px] text-outline/60 truncate max-w-[120px]">{desc}</span>
                    )}
                    <button
                      onClick={() => {
                        if (isExpanded) { setExpandedTag(null); } else {
                          setExpandedTag(tag);
                          setEditingDescriptions(prev => ({ ...prev, [tag]: desc ?? '' }));
                        }
                      }}
                      className="text-outline/40 hover:text-primary transition-colors"
                      title="Edit description"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button onClick={() => removeTag(tag)} className="text-outline/40 hover:text-error transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-outline-variant/10 pt-2">
                      <textarea
                        className="w-full bg-surface-container border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary resize-none"
                        placeholder="Description (shown in conditions panel)..."
                        rows={2}
                        value={editingDescriptions[tag] ?? ''}
                        onChange={e => setEditingDescriptions(prev => ({ ...prev, [tag]: e.target.value }))}
                      />
                      <button
                        onClick={() => saveTagDescription(tag)}
                        className="text-[9px] font-bold px-3 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
                placeholder="Tag name..."
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
              <button onClick={addTag} className="p-2 bg-primary text-on-primary rounded-lg hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <textarea
              className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-xs focus:ring-1 focus:ring-primary resize-none"
              placeholder="Description (optional)..."
              rows={2}
              value={newTagDescription}
              onChange={e => setNewTagDescription(e.target.value)}
            />
          </div>
        </section>
        <section>
          <h4 className="text-[10px] uppercase font-bold text-outline mb-3 tracking-widest">Concentration</h4>
          <div className="relative">
            <input
              className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
              placeholder="Concentrating on… (spell name)"
              value={concentrationInput}
              onChange={e => { setConcentrationInput(e.target.value); setShowSpellDropdown(true); }}
              onFocus={() => setShowSpellDropdown(true)}
              onBlur={() => setTimeout(() => setShowSpellDropdown(false), 150)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onUpdate({ ...combatant, concentratingOn: concentrationInput || undefined });
                  setShowSpellDropdown(false);
                }
                if (e.key === 'Escape') { setShowSpellDropdown(false); }
              }}
            />
            {showSpellDropdown && spellSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-surface-container border border-outline-variant/20 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {spellSuggestions.map(spell => (
                  <button
                    key={spell.id}
                    onMouseDown={() => {
                      setConcentrationInput(spell.name);
                      onUpdate({ ...combatant, concentratingOn: spell.name });
                      setShowSpellDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="font-bold text-on-surface">{spell.name}</span>
                    <span className="text-outline/60 shrink-0">Lv {spell.level} · {spell.school}</span>
                  </button>
                ))}
              </div>
            )}
            {concentrationInput && (
              <button
                onClick={() => { setConcentrationInput(''); onBreakConcentration?.(combatant); onUpdate({ ...combatant, concentratingOn: undefined, concentrationTargets: undefined, conditions: combatant.conditions.filter(c => c !== 'concentrating') }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/40 hover:text-error transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
};
