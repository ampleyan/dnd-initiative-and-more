import React from 'react';
import { X, Shield, Heart, Zap, Plus, Star } from 'lucide-react';
import { MonsterTemplate } from '../types';
import { AvatarImg } from './AvatarImg';

interface MonsterDetailPanelProps {
  monster: MonsterTemplate;
  onClose: () => void;
  onAddToEncounter: (monster: MonsterTemplate) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

function statMod(val: number): string {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const STAT_LABELS: Array<{ key: keyof MonsterTemplate['stats']; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
];

export const MonsterDetailPanel: React.FC<MonsterDetailPanelProps> = ({
  monster,
  onClose,
  onAddToEncounter,
  isFavorite,
  onToggleFavorite,
}) => {
  return (
    <div className="flex flex-col h-full bg-surface-container overflow-y-auto">
      {/* Hero image */}
      <div className="relative h-52 flex-shrink-0 overflow-hidden">
        <AvatarImg
          src={monster.image}
          name={monster.name}
          className="w-full h-full text-5xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent" />

        {/* Controls */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={() => onAddToEncounter(monster)}
            className="md:hidden p-2 rounded-full backdrop-blur-md bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
            title="Add to encounter"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => onToggleFavorite(monster.id)}
            className={`p-2 rounded-full backdrop-blur-md transition-all ${
              isFavorite
                ? 'bg-amber-500/30 text-amber-400'
                : 'bg-black/40 hover:bg-black/60 text-white'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CR badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-black text-white">
          CR {monster.cr}
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-2xl font-headline font-bold text-white leading-tight">{monster.name}</h2>
          <p className="text-xs text-white/70 font-body capitalize mt-0.5">{monster.type}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-5">

        {/* AC + HP */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-high rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">AC</p>
              <p className="text-xl font-headline font-bold text-on-surface">{monster.ac}</p>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">HP</p>
              <p className="text-xl font-headline font-bold text-on-surface">{monster.hp}</p>
            </div>
          </div>
        </div>


        {/* Speed */}
        {monster.speed && (
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-outline flex-shrink-0" />
            <span className="text-xs text-on-surface-variant">Speed: <span className="text-on-surface font-medium">{monster.speed}</span></span>
          </div>
        )}

        {/* Tags */}
        {monster.tags && monster.tags.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {monster.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wide">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {monster.source && (
          <div className="text-xs text-outline">
            Source: <span className="text-on-surface-variant">{monster.source}</span>
          </div>
        )}

        {/* Spells */}
        {monster.spells && monster.spells.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Spells</p>
            <div className="space-y-2">
              {monster.spells.map((spell, i) => (
                <div key={i} className="bg-surface-container-high rounded-lg p-3 border-l-2 border-violet-500/30">
                  <p className="text-xs font-bold text-violet-300">{spell.name}</p>
                  <p className="text-xs text-outline mt-1 leading-relaxed">{spell.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {monster.actions && monster.actions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Actions</p>
            <div className="space-y-2">
              {monster.actions.map((action, i) => (
                <div key={i} className="bg-surface-container-high rounded-lg p-3">
                  <p className="text-xs font-bold text-on-surface">{action.name}</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abilities */}
        {monster.abilities && monster.abilities.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Special Abilities</p>
            <div className="space-y-2">
              {monster.abilities.map((ability, i) => (
                <div key={i} className="bg-surface-container-high rounded-lg p-3">
                  <p className="text-xs font-bold text-on-surface">{ability.name}</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{ability.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {monster.description && (
          <p className="text-xs text-on-surface-variant italic leading-relaxed">{monster.description}</p>
        )}

        {/* CTA */}
        <div className="mt-auto pt-2">
          <button
            onClick={() => onAddToEncounter(monster)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3 font-bold text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add to Encounter
          </button>
        </div>
      </div>
    </div>
  );
};
