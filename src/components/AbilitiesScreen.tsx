import React, { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronRight, Shield, BookOpen, Sparkles, Zap, Filter, LayoutGrid, List } from 'lucide-react';
import { ClassFeature } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const SOURCE_LABELS: Record<string, string> = {
  XPHB: 'PHB 2024', PHB: 'PHB 2014', TCE: "Tasha's", XGE: "Xanathar's",
  SCAG: 'SCAG', DMG: 'DMG', MTF: "Mordenkainen's", BGG: "Bigby's",
};
const PRIORITY_SOURCES = ['XPHB', 'XMM'];

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function FeatureCard({ feature }: { feature: ClassFeature }) {
  const [expanded, setExpanded] = useState(false);
  
  const is2024 = PRIORITY_SOURCES.includes(feature.source);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative rounded-xl border transition-all duration-300",
        expanded 
          ? "bg-surface-container-highest border-primary/30 shadow-lg shadow-black/20" 
          : "bg-surface-container-low border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-medium"
      )}
    >
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                "text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest",
                is2024 ? "bg-violet-500/20 text-violet-300" : "bg-slate-500/20 text-slate-400"
              )}>
                Level {feature.level}
              </span>
              {feature.subclassName && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 uppercase tracking-widest border border-amber-500/10">
                  {feature.subclassName}
                </span>
              )}
              <span className="text-[9px] font-bold text-outline/40">
                {sourceLabel(feature.source)}
              </span>
            </div>
            <h4 className="font-headline font-bold text-sm text-on-surface leading-tight group-hover:text-primary transition-colors">
              {feature.name}
            </h4>
          </div>
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            expanded ? "bg-primary text-on-primary rotate-180" : "bg-surface-container-highest text-outline group-hover:text-on-surface"
          )}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-outline-variant/10">
                <div 
                  className="prose-desc text-xs text-on-surface-variant leading-relaxed space-y-2"
                  dangerouslySetInnerHTML={{ __html: feature.description.replace(/\n/g, '<br/>') }}
                />
                
                <div className="mt-4 pt-4 border-t border-outline-variant/5 flex items-center justify-between text-[10px]">
                  <span className="text-outline/40 font-mono italic">{feature.className} Feature</span>
                  <span className="text-outline/40">{sourceLabel(feature.source)} p.??</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface AbilitiesScreenProps {
  features: ClassFeature[];
}

export const AbilitiesScreen: React.FC<AbilitiesScreenProps> = ({ features }) => {
  const [search, setSearch] = useState('');
  const [showSubclasses, setShowSubclasses] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'all' | '2024' | '2014'>('2024');
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const classes = useMemo(() =>
    Array.from(new Set(features.map(f => f.className))).sort(),
    [features]
  );

  const filteredFeatures = useMemo(() => {
    let result = features;
    
    if (classFilter.length > 0) {
      result = result.filter(f => classFilter.includes(f.className));
    }
    
    if (!showSubclasses) {
      result = result.filter(f => !f.isSubclass);
    }
    
    if (sourceFilter !== 'all') {
      if (sourceFilter === '2024') result = result.filter(f => PRIORITY_SOURCES.includes(f.source));
      else result = result.filter(f => !PRIORITY_SOURCES.includes(f.source));
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.description.toLowerCase().includes(q) ||
        f.className.toLowerCase().includes(q)
      );
    }
    
    return result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [features, classFilter, showSubclasses, sourceFilter, search]);

  const featuresByClass = useMemo(() => {
    const map = new Map<string, ClassFeature[]>();
    for (const f of filteredFeatures) {
      if (!map.has(f.className)) map.set(f.className, []);
      map.get(f.className)!.push(f);
    }
    return map;
  }, [filteredFeatures]);

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/20">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-headline font-bold text-on-surface mb-2">No Class Features</h2>
        <p className="text-sm text-outline max-w-sm mb-6">
          Import class features from the Import tab using a 5etools class JSON file to populate your library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-surface-container-low rounded-2xl p-4 border border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search features, classes, descriptions..."
              className="w-full bg-surface-container-highest border-none rounded-xl pl-10 pr-10 py-2.5 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/50 transition-all"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-container-highest rounded-xl p-1">
              {(['all', '2024', '2014'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    sourceFilter === s 
                      ? "bg-primary text-on-primary shadow-sm" 
                      : "text-outline hover:text-on-surface"
                  )}
                >
                  {s === 'all' ? 'All' : s === '2024' ? '2024' : '2014'}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowSubclasses(v => !v)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                showSubclasses 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-surface-container-highest border-transparent text-outline"
              )}
            >
              Subclasses
            </button>

            <div className="h-8 w-px bg-white/5 mx-1" />

            <div className="flex bg-surface-container-highest rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'grid' ? "bg-surface text-primary shadow-sm" : "text-outline hover:text-on-surface"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'list' ? "bg-surface text-primary shadow-sm" : "text-outline hover:text-on-surface"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Class selection chips */}
        <div className="flex flex-wrap gap-1.5">
          <div className="flex items-center px-2 mr-1">
            <Filter className="w-3 h-3 text-outline mr-2" />
            <span className="text-[10px] font-black text-outline uppercase tracking-widest">Filter:</span>
          </div>
          {classes.map(c => (
            <button
              key={c}
              onClick={() => setClassFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all",
                classFilter.includes(c)
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-surface-container-highest border-transparent text-outline hover:border-outline-variant/30 hover:text-on-surface"
              )}
            >
              {c}
            </button>
          ))}
          {classFilter.length > 0 && (
            <button 
              onClick={() => setClassFilter([])}
              className="px-3 py-1.5 text-[10px] font-bold text-error/80 hover:text-error transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">
        {Array.from(featuresByClass.entries()).map(([cls, feats]) => (
          <div key={cls} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/10">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-headline font-bold text-on-surface">{cls}</h3>
                <span className="text-[10px] text-outline font-mono">({feats.length})</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent" />
            </div>

            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
              {feats.map(f => (
                <FeatureCard key={f.id} feature={f} />
              ))}
            </div>
          </div>
        ))}
        
        {filteredFeatures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-outline/20 mb-4" />
            <p className="text-outline text-sm">No features match your current filters.</p>
          </div>
        )}
      </div>

      <div className="flex justify-center pt-8">
        <div className="px-4 py-2 rounded-full bg-surface-container-low border border-white/5 text-[10px] font-bold text-outline uppercase tracking-widest">
          Showing {filteredFeatures.length} of {features.length} features
        </div>
      </div>
    </div>
  );
};
