import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MappedEntity } from './helpers';
import { MonsterTemplate, Spell, Encounter, ClassFeature } from '../../types';

interface EntitySelectorProps {
  entities: MappedEntity[];
  monsters: MonsterTemplate[];
  classFeatures: ClassFeature[];
  existingEncounters: Encounter[];
  onImport: (monsters: MonsterTemplate[], spells: Spell[], encounters: Encounter[], features: ClassFeature[]) => void;
  onClear: () => void;
}

export const EntitySelector = React.memo<EntitySelectorProps>(({
  entities,
  monsters,
  classFeatures,
  existingEncounters,
  onImport,
  onClear,
}) => {
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<Set<string>>(new Set());
  const [selectedEncounterIds, setSelectedEncounterIds] = useState<Set<string>>(new Set());
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newMonIds = entities.filter(e => e.type === 'Monster' && !seenIdsRef.current.has(e.id)).map(e => e.id);
    const newEncIds = entities.filter(e => e.type === 'Encounter' && !seenIdsRef.current.has(e.id)).map(e => e.id);
    const newFeatureIds = entities.filter(e => e.type === 'Feature' && !seenIdsRef.current.has(e.id)).map(e => e.id);
    entities.forEach(e => seenIdsRef.current.add(e.id));
    if (newMonIds.length > 0) setSelectedMonsterIds(prev => new Set([...prev, ...newMonIds]));
    if (newEncIds.length > 0) setSelectedEncounterIds(prev => new Set([...prev, ...newEncIds]));
    if (newFeatureIds.length > 0) setSelectedFeatureIds(prev => new Set([...prev, ...newFeatureIds]));
  }, [entities]);

  const handleCommit = () => {
    setIsImporting(true);
    const monstersToImport = entities.filter(e => e.type === 'Monster' && selectedMonsterIds.has(e.id)).map(e => e.data as MonsterTemplate);
    const spells = entities.filter(e => e.type === 'Spell').map(e => e.data as Spell);
    const encounters = entities.filter(e => e.type === 'Encounter' && selectedEncounterIds.has(e.id)).map(e => e.data as Encounter);
    const features = entities.filter(e => e.type === 'Feature' && selectedFeatureIds.has(e.id)).map(e => e.data as ClassFeature);
    setTimeout(() => {
      onImport(monstersToImport, spells, encounters, features);
      setSelectedMonsterIds(new Set());
      setSelectedEncounterIds(new Set());
      setSelectedFeatureIds(new Set());
      setIsImporting(false);
    }, 1500);
  };

  const existingMonsterNames = useMemo(
    () => new Set(monsters.map(m => m.name.toLowerCase())),
    [monsters]
  );

  const existingFeatureKeys = useMemo(
    () => new Set(classFeatures.map(f => `${f.className}-${f.name}`.toLowerCase())),
    [classFeatures]
  );

  const existingEncounterNames = useMemo(
    () => new Set(existingEncounters.map(e => e.name.trim().toLowerCase())),
    [existingEncounters]
  );

  const allMonsterIds = entities.filter(e => e.type === 'Monster').map(e => e.id);
  const allFeatureIds = entities.filter(e => e.type === 'Feature').map(e => e.id);
  const allEncounterIds = entities.filter(e => e.type === 'Encounter').map(e => e.id);
  const duplicateMonsterIds = entities
    .filter(e => e.type === 'Monster' && existingMonsterNames.has(e.name.toLowerCase()))
    .map(e => e.id);
  const duplicateFeatureIds = entities
    .filter(e => e.type === 'Feature' && existingFeatureKeys.has(`${e.data.className}-${e.data.name}`.toLowerCase()))
    .map(e => e.id);
  const duplicateEncounterIds = entities
    .filter(e => e.type === 'Encounter' && existingEncounterNames.has(e.name.trim().toLowerCase()))
    .map(e => e.id);
  const selectedCount =
    selectedMonsterIds.size +
    entities.filter(e => e.type === 'Spell').length +
    selectedEncounterIds.size +
    selectedFeatureIds.size;

  return (
    <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold">Ready to Import</h3>
          <span className="text-[10px] text-outline">{selectedCount} selected of {entities.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {duplicateMonsterIds.length > 0 && (
            <button
              onClick={() => setSelectedMonsterIds(prev => {
                const n = new Set(prev);
                duplicateMonsterIds.forEach(id => n.delete(id));
                return n;
              })}
              className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-bold"
            >
              Deselect Existing ({duplicateMonsterIds.length})
            </button>
          )}
          {allMonsterIds.length > 0 && (
            <button
              onClick={() => {
                const allSelected = allMonsterIds.every(id => selectedMonsterIds.has(id));
                setSelectedMonsterIds(allSelected ? new Set() : new Set(allMonsterIds));
              }}
              className="text-[10px] text-outline hover:text-on-surface transition-colors font-bold"
            >
              {allMonsterIds.every(id => selectedMonsterIds.has(id)) ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {allEncounterIds.length > 0 && (
            <div className="flex items-center gap-2">
              {duplicateEncounterIds.length > 0 && (
                <button
                  onClick={() => setSelectedEncounterIds(prev => {
                    const n = new Set(prev);
                    duplicateEncounterIds.forEach(id => n.delete(id));
                    return n;
                  })}
                  className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-bold"
                >
                  Deselect Existing ({duplicateEncounterIds.length})
                </button>
              )}
              <button
                onClick={() => {
                  const allSelected = allEncounterIds.every(id => selectedEncounterIds.has(id));
                  setSelectedEncounterIds(allSelected ? new Set() : new Set(allEncounterIds));
                }}
                className="text-[10px] text-outline hover:text-on-surface transition-colors font-bold"
              >
                {allEncounterIds.every(id => selectedEncounterIds.has(id)) ? 'Deselect Encounters' : 'Select Encounters'}
              </button>
            </div>
          )}
          {allFeatureIds.length > 0 && (
            <div className="flex items-center gap-2">
              {duplicateFeatureIds.length > 0 && (
                <button
                  onClick={() => setSelectedFeatureIds(prev => {
                    const n = new Set(prev);
                    duplicateFeatureIds.forEach(id => n.delete(id));
                    return n;
                  })}
                  className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-bold"
                >
                  Deselect Existing ({duplicateFeatureIds.length})
                </button>
              )}
              <button
                onClick={() => {
                  const allSelected = allFeatureIds.every(id => selectedFeatureIds.has(id));
                  setSelectedFeatureIds(allSelected ? new Set() : new Set(allFeatureIds));
                }}
                className="text-[10px] text-outline hover:text-on-surface transition-colors font-bold"
              >
                {allFeatureIds.every(id => selectedFeatureIds.has(id)) ? 'Deselect Features' : 'Select Features'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {entities.map(entity => {
          const isMonster = entity.type === 'Monster';
          const isEncounter = entity.type === 'Encounter';
          const isFeature = entity.type === 'Feature';
          const isToggleable = isMonster || isEncounter || isFeature;
          const isSelected = isMonster
            ? selectedMonsterIds.has(entity.id)
            : isEncounter
            ? selectedEncounterIds.has(entity.id)
            : isFeature
            ? selectedFeatureIds.has(entity.id)
            : true;
          const isDuplicate = isMonster 
            ? existingMonsterNames.has(entity.name.toLowerCase())
            : isFeature
            ? existingFeatureKeys.has(`${entity.data.className}-${entity.data.name}`.toLowerCase())
            : isEncounter
            ? existingEncounterNames.has(entity.name.trim().toLowerCase())
            : false;

          const toggle = () => {
            if (isMonster) {
              setSelectedMonsterIds(prev => { const n = new Set(prev); n.has(entity.id) ? n.delete(entity.id) : n.add(entity.id); return n; });
            } else if (isEncounter) {
              setSelectedEncounterIds(prev => { const n = new Set(prev); n.has(entity.id) ? n.delete(entity.id) : n.add(entity.id); return n; });
            } else if (isFeature) {
              setSelectedFeatureIds(prev => { const n = new Set(prev); n.has(entity.id) ? n.delete(entity.id) : n.add(entity.id); return n; });
            }
          };

          return (
            <div
              key={entity.id}
              onClick={isToggleable ? toggle : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 border-b border-white/5 transition-colors",
                isToggleable && "cursor-pointer hover:bg-white/5",
                isToggleable && !isSelected && "opacity-40"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                isToggleable
                  ? isSelected ? "border-primary bg-primary" : "border-white/30"
                  : "border-white/10 bg-white/5"
              )}>
                {(isToggleable ? isSelected : true) && <div className="w-2 h-2 rounded-sm bg-white/80" />}
              </div>
              <span className="text-sm font-medium flex-1 truncate">{entity.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {isDuplicate && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                    exists
                  </span>
                )}
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  entity.type === 'Monster' ? "bg-red-500/10 text-red-400" :
                  entity.type === 'Spell' ? "bg-violet-500/10 text-violet-400" :
                  entity.type === 'Feature' ? "bg-amber-500/10 text-amber-400" :
                  "bg-blue-500/10 text-blue-400"
                )}>
                  {entity.type}
                </span>
                <span className="text-[9px] text-outline/50">{entity.format}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <button
          onClick={() => {
            onClear();
            setSelectedMonsterIds(new Set());
            setSelectedEncounterIds(new Set());
            setSelectedFeatureIds(new Set());
          }}
          className="text-xs font-bold text-outline hover:text-white transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={handleCommit}
          disabled={selectedCount === 0 || isImporting}
          className={cn(
            "px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
            selectedCount > 0 ? "bg-primary text-on-primary hover:opacity-90" : "bg-white/5 text-outline cursor-not-allowed"
          )}
        >
          {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          {isImporting ? 'Importing…' : `Import ${selectedCount}`}
        </button>
      </div>
    </div>
  );
});
EntitySelector.displayName = 'EntitySelector';
