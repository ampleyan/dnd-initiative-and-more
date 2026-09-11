import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ImportReviewAction, MappedEntity, reviewImportEntities } from './helpers';
import { ClassFeature, Encounter, MonsterTemplate, Spell } from '../../types';

interface EntitySelectorProps {
  entities: MappedEntity[];
  monsters: MonsterTemplate[];
  spells?: Spell[];
  classFeatures: ClassFeature[];
  existingEncounters: Encounter[];
  onImport: (monsters: MonsterTemplate[], spells: Spell[], encounters: Encounter[], features: ClassFeature[]) => void;
  onClear: () => void;
}

const actionStyles: Record<ImportReviewAction, string> = {
  create: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  update: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  skip: 'bg-white/5 text-outline border-white/10',
  invalid: 'bg-red-500/10 text-red-400 border-red-500/20',
  'needs-choice': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const entityStyles: Record<string, string> = {
  Monster: 'bg-red-500/10 text-red-400',
  Spell: 'bg-violet-500/10 text-violet-400',
  Feature: 'bg-amber-500/10 text-amber-400',
  Encounter: 'bg-blue-500/10 text-blue-400',
};

export const EntitySelector = React.memo<EntitySelectorProps>(({
  entities,
  monsters,
  spells,
  classFeatures,
  existingEncounters,
  onImport,
  onClear,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isReviewing, setIsReviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [choices, setChoices] = useState<Record<string, 'create' | 'update' | 'skip'>>({});
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newIds = entities.filter(entity => !seenIdsRef.current.has(entity.id)).map(entity => entity.id);
    entities.forEach(entity => seenIdsRef.current.add(entity.id));
    if (newIds.length > 0) {
      setSelectedIds(previous => new Set([...previous, ...newIds]));
      setIsReviewing(false);
      setChoices({});
    }
  }, [entities]);

  const selectedEntities = useMemo(
    () => entities.filter(entity => selectedIds.has(entity.id)),
    [entities, selectedIds],
  );
  const review = useMemo(
    () => reviewImportEntities(selectedEntities, { monsters, spells, encounters: existingEncounters, features: classFeatures }),
    [selectedEntities, monsters, spells, existingEncounters, classFeatures],
  );
  const unresolvedChoices = review.items.filter(item => item.action === 'needs-choice' && !choices[item.entity.id]).length;

  const getEffectiveAction = (action: ImportReviewAction, id: string): ImportReviewAction => {
    return action === 'needs-choice' ? choices[id] ?? action : action;
  };

  const toggleEntity = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirmImport = () => {
    if (isImporting || unresolvedChoices > 0) return;
    const approved = review.items.filter(item => {
      const action = getEffectiveAction(item.action, item.entity.id);
      return action === 'create' || action === 'update';
    }).map(item => item.entity);

    setIsImporting(true);
    onImport(
      approved.filter(entity => entity.type === 'Monster').map(entity => entity.data as MonsterTemplate),
      approved.filter(entity => entity.type === 'Spell').map(entity => entity.data as Spell),
      approved.filter(entity => entity.type === 'Encounter').map(entity => entity.data as Encounter),
      approved.filter(entity => entity.type === 'Feature').map(entity => entity.data as ClassFeature),
    );
    setSelectedIds(new Set());
    setChoices({});
    setIsReviewing(false);
    setIsImporting(false);
  };

  const clearSelection = () => {
    onClear();
    setSelectedIds(new Set());
    setChoices({});
    setIsReviewing(false);
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <h3 className="text-sm font-bold">{isReviewing ? 'Review & import' : 'Select data'}</h3>
          <p className="text-[10px] text-outline">{selectedEntities.length} selected of {entities.length}</p>
        </div>
        {!isReviewing && entities.length > 0 && (
          <button
            onClick={() => setSelectedIds(selectedIds.size === entities.length ? new Set() : new Set(entities.map(entity => entity.id)))}
            className="text-[10px] text-outline hover:text-on-surface transition-colors font-bold"
          >
            {selectedIds.size === entities.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {!isReviewing ? (
        <div className="max-h-72 overflow-y-auto">
          {entities.map(entity => {
            const isSelected = selectedIds.has(entity.id);
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => toggleEntity(entity.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-white/5 transition-colors hover:bg-white/5',
                  !isSelected && 'opacity-45',
                )}
              >
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', isSelected ? 'border-primary bg-primary' : 'border-white/30')}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{entity.name}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', entityStyles[entity.type] ?? 'bg-white/5 text-outline')}>
                  {entity.type}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <div className="grid grid-cols-5 gap-px bg-white/5 border-b border-white/5">
            {([
              ['Create', review.summary.create, 'text-emerald-400'],
              ['Update', review.summary.update, 'text-blue-400'],
              ['Choice', review.summary.needsChoice, 'text-amber-400'],
              ['Skip', review.summary.skip, 'text-outline'],
              ['Invalid', review.summary.invalid, 'text-red-400'],
            ] as const).map(([label, count, color]) => (
              <div key={label} className="bg-surface-container-low px-2 py-2 text-center">
                <div className={cn('text-sm font-bold', color)}>{count}</div>
                <div className="text-[9px] uppercase tracking-wider text-outline">{label}</div>
              </div>
            ))}
          </div>
          {review.items.map(item => {
            const action = getEffectiveAction(item.action, item.entity.id);
            return (
              <div key={item.entity.id} className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium flex-1 truncate">{item.entity.name}</span>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider', actionStyles[action])}>{action}</span>
                </div>
                <p className="mt-1 text-[10px] text-outline">{item.reason}</p>
                {item.action === 'needs-choice' && (
                  <div className="mt-2 flex gap-2">
                    {(['create', 'update', 'skip'] as const).map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setChoices(previous => ({ ...previous, [item.entity.id]: choice }))}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-bold capitalize border transition-colors',
                          choices[item.entity.id] === choice ? actionStyles[choice] : 'border-white/10 text-outline hover:text-white',
                        )}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <button onClick={isReviewing ? () => setIsReviewing(false) : clearSelection} className="text-xs font-bold text-outline hover:text-white transition-colors flex items-center gap-1">
          {isReviewing && <ArrowLeft className="w-3.5 h-3.5" />}
          {isReviewing ? 'Back to selection' : 'Clear all'}
        </button>
        {isReviewing ? (
          <button
            onClick={handleConfirmImport}
            disabled={isImporting || unresolvedChoices > 0}
            className={cn('px-5 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2', unresolvedChoices === 0 ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-white/5 text-outline cursor-not-allowed')}
          >
            {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isImporting ? 'Importing…' : unresolvedChoices > 0 ? `Choose ${unresolvedChoices} action${unresolvedChoices === 1 ? '' : 's'}` : 'Confirm import'}
          </button>
        ) : (
          <button
            onClick={() => setIsReviewing(true)}
            disabled={selectedEntities.length === 0}
            className={cn('px-5 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2', selectedEntities.length > 0 ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-white/5 text-outline cursor-not-allowed')}
          >
            Review & import <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

EntitySelector.displayName = 'EntitySelector';
