import React, { useState, useRef, useCallback } from 'react';
import { Link, Upload, FileText, AlertTriangle, CheckSquare, Square, Loader2, ScrollText, ChevronDown, ChevronRight, BookOpen, Search, Swords, User, HelpCircle } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { parseMarkdown, parseFoundryJournal } from '../lib/adventureParser';
import { matchCreatures } from '../lib/monsterMatcher';
import { cn } from '../lib/utils';
import type { MonsterTemplate, ParsedEncounter, ParsedCreature, Encounter, Combatant } from '../types';

interface FiveToolsChapter {
  index: number;
  name: string;
  chapterNum: number | null;
  type: string;
}

interface FiveToolsMeta {
  meta: { id: string; name: string; author: string; level: { start: number; end: number }; published: string; storyline: string };
  summary: string;
  chapters: FiveToolsChapter[];
}

interface AdventureImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: MonsterTemplate[];
  onImport: (encounters: Encounter[]) => void;
  onImportAsCampaign?: (name: string, description: string, chapters: Array<{ name: string; encounters: Encounter[] }>) => Promise<void>;
  existingEncounters?: Encounter[];
  /** When true, renders content inline without the <Modal> wrapper */
  inline?: boolean;
}

type SourceType = 'url' | 'upload' | 'foundry' | 'paste' | '5etools';
type Step = 'source' | 'review';

type CreatureRole = 'combatant' | 'npc' | 'uncertain';

interface ReviewEncounter extends ParsedEncounter {
  selected: boolean;
  creatureOverrides: Record<string, string>;
  roleOverrides: Record<string, CreatureRole>;
}

