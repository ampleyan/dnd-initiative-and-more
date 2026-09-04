import React, { useState, useEffect, useMemo } from 'react';
import { X, Zap, Heart, Sparkles, Music, Play, Square } from 'lucide-react';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=')
    .replace(/javascript:/gi, '');
}
import { motion, AnimatePresence } from 'motion/react';
import { Combatant, MonsterAction, MonsterTemplate, Spell, Sound } from '../types';
import { PolymorphModal } from './PolymorphModal';
import { CONDITIONS } from '../constants';
import { clean5eTags } from '../lib/utils';
import { extractDamageType, DAMAGE_TYPES_REGEX } from '../lib/damageTypes';

const CONDITION_IDS = CONDITIONS.map(c => c.id);

// Maps action/spell names → condition IDs for self-applied buffs
const NAME_CONDITION_MAP: Record<string, string> = {
  rage: 'raging',
  bless: 'blessed',
  haste: 'hasted',
  'bardic inspiration': 'inspired',
  inspiration: 'inspired',
  hex: 'concentrating',
  'hunter\'s mark': 'hunters-mark',
  'faerie fire': 'concentrating',
  'spirit guardians': 'concentrating',
  'spirit weapon': 'concentrating',
};

// PRIMARY: you are the aggressor attacking/damaging a target
const OUTGOING_DAMAGE_PATTERN = /\byou (make|roll)\b.{0,60}\battack\b|\b(deal|deals?)\b.{0,40}\bdamage\b|\btarget\b.{0,80}\b(must make|takes?|suffers?)\b.{0,60}\b(saving throw|damage)\b|\beach (creature|target)\b.{0,200}\b(takes?|taking)\b.{0,40}\bdamage\b|\bmelee (weapon|spell) attack\b|\branged (weapon|spell) attack\b|\bsaving throw\b.{0,200}\bdamage\b|\bhit\b.{0,40}(?:damage|slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|radiant|necrotic|force|psychic)/i;


// REACTIVE: damage that fires BACK at an attacker; NOT the primary effect
const REACTIVE_DAMAGE_PATTERN = /\b(hits? you|attacks? you|attack (roll )?against you|creature that hits?|attacker)\b.{0,120}\btakes?\b/i;

// Self temp-HP grant: "you gain N temporary hit points"
const TEMP_HP_PATTERN = /\byou gain\b.{0,50}\btemporary hit points?\b/i;

// Heal to self: "you regain/restore N hit points"
const SELF_HEAL_PATTERN = /\byou (regains?|heals?|restores?|recovers?)\b.{0,60}\bhit points?\b/i;

// General self-buff indicator
const SELF_PATTERN = /\byourself\b|\byou gain\b.{0,50}\b(resistance|immunity|temporary hit points?)\b|\byou become\b|\byou can enter\b|\byou are now\b|\byour (?:ac|armor class|hit points?|speed|spell save dc|attack bonus)\b|\btemporary hit points?\b/i;

function detectTempHp(desc: string): boolean {
  return TEMP_HP_PATTERN.test(desc);
}

function detectSelfHeal(desc: string): boolean {
  return SELF_HEAL_PATTERN.test(desc);
}

function detectOutgoingDamage(desc: string, category?: string): boolean {
  if (category === 'attack') return true;
  if (detectTempHp(desc)) return false;
  if (REACTIVE_DAMAGE_PATTERN.test(desc) && !OUTGOING_DAMAGE_PATTERN.test(desc)) return false;
  return OUTGOING_DAMAGE_PATTERN.test(desc) || (/\b\d+\b/.test(desc) && DAMAGE_TYPES_REGEX.test(desc));
}

function detectSelf(_name: string, desc: string): boolean {
  return SELF_PATTERN.test(desc);
}

