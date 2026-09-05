import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, Dices, Plus, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { MonsterTemplate } from '../types';

interface AddEnemyModalProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: MonsterTemplate[];
  onAdd: (monster: MonsterTemplate, initiative: number, count: number, hidden: boolean, waveId: string) => void;
  existingWaves?: string[];
}

function dexMod(dex: number) {
  return Math.floor((dex - 10) / 2);
}

function rollInitiative(dex: number) {
  return Math.max(1, Math.floor(Math.random() * 20) + 1 + dexMod(dex));
}

function crSort(cr: string): number {
  if (cr === '0') return 0;
  if (cr.includes('/')) {
    const [n, d] = cr.split('/').map(Number);
    return n / d;
  }
  return parseFloat(cr) || 0;
}

export const AddEnemyModal: React.FC<AddEnemyModalProps> = ({ isOpen, onClose, monsters, onAdd, existingWaves = [] }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MonsterTemplate | null>(null);
  const [initiative, setInitiative] = useState('');
  const [count, setCount] = useState(1);
  const [waveId, setWaveId] = useState('default');
  const [startHidden, setStartHidden] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelected(null);
      setInitiative('');
      setCount(1);
      setWaveId('default');
      setStartHidden(false);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? monsters.filter(m => m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
      : monsters;
    return [...list].sort((a, b) => crSort(a.cr) - crSort(b.cr) || a.name.localeCompare(b.name));
  }, [monsters, search]);

  const handleSelect = (m: MonsterTemplate) => {
    setSelected(m);
    setInitiative(String(rollInitiative(m.stats?.dex ?? 10)));
    setCount(1);
  };

  const handleReroll = () => {
    if (!selected) return;
    setInitiative(String(rollInitiative(selected.stats?.dex ?? 10)));
  };

  const handleAdd = () => {
    if (!selected) return;
    const init = Math.max(1, Math.min(30, parseInt(initiative) || 10));
    onAdd(selected, init, count, startHidden, waveId.trim() || 'default');
    // Stay open so DM can add more enemies
    setSelected(null);
    setInitiative('');
    setCount(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <h2 className="font-headline font-bold text-lg text-on-surface">Add Enemy</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: search + list */}
          <div className="flex flex-col w-72 shrink-0 border-r border-white/8">
            <div className="p-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container border border-white/8 focus-within:border-primary/60 transition-colors">
                <Search className="w-3.5 h-3.5 text-outline shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search monsters…"
                  className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline/50 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-xs text-outline text-center py-6">No monsters found</p>
              )}
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                    selected?.id === m.id
                      ? "bg-primary/20 text-on-surface border border-primary/40"
                      : "hover:bg-white/5 text-outline hover:text-on-surface"
                  )}
                >
                  {m.image ? (
                    <img src={m.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 opacity-80" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center text-[10px] text-outline font-bold">
                      {m.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{m.name}</p>
                    <p className="text-[10px] text-outline truncate">{m.type}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-outline">
                    CR {m.cr}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: initiative + add */}
          <div className="flex-1 flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-center px-8">
                <div>
                  <div className="text-4xl mb-3 opacity-30">⚔️</div>
                  <p className="text-sm text-outline">Select a monster from the list to set its initiative and add it to the encounter.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-5 gap-5">
                {/* Monster card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-white/8">
                  {selected.image ? (
                    <img src={selected.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high shrink-0 flex items-center justify-center text-lg font-bold text-outline">
                      {selected.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{selected.name}</p>
                    <p className="text-xs text-outline">{selected.type} • CR {selected.cr} • AC {selected.ac} • HP {selected.hp}</p>
                  </div>
                </div>

                {/* Initiative */}
                <div>
                  <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-2">Initiative</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={initiative}
                      onChange={e => setInitiative(e.target.value)}
                      className="w-24 text-center text-2xl font-bold bg-surface-container border border-white/10 rounded-xl text-on-surface outline-none focus:border-primary/60 transition-colors py-2"
                    />
                    <button
                      onClick={handleReroll}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface transition-colors text-sm font-medium border border-white/8"
                      title="Reroll 1d20 + Dex modifier"
                    >
                      <Dices className="w-4 h-4" />
                      Reroll
                    </button>
                    <span className="text-xs text-outline">
                      Dex {selected.stats?.dex ?? 10}
                      {dexMod(selected.stats?.dex ?? 10) >= 0 ? ' (+' : ' ('}
                      {dexMod(selected.stats?.dex ?? 10)})
                    </span>
                  </div>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-2">Count</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCount(c => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high border border-white/8 flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xl font-bold text-on-surface w-6 text-center">{count}</span>
                    <button
                      onClick={() => setCount(c => Math.min(10, c + 1))}
                      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high border border-white/8 flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-outline">of {selected.name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-outline uppercase tracking-wider mb-2" htmlFor="enemy-wave-name">Wave name</label>
                  <input
                    id="enemy-wave-name"
                    list="enemy-wave-options"
                    value={waveId}
                    onChange={e => {
                      setWaveId(e.target.value);
                      setStartHidden(!!e.target.value.trim() && e.target.value.trim() !== 'default');
                    }}
                    placeholder="Choose a wave or enter a new name"
                    className="w-full bg-surface-container border border-white/10 rounded-xl px-3 py-2 text-sm text-on-surface"
                  />
                  <datalist id="enemy-wave-options">
                    {Array.from(new Set(['default', ...existingWaves])).map(w => <option key={w} value={w} />)}
                  </datalist>
                  <p className="mt-1 text-[10px] text-outline">Use the same name to group NPCs, or a new name for another wave.</p>
                  <label className="mt-2 flex items-center gap-2 text-xs text-on-surface">
                    <input type="checkbox" checked={startHidden} onChange={e => setStartHidden(e.target.checked)} />
                    Start concealed
                  </label>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={handleAdd}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary/80 text-on-primary font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add {count > 1 ? `${count}× ` : ''}{selected.name}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
