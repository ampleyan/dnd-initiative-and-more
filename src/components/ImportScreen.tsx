import React, { useState, useCallback } from 'react';
import {
  Link as LinkIcon,
  RefreshCw,
  UploadCloud,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Swords,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MonsterTemplate, Spell, Player, Encounter, ClassFeature, ParsedEncounter } from '../types';
import { AdventureImportModal } from './AdventureImportModal';
import { DndBeyondImport, FileDropZone, EntitySelector, FoundryImport, processJson, MappedEntity } from './import';
import { api } from '../api/client';

interface ImportScreenProps {
  onImportMonsters: (monsters: MonsterTemplate[]) => void;
  onImportSpells: (spells: Spell[]) => void;
  onImportEncounters: (encounters: Encounter[]) => void;
  onCancel?: () => void;
  players: Player[];
  onImportPlayer: (dndBeyondId: string, cobaltSession?: string) => Promise<any>;
  onCreatePlayer?: (data: Partial<Player>) => Promise<Player>;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<any>;
  onRemovePlayer: (id: string) => Promise<void>;
  monsters: MonsterTemplate[];
  classFeatures: ClassFeature[];
  onImportEncountersFromAdventure: (encounters: Encounter[]) => void;
  onImportAdventureAsCampaign?: (name: string, description: string, chapters: Array<{ name: string; encounters: Encounter[] }>) => Promise<void>;
  onImportClassFeatures?: (features: ClassFeature[]) => void;
  existingEncounters?: Encounter[];
  onImportScene?: (scene: { name: string; backgroundImg: string }) => void;
  currentEncounterId?: string | null;
}

