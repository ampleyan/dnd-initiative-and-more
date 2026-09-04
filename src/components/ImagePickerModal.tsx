import React, { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './Modal';
import type { ImageSearchResult } from '../api/client';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  initialQuery?: string;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchImages = useCallback(async (q: string, nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/images/search?q=${encodeURIComponent(q)}&offset=${nextOffset}`,
      );
      const data = await res.json() as { results: ImageSearchResult[]; hasMore: boolean; error?: string };
      if (nextOffset === 0) {
        setResults(data.results);
      } else {
        setResults(prev => [...prev, ...data.results]);
      }
      setHasMore(data.hasMore);
      setOffset(nextOffset + 24);
      if (data.error && data.results.length === 0) setError(data.error);
    } catch {
      setError('Search failed. Check your connection.');
      if (nextOffset === 0) setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setOffset(0);
    fetchImages(query, 0);
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Images" size="xl">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. dark forest dungeon D&D fantasy"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </form>

      {loading && results.length === 0 && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video bg-surface-container-high rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-center text-outline text-sm py-10">
          {error ?? 'No results'} — try different keywords.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {results.map((r, i) => (
            <button
              key={`${r.image}-${i}`}
              onClick={() => handleSelect(r.image)}
              className="relative group rounded-lg overflow-hidden border border-white/10 aspect-video hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img
                src={r.thumb}
                alt={r.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-white/80 truncate block">{r.source}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length > 0 && hasMore && (
        <button
          onClick={() => fetchImages(query, offset)}
          disabled={loading}
          className="mt-4 w-full py-2 text-sm text-outline hover:text-on-surface border border-outline/20 rounded-lg hover:border-outline/40 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </Modal>
  );
};
