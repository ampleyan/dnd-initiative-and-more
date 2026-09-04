import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { Spell, Combatant, MonsterAction } from '../types';
import { useMasonryLayout } from '../hooks/useMasonryLayout';
import { CONDITIONS } from '../constants';

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const LEVELS = ['Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CONDITION_NAMES = CONDITIONS.map(c => c.name.toLowerCase());

function levelLabel(level: number): string {
  if (level === 0) return 'Cantrip';
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}

function levelColor(level: number): string {
  const colors = [
    'bg-slate-500/20 text-slate-300',
    'bg-sky-500/20 text-sky-300',
    'bg-blue-500/20 text-blue-300',
    'bg-violet-500/20 text-violet-300',
    'bg-purple-500/20 text-purple-300',
    'bg-pink-500/20 text-pink-300',
    'bg-rose-500/20 text-rose-300',
    'bg-red-500/20 text-red-300',
    'bg-orange-500/20 text-orange-300',
    'bg-amber-500/20 text-amber-300',
  ];
  return colors[Math.min(level, colors.length - 1)];
}

interface SpellCardProps {
  spell: Spell;
  style: React.CSSProperties;
  linkedPlayers?: Combatant[];
  onUseSpell?: (actor: Combatant, action: MonsterAction) => void;
}

const SpellCard: React.FC<SpellCardProps> = ({ spell, style, linkedPlayers, onUseSpell }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={style}
      className="absolute bg-surface-container-low border border-outline-variant/10 rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-sm text-on-surface leading-tight">{spell.name}</p>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${levelColor(spell.level)}`}>
          {levelLabel(spell.level)}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">{spell.school}</p>
        {spell.source && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
            spell.source === 'XPHB' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' :
            spell.source === 'PHB'  ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' :
            'bg-surface-container-highest text-outline border-outline-variant/20'
          }`}>
            {spell.source === 'XPHB' ? 'PHB 2024' : spell.source === 'PHB' ? 'PHB 2014' : spell.source}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
        {[
          { label: 'Cast', value: spell.time },
          { label: 'Range', value: spell.range },
          { label: 'Duration', value: spell.duration },
          { label: 'Components', value: spell.components },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[9px] text-outline uppercase tracking-widest">{label}</p>
            <p className="text-[10px] text-on-surface-variant leading-tight truncate">{value}</p>
          </div>
        ))}
      </div>

      <p className={`text-xs text-on-surface-variant leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
        {spell.description}
      </p>

      {spell.higherLevels && expanded && (
        <div className="mt-2 pt-2 border-t border-outline-variant/10">
          <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-1">At Higher Levels</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">{spell.higherLevels}</p>
        </div>
      )}

      {linkedPlayers && linkedPlayers.length > 0 && (
        <div className="mt-3 pt-2 border-t border-outline-variant/10 flex flex-wrap gap-1">
          {linkedPlayers.map(p => (
            <button
              key={p.id}
              onClick={e => {
                e.stopPropagation();
                onUseSpell?.(p, { name: spell.name, description: spell.description, category: 'spell' });
              }}
              className="flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg text-[10px] font-bold transition-all"
            >
              Cast ({p.name})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface SpellsScreenProps {
  spells: Spell[];
  combatants?: Combatant[];
  onUseSpell?: (actor: Combatant, action: MonsterAction) => void;
}

export const SpellsScreen: React.FC<SpellsScreenProps> = ({ spells, combatants, onUseSpell }) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string[]>([]);
  const [targetFilter, setTargetFilter] = useState<string[]>([]);
  const [conditionFilter, setConditionFilter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900); // sensible default; ResizeObserver will correct it

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Deduplicate by name — prefer 2024 sources (XPHB) over older ones
  const PRIORITY_SOURCES = ['XPHB', 'XMM'];
  const deduped = useMemo(() => {
    const map = new Map<string, Spell>();
    for (const s of spells) {
      const existing = map.get(s.name);
      if (!existing) { map.set(s.name, s); continue; }
      const sIs2024 = PRIORITY_SOURCES.includes(s.source ?? '');
      const exIs2024 = PRIORITY_SOURCES.includes(existing.source ?? '');
      if (sIs2024 && !exIs2024) map.set(s.name, s);
    }
    return Array.from(map.values());
  }, [spells]);

  const filtered = useMemo(() => {
    let result = deduped;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (levelFilter.length > 0) {
      result = result.filter(s => levelFilter.includes(s.level === 0 ? 'Cantrip' : String(s.level)));
    }
    if (schoolFilter.length > 0) {
      result = result.filter(s => schoolFilter.includes(s.school));
    }
    if (targetFilter.length > 0) {
      result = result.filter(s => {
        const r = s.range.toLowerCase();
        let target: string;
        if (r === 'self') target = 'Self';
        else if (r === 'touch') target = 'Touch';
        else target = 'Ranged';
        return targetFilter.includes(target);
      });
    }
    if (conditionFilter) {
      result = result.filter(s =>
        CONDITION_NAMES.some(cn => s.description.toLowerCase().includes(cn))
      );
    }
    return [...result].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [deduped, search, levelFilter, schoolFilter, targetFilter, conditionFilter]);

  const linkedPlayerMap = useMemo(() => {
    const map = new Map<string, Combatant[]>();
    if (!combatants) return map;
    for (const c of combatants) {
      for (const spellId of (c.spellIds ?? [])) {
        if (!map.has(spellId)) map.set(spellId, []);
        map.get(spellId)!.push(c);
      }
    }
    return map;
  }, [combatants]);

  const gap = 12;
  const columns = containerWidth >= 1280 ? 3 : containerWidth >= 768 ? 2 : 1;
  const columnWidth = containerWidth > 0 ? Math.floor((containerWidth - gap * (columns - 1)) / columns) : 280;

  const getText = useMemo(() => (spell: Spell) =>
    `${spell.name} ${spell.school} ${spell.time} ${spell.range} ${spell.components} ${spell.duration} ${spell.description}`,
    []
  );

  const { positions, totalHeight } = useMasonryLayout(
    filtered,
    getText,
    columns,
    columnWidth,
    gap,
    '13px Inter, system-ui, sans-serif',
    20,
    132,
  );

  if (spells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Sparkles className="w-12 h-12 text-outline/30" />
        <p className="text-outline text-sm">No spells imported yet.</p>
        <p className="text-outline/60 text-xs">Import spells from the Import tab using a 5etools JSON file.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search spells…"
            className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-outline hover:text-on-surface" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {LEVELS.map(lv => (
            <button
              key={lv}
              onClick={() => setLevelFilter(prev => prev.includes(lv) ? prev.filter(x => x !== lv) : [...prev, lv])}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                levelFilter.includes(lv)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-container-high border-outline-variant/20 text-outline hover:text-on-surface'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {SCHOOLS.map(sc => (
            <button
              key={sc}
              onClick={() => setSchoolFilter(prev => prev.includes(sc) ? prev.filter(x => x !== sc) : [...prev, sc])}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                schoolFilter.includes(sc)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-container-high border-outline-variant/20 text-outline hover:text-on-surface'
              }`}
            >
              {sc}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {['Self', 'Touch', 'Ranged'].map(t => (
            <button
              key={t}
              onClick={() => setTargetFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                targetFilter.includes(t)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-container-high border-outline-variant/20 text-outline hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => setConditionFilter(v => !v)}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
            conditionFilter
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-surface-container-high border-outline-variant/20 text-outline hover:text-on-surface'
          }`}
        >
          Applies Condition
        </button>

        {(levelFilter.length > 0 || schoolFilter.length > 0 || targetFilter.length > 0 || conditionFilter) && (
          <button
            onClick={() => { setLevelFilter([]); setSchoolFilter([]); setTargetFilter([]); setConditionFilter(false); }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-outline hover:text-error transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <p className="text-xs text-outline ml-auto">{filtered.length} spell{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div ref={containerRef} className="relative" style={{ height: totalHeight > 0 ? totalHeight : undefined }}>
        {filtered.map((spell, i) =>
          positions[i] ? (
            <SpellCard
              key={spell.id}
              spell={spell}
              style={{
                position: 'absolute',
                top: positions[i].top,
                left: positions[i].left,
                width: columnWidth,
                minHeight: positions[i].height,
              }}
              linkedPlayers={linkedPlayerMap.get(spell.id) ?? []}
              onUseSpell={onUseSpell}
            />
          ) : null
        )}
      </div>
    </div>
  );
};