const QUICK_LINKS = [
  { label: 'MM Monsters',   url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-mm.json',  tag: 'M' },
  { label: 'XMM Monsters',  url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-xmm.json', tag: 'M' },
  { label: 'VGM Monsters',  url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-vgm.json', tag: 'M' },
  { label: 'MTF Monsters',  url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-mtf.json', tag: 'M' },
  { label: 'WBTW Monsters', url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/refs/heads/main/data/bestiary/bestiary-wbtw.json', tag: 'M' },
  { label: 'PHB Spells',    url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/spells-phb.json',      tag: 'S' },
  { label: 'XGTE Spells',   url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/spells-xge.json',      tag: 'S' },
  { label: 'SRD Monsters',  url: 'https://api.open5e.com/v1/monsters/?format=json&limit=500', tag: 'M' },
  { label: 'SRD Spells',    url: 'https://api.open5e.com/v1/spells/?format=json&limit=500',   tag: 'S' },
];

export const ImportScreen: React.FC<ImportScreenProps> = ({
  onImportMonsters,
  onImportSpells,
  onImportEncounters,
  onCancel,
  players,
  onImportPlayer,
  onCreatePlayer,
  onUpdatePlayer,
  onRemovePlayer,
  monsters,
  classFeatures,
  onImportEncountersFromAdventure,
  onImportAdventureAsCampaign,
  onImportClassFeatures,
  existingEncounters = [],
  onImportScene,
  currentEncounterId,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('dndbeyond');
  const [mappedEntities, setMappedEntities] = useState<MappedEntity[]>([]);
  const [urlSectionExpanded, setUrlSectionExpanded] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [fetchingUrls, setFetchingUrls] = useState<Set<string>>(new Set());
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const addEntities = useCallback((newEntities: MappedEntity[]) => {
    setMappedEntities(prev => [...prev, ...newEntities]);
  }, []);

  const handleFoundryJournals = useCallback((encounters: ParsedEncounter[]) => {
    const mapped: MappedEntity[] = encounters.map(enc => ({
      id: enc.id || Math.random().toString(36).substr(2, 9),
      name: enc.name,
      type: 'Encounter',
      format: 'Foundry Journal',
      status: 'detected' as const,
      data: enc,
    }));
    addEntities(mapped);
  }, [addEntities]);

  const fetchSingleUrl = async (url: string) => {
    setFetchingUrls(prev => new Set([...prev, url]));
    try {
      const json = await api.proxy.fetch(url);
      const entities = await processJson(json as Parameters<typeof processJson>[0]);
      addEntities(entities);
    } catch (err) {
      console.error('Failed to fetch from URL', url, err);
    } finally {
      setFetchingUrls(prev => { const n = new Set(prev); n.delete(url); return n; });
    }
  };

  const handleFetchSelected = async () => {
    const urlsToFetch = [...selectedUrls];
    if (urlsToFetch.length === 0 && urlInput.trim()) {
      urlsToFetch.push(urlInput.trim());
      setUrlInput('');
    }
    if (urlsToFetch.length === 0) return;
    
    setIsFetchingUrl(true);
    await Promise.all(urlsToFetch.map(fetchSingleUrl));
    setSelectedUrls(new Set());
    setIsFetchingUrl(false);
  };

  const handleImport = useCallback((importedMonsters: MonsterTemplate[], spells: Spell[], encounters: Encounter[], features: ClassFeature[]) => {
    if (importedMonsters.length > 0) onImportMonsters(importedMonsters);
    if (spells.length > 0) onImportSpells(spells);
    if (encounters.length > 0) onImportEncounters(encounters);
    if (features.length > 0) onImportClassFeatures?.(features);
    setMappedEntities([]);
  }, [onImportMonsters, onImportSpells, onImportEncounters, onImportClassFeatures]);

  return (
    <div className="flex-1 flex flex-col text-white">
      <div className="flex-1 space-y-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high hover:bg-surface-bright text-outline hover:text-primary text-xs font-bold rounded-lg transition-all shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <h1 className="text-2xl font-headline font-bold tracking-tight">Import</h1>
        </div>

        {/* ── Source cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* D&D Beyond */}
          <button
            onClick={() => setSelectedSource('dndbeyond')}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-all",
              selectedSource === 'dndbeyond'
                ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_32px_0_rgba(255,135,189,0.08)]"
                : "bg-surface-container-low hover:bg-surface-container-high"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              selectedSource === 'dndbeyond' ? "bg-primary/20 text-primary" : "bg-white/5 text-outline group-hover:text-on-surface"
            )}>
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="font-headline font-bold text-sm text-on-surface">D&D Beyond</p>
              <p className="text-[11px] text-outline mt-0.5">Characters &amp; campaigns</p>
            </div>
            {selectedSource === 'dndbeyond' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          {/* 5etools Adventure */}
          <button
            onClick={() => setSelectedSource('adventure')}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-all",
              selectedSource === 'adventure'
                ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_32px_0_rgba(255,135,189,0.08)]"
                : "bg-surface-container-low hover:bg-surface-container-high"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              selectedSource === 'adventure' ? "bg-primary/20 text-primary" : "bg-white/5 text-outline group-hover:text-on-surface"
            )}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-headline font-bold text-sm text-on-surface">5etools Adventure</p>
              <p className="text-[11px] text-outline mt-0.5">Encounters, monsters &amp; NPCs</p>
            </div>
            {selectedSource === 'adventure' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          {/* Local File */}
          <button
            onClick={() => setSelectedSource('json')}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-all",
              selectedSource === 'json'
                ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_32px_0_rgba(255,135,189,0.08)]"
                : "bg-surface-container-low hover:bg-surface-container-high"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              selectedSource === 'json' ? "bg-primary/20 text-primary" : "bg-white/5 text-outline group-hover:text-on-surface"
            )}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="font-headline font-bold text-sm text-on-surface">Local File</p>
              <p className="text-[11px] text-outline mt-0.5">5etools / Foundry JSON</p>
            </div>
            {selectedSource === 'json' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          {/* Foundry VTT */}
          <button
            onClick={() => setSelectedSource('foundry')}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-all",
              selectedSource === 'foundry'
                ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_32px_0_rgba(255,135,189,0.08)]"
                : "bg-surface-container-low hover:bg-surface-container-high"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              selectedSource === 'foundry' ? "bg-primary/20 text-primary" : "bg-white/5 text-outline group-hover:text-on-surface"
            )}>
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <p className="font-headline font-bold text-sm text-on-surface">Foundry VTT</p>
              <p className="text-[11px] text-outline mt-0.5">World actors &amp; packs</p>
            </div>
            {selectedSource === 'foundry' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* Tab content */}
        {selectedSource === 'adventure' && (
          <AdventureImportModal
            inline
            isOpen={true}
            onClose={() => setSelectedSource('dndbeyond')}
            monsters={monsters}
            onImport={onImportEncountersFromAdventure}
            onImportAsCampaign={onImportAdventureAsCampaign}
            existingEncounters={existingEncounters}
          />
        )}

        {selectedSource === 'dndbeyond' && (
          <DndBeyondImport
            players={players}
            onImportPlayer={onImportPlayer}
            onUpdatePlayer={onUpdatePlayer}
            onRemovePlayer={onRemovePlayer}
          />
        )}

        {selectedSource === 'json' && (
          <FileDropZone onEntitiesParsed={addEntities} />
        )}

        {selectedSource === 'foundry' && (
          <FoundryImport
            onImportMonsters={onImportMonsters}
            onImportSpells={onImportSpells}
            onImportScene={onImportScene}
            currentEncounterId={currentEncounterId}
            onCreatePlayer={onCreatePlayer}
            onImportEncounters={handleFoundryJournals}
          />
        )}

        {/* ── Advanced: URL import (collapsed) ─────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-surface-container-low">
          <button
            onClick={() => setUrlSectionExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-outline" />
              <span className="text-xs font-bold text-outline uppercase tracking-widest">URL Import</span>
              <span className="text-[10px] text-outline/50">5etools bestiary, spells &amp; more</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-outline transition-transform", urlSectionExpanded && "rotate-180")} />
          </button>

          {urlSectionExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                <div className="grid grid-cols-2 gap-1.5 pt-3">
                  {QUICK_LINKS.map(link => {
                    const isSelected = selectedUrls.has(link.url);
                    const isFetching = fetchingUrls.has(link.url);
                    return (
                      <button
                        key={link.url}
                        onClick={() => setSelectedUrls(prev => { const n = new Set(prev); isSelected ? n.delete(link.url) : n.add(link.url); return n; })}
                        disabled={isFetching}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-lg text-left border transition-all",
                          isSelected ? "bg-primary/10 border-primary/40 text-on-surface" : "bg-black/20 border-white/5 text-outline hover:border-white/15 hover:text-on-surface",
                          isFetching && "opacity-60"
                        )}
                      >
                        {isFetching
                          ? <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-primary" />
                          : <div className={cn("w-3 h-3 rounded border shrink-0 flex items-center justify-center transition-colors", isSelected ? "bg-primary border-primary" : "border-white/30")}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-white" />}
                            </div>
                        }
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${link.tag === 'S' ? 'bg-violet-500/20 text-violet-300' : 'bg-red-500/20 text-red-300'}`}>{link.tag}</span>
                        <span className="text-[11px] truncate">{link.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1 border-t border-white/5">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && urlInput) { setSelectedUrls(prev => new Set([...prev, urlInput])); setUrlInput(''); } }}
                    placeholder="Paste a custom URL and press Enter…"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between">
                  {selectedUrls.size > 0 && <span className="text-[11px] text-outline">{selectedUrls.size} source{selectedUrls.size > 1 ? 's' : ''} selected</span>}
                  <div className="flex gap-2 ml-auto">
                    {selectedUrls.size > 0 && <button onClick={() => setSelectedUrls(new Set())} className="text-xs text-outline hover:text-on-surface transition-colors">Clear</button>}
                    <button
                      onClick={handleFetchSelected}
                      disabled={(selectedUrls.size === 0 && !urlInput.trim()) || isFetchingUrl}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-bold text-xs disabled:opacity-50 transition-all"
                    >
                      {isFetchingUrl ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      {isFetchingUrl ? `Fetching… (${fetchingUrls.size} left)` : selectedUrls.size > 0 ? `Fetch ${selectedUrls.size}` : 'Fetch URL'}
                    </button>
                  </div>
                </div>
              </div>
          )}
        </div>

        {mappedEntities.length > 0 && (
          <EntitySelector
            entities={mappedEntities}
            monsters={monsters}
            classFeatures={classFeatures}
            existingEncounters={existingEncounters}
            onImport={handleImport}
            onClear={() => setMappedEntities([])}
          />
        )}
      </div>
    </div>
  );
};
