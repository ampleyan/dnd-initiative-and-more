import React from 'react';
import { Edit2, Skull, Shield, Heart, Plus } from 'lucide-react';
import { MonsterTemplate } from '../types';
import { AvatarImg } from './AvatarImg';

interface MonsterCardProps {
  monster: MonsterTemplate;
  onAdd: () => void;
  onEdit: () => void;
}

export const MonsterCard: React.FC<MonsterCardProps> = ({ monster, onAdd, onEdit }) => (
  <div className="group relative flex flex-col bg-surface-container-low hover:bg-surface-container-high transition-all duration-300 rounded-lg overflow-hidden border border-outline-variant/10">
    <div className="h-48 overflow-hidden relative">
      <AvatarImg
        src={monster.image}
        name={monster.name}
        className="w-full h-full group-hover:scale-110 transition-transform duration-700 text-4xl"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent opacity-60" />
      {monster.rarity && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded-sm uppercase font-label backdrop-blur-md">
          {monster.rarity}
        </div>
      )}
      <button 
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="p-5 flex flex-col flex-1">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-headline text-xl font-bold text-on-surface leading-none">{monster.name}</h3>
        <span className="font-label text-primary text-sm font-bold">CR {monster.cr}</span>
      </div>
      <p className="text-xs text-on-surface-variant mb-6 line-clamp-2 italic font-body">
        {monster.description}
      </p>
      <div className="mt-auto flex items-center justify-between">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-sm bg-surface-variant flex items-center justify-center">
            <Skull className="w-3.5 h-3.5 text-outline" />
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-outline">
            <Shield className="w-3 h-3" /> {monster.ac}
            <Heart className="w-3 h-3 ml-1" /> {monster.hp}
          </div>
        </div>
        <button 
          onClick={onAdd}
          className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary px-3 py-1.5 rounded-sm text-xs font-bold transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" /> Quick Add
        </button>
      </div>
    </div>
  </div>
);
