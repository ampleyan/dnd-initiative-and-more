import React from 'react';
import { LayoutDashboard, Map, Swords, BookOpen, Sparkles, Shield, Settings, Music } from 'lucide-react';
import { cn } from '../lib/utils';
import { NavLink } from 'react-router-dom';
import { useLocalState } from '../hooks/useLocalState';

interface MobileNavProps {
  onClearEncounter?: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home', color: 'text-slate-400' },
  { to: '/campaigns', icon: Map, label: 'Campaigns', color: 'text-teal-400' },
  { to: '/encounters', icon: Swords, label: 'Encounters', color: 'text-violet-400', clear: true },
  { to: '/monsters', icon: BookOpen, label: 'Library', color: 'text-red-400' },
  { to: '/spells', icon: Sparkles, label: 'Spells', color: 'text-sky-400' },
  { to: '/abilities', icon: Shield, label: 'Abilities', color: 'text-amber-400' },
  { to: '/soundboard', icon: Music, label: 'Sounds', color: 'text-pink-400' },
  { to: '/settings', icon: Settings, label: 'Settings', color: 'text-amber-400' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ onClearEncounter }) => {
  const [isBasicMode] = useLocalState<boolean>('basic-mode', false);

  const BASIC_ROUTES = new Set(['/encounters', '/monsters']);
  const visibleItems = isBasicMode
    ? NAV_ITEMS.filter(item => BASIC_ROUTES.has(item.to))
    : NAV_ITEMS;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest h-16 flex items-center z-40 border-t border-outline-variant/10 overflow-x-auto scrollbar-none">
      {visibleItems.map(({ to, icon: Icon, label, color, clear }) => (
        <NavLink
          key={to}
          to={to}
          onClick={clear ? onClearEncounter : undefined}
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 flex-shrink-0 flex-1 min-w-[4rem] py-2",
            isActive ? color : "text-outline"
          )}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[9px] font-label whitespace-nowrap">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

