import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { MonsterFilters } from '../hooks/useMonsterFilter';

interface MonsterFilterBarProps {
  filters: MonsterFilters;
  availableTypes: string[];
  availableSources: string[];
  availableTags: string[];
  onSearch: (v: string) => void;
  onCrRange: (v: [number, number]) => void;
  onTypes: (v: string[]) => void;
  onSources: (v: string[]) => void;
  onTags: (v: string[]) => void;
  onGroupBy: (v: MonsterFilters['groupBy']) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const MonsterFilterBar: React.FC<MonsterFilterBarProps> = ({
  filters, availableTypes, availableSources, availableTags,
  onSearch, onCrRange, onTypes, onSources, onTags, onGroupBy, onReset,
  totalCount, filteredCount
}) => {
  const hasActiveFilters = filters.search || filters.types.length > 0 || filters.sources.length > 0 ||
    filters.tags.length > 0 || filters.crRange[0] > 0 || filters.crRange[1] < 30 || filters.groupBy !== 'none';

  const toggleType = (t: string) =>
    onTypes(filters.types.includes(t) ? filters.types.filter(x => x !== t) : [...filters.types, t]);

  const toggleSource = (s: string) =>
    onSources(filters.sources.includes(s) ? filters.sources.filter(x => x !== s) : [...filters.sources, s]);

  const toggleTag = (t: string) =>
    onTags(filters.tags.includes(t) ? filters.tags.filter(x => x !== t) : [...filters.tags, t]);

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/40" />
          <input
            type="text"
            value={filters.search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search monsters..."
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
          />
          {filters.search && (
            <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-outline" />
            </button>
          )}
        </div>
        <span className="text-xs text-outline shrink-0">
          {filteredCount === totalCount ? `${totalCount} monsters` : `${filteredCount} / ${totalCount}`}
        </span>
        {hasActiveFilters && (
          <button onClick={onReset} className="flex items-center gap-1.5 text-xs text-outline hover:text-primary transition-colors shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline shrink-0 w-16">CR Range</span>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-outline w-8 text-right">{filters.crRange[0]}</span>
          <input
            type="range" min={0} max={30} step={1}
            value={filters.crRange[0]}
            onChange={e => onCrRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), filters.crRange[1])])}
            className="flex-1 accent-primary"
          />
          <input
            type="range" min={0} max={30} step={1}
            value={filters.crRange[1]}
            onChange={e => onCrRange([Math.min(filters.crRange[0], parseInt(e.target.value)), parseInt(e.target.value)])}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-outline w-8">{filters.crRange[1]}</span>
        </div>
      </div>

      {availableTypes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline shrink-0 w-16">Type</span>
          <div className="flex gap-2 flex-wrap">
            {availableTypes.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
                  filters.types.includes(t)
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-white/5 text-outline border-white/5 hover:border-white/20'
                }`}
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      {availableSources.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline shrink-0 w-16">Source</span>
          <div className="flex gap-2 flex-wrap">
            {availableSources.map(s => (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
                  filters.sources.includes(s)
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-white/5 text-outline border-white/5 hover:border-white/20'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {availableTags.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline shrink-0 w-16">Tags</span>
          <div className="flex gap-2 flex-wrap">
            {availableTags.map(t => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
                  filters.tags.includes(t)
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-white/5 text-outline border-white/5 hover:border-white/20'
                }`}
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline shrink-0 w-16">Group</span>
        <div className="flex gap-1">
          {(['none', 'cr', 'type', 'source'] as const).map(g => (
            <button
              key={g}
              onClick={() => onGroupBy(g)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                filters.groupBy === g
                  ? 'bg-white/15 text-white'
                  : 'text-outline hover:text-white hover:bg-white/5'
              }`}
            >{g === 'none' ? 'None' : g === 'cr' ? 'CR' : g.charAt(0).toUpperCase() + g.slice(1)}</button>
          ))}
        </div>
      </div>
    </div>
  );
};
