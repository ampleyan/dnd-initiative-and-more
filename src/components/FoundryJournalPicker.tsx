import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, BookOpen, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { api } from '../api/client';

const LS_DATA_PATH = 'foundry_data_path';
const LS_LAST_WORLD = 'foundry_last_world';

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

interface JournalPage {
  _id: string;
  name: string;
  text: { content: string };
}

interface Journal {
  _id: string;
  name: string;
  pages: JournalPage[];
}

interface Props {
  onImport: (text: string) => void;
  onClose: () => void;
}

export const FoundryJournalPicker: React.FC<Props> = ({ onImport, onClose }) => {
  const dataPath = localStorage.getItem(LS_DATA_PATH) ?? '';
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  const [selectedWorld, setSelectedWorld] = useState(() => localStorage.getItem(LS_LAST_WORLD) ?? '');
  const [journals, setJournals] = useState<Journal[]>([]);
  const [search, setSearch] = useState('');
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [worldsLoading, setWorldsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dataPath) return;
    setWorldsLoading(true);
    api.foundry.worlds(dataPath)
      .then(data => {
        setWorlds(data);
        if (!selectedWorld && data.length > 0) {
          setSelectedWorld(data[0].id);
          localStorage.setItem(LS_LAST_WORLD, data[0].id);
        }
      })
      .catch(e => setError(e.message ?? 'Failed to load worlds'))
      .finally(() => setWorldsLoading(false));
  }, [dataPath]);

  const fetchJournals = useCallback(async (world: string, q: string) => {
    if (!world) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.foundry.journals({
        world,
        search: q || undefined,
        full: true,
        dataPath: dataPath || undefined,
      });
      setJournals(data as Journal[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load journals');
    } finally {
      setLoading(false);
    }
  }, [dataPath]);

  useEffect(() => {
    if (!selectedWorld) return;
    const t = setTimeout(() => fetchJournals(selectedWorld, search), 300);
    return () => clearTimeout(t);
  }, [selectedWorld, search, fetchJournals]);

  const togglePage = (pageId: string, content: string) => {
    setSelectedPages(prev => {
      const next = new Map(prev);
      next.has(pageId) ? next.delete(pageId) : next.set(pageId, content);
      return next;
    });
  };

  const toggleJournal = (journalId: string) => {
    setExpandedJournals(prev => {
      const next = new Set(prev);
      next.has(journalId) ? next.delete(journalId) : next.add(journalId);
      return next;
    });
  };

  const handleImport = () => {
    if (selectedPages.size === 0) return;
    const text = [...selectedPages.values()].map(stripHtml).filter(Boolean).join('\n\n');
    onImport(text);
    onClose();
  };

  if (!dataPath) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-white/10" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline font-bold text-base text-on-surface">Import from Foundry</h2>
            <button onClick={onClose} className="text-outline hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-outline/70">Foundry data path not configured. Set it in the <strong className="text-on-surface">Import → Foundry</strong> tab first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h2 className="font-headline font-bold text-base text-on-surface">Import from Foundry Journal</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* World selector + search */}
        <div className="px-4 pt-3 pb-2 shrink-0 space-y-2">
          <select
            value={selectedWorld}
            onChange={e => { setSelectedWorld(e.target.value); localStorage.setItem(LS_LAST_WORLD, e.target.value); }}
            disabled={worldsLoading}
            className="w-full bg-surface-container-highest border border-outline/20 rounded-lg px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary/50"
          >
            {worlds.length === 0 && <option value="">Loading worlds…</option>}
            {worlds.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search journals…"
              className="w-full bg-surface-container-highest border border-outline/20 rounded-lg pl-7 pr-3 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-outline/40"
            />
          </div>
        </div>

        {error && <p className="px-4 pb-2 text-xs text-error shrink-0">{error}</p>}

        {/* Journal list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-3 space-y-1">
          {loading && <p className="text-xs text-outline/50 italic text-center py-6">Loading journals…</p>}
          {!loading && journals.length === 0 && !error && (
            <p className="text-xs text-outline/50 italic text-center py-6">No journals found</p>
          )}
          {journals.map(journal => {
            const isExpanded = expandedJournals.has(journal._id);
            const selectedCount = journal.pages.filter(p => selectedPages.has(p._id)).length;
            return (
              <div key={journal._id} className="rounded-lg border border-white/8 overflow-hidden">
                <button
                  onClick={() => toggleJournal(journal._id)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest transition-colors text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-outline/50 shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-outline/50 shrink-0" />}
                  <span className="text-sm font-bold text-on-surface flex-1 truncate">{journal.name}</span>
                  <span className="text-[10px] text-outline/40 shrink-0">{journal.pages.length} pages</span>
                  {selectedCount > 0 && (
                    <span className="text-[10px] font-bold text-primary shrink-0">{selectedCount} selected</span>
                  )}
                </button>
                {isExpanded && journal.pages.length > 0 && (
                  <div className="divide-y divide-white/5">
                    {journal.pages.map(page => {
                      const isSelected = selectedPages.has(page._id);
                      const preview = stripHtml(page.text?.content ?? '').slice(0, 120);
                      return (
                        <button
                          key={page._id}
                          onClick={() => togglePage(page._id, page.text?.content ?? '')}
                          className={`w-full text-left px-4 py-2 flex items-start gap-2.5 transition-colors ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-white/3'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-primary border-primary' : 'border-outline/30'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-on-primary" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{page.name}</p>
                            {preview && <p className="text-[10px] text-outline/50 leading-relaxed mt-0.5 line-clamp-2">{preview}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {isExpanded && journal.pages.length === 0 && (
                  <p className="px-4 py-2 text-xs text-outline/40 italic">No text pages</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <span className="text-xs text-outline/50">
            {selectedPages.size === 0 ? 'Select pages to import' : `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedPages.size === 0}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Append to notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
