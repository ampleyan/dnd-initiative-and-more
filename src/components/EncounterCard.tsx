import React from 'react';
import { Users, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface EncounterCardProps {
  title: string;
  description: string;
  players: number;
  time: string;
  difficulty: string;
  cr: number;
  image: string;
  isActive?: boolean;
  onClick: () => void;
}

export const EncounterCard: React.FC<EncounterCardProps> = ({
  title,
  description,
  players,
  time,
  difficulty,
  cr,
  image,
  isActive,
  onClick
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    onClick={onClick}
    className={cn(
      "bg-[#12141C] rounded-2xl overflow-hidden border group cursor-pointer shadow-xl transition-colors",
      isActive ? "border-green-500/40" : "border-white/5"
    )}
  >
    <div className="relative h-40 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#12141C] to-transparent opacity-60" />
      <div className="absolute top-4 left-4 flex gap-2">
        {isActive && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-black uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
        )}
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
          difficulty === 'DEADLY' ? "bg-red-600 text-white" :
          difficulty === 'HARD' ? "bg-orange-500 text-white" :
          difficulty === 'MEDIUM' ? "bg-yellow-500 text-black" :
          difficulty === 'EASY' ? "bg-emerald-600 text-white" :
          difficulty === 'TRIVIAL' ? "bg-surface-container-high text-outline" :
          "bg-blue-600 text-white"
        )}>
          {difficulty}
        </span>
        <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider">
          CR {cr}
        </span>
      </div>
    </div>
    <div className="p-6 space-y-3">
      <h3 className="text-lg font-headline font-bold text-white group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-xs text-outline leading-relaxed line-clamp-2 font-body opacity-70">
        {description}
      </p>
      <div className="pt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-outline">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          {players} Players
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          {time} Est.
        </div>
      </div>
    </div>
  </motion.div>
);
