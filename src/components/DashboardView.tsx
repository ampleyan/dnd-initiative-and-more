import React, { useState } from 'react';
import { Swords, BookOpen, Shield, Sparkles, Clock, Map as MapIcon, UploadCloud, ChevronRight, MapPin, Users, Play, Radio, ScrollText, Pencil, Check, X, ClipboardCheck } from 'lucide-react';
import { Combatant, Encounter, MonsterTemplate, Player, Spell, Campaign, Session } from '../types';

type ActiveTab = 'dashboard' | 'monsters' | 'players' | 'encounters' | 'spells' | 'archive' | 'settings' | 'import' | 'campaigns' | 'abilities' | 'soundboard';

interface DashboardViewProps {
  isEncounterActive: boolean;
  currentEncounterId: string | null;
  encounterName: string;
  currentRound: number;
  combatants: Combatant[];
  savedEncounters: Encounter[];
  monsters: MonsterTemplate[];
  players: Player[];
  spells: Spell[];
  campaigns?: Campaign[];
  activeCampaignId?: string | null;
  sessions?: Session[];
  activeSoundCount?: number;
  hasAmbientMusic?: boolean;
  isMusicPaused?: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  setIsEncounterCreatorOpen: (v: boolean) => void;
  onSelectCampaign?: (id: string) => void;
  handleLoadEncounter: (enc: Encounter) => void;
  onUpdateSession?: (id: string, updates: Partial<Pick<Session, 'name' | 'date' | 'notes'>>) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  isEncounterActive,
  currentEncounterId,
  encounterName,
  currentRound,
  combatants,
  savedEncounters,
  monsters,
  players,
  spells,
  campaigns,
  activeCampaignId,
  sessions,
  activeSoundCount = 0,
  hasAmbientMusic = false,
  isMusicPaused = false,
  setActiveTab,
  setIsEncounterCreatorOpen,
  onSelectCampaign,
  handleLoadEncounter,
  onUpdateSession,
}) => {
  const [prepExpanded, setPrepExpanded] = useState(false);
  const [editingNextSession, setEditingNextSession] = useState(false);
  const [nextSessionDraft, setNextSessionDraft] = useState('');
  const campaignList = campaigns ?? [];
  const activeCampaign = campaignList.find(campaign => campaign.id === activeCampaignId)
    ?? [...campaignList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const campaignEncounters = activeCampaign
    ? savedEncounters.filter(encounter => encounter.campaignId === activeCampaign.id)
    : [];
  const latestEncounter = [...savedEncounters].sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())[0];
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const upcomingSession = [...(sessions ?? [])].filter(session => new Date(session.date).getTime() >= startOfToday).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const lastSession = [...(sessions ?? [])].filter(session => new Date(session.date).getTime() < startOfToday).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const playerLevels = players.flatMap(player => player.level === undefined ? [] : [player.level]);
  const averagePartyLevel = playerLevels.length
    ? (playerLevels.reduce((total, level) => total + level, 0) / playerLevels.length).toFixed(1).replace(/\.0$/, '')
    : '—';
  const currentEncounter = savedEncounters.find(encounter => encounter.id === currentEncounterId);
  const lastPrepNote = currentEncounter?.notes?.general || latestEncounter?.notes?.general || lastSession?.notes;
  const nextEncounter = isEncounterActive ? encounterName : upcomingSession?.name || latestEncounter?.name;
  const musicStatus = hasAmbientMusic && !isMusicPaused ? 'Ambient music playing' : activeSoundCount > 0 ? `${activeSoundCount} sound${activeSoundCount === 1 ? '' : 's'} playing` : 'Music idle';
  const readiness = [
    { label: 'Campaign selected', ready: Boolean(activeCampaign) },
    { label: 'Party loaded', ready: players.length > 0 },
    { label: 'Encounter prepared', ready: Boolean(currentEncounter || upcomingSession || savedEncounters.length) },
    { label: 'Atmosphere ready', ready: Boolean(activeSoundCount || hasAmbientMusic) },
  ];
  const saveNextSession = async () => {
    if (!upcomingSession || !nextSessionDraft.trim() || !onUpdateSession) return;
    await onUpdateSession(upcomingSession.id, { name: nextSessionDraft.trim() });
    setEditingNextSession(false);
  };

  const primaryAction = isEncounterActive
    ? () => setActiveTab('encounters')
    : latestEncounter
      ? () => handleLoadEncounter(latestEncounter)
      : upcomingSession
        ? () => setActiveTab('campaigns')
        : () => setIsEncounterCreatorOpen(true);
  const primaryActionLabel = isEncounterActive
    ? 'Resume encounter'
    : latestEncounter
      ? `Resume ${latestEncounter.name}`
      : upcomingSession
        ? `Next ${upcomingSession.name}`
        : 'Create encounter';

  const sessionStatus = [
    { label: 'Encounter', value: isEncounterActive ? 'Active' : 'No active encounter', icon: Swords, color: 'text-violet-400 bg-violet-400/10' },
    { label: 'Next up', value: nextEncounter ?? 'Not set', icon: Clock, color: 'text-rose-400 bg-rose-400/10' },
    { label: 'Party', value: `${players.length} member${players.length === 1 ? '' : 's'}`, icon: Users, color: 'text-emerald-400 bg-emerald-400/10' },
    { label: 'Last session', value: lastSession ? new Date(lastSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not recorded', icon: ClipboardCheck, color: 'text-sky-400 bg-sky-400/10' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
      <section className="bg-surface-container-low border border-primary/20 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-bold">Tonight's session</p>
            <h2 className="font-headline font-bold text-2xl text-on-surface mt-1">{isEncounterActive ? encounterName : nextEncounter ?? 'Prepare the next encounter'}</h2>
            <p className="text-sm text-outline mt-1">{isEncounterActive ? `Round ${currentRound} is in progress.` : nextEncounter ? 'Ready when the table is.' : 'Create an encounter to get started.'}</p>
          </div>
          <button onClick={primaryAction} aria-label={primaryActionLabel} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs uppercase tracking-widest shrink-0 hover:bg-primary/90 transition-colors">
            <Play className="w-3.5 h-3.5" fill="currentColor" />
            {isEncounterActive ? 'Resume encounter' : latestEncounter ? 'Resume encounter' : upcomingSession ? 'Open next session' : 'Create encounter'}
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl bg-black/15 p-3"><p className="text-[10px] uppercase tracking-widest text-outline">Party average</p><p className="font-bold mt-1">Level {averagePartyLevel}</p></div>
          <div className="rounded-xl bg-black/15 p-3">
            <p className="text-[10px] uppercase tracking-widest text-outline">Next session</p>
            {editingNextSession ? (
              <div className="flex items-center gap-1 mt-1">
                <input value={nextSessionDraft} onChange={e => setNextSessionDraft(e.target.value)} autoFocus className="min-w-0 w-full bg-surface-container-high rounded px-2 py-1 text-xs" />
                <button onClick={saveNextSession} aria-label="Save next session name" className="text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingNextSession(false)} aria-label="Cancel editing next session" className="text-outline"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1">
                <p className="font-bold truncate flex-1">{upcomingSession?.name ?? 'Not set'}</p>
                {upcomingSession && onUpdateSession && <button onClick={() => { setNextSessionDraft(upcomingSession.name); setEditingNextSession(true); }} aria-label="Edit next session name" className="text-outline hover:text-primary"><Pencil className="w-3 h-3" /></button>}
              </div>
            )}
          </div>
          <div className="rounded-xl bg-black/15 p-3"><p className="text-[10px] uppercase tracking-widest text-outline">Up next</p><p className="font-bold mt-1 truncate">{nextEncounter ?? 'Not set'}</p></div>
          <div className="rounded-xl bg-black/15 p-3"><p className="text-[10px] uppercase tracking-widest text-outline">Campaign</p><p className="font-bold mt-1 truncate">{activeCampaign?.name ?? 'Not selected'}</p></div>
        </div>
        {lastPrepNote && <div className="flex gap-3 rounded-xl border border-white/5 bg-black/10 p-3"><ScrollText className="w-4 h-4 text-primary shrink-0 mt-0.5" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-widest text-outline">Last prep note</p><button onClick={() => setPrepExpanded(value => !value)} className="text-[10px] text-primary hover:underline">{prepExpanded ? 'Collapse' : 'Read more'}</button></div><p className={`text-sm text-on-surface/80 mt-1 ${prepExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{lastPrepNote}</p></div></div>}
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-outline" aria-label="Shared DM context">
        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" />{activeCampaign?.name ?? 'No campaign selected'}</span>
        <span className="inline-flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-violet-400" />{isEncounterActive ? `${encounterName}, round ${currentRound}` : 'No active encounter'}</span>
        <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-400" />{players.length} party member{players.length === 1 ? '' : 's'}</span>
        <span className="inline-flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-pink-400" />{musicStatus}</span>
      </div>

      <section className="rounded-2xl border border-white/5 bg-surface-container-low p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /><h3 className="text-xs uppercase tracking-widest font-bold text-outline">Session readiness</h3></div>
          <span className="text-[10px] text-outline">{readiness.filter(item => item.ready).length}/{readiness.length} ready</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {readiness.map(item => <div key={item.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${item.ready ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-outline'}`}><span>{item.ready ? '✓' : '○'}</span>{item.label}</div>)}
        </div>
      </section>

      {isEncounterActive && currentEncounterId && (
        <div
          className="bg-primary/10 border border-primary/30 rounded-2xl p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => setActiveTab('encounters')}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-bold">Combat Active</p>
              <p className="font-bold text-on-surface">{encounterName}</p>
              <p className="text-xs text-outline">Round {currentRound} · {combatants.filter(c => c.hp.current > 0).length} standing</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sessionStatus.map(stat => (
          <button
            key={stat.label}
            onClick={() => stat.label === 'Party' ? setActiveTab('import') : stat.label === 'Encounter' ? setActiveTab('encounters') : stat.label === 'Next up' ? setActiveTab('campaigns') : setActiveTab('encounters')}
            className="bg-surface-container-low rounded-2xl p-4 border border-white/5 flex flex-col gap-2 hover:border-white/10 hover:bg-white/5 transition-all text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-outline uppercase tracking-widest">{stat.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Resume Encounter', icon: Play, action: primaryAction, desc: isEncounterActive ? encounterName : latestEncounter?.name ?? upcomingSession?.name ?? 'Choose what to run next', iconColor: 'text-primary', bgColor: 'bg-primary/10', hoverBorder: 'hover:border-primary/40', hoverBg: 'hover:bg-primary/5' },
          { label: 'New Encounter', icon: Swords, action: () => setIsEncounterCreatorOpen(true), desc: 'Build and launch combat', iconColor: 'text-violet-400', bgColor: 'bg-violet-400/10', hoverBorder: 'hover:border-violet-400/40', hoverBg: 'hover:bg-violet-400/5' },
          { label: 'Campaign Board', icon: MapIcon, action: () => setActiveTab('campaigns'), desc: 'Plan the next session', iconColor: 'text-teal-400', bgColor: 'bg-teal-400/10', hoverBorder: 'hover:border-teal-400/40', hoverBg: 'hover:bg-teal-400/5' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={`bg-surface-container-low border border-white/5 rounded-2xl p-6 text-left ${btn.hoverBorder} ${btn.hoverBg} transition-colors group`}
          >
            <div className={`w-10 h-10 rounded-xl ${btn.bgColor} flex items-center justify-center mb-4 transition-colors`}>
              <btn.icon className={`w-5 h-5 ${btn.iconColor}`} />
            </div>
            <p className="font-bold text-on-surface">{btn.label}</p>
            <p className="text-xs text-outline mt-1">{btn.desc}</p>
          </button>
        ))}
      </div>

      {(campaigns ?? []).length > 0 && (() => {
        const featuredCampaign = activeCampaign ?? [...(campaigns ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const otherCampaigns = [...(campaigns ?? [])].filter(c => c.id !== featuredCampaign.id).slice(0, 2);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest font-bold text-outline">Campaign</h3>
              {(campaigns ?? []).length > 1 && (
                <button onClick={() => setActiveTab('campaigns')} className="text-xs text-primary hover:underline">View all ({(campaigns ?? []).length})</button>
              )}
            </div>

            <button
              onClick={() => onSelectCampaign?.(featuredCampaign.id)}
              className="w-full relative overflow-hidden rounded-2xl h-64 text-left group"
              style={{
                background: featuredCampaign.mapImage
                  ? `url(${featuredCampaign.mapImage}) center/cover`
                  : '#0c1a2e',
              }}
            >
              {!featuredCampaign.mapImage && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(255,135,189,0.06) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,135,189,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[#060810] via-[#060810]/30 to-transparent" />

              {!featuredCampaign.mapImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full bg-primary animate-pulse" style={{ boxShadow: '0 0 24px 8px rgba(255,135,189,0.4)' }} />
                  </div>
                </div>
              )}

              <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#060810]/80 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-on-surface truncate max-w-[200px]">{featuredCampaign.name}</span>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between">
                <div>
                  <h2 className="font-headline font-bold text-2xl text-white leading-tight mb-1">{featuredCampaign.name}</h2>
                  <p className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">{campaignEncounters.length} encounter{campaignEncounters.length !== 1 ? 's' : ''} · {lastSession ? `Last played ${new Date(lastSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Not played yet'}</p>
                  <p className="text-sm text-white/70 mt-2 line-clamp-2 max-w-xl">{featuredCampaign.description || 'No lore recorded yet.'}</p>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold text-xs uppercase tracking-widest rounded-xl shrink-0 group-hover:bg-primary/90 transition-all"
                  style={{ boxShadow: '0 4px 20px rgba(255,135,189,0.3)' }}>
                  Open Lore
                </div>
              </div>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="bg-surface-container-low border border-white/5 rounded-xl p-3"><p className="text-[10px] uppercase tracking-widest text-outline">Next session</p><p className="font-medium mt-1 truncate">{upcomingSession?.name ?? 'Not set'}</p></div>
              <div className="bg-surface-container-low border border-white/5 rounded-xl p-3"><p className="text-[10px] uppercase tracking-widest text-outline">Next encounter</p><p className="font-medium mt-1 truncate">{nextEncounter ?? 'Not set'}</p></div>
            </div>

            {otherCampaigns.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectCampaign?.(c.id)}
                className="w-full flex items-center gap-4 bg-surface-container-low border border-white/5 rounded-xl px-5 py-3 text-left hover:border-primary/20 hover:bg-primary/5 transition-colors group"
              >
                <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                <p className="font-medium text-sm truncate flex-1">{c.name}</p>
                <ChevronRight className="w-4 h-4 text-outline/30 group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        );
      })()}

      {savedEncounters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-widest font-bold text-outline">Recent Encounters</h3>
            <button onClick={() => setActiveTab('encounters')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {[...savedEncounters]
              .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
              .slice(0, 5)
              .map(enc => {
                const status = enc.id === currentEncounterId && isEncounterActive ? 'Active' : enc.completedAt ? 'Completed' : enc.sessionId ? 'Scheduled' : 'Draft';
                const statusClass = status === 'Active' ? 'text-primary bg-primary/10' : status === 'Completed' ? 'text-emerald-400 bg-emerald-400/10' : status === 'Scheduled' ? 'text-sky-400 bg-sky-400/10' : 'text-outline bg-white/5';
                return <button
                  key={enc.id}
                  onClick={() => handleLoadEncounter(enc)}
                  className="w-full flex items-center gap-4 bg-surface-container-low border border-white/5 rounded-xl px-5 py-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                >
                  <Clock className="w-4 h-4 text-outline shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{enc.name}</p>
                    <p className="text-[10px] text-outline">{enc.combatants?.length ?? 0} combatants · {new Date(enc.lastModified).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 shrink-0 ${statusClass}`}>{status}</span>
                  <ChevronRight className="w-4 h-4 text-outline/40 group-hover:text-primary transition-colors shrink-0" />
                </button>;
              })}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest font-bold text-outline">Players</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {players.map(p => (
              <div key={p.id} className="bg-surface-container-low border border-white/5 rounded-xl p-4 flex items-center gap-3">
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-outline">{p.class ?? 'Player'}{p.level ? ` · Lv ${p.level}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {players.length === 0 && savedEncounters.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <p className="text-outline text-sm">No data yet. Start by importing your players or creating an encounter.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setActiveTab('import')} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold">Import Players</button>
            <button onClick={() => setIsEncounterCreatorOpen(true)} className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-sm font-bold">New Encounter</button>
          </div>
        </div>
      )}
    </div>
  );
};
