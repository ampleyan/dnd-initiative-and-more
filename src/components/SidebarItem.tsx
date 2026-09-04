import React from 'react';
import { LucideIcon, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { NavLink } from 'react-router-dom';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  iconColor?: string;
  onClick?: () => void;
  onExternalClick?: (e: React.MouseEvent) => void;
  to?: string;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active,
  collapsed,
  iconColor,
  onClick,
  onExternalClick,
  to
}) => {
  const content = (
    <>
      <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110 shrink-0", iconColor ?? (active ? "text-primary" : "text-outline"))} />
      {!collapsed && <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      {active && !collapsed && !onExternalClick && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
    </>
  );

  const className = ({ isActive }: { isActive?: boolean } = {}) => cn(
    "w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all group",
    collapsed ? "justify-center px-0" : "px-4",
    (isActive || active)
      ? "bg-white/5 text-on-surface shadow-[0_0_20px_rgba(173,198,255,0.05)]"
      : "text-outline hover:bg-white/5 hover:text-on-surface"
  );

  return (
    <div className="relative group/item">
      {to ? (
        <NavLink
          to={to}
          title={label}
          className={({ isActive }) => className({ isActive })}
        >
          {({ isActive }) => (
            <>
              <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110 shrink-0", iconColor ?? (isActive ? "text-primary" : "text-outline"))} />
              {!collapsed && <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
              {isActive && !collapsed && !onExternalClick && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
            </>
          )}
        </NavLink>
      ) : (
        <button
          onClick={onClick}
          title={label}
          className={className()}
        >
          {content}
        </button>
      )}
      
      {onExternalClick && (
        <button
          onClick={onExternalClick}
          title="Open in new tab"
          className={cn(
            "absolute p-1.5 rounded-md text-outline hover:text-primary hover:bg-primary/10 opacity-0 group-hover/item:opacity-100 transition-all",
            collapsed ? "-right-1 -top-1" : "right-2 top-1/2 -translate-y-1/2"
          )}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
