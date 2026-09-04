import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { MonsterTemplate } from '../types';
import { AvatarImg } from './AvatarImg';
import { cn } from '../lib/utils';

interface AddMonsterDrawerProps {
  monsters: MonsterTemplate[];
  onAdd: (monster: MonsterTemplate) => void;
  onClose: () => void;
}

const CR_OPTIONS = [
  'any', '0', '1/8', '1/4', '1/2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
];

function parseCR(cr: string): number {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  const n = parseFloat(cr);
  return isNaN(n) ? Infinity : n;
}

export const AddMonsterDrawer: React.FC<AddMonsterDrawerProps> = ({ monsters, onAdd, onClose }) => {
  const [search, setSearch] = useState('');
  const [maxCR, setMaxCR] = useState('any');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = monsters
    .filter(m => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (maxCR !== 'any' && parseCR(m.cr) > parseCR(maxCR)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 max-h-[60vh] flex flex-col bg-surface-container border border-outline-variant/20 rounded-t-2xl shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/15 shrink-0">
          <span className="font-bold text-sm text-on-surface shrink-0">Add Monster</span>
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline/50 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={maxCR}
              onChange={e => setMaxCR(e.target.value)}
              className="bg-surface-container-high border-none rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary"
            >
              {CR_OPTIONS.map(cr => (
                <option key={cr} value={cr}>{cr === 'any' ? 'Any CR' : `≤ CR ${cr}`}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-center text-outline/50 text-xs py-8 italic">No monsters found</p>
          ) : (
            filtered.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-high group transition-colors"
              >
                <AvatarImg
                  src={m.image || m.avatar}
                  name={m.name}
                  className="w-7 h-7 rounded shrink-0 text-[10px]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{m.name}</p>
                  <p className="text-[10px] text-outline/60 truncate">{m.type} · CR {m.cr}</p>
                </div>
                <button
                  onClick={() => onAdd(m)}
                  className={cn(
                    'shrink-0 p-1.5 rounded transition-colors',
                    'bg-primary/10 hover:bg-primary text-primary hover:text-on-primary',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100'
                  )}
                  title={`Add ${m.name} to encounter`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
