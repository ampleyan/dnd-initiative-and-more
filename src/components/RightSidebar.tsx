import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=')
    .replace(/javascript:/gi, '');
}
import { X, Sparkles, Zap, Edit2, Swords, Users, Shield, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { FoundryJournalPicker } from './FoundryJournalPicker';
import { cn, clean5eTags } from '../lib/utils';
import { getSpellIcon } from '../lib/spellIcons';
import { Combatant, MonsterAction, Spell, EncounterNotes } from '../types';
import { getSpellSaveDc } from '../lib/combatantUtils';
import { CR_TABLE } from '../constants/crTable';
import { AvatarImg } from './AvatarImg';
import { CONDITIONS } from '../constants';

type ActionTab = 'attacks' | 'abilities' | 'spells';

type SpellType = 'attack' | 'save' | 'heal' | 'buff' | 'utility';
type SpellTarget = 'self' | 'touch' | 'aoe' | 'ally' | 'enemy' | 'any';

function classifySpell(s: Spell): { isConcentration: boolean; type: SpellType; target: SpellTarget } {
  const desc = s.description.toLowerCase();
  const dur  = (s.duration ?? '').toLowerCase();
  const rng  = (s.range   ?? '').toLowerCase();

  const isConcentration = /\bconcentration\b/.test(dur);

  const isAttack = /\bspell attack\b|\battack roll\b|\branged spell attack\b|\bmelee spell attack\b/.test(desc);
  const isSave   = /\bsaving throw\b|\bmust (make|succeed on)/.test(desc);
  const isHeal   = /\bregain.{0,30}hit point|hit point.{0,20}regain|\bheals?\b.{0,20}\bhit\b/.test(desc);
  const isBuff   = !isAttack && !isSave && !isHeal && (
    /\badvantage\b.{0,40}\b(attack|ability|saving)\b|\bresistance\b.{0,30}\bdamage\b|\bbonus\b.{0,30}\b(ac|armor|attack|save|check)\b|\btemporary hit point\b/.test(desc) ||
    ['abjuration', 'enchantment'].includes(s.school.toLowerCase())
  );

  const type: SpellType = isHeal ? 'heal' : isAttack ? 'attack' : isSave ? 'save' : isBuff ? 'buff' : 'utility';

  const isSelf   = rng === 'self' || rng.startsWith('self (');
  const isTouch  = rng === 'touch';
  const isAoe    = /\b\d+.?-?foot.*(radius|cone|cube|line|sphere|cylinder)\b|\beach (creature|target)\b|\ball creature/.test(desc) || /\b(cone|radius|cube|line|sphere)\b/.test(rng);
  const isAlly   = /\bwilling creature\b|\bfriendly (creature|target)\b/.test(desc);
  const isEnemy  = (isAttack || isSave) && !isAlly && !isSelf;

  const target: SpellTarget = isSelf ? 'self' : isTouch ? 'touch' : isAoe ? 'aoe' : isAlly ? 'ally' : isEnemy ? 'enemy' : 'any';

  return { isConcentration, type, target };
}

const SPELL_TYPE_STYLE: Record<SpellType, { label: string; cls: string; title: string }> = {
  attack:  { label: 'ATK',  cls: 'bg-rose-500/20 text-rose-400',    title: 'Requires attack roll' },
  save:    { label: 'SAV',  cls: 'bg-amber-500/20 text-amber-400',  title: 'Targets must make a saving throw' },
  heal:    { label: 'HEL',  cls: 'bg-emerald-500/20 text-emerald-400', title: 'Restores hit points' },
  buff:    { label: 'BUFF', cls: 'bg-sky-500/20 text-sky-400',      title: 'Buffs / support effect' },
  utility: { label: 'UTIL', cls: 'bg-white/5 text-outline/50',      title: 'Utility / other' },
};

const SPELL_TARGET_STYLE: Record<SpellTarget, { label: string; cls: string; title: string } | null> = {
  self:   { label: 'SELF',  cls: 'bg-primary/15 text-primary/70',       title: 'Targets self only' },
  touch:  { label: 'TCH',   cls: 'bg-primary/10 text-primary/50',       title: 'Touch range' },
  aoe:    { label: 'AOE',   cls: 'bg-orange-500/20 text-orange-400',    title: 'Area of effect' },
  ally:   { label: 'ALLY',  cls: 'bg-emerald-500/15 text-emerald-400/70', title: 'Targets willing / friendly creatures' },
  enemy:  { label: 'FOE',   cls: 'bg-rose-500/15 text-rose-400/70',     title: 'Targets enemies' },
  any:    null,
};

function ActionRow({
  item,
  category,
  spellData,
  onUse,
}: {
  item: MonsterAction;
  category: MonsterAction['category'];
  spellData?: Spell;
  onUse: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const accentColor =
    category === 'spell'   ? 'text-violet-400' :
    category === 'ability' ? 'text-amber-400'  : 'text-rose-400';

  const spellIconUrl = category === 'spell' ? getSpellIcon(item.name, spellData?.school) : null;

  const icon = spellIconUrl
    ? <img src={spellIconUrl} alt="" className="w-4 h-4 shrink-0 rounded-sm object-cover" />
    : category === 'spell'   ? <Sparkles className="w-3 h-3 shrink-0" />
    : category === 'ability' ? <Shield   className="w-3 h-3 shrink-0" />
    :                          <Zap      className="w-3 h-3 shrink-0" />;

  const hasContent = !!(spellData || item.description);
  const meta = spellData ? classifySpell(spellData) : null;
  const typeStyle   = meta ? SPELL_TYPE_STYLE[meta.type] : null;
  const targetStyle = meta ? SPELL_TARGET_STYLE[meta.target] : null;
  const actionStats = (category === 'attack' || category === 'ability') ? parseActionStats(item.description) : null;

  return (
    <div className="rounded-lg border border-white/5 overflow-hidden bg-surface-container-high">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={() => hasContent ? setOpen(o => !o) : undefined}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span className={accentColor}>{icon}</span>
          <span className="text-xs font-bold text-on-surface truncate flex-1 min-w-0">{item.name}</span>

          {/* Attack/ability stat badges */}
          {actionStats && (actionStats.hit || actionStats.damage || actionStats.dc) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {actionStats.hit && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 leading-none" title="Attack bonus">
                  {actionStats.hit}
                </span>
              )}
              {actionStats.damage && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 leading-none" title="Damage">
                  {actionStats.damage}
                </span>
              )}
              {actionStats.dc && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 leading-none" title="Save DC">
                  {actionStats.dc}
                </span>
              )}
            </div>
          )}

          {/* Spell metadata badges */}
          {meta && (
            <div className="flex items-center gap-0.5 shrink-0">
              {spellData && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-outline/50 leading-none"
                    title={spellData.level === 0 ? 'Cantrip' : `Level ${spellData.level} spell slot`}
                  >
                    {spellData.level === 0 ? '∞' : spellData.level}
                  </span>
                )}
                {meta.isConcentration && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 leading-none"
                    title="Requires concentration"
                  >
                    C
                  </span>
                )}
                {typeStyle && meta.type !== 'utility' && (
                  <span
                    className={cn('text-[9px] font-black px-1.5 py-0.5 rounded leading-none', typeStyle.cls)}
                    title={typeStyle.title}
                  >
                    {typeStyle.label}
                  </span>
                )}
                {targetStyle && (
                  <span
                    className={cn('text-[9px] font-black px-1.5 py-0.5 rounded leading-none', targetStyle.cls)}
                    title={targetStyle.title}
                  >
                    {targetStyle.label}
                  </span>
                )}
            </div>
          )}

          {hasContent ? (
            open
              ? <ChevronDown  className="w-3 h-3 text-outline/40 shrink-0" />
              : <ChevronRight className="w-3 h-3 text-outline/40 shrink-0" />
          ) : null}
        </button>
        <button
          onClick={onUse}
          className={cn('text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded transition-colors',
            category === 'spell'   ? 'text-violet-400 hover:bg-violet-400/10' :
            category === 'ability' ? 'text-amber-400 hover:bg-amber-400/10'  :
                                     'text-rose-400 hover:bg-rose-400/10'
          )}
        >
          ▶
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-white/5 pt-1.5">
          {spellData && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-[10px] font-black text-outline/60 uppercase tracking-wide">
                  {spellData.level === 0 ? 'Cantrip' : `Level ${spellData.level}`} · {spellData.school}
                </span>
                {meta?.isConcentration && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">◎ Concentration</span>
                )}
                {typeStyle && meta?.type !== 'utility' && (
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', typeStyle.cls)}>{typeStyle.title}</span>
                )}
                {targetStyle && (
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', targetStyle.cls)}>{targetStyle.title}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {[
                  { label: 'Cast',       value: spellData.time },
                  { label: 'Range',      value: spellData.range },
                  { label: 'Duration',   value: spellData.duration },
                  { label: 'Components', value: spellData.components },
                ].map(({ label, value }) => value ? (
                  <div key={label}>
                    <p className="text-[9px] text-outline uppercase tracking-widest">{label}</p>
                    <p className="text-[11px] text-on-surface-variant leading-tight truncate">{value}</p>
                  </div>
                ) : null)}
              </div>
              <div
                className="prose-desc text-[11px] text-outline/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(clean5eTags(spellData.description)) }}
              />
              {spellData.higherLevels && (
                <div className="pt-1 border-t border-white/5">
                  <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-0.5">At Higher Levels</p>
                  <p className="text-[11px] text-outline/70 leading-relaxed">{clean5eTags(spellData.higherLevels)}</p>
                </div>
              )}
            </>
          )}
          {!spellData && item.description && (
            <p
              className="prose-desc text-[11px] text-outline/80 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(clean5eTags(item.description)) }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function parseActionStats(description: string): { hit: string | null; damage: string | null; dc: string | null } {
  const hitMatch = description.match(/([+-]\d+)\s+to\s+hit/i);
  const damageMatch = description.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/i);
  const dcMatch = description.match(/DC\s+(\d+)\s+(\w+)\s+saving/i);
  return {
    hit: hitMatch ? hitMatch[1] : null,
    damage: damageMatch ? `${damageMatch[1]} ${damageMatch[2]}` : null,
    dc: dcMatch ? `DC ${dcMatch[1]} ${dcMatch[2].slice(0, 3).toUpperCase()}` : null,
  };
}