// Returns true if the spell/action can hit multiple targets simultaneously.
// Checks the spell range field first (most reliable), then the description.
function detectMultiTarget(desc: string, range?: string, category?: string): boolean {
  // AoE range: "Self (30-foot cone)", "60-foot line", "20-foot radius", etc.
  if (range && /\b(cone|cube|line|cylinder|sphere|emanation)\b|\d+-foot (radius|cone|cube|line|cylinder|sphere)/i.test(range)) return true;

  // Description: explicit multi-target phrases
  if (/\beach (creature|target|enemy|foe)\b/i.test(desc)) return true;
  if (/\bup to \d+ (creatures?|targets?)\b/i.test(desc)) return true;
  if (/\bcreatures? of your choice\b/i.test(desc)) return true;
  if (/\bnumber of creatures\b/i.test(desc)) return true;
  if (/\b(radius|cone|cube|sphere|cylinder|emanation)\b/i.test(desc)) return true;
  if (/\bwithin .{0,30}\bfeet\b.{0,30}\b(of you|around|centered)\b/i.test(desc)) return true;

  // Attacks and single-target phrasing → single target
  if (category === 'attack') return false;
  if (/\b(melee|ranged) (weapon|spell) attack\b/i.test(desc)) return false;
  if (/\bone (creature|target|enemy|willing creature|humanoid|beast|undead|fiend|aberration)\b/i.test(desc)) return false;

  // Default: allow multi (permissive for unknown spells/abilities)
  return true;
}

function extractFixedAmount(desc: string): number | null {
  // Try hit prefix first (monsters)
  const mH = desc.match(/\bhit:\s*(\d+)/i);
  if (mH) return parseInt(mH[1]);

  const mHp = desc.match(/\byou gain (\d+) temporary hit points?\b/i)
    ?? desc.match(/\byou regain (\d+) hit points?\b/i)
    ?? desc.match(/\bgain (\d+) temporary hit points?\b/i)
    ?? desc.match(/\bheals?\b(?:.*?)\b(\d+)\b/i);

  if (mHp) return parseInt(mHp[1]);

  const dmgMatches = [...desc.matchAll(/(?:^|[^a-zA-Z])(\d+)\b(?!\s*[dD]\d+)\s*(?:\([^)]+\))?\s*(?:[a-zA-Z]+\s+)*(?:damage|slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|radiant|necrotic|force|psychic)/gi)];
  if (dmgMatches.length > 0) {
    let sum = 0;
    for (const match of dmgMatches) {
      sum += parseInt(match[1]);
    }
    return sum;
  }

  return null;
}

// Extra effect patterns → condition IDs (checked against the full description)
const EXTRA_CONDITION_PATTERNS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /\bdisadvantage\b.{0,60}\b(attack|weapon)\b|\b(attack|weapon)\b.{0,60}\bdisadvantage\b/i, id: 'disadvantaged' },
  { pattern: /\breaction\b.{0,80}\b(use|spend|expend|must)\b|\b(must|immediately)\b.{0,80}\breaction\b/i,  id: 'reaction-spent' },
  { pattern: /\bspeed\b.{0,40}\b(0|zero|reduced to 0)\b|\bcan'?t move\b/i,                               id: 'speed-zero' },
  { pattern: /\bprone\b/i,         id: 'prone' },
  { pattern: /\bfrightened\b/i,    id: 'frightened' },
  { pattern: /\brestrained\b/i,    id: 'restrained' },
  { pattern: /\bblinded\b/i,       id: 'blinded' },
  { pattern: /\bdeafened\b/i,      id: 'deafened' },
  { pattern: /\bcharmed\b/i,       id: 'charmed' },
  { pattern: /\bpoisoned\b/i,      id: 'poisoned' },
  { pattern: /\bincapacitated\b/i, id: 'incapacitated' },
  { pattern: /\bparalyzed\b/i,     id: 'paralyzed' },
  { pattern: /\bstunned\b/i,       id: 'stunned' },
  { pattern: /\bunconscious\b/i,   id: 'unconscious' },
];

