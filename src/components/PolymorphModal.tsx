import React, { useState, useMemo } from 'react';
import { X, Search, Wand2 } from 'lucide-react';
import { Combatant, MonsterTemplate } from '../types';
import { AvatarImg } from './AvatarImg';

interface Props {
  combatant: Combatant;
  monsters: MonsterTemplate[];
  onConfirm: (monster: MonsterTemplate) => void;
  onClose: () => void;
}

export const PolymorphModal: React.FC<Props> = ({ combatant, monsters, onConfirm, onClose }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MonsterTemplate | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return monsters.slice(0, 50);
    return monsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 50);
  }, [monsters, search]);

  const mod = (score: number) => {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-violet-400" />
            <h2 className="font-headline font-bold text-base text-on-surface">
              Polymorph — {combatant.name}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col w-1/2 border-r border-white/10">
            <div className="p-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-highest rounded-xl border border-white/10">
                <Search className="w-3.5 h-3.5 text-outline shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search creatures…"
                  className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                    selected?.id === m.id
                      ? 'bg-violet-500/20 border border-violet-500/40'
                      : 'hover:bg-surface-container-highest border border-transparent'
                  }`}
                >
                  <AvatarImg src={m.avatar} name={m.name} className="w-7 h-7 rounded-lg shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-on-surface truncate">{m.name}</div>
                    <div className="text-[10px] text-outline">CR {m.cr} · {m.type} · HP {m.hp} · AC {m.ac}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-outline text-xs py-8">No creatures found</p>
              )}
            </div>
          </div>

          <div className="w-1/2 flex flex-col">
            {selected ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <AvatarImg src={selected.avatar} name={selected.name} className="w-12 h-12 rounded-xl shrink-0" />
                    <div>
                      <h3 className="font-headline font-bold text-on-surface">{selected.name}</h3>
                      <p className="text-xs text-outline">CR {selected.cr} · {selected.type}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-surface-container-highest">
                      <div className="text-xs text-outline">HP</div>
                      <div className="font-bold text-sm text-on-surface">{selected.hp}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-surface-container-highest">
                      <div className="text-xs text-outline">AC</div>
                      <div className="font-bold text-sm text-on-surface">{selected.ac}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-surface-container-highest">
                      <div className="text-xs text-outline">Speed</div>
                      <div className="font-bold text-[11px] text-on-surface truncate">{selected.speed}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {(['str','dex','con','int','wis','cha'] as const).map(stat => (
                      <div key={stat} className="text-center p-1.5 rounded-lg bg-surface-container-highest">
                        <div className="text-[9px] text-outline uppercase font-bold">{stat}</div>
                        <div className="font-bold text-xs text-on-surface">{selected.stats[stat]}</div>
                        <div className="text-[9px] text-violet-400">{mod(selected.stats[stat])}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={() => { onConfirm(selected); onClose(); }}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    Polymorph into {selected.name}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-outline text-sm">
                Select a creature to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