function parseSpellcastingInfo(combatant: Combatant): { dc: number | null; attackBonus: number | null } {
  const allText = [...(combatant.abilities ?? []), ...(combatant.actions ?? []), ...(combatant.spells ?? [])]
    .map(a => a.description).join(' ');
  const atkMatch = allText.match(/\+(\d+) to hit with spell attack/i);
  return {
    dc: getSpellSaveDc(combatant),
    attackBonus: atkMatch ? Number(atkMatch[1]) : null,
  };
}

interface RightSidebarProps {
  selectedCombatant: Combatant | null;
  selectedDisplayName?: string;
  setSelectedCombatantId: (id: string | null) => void;
  isEncounterActive: boolean;
  handleNextTurn: () => void;
  setEditingCombatantId: (id: string) => void;
  setIsEditModalOpen: (open: boolean) => void;
  setIsStatusModalOpen: (open: boolean) => void;
  setQuickActionCombatantId: (id: string) => void;
  setIsQuickActionModalOpen: (open: boolean) => void;
  currentEncounterId: string | null;
  activeTab: string;
  onUseAction: (action: MonsterAction, actor: Combatant) => void;
  spellLibrary?: Spell[];
  onUseFeature?: (combatantId: string, featureId: string) => void;
  onUpdate?: (updated: Combatant) => void;
  isAdmin?: boolean;
  encounterNotes: EncounterNotes;
  onUpdateNotes: (notes: EncounterNotes) => void;
  sidebarView: 'details' | 'notes';
  onSetSidebarView: (view: 'details' | 'notes') => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedCombatant,
  selectedDisplayName,
  setSelectedCombatantId,
  isEncounterActive,
  handleNextTurn,
  setEditingCombatantId,
  setIsEditModalOpen,
  setIsStatusModalOpen,
  setQuickActionCombatantId,
  setIsQuickActionModalOpen,
  currentEncounterId,
  activeTab,
  onUseAction,
  spellLibrary,
  onUseFeature,
  onUpdate,
  isAdmin,
  encounterNotes,
  onUpdateNotes,
  sidebarView,
  onSetSidebarView,
  isMobileOpen,
  onMobileClose,
}) => {
  const [customAction, setCustomAction] = React.useState('');
  const [actionTab, setActionTab] = React.useState<ActionTab>('attacks');
  const [showJournalPicker, setShowJournalPicker] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [spellGrouped, setSpellGrouped] = React.useState(true);
  const [collapsedLevels, setCollapsedLevels] = React.useState<Set<number | 'unknown'>>(new Set());
  const [editingHp, setEditingHp] = React.useState(false);
  const [hpInput, setHpInput] = React.useState('');

  const displayedCombatant = selectedCombatant;
  const isEncounterView = activeTab === 'encounters' && !!currentEncounterId;

  React.useEffect(() => {
    setEditingHp(false);
  }, [displayedCombatant?.id]);

  if (!isEncounterView) return null;

  const attacks = displayedCombatant?.actions ?? [];
  const abilities = displayedCombatant?.abilities ?? [];
  const spells = displayedCombatant?.spells ?? [];

  const tabItems: Record<ActionTab, MonsterAction[]> = { attacks, abilities, spells };
  const tabCategory: Record<ActionTab, MonsterAction['category']> = {
    attacks: 'attack',
    abilities: 'ability',
    spells: 'spell',
  };

  const tabs: Array<{ key: ActionTab; label: string; count: number; color: string }> = [
    { key: 'attacks', label: 'Atk', count: attacks.length, color: 'text-rose-400' },
    { key: 'abilities', label: 'Abil', count: abilities.length, color: 'text-amber-400' },
    { key: 'spells', label: 'Spells', count: spells.length, color: 'text-violet-400' },
  ];

  const filtered = tabItems[actionTab].filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Spell enrichment + filter + grouping ──────────────────────────────────
  type EnrichedSpell = { item: MonsterAction; spellData: Spell | undefined; meta: ReturnType<typeof classifySpell> | null };

  const enrichedSpells: EnrichedSpell[] = spells.map(item => {
    const spellData = spellLibrary?.find(s => s.name.toLowerCase() === item.name.toLowerCase());
    return { item, spellData, meta: spellData ? classifySpell(spellData) : null };
  });


  const spellChipFiltered = enrichedSpells.filter(({ item }) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by level
  const spellGroups = new Map<number | 'unknown', EnrichedSpell[]>();
  for (const entry of spellChipFiltered) {
    const lvl: number | 'unknown' = entry.spellData?.level ?? 'unknown';
    if (!spellGroups.has(lvl)) spellGroups.set(lvl, []);
    spellGroups.get(lvl)!.push(entry);
  }
  const sortedSpellGroups = [...spellGroups.entries()].sort(([a], [b]) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return (a as number) - (b as number);
  });

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/60 lg:hidden"
          onClick={onMobileClose}
        />
      )}
    <aside className={cn(
      "bg-surface-container-lowest border-outline-variant/15 flex-col",
      isMobileOpen
        ? "flex fixed inset-x-0 bottom-0 z-[60] h-[80vh] w-full rounded-t-2xl border-t"
        : "hidden lg:flex w-64 xl:w-72 2xl:w-80 border-l h-full sticky top-0"
    )}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Details / Notes tab toggle */}
        <div className="flex border-b border-outline/10 shrink-0">
          <button
            onClick={() => onSetSidebarView('details')}
            className={`flex-1 py-1.5 text-[11px] font-bold transition-colors ${
              sidebarView === 'details'
                ? 'text-on-surface border-b-2 border-primary'
                : 'text-outline/60 hover:text-on-surface'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => onSetSidebarView('notes')}
            className={`flex-1 py-1.5 text-[11px] font-bold transition-colors relative ${
              sidebarView === 'notes'
                ? 'text-on-surface border-b-2 border-primary'
                : 'text-outline/60 hover:text-on-surface'
            }`}
          >
            Notes
            {(encounterNotes.general.trim() || encounterNotes.rounds.some(r => r.text.trim())) && (
              <span className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
        </div>
        {sidebarView === 'notes' ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-outline">General</span>
                      <button
                        onClick={() => setShowJournalPicker(true)}
                        title="Import from Foundry journal"
                        className="flex items-center gap-1 text-[9px] text-outline/50 hover:text-amber-400 transition-colors"
                      >
                        <BookOpen className="w-3 h-3" />
                        Foundry
                      </button>
                    </div>
                    <textarea
                      value={encounterNotes.general}
                      onChange={e => onUpdateNotes({ ...encounterNotes, general: e.target.value })}
                      placeholder="Notes for this encounter…"
                      rows={4}
                      className="w-full bg-surface-container-highest border border-outline/20 rounded-lg px-2 py-1.5 text-xs text-on-surface resize-none focus:outline-none focus:border-primary/50 placeholder:text-outline/40"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-outline block mb-2">Rounds</span>
                    <div className="space-y-2">
                      {encounterNotes.rounds
                        .slice()
                        .sort((a, b) => a.round - b.round)
                        .map((rn) => (
                          <div key={rn.round} className="flex gap-1.5 items-start">
                            <input
                              type="number"
                              min={1}
                              value={rn.round}
                              onChange={e => {
                                const newRound = parseInt(e.target.value, 10);
                                if (isNaN(newRound)) return;
                                if (encounterNotes.rounds.some(r => r.round !== rn.round && r.round === newRound)) return;
                                const updated = encounterNotes.rounds.map(r =>
                                  r.round === rn.round ? { ...r, round: newRound } : r
                                );
                                onUpdateNotes({ ...encounterNotes, rounds: updated });
                              }}
                              className="w-8 bg-surface-container-highest border border-outline/20 rounded px-1 py-1 text-xs text-on-surface text-center focus:outline-none focus:border-primary/50"
                            />
                            <textarea
                              value={rn.text}
                              onChange={e => {
                                const updated = encounterNotes.rounds.map(r =>
                                  r.round === rn.round ? { ...r, text: e.target.value } : r
                                );
                                onUpdateNotes({ ...encounterNotes, rounds: updated });
                              }}
                              placeholder={`Round ${rn.round} plan…`}
                              rows={2}
                              className="flex-1 bg-surface-container-highest border border-outline/20 rounded-lg px-2 py-1 text-xs text-on-surface resize-none focus:outline-none focus:border-primary/50 placeholder:text-outline/40"
                            />
                            <button
                              onClick={() => {
                                const updated = encounterNotes.rounds.filter(r => r.round !== rn.round);
                                onUpdateNotes({ ...encounterNotes, rounds: updated });
                              }}
                              className="text-outline/40 hover:text-error transition-colors mt-1 shrink-0"
                              title="Remove round"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                    <button
                      onClick={() => {
                        const maxRound = encounterNotes.rounds.length > 0
                          ? Math.max(...encounterNotes.rounds.map(r => r.round))
                          : 0;
                        onUpdateNotes({
                          ...encounterNotes,
                          rounds: [...encounterNotes.rounds, { round: maxRound + 1, text: '' }],
                        });
                      }}
                      className="mt-2 w-full py-1 text-xs text-outline/60 hover:text-on-surface border border-dashed border-outline/20 hover:border-outline/40 rounded-lg transition-colors"
                    >
                      + Add round
                    </button>
                  </div>
                </div>
              ) : (
          <AnimatePresence mode="wait">
            {displayedCombatant ? (
              <motion.div
                key={displayedCombatant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col flex-1 min-h-0"
              >
              {/* Header */}
              <div className="p-2.5 shrink-0">
                {/* Name row */}
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 pr-2">
                    <h2 className="text-base font-headline font-bold text-on-surface leading-tight truncate">
                      {selectedDisplayName ?? displayedCombatant.name}
                    </h2>
                    <p className="text-primary font-label text-[10px] uppercase truncate">{displayedCombatant.subtitle}</p>
                  </div>
                  <button onClick={() => setSelectedCombatantId(null)} className="text-outline hover:text-on-surface transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Portrait + key stats side by side */}
                <div className="flex gap-2 mb-2">
                  <div className="relative rounded-xl overflow-hidden shrink-0 w-16 h-16">
                    <AvatarImg src={displayedCombatant.avatar} name={displayedCombatant.name} className="w-16 h-16 text-2xl" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* HP */}
                    <div>
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[9px] font-bold text-outline uppercase tracking-wider">HP</span>
                        <span className="text-[11px] font-bold tabular-nums flex items-baseline gap-0.5">
                          {editingHp ? (
                            <input
                              autoFocus
                              type="number"
                              value={hpInput}
                              onChange={e => setHpInput(e.target.value)}
                              onBlur={() => {
                                const v = Math.max(0, Math.min(parseInt(hpInput) || 0, displayedCombatant.hp.max));
                                onUpdate?.({ ...displayedCombatant, hp: { ...displayedCombatant.hp, current: v } });
                                setEditingHp(false);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingHp(false);
                              }}
                              className="w-10 text-sm font-black text-on-surface bg-transparent border-b border-primary focus:outline-none text-center"
                            />
                          ) : (
                            <button
                              onClick={() => { setHpInput(String(displayedCombatant.hp.current)); setEditingHp(true); }}
                              title="Click to edit HP"
                              className="font-black text-sm text-on-surface hover:text-primary transition-colors cursor-pointer"
                            >
                              {displayedCombatant.hp.current}
                            </button>
                          )}
                          <span className="text-outline/50">/{displayedCombatant.hp.max}</span>
                          {(displayedCombatant.tempHp ?? 0) > 0 && (
                            <span className="text-sky-400 ml-0.5">+{displayedCombatant.tempHp}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500',
                            displayedCombatant.hp.current / displayedCombatant.hp.max < 0.3 ? 'bg-error' : 'bg-primary'
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, (displayedCombatant.hp.current / displayedCombatant.hp.max) * 100))}%` }}
                        />
                      </div>
                    </div>
                    {/* AC + Speed */}
                    <div className="flex gap-1.5">
                      <div className="flex items-center gap-1 bg-white/5 rounded-md px-2 py-1 flex-1">
                        <Shield className="w-2.5 h-2.5 text-outline/50 shrink-0" />
                        <span className="text-[11px] font-bold">{displayedCombatant.ac}</span>
                        <span className="text-[8px] text-outline/40 ml-0.5">AC</span>
                      </div>
                      {displayedCombatant.speed && (
                        <div className="flex items-center gap-1 bg-white/5 rounded-md px-2 py-1 flex-1 min-w-0">
                          <span className="text-[8px] text-outline/40 shrink-0">SPD</span>
                          <span className="text-[10px] font-bold truncate">{displayedCombatant.speed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vulnerabilities / Resistances / Immunities — admin only, prominent panel */}
                {isAdmin && displayedCombatant.type !== 'player' && (() => {
                  const vuln = displayedCombatant.vulnerabilities ?? [];
                  const res  = displayedCombatant.resistances ?? [];
                  const dimm = displayedCombatant.damageImmunities ?? [];
                  const cimm = displayedCombatant.conditionImmunities ?? [];
                  if (!vuln.length && !res.length && !dimm.length && !cimm.length) {
                     return (
                       <div className="mb-2 px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/2 flex items-center gap-1.5">
                         <span className="text-[9px] text-outline/30 uppercase tracking-widest font-semibold">No damage traits</span>
                       </div>
                     );
                   }
                  return (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/8 divide-y divide-white/5">
                      {vuln.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 bg-rose-500/10">
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 shrink-0">⚡ Vuln</span>
                          <div className="flex flex-wrap gap-1">
                            {vuln.map(v => <span key={v} className="px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-200 bg-rose-500/25 capitalize">{v}</span>)}
                          </div>
                        </div>
                      )}
                      {res.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 bg-sky-500/10">
                          <span className="text-[9px] font-black uppercase tracking-widest text-sky-400 shrink-0">🛡 Res</span>
                          <div className="flex flex-wrap gap-1">
                            {res.map(r => <span key={r} className="px-2 py-0.5 rounded-md text-[11px] font-bold text-sky-200 bg-sky-500/25 capitalize">{r}</span>)}
                          </div>
                        </div>
                      )}
                      {dimm.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 bg-purple-500/10">
                          <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 shrink-0">✦ Imm</span>
                          <div className="flex flex-wrap gap-1">
                            {dimm.map(i => <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold text-purple-200 bg-purple-500/25 capitalize">{i}</span>)}
                          </div>
                        </div>
                      )}
                      {cimm.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 bg-amber-500/10">
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 shrink-0">⭕ Cond</span>
                          <div className="flex flex-wrap gap-1">
                            {cimm.map(i => <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-200 bg-amber-500/25 capitalize">{i}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Ability scores */}
                {displayedCombatant.stats && (
                  <div className="grid grid-cols-6 gap-px mb-2 bg-white/3 rounded-lg overflow-hidden border border-white/5">
                    {(['str','dex','con','int','wis','cha'] as const).map(stat => {
                      const val = displayedCombatant.stats[stat];
                      const mod = Math.floor((val - 10) / 2);
                      return (
                        <div key={stat} className="text-center py-1 bg-surface-container-low">
                          <p className="text-[7px] font-bold text-outline/40 uppercase tracking-wide">{stat}</p>
                          <p className="text-[11px] font-bold text-on-surface leading-tight">{val}</p>
                          <p className="text-[9px] text-outline/60">{mod >= 0 ? '+' : ''}{mod}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Combat stats: CR (editable) + derived stats + spell casting info */}
                {(() => {
                  const crMatch = displayedCombatant.subtitle.match(/\bCR\s+([\d\/]+)/i);
                  const crKey = crMatch ? crMatch[1] : null;
                  const crStats = crKey ? CR_TABLE[crKey] : null;
                  const { dc: spellDc, attackBonus } = parseSpellcastingInfo(displayedCombatant);
                  const derivedItems = [
                    crStats              && { label: 'Prof',      value: `+${crStats.profBonus}` },
                    crStats              && { label: 'Save DC',   value: String(crStats.saveDC) },
                    crStats              && { label: 'XP',        value: crStats.xp.toLocaleString() },
                    spellDc !== null     && { label: 'Spell DC',  value: String(spellDc) },
                    attackBonus !== null && { label: 'Spell Atk', value: `+${attackBonus}` },
                  ].filter(Boolean) as { label: string; value: string }[];

                  const CR_OPTIONS = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

                  const handleCrChange = (newCr: string) => {
                    if (!onUpdate) return;
                    const sub = displayedCombatant.subtitle;
                    const newSubtitle = /\bCR\s+[\d\/]+/i.test(sub)
                      ? sub.replace(/\bCR\s+[\d\/]+/i, `CR ${newCr}`)
                      : sub ? `${sub}, CR ${newCr}` : `CR ${newCr}`;

                    const newCrStats = CR_TABLE[newCr];
                    const oldCrStats = crKey ? CR_TABLE[crKey] : null;
                    if (newCrStats && oldCrStats) {
                      const hpRatio = ((newCrStats.hpMin + newCrStats.hpMax) / 2) / ((oldCrStats.hpMin + oldCrStats.hpMax) / 2);
                      const acOffset = newCrStats.acSuggested - oldCrStats.acSuggested;
                      const newMax = Math.max(1, Math.round(displayedCombatant.hp.max * hpRatio));
                      const newCurrent = Math.max(0, Math.round(displayedCombatant.hp.current * hpRatio));
                      const newAc = displayedCombatant.ac + acOffset;
                      onUpdate({ ...displayedCombatant, subtitle: newSubtitle, hp: { current: newCurrent, max: newMax }, ac: newAc });
                    } else {
                      onUpdate({ ...displayedCombatant, subtitle: newSubtitle });
                    }
                  };

                  if (derivedItems.length === 0 && !displayedCombatant.subtitle.match(/\bCR\b/i) && displayedCombatant.type !== 'monster') return null;

                  return (
                    <div className="mb-2 space-y-1">
                      {/* CR row */}
                      <div className="flex items-center gap-1.5 bg-white/3 rounded-lg border border-white/5 px-2 py-1">
                        <span className="text-[7px] font-bold text-outline/40 uppercase tracking-wide shrink-0">CR</span>
                        <select
                          value={crKey ?? ''}
                          onChange={e => handleCrChange(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 bg-transparent text-[11px] font-bold text-violet-300 focus:outline-none cursor-pointer appearance-none"
                        >
                          <option value="" disabled>—</option>
                          {CR_OPTIONS.map(cr => (
                            <option key={cr} value={cr} className="bg-[#1a1c24] text-white">CR {cr}</option>
                          ))}
                        </select>
                        {crStats && (
                          <span className="text-[9px] text-outline/30 shrink-0">{crStats.xp.toLocaleString()} XP</span>
                        )}
                      </div>
                      {/* Derived stats */}
                      {derivedItems.length > 0 && (
                        <div className="grid gap-px bg-white/3 rounded-lg overflow-hidden border border-white/5"
                          style={{ gridTemplateColumns: `repeat(${Math.min(derivedItems.length, 5)}, 1fr)` }}>
                          {derivedItems.map(({ label, value }) => (
                            <div key={label} className="text-center py-1 bg-surface-container-low">
                              <p className="text-[7px] font-bold text-outline/40 uppercase tracking-wide leading-tight">{label}</p>
                              <p className="text-[11px] font-bold text-violet-300 leading-tight">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Conditions */}
                {displayedCombatant.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {displayedCombatant.conditions.map(cId => {
                      const condition = CONDITIONS.find(c => c.id === cId);
                      return condition ? (
                        <span key={cId} className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white', condition.color)}>
                          {condition.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}


                {/* Class Features */}
                {Object.keys(displayedCombatant.featureUses ?? {}).length > 0 && (
                  <div className="mb-1.5 px-0 py-1 border-t border-outline-variant/10">
                    <span className="text-[9px] font-black uppercase tracking-widest text-outline block mb-1">Class Features</span>
                    <div className="space-y-1">
                      {Object.entries(displayedCombatant.featureUses ?? {}).map(([featureId, feat]) => {
                        if (!feat) return null;
                        const remaining = feat.total - feat.used;
                        return (
                          <div key={featureId} className="flex items-center gap-1.5">
                            <span className="text-[9px] text-outline/60 truncate flex-1 min-w-0" title={feat.name}>{feat.name}</span>
                            <div className="flex gap-0.5 flex-wrap shrink-0">
                              {Array.from({ length: feat.total }).map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => onUseFeature?.(displayedCombatant.id, featureId)}
                                  className={`w-3.5 h-3.5 rounded-sm border transition-all ${
                                    i < remaining
                                      ? 'bg-amber-500/70 border-amber-500/50 hover:bg-error/70 hover:border-error/50'
                                      : 'bg-transparent border-outline/20 hover:border-amber-500/30'
                                  }`}
                                  title={i < remaining ? `Use ${feat.name}` : 'Used'}
                                />
                              ))}
                            </div>
                            <span className="text-[9px] text-outline/40 shrink-0">{remaining}/{feat.total}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Compact action row */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    onClick={() => { setQuickActionCombatantId(displayedCombatant.id); setIsQuickActionModalOpen(true); }}
                    title="Damage / Heal"
                    className="p-1.5 bg-error/10 border border-error/20 rounded-lg hover:bg-error/20 transition-all"
                  >
                    <Swords className="w-3.5 h-3.5 text-error" />
                  </button>
                  <button
                    onClick={() => { setEditingCombatantId(displayedCombatant.id); setIsEditModalOpen(true); }}
                    title="Edit combatant"
                    className="p-1.5 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button
                    onClick={() => { setEditingCombatantId(displayedCombatant.id); setIsStatusModalOpen(true); }}
                    title="Conditions / Status"
                    className="p-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg hover:bg-violet-500/20 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  </button>
                  {displayedCombatant.type !== 'player' && (
                    <button
                      onClick={() => onUpdate?.({ ...displayedCombatant, isFriendly: !displayedCombatant.isFriendly })}
                      title={displayedCombatant.isFriendly ? 'Remove friendly' : 'Mark as friendly'}
                      className={cn(
                        "p-1.5 border rounded-lg transition-all",
                        displayedCombatant.isFriendly
                          ? "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30"
                          : "bg-white/5 border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                      )}
                    >
                      <Shield className={cn("w-3.5 h-3.5", displayedCombatant.isFriendly ? "text-emerald-400" : "text-outline/50")} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              {(attacks.length > 0 || abilities.length > 0 || spells.length > 0) && (
                <div className="flex flex-col flex-1 min-h-0 border-t border-outline-variant/10">
                  {/* Tab bar */}
                  <div className="flex shrink-0 border-b border-outline-variant/10">
                    {tabs.map(t => (
                      <button
                        key={t.key}
                        onClick={() => { setActionTab(t.key); setSearch(''); }}
                        className={cn(
                          'flex-1 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1',
                          actionTab === t.key
                            ? `${t.color} border-b-2 border-current -mb-px bg-surface-container-high`
                            : 'text-outline hover:text-on-surface'
                        )}
                      >
                        {t.label}
                        <span className="text-[10px] opacity-60">({t.count})</span>
                      </button>
                    ))}
                  </div>

                  {actionTab === 'spells' && (
                    <div className="px-2 pt-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Search spells..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="flex-1 bg-surface-container-high border-none rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => setSpellGrouped(v => !v)}
                          className={cn(
                            'shrink-0 text-[9px] font-black px-2 py-1.5 rounded border transition-colors',
                            spellGrouped
                              ? 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-outline/20 text-outline/50 hover:border-outline/40'
                          )}
                          title={spellGrouped ? 'Grouped by level — click to flatten' : 'Flat list — click to group by level'}
                        >
                          ≡ LVL
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search for non-spell tabs */}
                  {actionTab !== 'spells' && tabItems[actionTab].length > 5 && (
                    <div className="px-2 pt-1.5 shrink-0">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-surface-container-high border-none rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Items list */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1.5 space-y-1">
                    {actionTab === 'spells' ? (
                      <>
                        {spellChipFiltered.length === 0 ? (
                          <p className="text-[10px] text-outline/50 italic text-center py-4">
                            {search ? 'No matches' : 'None'}
                          </p>
                        ) : spellGrouped ? (
                          sortedSpellGroups.map(([lvl, entries]) => {
                            const isCollapsed = collapsedLevels.has(lvl);
                            const levelLabel = lvl === 0 ? 'Cantrip' : lvl === 'unknown' ? 'Other' : `Level ${lvl}`;
                            const slot = typeof lvl === 'number' && lvl > 0 ? displayedCombatant?.spellSlots?.[lvl] : null;
                            const slotsRemaining = slot ? slot.total - slot.used : null;
                            return (
                              <div key={String(lvl)}>
                                <button
                                  onClick={() => setCollapsedLevels(prev => {
                                    const next = new Set(prev);
                                    next.has(lvl) ? next.delete(lvl) : next.add(lvl);
                                    return next;
                                  })}
                                  className="w-full flex items-center gap-1.5 py-1 mb-0.5 group"
                                >
                                  <span className={cn(
                                    'text-[8px] font-black uppercase tracking-widest',
                                    lvl === 0 ? 'text-sky-400/70' : lvl === 'unknown' ? 'text-outline/40' : 'text-violet-400/70'
                                  )}>
                                    {levelLabel}
                                  </span>
                                  {slotsRemaining !== null && (
                                    <div className="flex gap-px">
                                      {Array.from({ length: slot!.total }).map((_, i) => (
                                        <div
                                          key={i}
                                          className={cn('w-2 h-2 rounded-sm', i < slotsRemaining ? 'bg-violet-500/60' : 'bg-white/10')}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {lvl === 0 && <span className="text-[8px] text-sky-400/50">∞</span>}
                                  <span className="text-[8px] text-outline/30 ml-0.5">({entries.length})</span>
                                  <span className="ml-auto text-outline/30 text-[8px] group-hover:text-outline/60 transition-colors">
                                    {isCollapsed ? '▶' : '▼'}
                                  </span>
                                </button>
                                {!isCollapsed && (
                                  <div className="space-y-1 mb-2">
                                    {entries.map(({ item, spellData }, idx) => (
                                      <ActionRow
                                        key={idx}
                                        item={item}
                                        category="spell"
                                        spellData={spellData}
                                        onUse={() => onUseAction({ ...item, category: 'spell' }, displayedCombatant)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          spellChipFiltered.map(({ item, spellData }, idx) => (
                            <ActionRow
                              key={idx}
                              item={item}
                              category="spell"
                              spellData={spellData}
                              onUse={() => onUseAction({ ...item, category: 'spell' }, displayedCombatant)}
                            />
                          ))
                        )}
                      </>
                    ) : (
                      <>
                        {filtered.length === 0 ? (
                          <p className="text-[10px] text-outline/50 italic text-center py-4">
                            {search ? 'No matches' : 'None'}
                          </p>
                        ) : (
                          filtered.map((item, idx) => (
                            <ActionRow
                              key={idx}
                              item={item}
                              category={tabCategory[actionTab]}
                              spellData={undefined}
                              onUse={() => onUseAction({ ...item, category: tabCategory[actionTab] }, displayedCombatant)}
                            />
                          ))
                        )}
                      </>
                    )}

                    {/* Custom action row */}
                    <div className="flex gap-1.5 pt-1.5 border-t border-outline-variant/10 mt-1">
                      <input
                        type="text"
                        className="flex-1 bg-surface-container-high border-none rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-primary"
                        placeholder="Custom..."
                        value={customAction}
                        onChange={e => setCustomAction(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customAction.trim()) {
                            onUseAction({ name: customAction.trim(), description: '' }, displayedCombatant);
                            setCustomAction('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (customAction.trim()) {
                            onUseAction({ name: customAction.trim(), description: '' }, displayedCombatant);
                            setCustomAction('');
                          }
                        }}
                        className="px-2 py-1 bg-surface-container-highest text-on-surface rounded text-[10px] font-bold hover:bg-surface-bright transition-colors shrink-0"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* No actions fallback - just show custom input */}
              {attacks.length === 0 && abilities.length === 0 && spells.length === 0 && (
                <div className="px-3 pb-3 shrink-0">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="flex-1 bg-surface-container-high border-none rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-primary"
                      placeholder="Custom action..."
                      value={customAction}
                      onChange={e => setCustomAction(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customAction.trim()) {
                          onUseAction({ name: customAction.trim(), description: '' }, displayedCombatant);
                          setCustomAction('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customAction.trim()) {
                          onUseAction({ name: customAction.trim(), description: '' }, displayedCombatant);
                          setCustomAction('');
                        }
                      }}
                      className="px-2 py-1 bg-surface-container-highest text-on-surface rounded text-[10px] font-bold hover:bg-surface-bright transition-colors"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-outline" />
                </div>
                <h3 className="font-headline font-bold text-on-surface text-sm mb-1">No Selection</h3>
                <p className="text-[10px] text-outline leading-relaxed">Click a combatant to view details.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {isEncounterActive && (
      <div className="p-3 bg-surface-container border-t border-outline-variant/15 shrink-0">
        <button
          onClick={handleNextTurn}
          className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight shadow-lg shadow-primary/10 active:scale-95 transition-all"
        >
          Next Turn
        </button>
      </div>
      )}
      {showJournalPicker && (
        <FoundryJournalPicker
          onImport={text => {
            const sep = encounterNotes.general.trim() ? '\n\n' : '';
            onUpdateNotes({ ...encounterNotes, general: encounterNotes.general + sep + text });
          }}
          onClose={() => setShowJournalPicker(false)}
        />
      )}
    </aside>
    </>
  );
};
