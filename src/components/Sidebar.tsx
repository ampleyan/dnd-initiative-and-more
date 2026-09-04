import React from 'react';
import { version } from '../../package.json';
import { LayoutDashboard, Swords, BookOpen, UploadCloud, Plus, ChevronRight, ChevronLeft, ChevronDown, Square, Settings, ScrollText, BarChart2, Sparkles, Map, Shield, HelpCircle, Music, Sun, Moon, MoreHorizontal, Play, Pause, ExternalLink, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_NAME, APP_SHORT_NAME } from '../lib/appConfig';
import { SidebarItem } from './SidebarItem';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useLocalState } from '../hooks/useLocalState';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isPlayerView: boolean;
  currentEncounterId: string | null;
  isEncounterActive: boolean;
  encounterName: string;
  encounterSubtab: 'saved' | 'recent';
  setEncounterSubtab: (subtab: 'saved' | 'recent') => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  setIsPlayerView: (isPlayerView: boolean) => void;
  setCombatants: (combatants: any[]) => void;
  setIsEncounterActive: (active: boolean) => void;
  setCurrentRound: (round: number) => void;
  setCurrentEncounterId: (id: string | null) => void;
  setEncounterName: (name: string) => void;
  setIsEncounterCreatorOpen: (open: boolean) => void;
  handleEndEncounter: () => void;
  onToggleLog: () => void;
  onShowWhatsNew: () => void;
  onShowSessionStats: () => void;
  onShowHelp: () => void;
  showLog?: boolean;
  theme?: 'light' | 'pink';
  onToggleTheme?: () => void;
  youtubeId?: string | null;
  youtubeUrl?: string | null;
  isMusicPaused?: boolean;
  onToggleMusic?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  isPlayerView,
  currentEncounterId,
  isEncounterActive,
  encounterName,
  encounterSubtab,
  setEncounterSubtab,
  setIsSidebarCollapsed,
  setIsPlayerView,
  setCombatants,
  setIsEncounterActive,
  setCurrentRound,
  setCurrentEncounterId,
  setEncounterName,
  setIsEncounterCreatorOpen,
  handleEndEncounter,
  onToggleLog,
  onShowWhatsNew,
  onShowSessionStats,
  onShowHelp,
  showLog,
  theme = 'pink',
  onToggleTheme,
  youtubeId,
  youtubeUrl,
  isMusicPaused,
  onToggleMusic,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBasicMode, setIsBasicMode] = useLocalState<boolean>('basic-mode', false);

  function handleToggleBasicMode() {
    const next = !isBasicMode;
    setIsBasicMode(next);
    if (next) {
      const hidden = ['/dashboard', '/campaigns', '/spells', '/abilities', '/soundboard', '/import', '/settings'];
      if (hidden.some(p => location.pathname.startsWith(p))) {
        navigate('/encounters');
      }
    }
  }

  if (isPlayerView) return null;

  // During combat, always show icon-only so soundboard/nav remain accessible
  const collapsed = isSidebarCollapsed || isEncounterActive;

  const isEncountersActive = location.pathname.startsWith('/encounters');

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[#05070A] border-r border-white/5 z-50 transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className={cn("p-5", collapsed && "px-0 flex flex-col items-center")}>
        <div className={cn("mb-6", collapsed && "mb-6 flex flex-col items-center")}>
          <h1 className={cn("text-on-surface font-headline font-bold text-2xl tracking-tight italic", collapsed && "text-center text-lg")}>
            {collapsed ? APP_SHORT_NAME : APP_NAME}
          </h1>
          {!collapsed && <p className="text-[10px] uppercase tracking-[0.2em] text-outline font-bold opacity-60">Dungeon Master Mode</p>}
          {collapsed && <p className="text-[9px] text-outline/40 font-mono mt-0.5">v{version}</p>}
          {!collapsed && <p className="text-[9px] text-outline/40 font-mono mt-0.5">v{version}</p>}
        </div>
        
        <nav className="flex flex-col w-full gap-1">
          {/* Home + Campaigns combined */}
          {!isBasicMode && (() => {
            const isDashActive = location.pathname === '/dashboard' || location.pathname === '/';
            const isCampActive = location.pathname.startsWith('/campaigns');
            const isExpanded = isDashActive || isCampActive;
            return (
              <div className="flex flex-col gap-1">
                <NavLink
                  to="/dashboard"
                  title={collapsed ? "Home & Campaigns" : undefined}
                  className={({ isActive }) => cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all",
                    collapsed && "justify-center px-0",
                    (isActive || isCampActive) ? "bg-white/5 text-on-surface" : "text-outline hover:bg-white/5 hover:text-on-surface"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <LayoutDashboard className="w-5 h-5 shrink-0 text-slate-400" />
                    {!collapsed && <span className="font-medium text-sm">Home</span>}
                  </div>
                  {!collapsed && <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />}
                </NavLink>
                {isExpanded && !collapsed && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pl-12 space-y-1 mt-1">
                    <NavLink to="/dashboard" className={({ isActive }) => cn("w-full text-left py-2 text-xs font-medium flex items-center gap-2 transition-colors", isActive && !isCampActive ? "text-primary" : "text-outline hover:text-on-surface")}>
                      <div className={cn("w-1 h-4 rounded-full", isDashActive && !isCampActive ? "bg-primary" : "bg-outline/30")} />
                      Dashboard
                    </NavLink>
                    <NavLink to="/campaigns" className={({ isActive }) => cn("w-full text-left py-2 text-xs font-medium flex items-center gap-2 transition-colors", isActive ? "text-teal-400" : "text-outline hover:text-on-surface")}>
                      <div className={cn("w-1 h-4 rounded-full", isCampActive ? "bg-teal-400" : "bg-outline/30")} />
                      Campaigns
                    </NavLink>
                  </motion.div>
                )}
              </div>
            );
          })()}

          {/* Encounters — standalone */}
          <div className="flex flex-col gap-1">
            <NavLink
              to="/encounters"
              onClick={() => setCurrentEncounterId(null)}
              title={collapsed ? "Encounters" : undefined}
              className={({ isActive }) => cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all group",
                collapsed && "justify-center px-0",
                isActive ? "bg-white/5 text-on-surface" : "text-outline hover:bg-white/5 hover:text-on-surface"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Swords className="w-5 h-5 shrink-0 text-violet-400" />
                {!collapsed && (
                  <span className="font-medium text-sm flex-1 truncate">Encounters</span>
                )}
                {!collapsed && isEncounterActive && encounterName && (
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-[9px] text-amber-400 font-bold truncate max-w-[80px]">{encounterName}</span>
                  </span>
                )}
              </div>
              {!collapsed && <ChevronDown className={cn("w-4 h-4 transition-transform", isEncountersActive ? "rotate-0" : "-rotate-90")} />}
            </NavLink>
            {isEncountersActive && !collapsed && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pl-12 space-y-1 mt-1">
                <button onClick={() => setEncounterSubtab('saved')} className={cn("w-full text-left py-2 text-xs font-medium flex items-center gap-2 transition-colors", encounterSubtab === 'saved' ? "text-primary" : "text-outline hover:text-on-surface")}>
                  <div className={cn("w-1 h-4 rounded-full", encounterSubtab === 'saved' ? "bg-primary" : "bg-outline/30")} /> Saved
                </button>
                <button onClick={() => setEncounterSubtab('recent')} className={cn("w-full text-left py-2 text-xs font-medium flex items-center gap-2 transition-colors", encounterSubtab === 'recent' ? "text-primary" : "text-outline hover:text-on-surface")}>
                  <div className={cn("w-1 h-4 rounded-full", encounterSubtab === 'recent' ? "bg-primary" : "bg-outline/30")} /> Recent
                </button>
                {isEncounterActive && (
                  <button onClick={handleEndEncounter} className="w-full mt-2 py-2 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg flex items-center justify-center gap-2 border border-red-500/20 transition-colors">
                    <Square className="w-3 h-3 fill-current" /> Stop Encounter
                  </button>
                )}
              </motion.div>
            )}
          </div>

          <div className={cn("border-t border-white/10 my-2", collapsed ? "mx-2" : "mx-0")} />

          {/* Library, Spells, Abilities — collapsed into popover */}
          {(() => {
            const [open, setOpen] = React.useState(false);
            const ref = React.useRef<HTMLDivElement>(null);
            React.useEffect(() => {
              const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
              document.addEventListener('mousedown', h);
              return () => document.removeEventListener('mousedown', h);
            }, []);
            if (isBasicMode) {
              return (
                <SidebarItem
                  icon={BookOpen}
                  label="Library"
                  collapsed={collapsed}
                  iconColor="text-red-400"
                  to="/monsters"
                />
              );
            }
            const links = [
              { icon: BookOpen,  label: 'Library',   color: 'text-red-400',   to: '/monsters'   },
              { icon: Sparkles,  label: 'Spells',    color: 'text-sky-400',   to: '/spells'     },
              { icon: Shield,    label: 'Abilities', color: 'text-amber-400', to: '/abilities'  },
            ];
            const isAnyActive = links.some(l => location.pathname.startsWith(l.to));
            return (
              <div ref={ref} className="relative">
                <button
                  onClick={() => setOpen(v => !v)}
                  title={collapsed ? "Library & More" : undefined}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all",
                    collapsed && "justify-center px-0",
                    open || isAnyActive ? "bg-white/5 text-on-surface" : "text-outline hover:bg-white/5 hover:text-on-surface"
                  )}
                >
                  <BookOpen className={cn("w-5 h-5 shrink-0", isAnyActive ? "text-red-400" : "text-outline")} />
                  {!collapsed && <span className="font-medium text-sm flex-1 text-left">Library</span>}
                  {!collapsed && <ChevronDown className={cn("w-4 h-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />}
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className={cn(
                        "absolute z-[200] bg-surface-container-high rounded-xl shadow-2xl shadow-black/40 border border-white/8 py-1 min-w-[160px]",
                        collapsed ? "left-14 top-0" : "left-2 top-full mt-1"
                      )}
                    >
                      {links.map(({ icon: Icon, label, color, to }) => (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5",
                            isActive ? "text-on-surface" : "text-outline hover:text-on-surface"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", color)} />
                          <span className="font-medium">{label}</span>
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {!isBasicMode && (
            <SidebarItem
              icon={Music}
              label="Soundboard"
              collapsed={collapsed}
              iconColor="text-pink-400"
              to="/soundboard"
            />
          )}

          {!isBasicMode && (
            <>
              <div className={cn("border-t border-white/10 mt-2 mb-3", collapsed ? "mx-2" : "mx-0")} />
              {!collapsed && (
                <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-outline/40 px-4 pb-1">Tools</p>
              )}
              <SidebarItem
                icon={UploadCloud}
                label="Import"
                collapsed={collapsed}
                iconColor="text-sky-400"
                to="/import"
              />
            </>
          )}

          {!isBasicMode && (
            <SidebarItem
              icon={Settings}
              label="Settings"
              collapsed={collapsed}
              iconColor="text-amber-400"
              to="/settings"
            />
          )}

          {/* Basic/Full toggle */}
          <button
            onClick={handleToggleBasicMode}
            title={isBasicMode ? 'Switch to Full mode' : 'Switch to Basic mode'}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all hover:bg-white/5",
              collapsed && "justify-center px-0",
              isBasicMode ? "text-primary" : "text-outline"
            )}
          >
            <Layers className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <span className="font-medium text-sm">{isBasicMode ? 'Basic' : 'Full'}</span>
            )}
          </button>

          <div className={cn("border-t border-white/5 my-2", collapsed ? "mx-2" : "mx-0")} />

          {/* More menu — Combat Log, Session Stats, Help, What's New, Theme */}
          {(() => {
            const [open, setOpen] = React.useState(false);
            const ref = React.useRef<HTMLDivElement>(null);
            React.useEffect(() => {
              const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
              document.addEventListener('mousedown', handler);
              return () => document.removeEventListener('mousedown', handler);
            }, []);
            if (isBasicMode) return null;
            const items = [
              { icon: ScrollText,  label: 'Combat Log',    color: 'text-slate-400',   action: onToggleLog,        active: showLog },
              { icon: BarChart2,   label: 'Session Stats', color: 'text-emerald-400', action: onShowSessionStats, active: false },
              { icon: HelpCircle,  label: 'Help',          color: 'text-sky-400',     action: onShowHelp,         active: false },
              { icon: Sparkles,    label: "What's New",    color: 'text-amber-300',   action: onShowWhatsNew,     active: false },
            ];
            return (
              <div ref={ref} className="relative">
                <button
                  onClick={() => setOpen(v => !v)}
                  title="More"
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all hover:bg-white/5 group",
                    open ? "text-on-surface bg-white/5" : "text-outline",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <MoreHorizontal className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="font-medium text-sm">More</span>}
                </button>

                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className={cn(
                        "absolute z-[200] bg-surface-container-high rounded-xl shadow-2xl shadow-black/40 border border-white/8 py-1 min-w-[180px]",
                        collapsed ? "left-14 bottom-0" : "left-2 bottom-full mb-2"
                      )}
                    >
                      {items.map(({ icon: Icon, label, color, action, active }) => (
                        <button
                          key={label}
                          onClick={() => { action(); setOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5",
                            active ? "text-on-surface" : "text-outline hover:text-on-surface"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", color)} />
                          <span className="font-medium">{label}</span>
                          {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                      <div className="border-t border-white/5 my-1" />
                      <button
                        onClick={() => { onToggleTheme?.(); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
                      >
                        {theme === 'pink'
                          ? <Sun className="w-4 h-4 shrink-0 text-amber-400" />
                          : <Moon className="w-4 h-4 shrink-0 text-pink-400" />}
                        <span className="font-medium">{theme === 'pink' ? 'Light Theme' : 'Pink Theme'}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}
        </nav>
      </div>

      <div className={cn("mt-auto p-5 space-y-4", collapsed && "p-3 flex flex-col items-center")}>
        {youtubeId && (
          <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "")}>
            <button
              onClick={onToggleMusic}
              title={isMusicPaused ? 'Play music' : 'Pause music'}
              className={cn(
                "flex items-center gap-2 rounded-lg transition-colors text-outline hover:text-on-surface hover:bg-white/5",
                collapsed ? "p-2.5" : "flex-1 px-3 py-2 text-xs font-medium"
              )}
            >
              {isMusicPaused
                ? <Play className="w-4 h-4 shrink-0 text-primary" />
                : <Pause className="w-4 h-4 shrink-0 text-primary" />}
              {!collapsed && <span>{isMusicPaused ? 'Play music' : 'Pause music'}</span>}
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noreferrer"
              title="Open in YouTube"
              className={cn(
                "flex items-center gap-2 rounded-lg transition-colors text-outline hover:text-on-surface hover:bg-white/5",
                collapsed ? "p-2.5" : "px-3 py-2 text-xs font-medium"
              )}
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Open in YouTube</span>}
            </a>
          </div>
        )}
        <button
          onClick={() => { 
            setCombatants([]); 
            setIsEncounterActive(false);
            setCurrentRound(1);
            setCurrentEncounterId(null);
            setEncounterName('New Encounter');
            setIsEncounterCreatorOpen(true);
          }}
          title={collapsed ? "New Encounter" : undefined}
          className={cn(
            "w-full bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center",
            collapsed ? "h-12 w-12" : "py-4"
          )}
        >
          {collapsed ? <Plus className="w-6 h-6" /> : "New Encounter"}
        </button>

        {!isEncounterActive && (
          <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-outline hover:bg-white/5 hover:text-on-surface group mt-4",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              {!collapsed && <span className="font-medium text-sm">Collapse</span>}
            </button>
        )}
      </div>
    </aside>
  );
};
