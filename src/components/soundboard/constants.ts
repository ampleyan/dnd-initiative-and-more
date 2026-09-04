import { Music, Swords, Sparkles, Waves, Leaf, Zap, Star, type LucideIcon } from 'lucide-react';

export const CATEGORIES: { id: string; label: string; color: string; bg: string; border: string; glow: string; Icon: LucideIcon; gradient: string; typeBadge: string }[] = [
  { id: 'all',       label: 'All',       color: 'text-on-surface',  bg: 'bg-surface-container-high',  border: 'border-outline/20',      glow: 'shadow-primary/20',    Icon: Music,    gradient: 'transparent',           typeBadge: ''        },
  { id: 'favorites', label: 'Favorites', color: 'text-amber-400',   bg: 'bg-amber-500/10',            border: 'border-amber-500/30',    glow: 'shadow-amber-500/30',  Icon: Star,     gradient: 'rgba(251,191,36,0.10)', typeBadge: ''        },
  { id: 'combat',  label: 'Combat',  color: 'text-red-400',     bg: 'bg-red-500/10',             border: 'border-red-500/30',     glow: 'shadow-red-500/30',    Icon: Swords,   gradient: 'rgba(239,68,68,0.13)',   typeBadge: 'SFX'     },
  { id: 'magic',   label: 'Magic',   color: 'text-violet-400',  bg: 'bg-violet-500/10',          border: 'border-violet-500/30',  glow: 'shadow-violet-500/30', Icon: Sparkles, gradient: 'rgba(139,92,246,0.13)',  typeBadge: 'SFX'     },
  { id: 'ambient', label: 'Ambient', color: 'text-teal-400',    bg: 'bg-teal-500/10',            border: 'border-teal-500/30',    glow: 'shadow-teal-500/30',   Icon: Waves,    gradient: 'rgba(20,184,166,0.10)',  typeBadge: 'Ambient' },
  { id: 'nature',  label: 'Nature',  color: 'text-emerald-400', bg: 'bg-emerald-500/10',         border: 'border-emerald-500/30', glow: 'shadow-emerald-500/30',Icon: Leaf,     gradient: 'rgba(52,211,153,0.10)',  typeBadge: 'Ambient' },
  { id: 'ui',      label: 'UI',      color: 'text-sky-400',     bg: 'bg-sky-500/10',             border: 'border-sky-500/30',     glow: 'shadow-sky-500/30',    Icon: Zap,      gradient: 'rgba(56,189,248,0.10)',  typeBadge: 'SFX'     },
  { id: 'custom',  label: 'Custom',  color: 'text-outline',     bg: 'bg-surface-container',      border: 'border-outline/20',     glow: 'shadow-white/10',      Icon: Music,    gradient: 'transparent',           typeBadge: ''        },
];

export function categoryMeta(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