function buildEncounterFromParsed(
  parsed: ParsedEncounter,
  monsters: MonsterTemplate[],
  overrides: Record<string, string>,
  roleOverrides: Record<string, CreatureRole>,
): Encounter {
  const combatants: Combatant[] = [];

  for (const creature of parsed.creatures) {
    // Skip creatures marked as NPC
    const effectiveRole = roleOverrides[creature.rawName] ?? creature.role ?? 'uncertain';
    if (effectiveRole === 'npc') continue;

    const matchedId = overrides[creature.rawName] ?? creature.matchedId;
    if (!matchedId) continue;

    const monster = monsters.find(m => m.id === matchedId);
    if (!monster) continue;

    const now = Date.now();
    for (let i = 0; i < creature.count; i++) {
      combatants.push({
        id: `${matchedId}-${now}-${Math.random().toString(36).slice(2)}`,
        name: monster.name,
        type: 'monster',
        initiative: 0,
        hp: { current: monster.hp, max: monster.hp },
        ac: monster.ac,
        speed: monster.speed,
        subtitle: `CR ${monster.cr}`,
        avatar: monster.image,
        conditions: [],
        tags: monster.tags ?? [],
        stats: { ...monster.stats },
        actions: monster.actions,
        abilities: monster.abilities,
      });
    }
  }

  return {
    id: `encounter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: parsed.name,
    combatants,
    lastModified: new Date().toISOString(),
    description: parsed.description,
    folder: parsed.chapter ?? '',
  };
}

const ROLE_CYCLE: CreatureRole[] = ['combatant', 'npc', 'uncertain'];

function RoleBadge({ role, onClick }: { role: CreatureRole; onClick: (e: React.MouseEvent) => void }) {
  if (role === 'combatant') return (
    <button
      onClick={onClick}
      title="Enemy — click to change"
      className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
    >
      <Swords className="w-3 h-3" /> Enemy
    </button>
  );
  if (role === 'npc') return (
    <button
      onClick={onClick}
      title="NPC — click to change"
      className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
    >
      <User className="w-3 h-3" /> NPC
    </button>
  );
  return (
    <button
      onClick={onClick}
      title="Uncertain — click to change"
      className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-outline hover:bg-white/15 transition-colors"
    >
      <HelpCircle className="w-3 h-3" /> ?
    </button>
  );
}

export const AdventureImportModal: React.FC<AdventureImportModalProps> = ({
  isOpen,
  onClose,
  monsters,
  onImport,
  onImportAsCampaign,
  existingEncounters = [],
  inline = false,
}) => {
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<SourceType>('5etools');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewEncounters, setReviewEncounters] = useState<ReviewEncounter[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expandedDescs, setExpandedDescs] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fiveToolsId, setFiveToolsId] = useState('wbtw');
  const [fiveToolsMeta, setFiveToolsMeta] = useState<FiveToolsMeta | null>(null);
  const [fiveToolsMetaLoading, setFiveToolsMetaLoading] = useState(false);
  const [fiveToolsMetaError, setFiveToolsMetaError] = useState<string | null>(null);
  const [fiveToolsSelectedChapters, setFiveToolsSelectedChapters] = useState<Set<number>>(new Set());

  const reset = useCallback(() => {
    setStep('source');
    setSource('5etools');
    setUrl('');
    setPasteText('');
    setLoading(false);
    setError(null);
    setReviewEncounters([]);
    setFileName(null);
    setExpandedDescs(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFiveToolsId('wbtw');
    setFiveToolsMeta(null);
    setFiveToolsMetaLoading(false);
    setFiveToolsMetaError(null);
    setFiveToolsSelectedChapters(new Set());
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const processEncounters = useCallback((parsed: ParsedEncounter[]) => {
    const matched = parsed.map(enc => ({
      ...enc,
      creatures: matchCreatures(enc.creatures, monsters),
      selected: true,
      creatureOverrides: {} as Record<string, string>,
      roleOverrides: {} as Record<string, CreatureRole>,
    }));
    setReviewEncounters(matched);
    setStep('review');
  }, [monsters]);

  const loadFiveToolsMeta = useCallback(async () => {
    if (!fiveToolsId.trim()) return;
    setFiveToolsMetaError(null);
    setFiveToolsMetaLoading(true);
    setFiveToolsMeta(null);
    setFiveToolsSelectedChapters(new Set());
    try {
      const data = await api.adventures.fetchMeta(fiveToolsId.trim()) as FiveToolsMeta;
      setFiveToolsMeta(data);
    } catch (err) {
      setFiveToolsMetaError(err instanceof Error ? err.message : 'Failed to load adventure');
    } finally {
      setFiveToolsMetaLoading(false);
    }
  }, [fiveToolsId]);

  const handleDetect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (source === 'url') {
        const data = await api.adventures.parseUrl(url) as { encounters: ParsedEncounter[] };
        if (!Array.isArray(data?.encounters)) throw new Error('Unexpected server response');
        processEncounters(data.encounters);
      } else if (source === 'upload' || source === 'foundry') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) throw new Error('No file selected');
        const text = await file.text();
        processEncounters(source === 'upload' ? parseMarkdown(text) : parseFoundryJournal(text));
      } else if (source === '5etools') {
        if (!fiveToolsMeta) throw new Error('Load an adventure first');
        if (fiveToolsSelectedChapters.size === 0) throw new Error('Select at least one chapter');
        const allEncounters: ParsedEncounter[] = [];
        for (const chIdx of Array.from(fiveToolsSelectedChapters).sort((a, b) => a - b)) {
          const data = await api.adventures.fetchChapter(fiveToolsMeta.meta.id.toLowerCase(), chIdx) as { encounters: ParsedEncounter[] };
          allEncounters.push(...(data.encounters || []));
        }
        processEncounters(allEncounters);
      } else {
        if (!pasteText.trim()) throw new Error('No text to parse');
        processEncounters(parseMarkdown(pasteText));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [source, url, pasteText, processEncounters, fiveToolsMeta, fiveToolsSelectedChapters]);

  const toggleEncounter = useCallback((idx: number) => {
    setReviewEncounters(prev =>
      prev.map((enc, i) => i === idx ? { ...enc, selected: !enc.selected } : enc)
    );
  }, []);

  const setCreatureOverride = useCallback((encIdx: number, rawName: string, monsterId: string) => {
    setReviewEncounters(prev =>
      prev.map((enc, i) =>
        i === encIdx
          ? { ...enc, creatureOverrides: { ...enc.creatureOverrides, [rawName]: monsterId } }
          : enc
      )
    );
  }, []);

  const setRoleOverride = useCallback((encIdx: number, rawName: string, role: CreatureRole) => {
    setReviewEncounters(prev => prev.map((enc, i) =>
      i === encIdx
        ? { ...enc, roleOverrides: { ...enc.roleOverrides, [rawName]: role } }
        : enc
    ));
  }, []);

  const handleImport = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const selected = reviewEncounters.filter(e => e.selected);
      const built = selected.map(e => buildEncounterFromParsed(e, monsters, e.creatureOverrides, e.roleOverrides));

      if (source === '5etools' && onImportAsCampaign && fiveToolsMeta) {
        const chapterGroups = new Map<string, Encounter[]>();
        for (let i = 0; i < selected.length; i++) {
          const chapterBase = selected[i].chapter ?? 'Imported';
          if (!chapterGroups.has(chapterBase)) chapterGroups.set(chapterBase, []);
          chapterGroups.get(chapterBase)!.push(built[i]);
        }
        const chapters = Array.from(chapterGroups.entries()).map(([name, encounters]) => ({ name, encounters }));
        await onImportAsCampaign(fiveToolsMeta.meta.name, fiveToolsMeta.summary ?? '', chapters);
      } else {
        onImport(built);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  }, [reviewEncounters, monsters, onImport, onImportAsCampaign, handleClose, source, fiveToolsMeta]);

  const selectedCount = reviewEncounters.filter(e => e.selected).length;

  const existingEncounterNames = React.useMemo(
    () => new Set(existingEncounters.map(e => e.name.trim().toLowerCase())),
    [existingEncounters]
  );

  const duplicateCount = reviewEncounters.filter(e => existingEncounterNames.has(e.name.trim().toLowerCase())).length;

  const hasUnmatched = (enc: ReviewEncounter) =>
    enc.creatures.some(c => !c.matchedId && !enc.creatureOverrides[c.rawName]);

  const isDetectDisabled =
    loading ||
    (source === 'url' && !url.trim()) ||
    (source === 'paste' && !pasteText.trim()) ||
    ((source === 'upload' || source === 'foundry') && !fileName) ||
    (source === '5etools' && fiveToolsSelectedChapters.size === 0);

  const content = (
    <>
      {step === 'source' && (
        <div className="space-y-6">
          {/* Source type tabs — hidden in inline/5etools-only mode */}
          {!inline && (
            <div className="flex gap-2 flex-wrap">
            {(['5etools', 'url', 'upload', 'foundry', 'paste'] as SourceType[]).map(s => {
              const icons = { '5etools': BookOpen, url: Link, upload: Upload, foundry: ScrollText, paste: FileText };
              const labels = { '5etools': '5etools', url: 'URL', upload: 'Markdown', foundry: 'Foundry JSON', paste: 'Paste' };
              const Icon = icons[s];
              return (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-xs font-medium transition-colors',
                    source === s
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-outline-variant/20 text-outline hover:bg-surface-container-high hover:text-on-surface'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {labels[s]}
                </button>
              );
            })}
            </div>
          )}

          {source === '5etools' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fiveToolsId}
                  onChange={e => { setFiveToolsId(e.target.value); setFiveToolsMeta(null); setFiveToolsMetaError(null); }}
                  onKeyDown={e => e.key === 'Enter' && loadFiveToolsMeta()}
                  placeholder="Adventure ID (e.g. wbtw)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={loadFiveToolsMeta}
                  disabled={fiveToolsMetaLoading || !fiveToolsId.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-highest border border-outline-variant/20 text-on-surface text-sm font-medium hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fiveToolsMetaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Load
                </button>
              </div>

              {fiveToolsMetaError && (
                <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
                  {fiveToolsMetaError}
                </div>
              )}

              {fiveToolsMeta && (
                <div className="space-y-3">
                  <div className="px-4 py-3 rounded-xl bg-surface-container-highest border border-outline-variant/20 space-y-1">
                    <p className="font-semibold text-on-surface text-sm">{fiveToolsMeta.meta.name}</p>
                    <p className="text-xs text-outline">
                      {fiveToolsMeta.meta.author} · Levels {fiveToolsMeta.meta.level?.start}–{fiveToolsMeta.meta.level?.end} · {fiveToolsMeta.meta.published?.slice(0, 4)}
                    </p>
                    {fiveToolsMeta.summary && (
                      <p className="text-xs text-outline/80 leading-relaxed mt-2 line-clamp-4">
                        {fiveToolsMeta.summary}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-outline">Chapters</p>
                      <button
                        onClick={() => {
                          const chapterIndices = fiveToolsMeta.chapters
                            .filter(c => c.type === 'chapter')
                            .map(c => c.index);
                          setFiveToolsSelectedChapters(
                            fiveToolsSelectedChapters.size === chapterIndices.length
                              ? new Set()
                              : new Set(chapterIndices)
                          );
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {fiveToolsSelectedChapters.size === fiveToolsMeta.chapters.filter(c => c.type === 'chapter').length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {fiveToolsMeta.chapters.map(ch => {
                        const isSelected = fiveToolsSelectedChapters.has(ch.index);
                        const label = ch.chapterNum != null ? `Ch. ${ch.chapterNum}: ${ch.name}` : ch.name;
                        return (
                          <button
                            key={ch.index}
                            onClick={() => {
                              setFiveToolsSelectedChapters(prev => {
                                const next = new Set(prev);
                                next.has(ch.index) ? next.delete(ch.index) : next.add(ch.index);
                                return next;
                              });
                            }}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-surface-container-highest text-on-surface'
                            )}
                          >
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 flex-shrink-0" />
                              : <Square className="w-4 h-4 flex-shrink-0 text-outline" />
                            }
                            <span className={cn(ch.type !== 'chapter' && 'text-outline')}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {source === 'url' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface">Adventure URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://5e.tools/adventure.html#wbtw,4c"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {(source === 'upload' || source === 'foundry') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface">
                {source === 'upload' ? 'Markdown File (.md, .txt)' : 'Foundry Journal JSON (.json)'}
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-outline-variant/30 text-outline hover:border-primary/50 hover:text-primary cursor-pointer transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm">Click to select {source === 'upload' ? 'Markdown' : 'JSON'} file</span>
                <span className="text-xs text-outline font-mono">
                  {fileName ?? 'No file selected'}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={source === 'upload' ? '.md,.txt' : '.json'}
                className="hidden"
                onChange={e => { 
                  setError(null); 
                  setFileName(e.target.files?.[0]?.name ?? null); 
                }}
              />
            </div>
          )}

          {source === 'paste' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface">Markdown Text</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your adventure markdown here..."
                rows={8}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleDetect}
            disabled={isDetectDisabled}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Detecting Encounters...
              </>
            ) : (
              'Detect Encounters'
            )}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-outline">
              Found {reviewEncounters.length} encounter{reviewEncounters.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setStep('source')}
              className="text-sm text-primary hover:underline"
            >
              Back
            </button>
          </div>

          {duplicateCount > 0 && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed">
                  <span className="font-bold">{duplicateCount} encounter{duplicateCount > 1 ? 's' : ''}</span> already exist{duplicateCount === 1 ? 's' : ''} with the same name.
                </p>
              </div>
              <button
                onClick={() =>
                  setReviewEncounters(prev =>
                    prev.map(e =>
                      existingEncounterNames.has(e.name.trim().toLowerCase())
                        ? { ...e, selected: false }
                        : e
                    )
                  )
                }
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
              >
                Deselect Duplicates
              </button>
            </div>
          )}

          <div className="space-y-3">
            {reviewEncounters.map((enc, encIdx) => {
              const unmatched = hasUnmatched(enc);
              const isDuplicate = existingEncounterNames.has(enc.name.trim().toLowerCase());
              return (
                <div
                  key={enc.name || encIdx}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container-high overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-highest transition-colors"
                    onClick={() => toggleEncounter(encIdx)}
                  >
                    {enc.selected ? (
                      <CheckSquare className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-outline flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-on-surface text-sm truncate">{enc.name}</p>
                        {isDuplicate && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                            exists
                          </span>
                        )}
                      </div>
                      {enc.chapter && (
                        <p className="text-xs text-outline truncate">{enc.chapter}</p>
                      )}
                    </div>
                    {unmatched && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Unmatched
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-3 space-y-1.5 border-t border-outline-variant/10 pt-2">
                    {enc.creatures.map((creature, cIdx) => {
                      const resolvedId = enc.creatureOverrides[creature.rawName] ?? creature.matchedId;
                      const isMatched = !!resolvedId;
                      return (
                        <div key={creature.rawName || cIdx} className="flex items-center gap-2 text-sm">
                          {creature.role !== undefined && (() => {
                            const effectiveRole: CreatureRole = enc.roleOverrides[creature.rawName] ?? creature.role ?? 'uncertain';
                            const nextRole = ROLE_CYCLE[(ROLE_CYCLE.indexOf(effectiveRole) + 1) % ROLE_CYCLE.length];
                            return (
                              <RoleBadge
                                role={effectiveRole}
                                onClick={e => { e.stopPropagation(); setRoleOverride(encIdx, creature.rawName, nextRole); }}
                              />
                            );
                          })()}
                          {isMatched ? (
                            <span className={cn("text-on-surface", creature.role !== undefined && (enc.roleOverrides[creature.rawName] ?? creature.role) === 'npc' && "line-through text-outline/50")}>
                              {creature.count}× {creature.matchedName ?? monsters.find(m => m.id === resolvedId)?.name ?? creature.rawName}
                            </span>
                          ) : (
                            <span className="line-through text-outline">{creature.count}× {creature.rawName}</span>
                          )}
                          {!creature.matchedId && (
                            <select
                              value={enc.creatureOverrides[creature.rawName] ?? ''}
                              onChange={e => setCreatureOverride(encIdx, creature.rawName, e.target.value)}
                              className="ml-auto text-xs px-2 py-1 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Pick from library...</option>
                              {monsters.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                    {enc.description && (
                      <div className="mt-2 border-t border-outline-variant/10 pt-2">
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedDescs(prev => { const next = new Set(prev); next.has(encIdx) ? next.delete(encIdx) : next.add(encIdx); return next; }); }}
                          className="flex items-center gap-1.5 text-xs text-outline hover:text-on-surface transition-colors"
                        >
                          <ScrollText className="w-3.5 h-3.5" />
                          DM Notes
                          {expandedDescs.has(encIdx) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                        {expandedDescs.has(encIdx) && (
                          <p className="mt-1.5 text-xs text-outline/80 leading-relaxed italic">
                            {enc.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || saving}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              source === '5etools' && onImportAsCampaign && fiveToolsMeta
                ? `Import as Campaign (${selectedCount} encounter${selectedCount !== 1 ? 's' : ''})`
                : `Import ${selectedCount} Encounter${selectedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
    </>
  );

  if (inline) return content;
  return <Modal isOpen={isOpen} onClose={handleClose} title="Import Adventure">{content}</Modal>;
};