function detectConditions(name: string, desc: string): string[] {
  // word-match existing condition IDs
  const fromDesc = CONDITION_IDS.filter(id =>
    new RegExp(`\\b${id.replace('-', '[- ]?')}\\b`, 'i').test(desc)
  );
  // extra semantic patterns
  const fromPatterns = EXTRA_CONDITION_PATTERNS
    .filter(({ pattern }) => pattern.test(desc))
    .map(({ id }) => id);
  // name-map for self-buffs
  const lname = name.toLowerCase().trim();
  const fromName = Object.entries(NAME_CONDITION_MAP)
    .filter(([k]) => lname === k || lname.startsWith(k))
    .map(([, v]) => v)
    .filter(v => CONDITION_IDS.includes(v));
  return [...new Set([...fromDesc, ...fromPatterns, ...fromName])];
}

function hpPct(c: Combatant) {
  return c.hp.max > 0 ? Math.max(0, Math.min(1, c.hp.current / c.hp.max)) : 0;
}

function hpColor(pct: number) {
  if (pct > 0.5) return '#34d399';
  if (pct > 0.25) return '#fbbf24';
  return '#ef4444';
}

interface ActionExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actor: Combatant | null;
  action: MonsterAction | null;
  combatants: Combatant[];
  monsters?: MonsterTemplate[];
  spellData?: Spell;
  sounds?: Sound[];
  onTogglePlay?: (sound: Sound) => void;
  playingIds?: Set<string>;
  onPolymorph?: (targetId: string, monster: MonsterTemplate) => void;
  onApply: (params: {
    targetIds: string[];
    effect: 'damage' | 'heal' | 'none';
    amount: number;
    amountPerTarget?: Record<string, number>;
    actionName: string;
    actionCategory: MonsterAction['category'];
    conditionsToAdd: string[];
    applyConcentration: boolean;
    damageType?: string;
  }) => void;
}

export const ActionExecutionModal: React.FC<ActionExecutionModalProps> = ({
  isOpen, onClose, actor, action, combatants, monsters = [], spellData, sounds = [], onTogglePlay, playingIds, onPolymorph, onApply,
}) => {
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [effect, setEffect] = useState<'damage' | 'heal'>('damage');
  const [amount, setAmount] = useState('');
  const [perTargetMode, setPerTargetMode] = useState(false);
  const [amountsPerTarget, setAmountsPerTarget] = useState<Record<string, string>>({});
  const [checkedConditions, setCheckedConditions] = useState<Set<string>>(new Set());
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(() => localStorage.getItem('sound_autoplay_enabled') !== 'false');
  const [polymorphMonster, setPolymorphMonster] = useState<MonsterTemplate | null>(null);
  const [showPolymorphPicker, setShowPolymorphPicker] = useState(false);

  const linkedSound = useMemo(() => {
    if (!spellData) return null;
    return sounds.find(s => s.spellId === spellData.id);
  }, [spellData, sounds]);

  const isPlayingLinked = linkedSound ? (playingIds?.has(linkedSound.id) ?? false) : false;

  const rawDesc = action?.description || spellData?.description || '';
  const desc = useMemo(() => clean5eTags(rawDesc), [rawDesc]);
  const name = action?.name ?? '';

  const isPolymorph   = /\bpolymorph\b/i.test(name);
  const isTempHp      = detectTempHp(desc);
  const isSelfHeal    = detectSelfHeal(desc);
  const hasDamage     = !isPolymorph && detectOutgoingDamage(desc, action?.category);
  const hasHeal       = !isPolymorph && (isTempHp || isSelfHeal || (!hasDamage && /\b(heals?|restores?|regains?|recovers?)\b.{0,40}\bhit points?\b/i.test(desc)));
  const hasEffect     = !isPolymorph && (hasDamage || hasHeal || !desc);
  const isSelf        = detectSelf(name, desc);
  const isMultiTarget = !isPolymorph && detectMultiTarget(desc, spellData?.range, action?.category);
  const isConcentration = /\bconcentration\b/i.test(desc) || /\bconcentration\b/i.test(spellData?.duration ?? '') || NAME_CONDITION_MAP[name.toLowerCase().trim()] === 'concentrating';
  // Conditions for targets: exclude 'concentrating' — that goes to the caster
  const autoConditions = detectConditions(name, desc).filter(c => c !== 'concentrating');
  const autoAmount = extractFixedAmount(desc);

  // All combatants available as targets (actor included for self-buffs; downed excluded for damage)
  const targets = actor
    ? combatants.filter(c => !(hasDamage && c.hp.current <= 0))
    : [];

  const enemies = targets.filter(c => c.id !== actor?.id && c.type !== 'player' && !c.isFriendly);
  const allies  = targets.filter(c => c.id !== actor?.id && (c.type === 'player' || c.isFriendly));

  useEffect(() => {
    if (!isOpen || !actor) return;
    setPolymorphMonster(null);
    setEffect(hasHeal ? 'heal' : 'damage');
    setAmount(autoAmount !== null ? String(autoAmount) : '');
    setPerTargetMode(true);
    setAmountsPerTarget({});
    setCheckedConditions(new Set(autoConditions));
    // Auto-select default group based on detection
    if (isSelf) {
      setSelectedTargetIds(new Set([actor.id]));
    } else if (hasDamage) {
      // Single-target: pre-select first enemy only
      setSelectedTargetIds(isMultiTarget
        ? new Set(enemies.map(c => c.id))
        : enemies.length > 0 ? new Set([enemies[0].id]) : new Set());
    } else if (hasHeal) {
      setSelectedTargetIds(new Set([actor.id]));
    } else if (autoConditions.length > 0 && enemies.length > 0) {
      setSelectedTargetIds(new Set([enemies[0].id]));
    } else {
      setSelectedTargetIds(new Set());
    }
  }, [isOpen, action, combatants]);

  const toggleTarget = (id: string) => {
    if (!isMultiTarget) {
      // Radio: selecting a new target replaces the current one; clicking selected clears
      setSelectedTargetIds(prev => prev.has(id) ? new Set() : new Set([id]));
      return;
    }
    setSelectedTargetIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Quick-select presets
  const quickSelect = (group: 'self' | 'enemies' | 'allies' | 'all') => {
    if (!actor) return;
    if (group === 'self')    setSelectedTargetIds(new Set([actor.id]));
    if (group === 'enemies') setSelectedTargetIds(new Set(enemies.map(c => c.id)));
    if (group === 'allies')  setSelectedTargetIds(new Set(allies.map(c => c.id)));
    if (group === 'all')     setSelectedTargetIds(new Set(targets.map(c => c.id)));
  };

  // Which quick-select preset matches the current selection (for highlight)
  const activePreset = (() => {
    const ids = selectedTargetIds;
    if (ids.size === 1 && actor && ids.has(actor.id)) return 'self';
    if (ids.size === enemies.length && enemies.every(c => ids.has(c.id)) && enemies.length > 0) return 'enemies';
    if (ids.size === allies.length  && allies.every(c => ids.has(c.id))  && allies.length  > 0) return 'allies';
    if (ids.size === targets.length && targets.length > 0)                                       return 'all';
    return null;
  })();

  const canApply = selectedTargetIds.size > 0 && (!isPolymorph || polymorphMonster !== null);

  const handleApply = () => {
    if (selectedTargetIds.size === 0) return;
    if (isPolymorph) {
      if (!polymorphMonster || !onPolymorph) return;
      for (const id of selectedTargetIds) onPolymorph(id, polymorphMonster);
      onClose();
      return;
    }

    if (isAutoplayEnabled && linkedSound && onTogglePlay) {
      if (!playingIds?.has(linkedSound.id)) {
        onTogglePlay(linkedSound);
      }
    }

    const num = hasEffect ? (parseInt(amount) || 0) : 0;
    const damageType = extractDamageType(rawDesc);

    let amountPerTarget: Record<string, number> | undefined;
    if (perTargetMode && hasEffect) {
      amountPerTarget = {};
      for (const id of selectedTargetIds) {
        amountPerTarget[id] = parseInt(amountsPerTarget[id] ?? '') || 0;
      }
    }

    onApply({
      targetIds: Array.from(selectedTargetIds),
      effect: hasEffect ? effect : 'none',
      amount: num,
      amountPerTarget,
      actionName: name,
      actionCategory: action.category,
      conditionsToAdd: Array.from(checkedConditions).filter(c => c !== 'concentrating'),
      applyConcentration: isConcentration,
      damageType,
    });
    onClose();
  };

  if (!actor || !action) return null;

  const polymorphTarget = selectedTargetIds.size > 0
    ? combatants.find(c => selectedTargetIds.has(c.id)) ?? actor
    : actor;

  const renderTarget = (c: typeof targets[0]) => {
    const self = c.id === actor.id;
    const ally = c.type === 'player' || !!c.isFriendly;
    const isSelected = selectedTargetIds.has(c.id);
    const pct = hpPct(c);
    const color = hpColor(pct);
    const selColor  = self ? 'border-primary/60 bg-primary/10'    : ally ? 'border-sky-500/60 bg-sky-500/10'    : 'border-error/60 bg-error/10';
    const idleColor = self ? 'border-primary/15 bg-primary/5 hover:border-primary/30 hover:bg-primary/10' : ally ? 'border-sky-500/15 bg-sky-500/5 hover:border-sky-500/30 hover:bg-sky-500/10' : 'border-error/15 bg-error/5 hover:border-error/30 hover:bg-error/10';
    const boxSel    = self ? 'bg-primary border-primary'   : ally ? 'bg-sky-500 border-sky-500'   : 'bg-error border-error';
    const boxIdle   = self ? 'border-primary/30'           : ally ? 'border-sky-500/30'           : 'border-error/30';
    return (
      <div key={c.id} className={`flex items-center gap-2 rounded-xl border transition-all ${isSelected ? selColor : idleColor}`}>
        <button
          onClick={() => toggleTarget(c.id)}
          className="flex items-center gap-3 px-3 py-2 text-left flex-1 min-w-0"
        >
          <div className={`shrink-0 w-4 h-4 border-2 flex items-center justify-center transition-colors ${isMultiTarget ? 'rounded' : 'rounded-full'} ${isSelected ? boxSel : boxIdle}`}>
            {isSelected && <span className={`font-black text-white leading-none ${isMultiTarget ? 'text-[9px]' : 'w-2 h-2 rounded-full bg-white block'}`}>{isMultiTarget ? '✓' : ''}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-on-surface truncate">{c.name}</span>
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                {self && <span className="text-[8px] font-black uppercase text-primary/60">Self</span>}
                <span className="text-[10px] font-mono text-outline">{c.hp.current}/{c.hp.max}</span>
              </div>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        </button>
        {perTargetMode && isSelected && hasEffect && (
          <input
            type="number"
            min="0"
            placeholder="0"
            value={amountsPerTarget[c.id] ?? ''}
            onChange={e => setAmountsPerTarget(prev => ({ ...prev, [c.id]: e.target.value }))}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleApply(); }}
            onClick={e => e.stopPropagation()}
            className="w-14 shrink-0 mr-2 bg-black/20 border border-white/20 rounded-lg px-2 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-white/50"
          />
        )}
      </div>
    );
  };

  const renderGroup = (group: typeof targets, label: string, labelColor: string) => group.length === 0 ? null : (
    <div>
      <span className={`text-[9px] font-black uppercase tracking-widest ${labelColor} block mb-1`}>{label}</span>
      <div className="space-y-1">{group.map(renderTarget)}</div>
    </div>
  );

  const selfTarget = targets.filter(c => c.id === actor.id);

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-3xl max-h-[90vh] bg-[#0f1419] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* ── Two-column body ── */}
            <div className="flex flex-1 min-h-0">

              {/* Left: action card + description */}
              <div className="w-72 shrink-0 flex flex-col border-r border-white/5 bg-white/[0.02]">
                <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase font-bold text-outline tracking-widest truncate">{actor.name}</p>
                    <h2 className="font-headline font-bold text-on-surface text-lg leading-tight">{name}</h2>
                  </div>
                  <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors shrink-0 mt-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                  {spellData && (
                    <>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {[
                          { label: 'Cast', value: spellData.time },
                          { label: 'Range', value: spellData.range },
                          { label: 'Duration', value: spellData.duration },
                          { label: 'Components', value: spellData.components },
                        ].map(({ label, value }) => value ? (
                          <div key={label}>
                            <p className="text-[9px] text-outline uppercase tracking-widest">{label}</p>
                            <p className="text-[10px] text-on-surface-variant leading-tight">{value}</p>
                          </div>
                        ) : null)}
                      </div>

                      {linkedSound && (
                        <div className="p-2 bg-pink-500/5 border border-pink-500/20 rounded-lg flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="p-1 bg-pink-500/10 rounded">
                                <Music className="w-3 h-3 text-pink-400" />
                              </div>
                              <span className="text-[10px] font-bold text-pink-300 truncate tracking-tight">{linkedSound.name}</span>
                            </div>
                            <button
                              onClick={() => onTogglePlay?.(linkedSound)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isPlayingLinked ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-outline hover:text-on-surface hover:bg-white/10'
                              }`}
                            >
                              {isPlayingLinked ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                            </button>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-pink-500/10">
                            <label className="text-[8px] font-black uppercase tracking-wider text-outline/60">Autoplay on Apply</label>
                            <button
                              onClick={() => {
                                const next = !isAutoplayEnabled;
                                setIsAutoplayEnabled(next);
                                localStorage.setItem('sound_autoplay_enabled', String(next));
                              }}
                              className={`w-7 h-4 rounded-full relative transition-colors ${isAutoplayEnabled ? 'bg-pink-500' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isAutoplayEnabled ? 'left-3.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className="text-[11px] text-outline/70 leading-relaxed prose-desc"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(spellData.description) }}
                      />
                      {spellData.higherLevels && (
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-0.5">At Higher Levels</p>
                          <p className="text-[10px] text-outline/60 leading-relaxed">{spellData.higherLevels}</p>
                        </div>
                      )}
                    </>
                  )}

                  {!spellData && action.description && (
                    <div
                      className="text-[11px] text-outline/70 leading-relaxed prose-desc"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }}
                    />
                  )}
                </div>
              </div>

              {/* Right: targets + effect + apply */}
              <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-y-auto custom-scrollbar">

                {/* Targets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase font-bold text-outline tracking-widest">
                        Targets{selectedTargetIds.size > 0 ? ` (${selectedTargetIds.size})` : ''}
                      </label>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        isMultiTarget
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-outline/70 bg-white/5 border-white/10'
                      }`}>
                        {isMultiTarget ? 'Area' : 'Single'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMultiTarget && hasEffect && selectedTargetIds.size > 1 && (
                        <button
                          onClick={() => {
                            const next = !perTargetMode;
                            setPerTargetMode(next);
                            if (next) {
                              const init: Record<string, string> = {};
                              for (const id of selectedTargetIds) init[id] = amount;
                              setAmountsPerTarget(init);
                            }
                          }}
                          className={`text-[10px] font-bold transition-colors px-1.5 py-0.5 rounded ${
                            perTargetMode ? 'text-primary bg-primary/10' : 'text-outline/50 hover:text-outline'
                          }`}
                        >
                          Per-target
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedTargetIds(new Set())}
                        className="text-[10px] font-bold text-outline/50 hover:text-outline transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Quick-select presets — group buttons only shown for AoE */}
                  <div className="flex gap-1">
                    {([
                      { key: 'self',    label: 'Self',    active: 'bg-primary/20 border-primary/40 text-primary',     base: 'border-white/10 text-outline hover:border-primary/30 hover:text-primary',    always: true },
                      { key: 'enemies', label: 'Enemies', active: 'bg-error/20 border-error/40 text-error',            base: 'border-white/10 text-outline hover:border-error/30 hover:text-error',          always: false },
                      { key: 'allies',  label: 'Allies',  active: 'bg-sky-500/20 border-sky-500/40 text-sky-400',      base: 'border-white/10 text-outline hover:border-sky-500/30 hover:text-sky-400',     always: false },
                      { key: 'all',     label: 'All',     active: 'bg-amber-500/20 border-amber-500/40 text-amber-400',base: 'border-white/10 text-outline hover:border-amber-500/30 hover:text-amber-400', always: false },
                    ] as const).filter(p => isMultiTarget || p.always).map(({ key, label, active, base }) => (
                      <button
                        key={key}
                        onClick={() => quickSelect(key)}
                        className={`flex-1 py-1 rounded-lg border text-[10px] font-bold transition-all ${activePreset === key ? active : base}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Individual rows */}
                  {targets.length === 0 ? (
                    <p className="text-[11px] text-outline/50 italic text-center py-3">No valid targets</p>
                  ) : (
                    <div className="space-y-3">
                      {renderGroup(selfTarget, 'Self', 'text-primary/60')}
                      {renderGroup(enemies,    'Enemies', 'text-error/60')}
                      {renderGroup(allies,     'Allies',  'text-sky-400/60')}
                    </div>
                  )}
                </div>

                {/* Concentration notice */}
                {isConcentration && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <span className="text-[10px] text-violet-300 font-bold">⟳ Concentration</span>
                    <span className="text-[10px] text-outline/60">will be applied to {actor.name}</span>
                  </div>
                )}

                {/* Detected conditions — opt-in checkboxes */}
                {autoConditions.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-outline tracking-widest">Apply Conditions</label>
                    <div className="flex flex-wrap gap-1.5">
                      {autoConditions.map(id => {
                        const cond = CONDITIONS.find(c => c.id === id);
                        if (!cond) return null;
                        const checked = checkedConditions.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => setCheckedConditions(prev => {
                              const next = new Set(prev);
                              checked ? next.delete(id) : next.add(id);
                              return next;
                            })}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white transition-all ${
                              checked ? cond.color : 'bg-surface-container-highest text-outline line-through opacity-50'
                            }`}
                          >
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            {cond.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Polymorph beast form picker */}
                {isPolymorph && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-outline tracking-widest">Beast Form</label>
                    {polymorphMonster ? (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{polymorphMonster.name}</p>
                          <p className="text-[10px] text-outline">CR {polymorphMonster.cr} · HP {polymorphMonster.hp} · AC {polymorphMonster.ac}</p>
                        </div>
                        <button
                          onClick={() => setShowPolymorphPicker(true)}
                          className="text-[10px] text-violet-400 hover:text-violet-300 font-bold transition-colors ml-3 shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPolymorphPicker(true)}
                        className="w-full py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        Choose beast form
                      </button>
                    )}
                  </div>
                )}

                {/* Effect + Amount */}
                {hasEffect && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-outline tracking-widest">Effect</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEffect('damage')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border font-bold text-xs transition-all ${
                            effect === 'damage'
                              ? 'bg-error/15 border-error/40 text-error'
                              : 'bg-surface-container-high border-white/5 text-outline hover:border-white/15'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" /> Damage
                        </button>
                        <button
                          onClick={() => setEffect('heal')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border font-bold text-xs transition-all ${
                            effect === 'heal'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                              : 'bg-surface-container-high border-white/5 text-outline hover:border-white/15'
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5" /> {isTempHp ? 'Temp HP' : 'Heal'}
                        </button>
                      </div>
                    </div>

                    {!perTargetMode && (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-outline tracking-widest">Amount</label>
                        <input
                          type="number"
                          min="0"
                          autoFocus
                          className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-2xl font-bold text-on-surface focus:ring-1 focus:ring-primary text-center"
                          placeholder="0"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleApply()}
                        />
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleApply}
                  disabled={!canApply}
                  className="w-full py-3 rounded-xl font-headline font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] mt-auto"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {showPolymorphPicker && isPolymorph && (
      <PolymorphModal
        combatant={polymorphTarget}
        monsters={monsters}
        onConfirm={monster => { setPolymorphMonster(monster); setShowPolymorphPicker(false); }}
        onClose={() => setShowPolymorphPicker(false)}
      />
    )}
    </>
  );
};
