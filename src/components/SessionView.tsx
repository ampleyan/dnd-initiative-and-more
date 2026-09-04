import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronLeft, Swords, Edit2, Check, X, ExternalLink, Link2, Link2Off, Zap, BookOpen, MapPin, Users, Scroll, Settings } from 'lucide-react';
import { Campaign, Session, Encounter, Player, Sound } from '../types';
import { AvatarImg } from './AvatarImg';
import { SaveEncounterModal } from './SaveEncounterModal';

function daysAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff < 0) return new Date(dateStr).toLocaleDateString();
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

function sessionLabel(index: number, total: number): string {
  return `Session ${total - index}`;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  hard: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  deadly: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const YON_MAP = 'https://5e.tools/img/adventure/WBtW/072-map-4.1-yon.webp';

interface SessionViewProps {
  campaign: Campaign;
  sessions: Session[];
  players: Player[];
  allEncounters: Encounter[];
  isEncounterActive: boolean;
  currentEncounterName?: string;
  onBack: () => void;
  onCreateSession: (name: string, date: string, notes: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onUpdateSession: (id: string, updates: Partial<Pick<Session, 'name' | 'date' | 'notes'>>) => Promise<void>;
  onUpdateCampaign: (id: string, updates: Partial<Pick<Campaign, 'name' | 'description' | 'mapImage'>>) => Promise<void>;
  onAssignEncounter: (encounterId: string, sessionId: string | null) => Promise<void>;
  onLoadSessions: (campaignId: string) => Promise<void>;
  onOpenEncounter: (enc: Encounter) => void;
  onUpdateEncounter: (id: string, updates: Partial<Encounter>) => Promise<void>;
  sounds: Sound[];
}

export const SessionView: React.FC<SessionViewProps> = ({
  campaign,
  sessions,
  players,
  allEncounters,
  isEncounterActive,
  currentEncounterName,
  onBack,
  onCreateSession,
  onDeleteSession,
  onUpdateSession,
  onUpdateCampaign,
  onAssignEncounter,
  onLoadSessions,
  onOpenEncounter,
  onUpdateEncounter,
  sounds,
}) => {
  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'lore' | 'now'>('overview');
  const [showNewSession, setShowNewSession] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingRecapId, setEditingRecapId] = useState<string | null>(null);
  const [recapDraft, setRecapDraft] = useState('');
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [assigningToSessionId, setAssigningToSessionId] = useState<string | null>(null);

  const [editingEncounter, setEditingEncounter] = useState<Encounter | null>(null);

  const [editingCampaign, setEditingCampaign] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState(campaign.name);
  const [editCampaignDescription, setEditCampaignDescription] = useState(campaign.description || '');
  const [editCampaignMap, setEditCampaignMap] = useState(campaign.mapImage || '');

  useEffect(() => {
    onLoadSessions(campaign.id);
  }, [campaign.id]);

  useEffect(() => {
    if (!editingCampaign) {
      setEditCampaignName(campaign.name);
      setEditCampaignDescription(campaign.description || '');
      setEditCampaignMap(campaign.mapImage || '');
    }
  }, [campaign, editingCampaign]);

  const handleSaveCampaign = async () => {
    await onUpdateCampaign(campaign.id, {
      name: editCampaignName,
      description: editCampaignDescription,
      mapImage: editCampaignMap,
    });
    setEditingCampaign(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await onCreateSession(newName.trim(), newDate, newNotes.trim());
    setNewName('');
    setNewNotes('');
    setShowNewSession(false);
    setCreating(false);
  };

  const saveSession = async (id: string) => {
    await onUpdateSession(id, { name: editSessionName, date: editSessionDate, notes: recapDraft });
    setEditingRecapId(null);
  };

  const handleAssign = async (encounterId: string, sessionId: string) => {
    setAssigning(encounterId);
    await onAssignEncounter(encounterId, sessionId);
    setAssigning(null);
    setAssigningToSessionId(null);
  };

  const handleUnassign = async (encounterId: string) => {
    setAssigning(encounterId);
    await onAssignEncounter(encounterId, null);
    setAssigning(null);
  };

  const thisCampaignEncounters = allEncounters.filter(e => e.campaignId === campaign.id);
  const campaignEncounters = thisCampaignEncounters.filter(e => e.sessionId);
  const unassigned = thisCampaignEncounters.filter(e => !e.sessionId);
  const totalEncounters = campaignEncounters.length;
  const totalRounds = campaignEncounters.reduce((sum, e) => sum + (e.encounterStats?.totalRounds ?? 0), 0);
  const totalEnemies = campaignEncounters.reduce((sum, e) => sum + (e.encounterStats?.enemiesDefeated ?? 0), 0);
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, 5);
  const recentEncounters = campaignEncounters.slice(-5).reverse();

  const SUBTABS = [
    { id: 'overview' as const, label: 'Overview', Icon: Scroll },
    { id: 'lore' as const, label: 'Lore', Icon: BookOpen },
    { id: 'now' as const, label: 'Now', Icon: Swords },
  ];

  return (
    <div className="min-h-full">
      {/* ── Header ── */}
      <section className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-outline/10 pb-6">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="flex items-center gap-2 mb-4 text-outline hover:text-on-surface transition-colors text-xs font-headline uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            All Campaigns
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px w-8 bg-primary inline-block" />
            <span className="font-headline text-primary text-xs tracking-[0.3em] uppercase">DM Command Center</span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            {editingCampaign ? (
              <input
                autoFocus
                type="text"
                value={editCampaignName}
                onChange={e => setEditCampaignName(e.target.value)}
                className="bg-surface-container-high border-none rounded-lg px-3 py-1 text-3xl md:text-4xl font-headline font-bold text-on-surface focus:ring-2 focus:ring-primary w-full max-w-sm"
              />
            ) : (
              <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-on-surface flex items-center gap-3 group">
                {campaign.name}
                <button
                  onClick={() => setEditingCampaign(true)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-container-highest rounded-lg transition-all text-outline hover:text-primary"
                  title="Edit Campaign Details"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </h1>
            )}
            {!editingCampaign && (
              <div className="flex gap-2 items-center">
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-outline font-headline">
                  {sessions.length} SESSION{sessions.length !== 1 ? 'S' : ''}
                </span>
                {isEncounterActive && (
                  <span className="text-[10px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-primary font-bold font-headline animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
            )}
          </div>
          {editingCampaign && (
            <div className="mt-4 space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline/10 w-full max-w-xl">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Adventure Summary / Lore</label>
                <textarea
                  value={editCampaignDescription}
                  onChange={e => setEditCampaignDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-surface-container-high border-none rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary resize-none"
                  placeholder="The story so far..."
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Map Image URL</label>
                <input
                  type="text"
                  value={editCampaignMap}
                  onChange={e => setEditCampaignMap(e.target.value)}
                  className="w-full bg-surface-container-high border-none rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveCampaign} className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors">
                  Save Changes
                </button>
                <button onClick={() => setEditingCampaign(false)} className="px-4 py-2 bg-surface-container-high text-outline rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-8 mt-6 md:mt-0 shrink-0 bg-surface-container/80 backdrop-blur-md p-4 rounded-xl border border-outline/10">
          <div className="flex flex-col">
            <span className="font-headline text-[10px] text-outline uppercase tracking-widest">Encounters</span>
            <span className="text-on-surface text-base font-medium">{totalEncounters}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-[10px] text-outline uppercase tracking-widest">Rounds Fought</span>
            <span className="text-on-surface text-base font-medium">{totalRounds > 0 ? totalRounds : '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-[10px] text-outline uppercase tracking-widest">Started</span>
            <span className="text-on-surface text-base font-medium">
              {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </section>

      {/* ── Subtab nav ── */}
      <div className="flex gap-1 mb-8 border-b border-outline/10">
        {SUBTABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSubtab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-headline uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              activeSubtab === id
                ? 'text-primary border-primary'
                : 'text-outline border-transparent hover:text-on-surface'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeSubtab === 'overview' && (
        <div className="pb-12 space-y-8">

          {/* ── 2×2 Dashboard Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Tactical Map */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xs font-bold tracking-widest uppercase text-primary">Tactical Map</h3>
                <button onClick={() => setActiveSubtab('lore')} className="text-[10px] uppercase tracking-widest text-outline hover:text-primary transition-colors flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Lore
                </button>
              </div>
              <div className="relative h-[340px] rounded-xl overflow-hidden shadow-lg group border border-outline/20 bg-surface-container-low bg-cover bg-center" style={campaign.mapImage ? { backgroundImage: `url(${campaign.mapImage})` } : undefined}>
                {!campaign.mapImage && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#adc6ff 1px, transparent 1px), linear-gradient(90deg, #adc6ff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span className="font-headline text-[11px] font-bold tracking-tight text-on-surface">{campaign.name}</span>
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative h-5 w-5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                    <span className="relative block h-5 w-5 rounded-full bg-primary shadow-[0_0_15px_#adc6ff] border border-white/20" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="space-y-0.5">
                    <h3 className="font-headline text-xl font-bold text-white">{campaign.name}</h3>
                    <span className="text-[9px] font-headline uppercase tracking-widest text-blue-200/80">
                      {totalEncounters} encounter{totalEncounters !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSubtab('lore')}
                    className="bg-primary hover:bg-primary/80 text-on-primary px-4 py-2 rounded-lg font-headline font-bold text-xs transition-all shadow-lg active:scale-95"
                  >
                    OPEN LORE
                  </button>
                </div>
              </div>
            </div>

            {/* Adventure Summary */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xs font-bold tracking-widest uppercase text-primary">Adventure Summary</h3>
                <button onClick={() => setActiveSubtab('lore')} className="text-[10px] uppercase tracking-widest text-outline hover:text-primary transition-colors">Full Log</button>
              </div>
              <div className="bg-surface-container-low h-[340px] p-5 rounded-xl border border-outline/20 flex flex-col relative overflow-hidden">
                <span className="font-headline text-[9px] text-primary tracking-widest uppercase mb-3 block">Official Chronicle</span>
                {campaign.description ? (
                  <>
                    <div className="space-y-3 overflow-hidden relative flex-1">
                      {campaign.description.split('\n').filter(p => p.trim()).map((para, i) => (
                        <p key={i} className={`text-[13px] leading-relaxed ${i === 0 ? 'text-on-surface' : 'text-on-surface-variant italic border-l-2 border-primary/30 pl-3'}`}>{para}</p>
                      ))}
                      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(23, 28, 34, 1) 100%)' }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-outline/10 shrink-0">
                      <div className="flex gap-1.5 flex-wrap">
                        {campaign.name.split(' ').slice(0, 3).map(word => (
                          <span key={word} className="text-[9px] font-headline bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">{word}</span>
                        ))}
                      </div>
                      <button onClick={() => setActiveSubtab('lore')} className="text-primary font-headline text-[10px] font-bold tracking-widest uppercase hover:underline shrink-0">Read More</button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-outline/30">
                    <BookOpen className="w-10 h-10" />
                    <p className="text-xs">No adventure summary yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Encounters */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xs font-bold tracking-widest uppercase text-on-surface/70">Encounters</h3>
                {campaignEncounters.length > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded border border-outline/20 text-outline font-headline">
                    {campaignEncounters.length} total
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {recentEncounters.length === 0 ? (
                  <div className="p-10 rounded-xl bg-surface-container border border-outline/10 flex flex-col items-center gap-2">
                    <Swords className="w-8 h-8 text-outline/20" />
                    <p className="text-xs text-outline/40">No encounters yet.</p>
                  </div>
                ) : (
                  recentEncounters.map((enc, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div
                        key={enc.id}
                        className={`p-4 rounded-xl border shadow-md group transition-all ${isFirst ? 'bg-surface-container border-l-4 border-l-primary hover:bg-surface-container-high' : 'bg-surface-container-low border-outline/10 hover:border-outline/30 hover:bg-surface-container'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              {isFirst && <Swords className="w-3.5 h-3.5 text-primary" />}
                              <h4 className="text-sm font-bold font-headline text-on-surface">{enc.name}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              {enc.difficulty && (
                                <span className={`text-[9px] uppercase tracking-wider font-headline font-bold px-1.5 py-0.5 rounded border ${DIFFICULTY_COLOR[enc.difficulty.toLowerCase()] ?? 'bg-outline/10 text-outline border-outline/20'}`}>
                                  {enc.difficulty}
                                </span>
                              )}
                              {enc.encounterStats && (
                                <span className="text-[9px] text-outline/50 font-headline">
                                  {enc.encounterStats.totalRounds}r · {enc.encounterStats.enemiesDefeated} defeated
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingEncounter(enc)}
                              className="p-1.5 text-outline/50 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit encounter settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenEncounter(enc)}
                              className={`px-3 py-1.5 rounded-lg font-headline font-bold text-[10px] transition-all border uppercase tracking-widest ${isFirst ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20' : 'text-primary hover:bg-primary/10 border-transparent'}`}
                            >
                              Open
                            </button>
                          </div>
                        </div>
                        {players.length > 0 && (
                          <div className="flex -space-x-2 mt-1">
                            {players.slice(0, 3).map(p => (
                              <AvatarImg key={p.id} src={p.avatar} name={p.name} className="h-5 w-5 rounded-full border-2 border-surface-container text-[8px]" />
                            ))}
                            {players.length > 3 && (
                              <div className="h-5 w-5 rounded-full border-2 border-surface-container bg-slate-800 flex items-center justify-center">
                                <span className="text-[8px] text-outline font-bold">+{players.length - 3}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Party Status */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xs font-bold tracking-widest uppercase text-on-surface/70">Party Status</h3>
              </div>
              <div className="space-y-3">
                {players.length === 0 ? (
                  <div className="p-10 rounded-xl bg-surface-container border border-outline/10 flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-outline/20" />
                    <p className="text-xs text-outline/40">No players imported yet.</p>
                  </div>
                ) : (
                  players.map(player => {
                    const level = player.level ?? parseInt(player.subtitle?.match(/\d+/)?.[0] ?? '0');
                    return (
                      <div key={player.id} className="flex gap-3 p-3 bg-surface-container rounded-xl border border-outline/5 hover:bg-surface-container-high transition-all">
                        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-outline/20">
                          <AvatarImg src={player.avatar} name={player.name} className="w-full h-full text-base" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-bold truncate font-headline text-on-surface">{player.name}</span>
                            {level > 0 && <span className="text-[9px] text-primary font-headline font-bold shrink-0 ml-1">LVL {level}</span>}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <span className="px-1 py-0.5 rounded-sm bg-surface-container-highest text-outline text-[7px] font-headline font-bold uppercase">AC {player.ac}</span>
                            {player.speed && <span className="px-1 py-0.5 rounded-sm bg-surface-container-highest text-outline text-[7px] font-headline font-bold uppercase">SPD {player.speed.split(',').map((s: string) => s.trim()).filter((s: string) => !/ 0 ft\.?/.test(s)).join(', ') || player.speed}</span>}
                            {player.passivePerception && <span className="px-1 py-0.5 rounded-sm bg-surface-container-highest text-outline text-[7px] font-headline font-bold uppercase">PP {player.passivePerception}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* ── Sessions section ── */}
          <div className="border-t border-outline/10 pt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-headline text-sm font-bold tracking-widest uppercase text-on-surface/70">Sessions</h3>
                {sessions.length > 0 && (
                  <span className="text-[9px] bg-surface-container text-outline border border-outline/10 px-2 py-0.5 rounded font-headline">{sessions.length}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unassigned.length > 0 && (
                  <button
                    onClick={() => setAssigningToSessionId(assigningToSessionId ? null : (sessions[0]?.id ?? null))}
                    className="flex items-center gap-1.5 text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors font-headline uppercase tracking-widest"
                  >
                    <Link2 className="w-3 h-3" />
                    Assign ({unassigned.length})
                  </button>
                )}
                <button
                  onClick={() => setShowNewSession(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-outline/20 rounded-lg text-xs text-outline hover:border-outline/40 hover:text-on-surface transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Session
                </button>
              </div>
            </div>

            {showNewSession && (
              <div className="bg-surface-container rounded-xl p-4 space-y-3 border border-outline/10 max-w-lg">
                <input
                  type="text" autoFocus placeholder="Session name" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <textarea
                  placeholder="Recap (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                  className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating || !newName.trim()} className="flex-1 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button onClick={() => setShowNewSession(false)} className="px-3 py-2 bg-surface-container-high text-outline rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {assigningToSessionId && unassigned.length > 0 && (
              <div className="bg-surface-container rounded-xl p-4 border border-outline/10 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-outline/50 font-bold">Add encounter to session</p>
                  <select
                    value={assigningToSessionId}
                    onChange={e => setAssigningToSessionId(e.target.value)}
                    className="bg-surface-container-high border border-outline/20 rounded px-2 py-1 text-[10px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unassigned.map(enc => (
                    <button
                      key={enc.id}
                      onClick={() => handleAssign(enc.id, assigningToSessionId)}
                      disabled={assigning === enc.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-outline hover:text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Link2 className="w-3 h-3 text-primary shrink-0" />
                      {enc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="text-center py-12 text-outline/30">
                <p className="text-sm">No sessions yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleSessions.map((session, i) => {
                  const isLatest = i === 0;
                  const isEditing = editingRecapId === session.id;
                  const sessionEncs = allEncounters.filter(e => e.sessionId === session.id);
                  return (
                    <div key={session.id} className="bg-surface-container-low rounded-xl border border-outline/10 overflow-hidden group/session">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-outline/10">
                        {isEditing ? (
                          <div className="flex gap-3 w-full mr-4">
                            <input
                              type="text"
                              value={editSessionName}
                              onChange={e => setEditSessionName(e.target.value)}
                              className="flex-1 bg-surface-container-high border-none rounded px-2 py-1 text-sm font-semibold text-on-surface focus:ring-1 focus:ring-primary"
                              placeholder="Session name"
                            />
                            <input
                              type="date"
                              value={editSessionDate}
                              onChange={e => setEditSessionDate(e.target.value)}
                              className="w-32 bg-surface-container-high border-none rounded px-2 py-1 text-xs text-on-surface focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className={`font-headline text-[9px] tracking-widest uppercase ${isLatest ? 'text-primary' : 'text-outline/50'}`}>
                              {sessionLabel(i, sessions.length)}{session.date && ` · ${daysAgo(session.date)}`}
                            </span>
                            <h4 className="text-sm font-semibold text-on-surface mt-0.5 group-hover:text-primary transition-colors flex items-center gap-2">
                              {session.name}
                              <button
                                onClick={() => {
                                  setEditingRecapId(session.id);
                                  setEditSessionName(session.name);
                                  setEditSessionDate(session.date || new Date().toISOString().slice(0, 10));
                                  setRecapDraft(session.notes ?? '');
                                }}
                                className="opacity-0 group-hover/session:opacity-100 p-1 text-outline/50 hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </h4>
                          </div>
                        )}
                        <button onClick={() => onDeleteSession(session.id)} className="p-1 text-outline/20 hover:text-error transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {sessionEncs.length > 0 && (
                        <div className="divide-y divide-outline/5">
                          {sessionEncs.map(enc => (
                            <div key={enc.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-surface-container transition-colors group">
                              <div className="min-w-0 flex-1">
                                <button onClick={() => onOpenEncounter(enc)} className="text-sm font-semibold text-on-surface hover:text-primary transition-colors flex items-center gap-1.5">
                                  {enc.name}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                </button>
                                {enc.encounterStats && (
                                  <p className="text-[10px] text-outline/50">{enc.encounterStats.totalRounds}r · {enc.encounterStats.enemiesDefeated} defeated · {enc.encounterStats.playersAlive} survived</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setEditingEncounter(enc)}
                                  className="p-1 text-outline/50 hover:text-primary transition-colors"
                                  title="Edit encounter"
                                >
                                  <Settings className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleUnassign(enc.id)}
                                  disabled={assigning === enc.id}
                                  className="p-1 text-outline/20 hover:text-error rounded disabled:opacity-30 transition-colors"
                                  title="Unassign encounter"
                                >
                                  <Link2Off className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="px-5 py-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              autoFocus value={recapDraft} onChange={e => setRecapDraft(e.target.value)} rows={3}
                              placeholder="What happened this session…"
                              className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveSession(session.id)} className="flex items-center gap-1 px-2.5 py-1 bg-primary text-on-primary rounded text-[10px] font-bold">
                                <Check className="w-2.5 h-2.5" /> Save
                              </button>
                              <button onClick={() => setEditingRecapId(null)} className="flex items-center gap-1 px-2.5 py-1 bg-surface-container-high text-outline rounded text-[10px] font-bold">
                                <X className="w-2.5 h-2.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : session.notes ? (
                          <div className="group/recap relative">
                            <p className="text-xs leading-relaxed text-outline/70 whitespace-pre-wrap">{session.notes}</p>
                            <button
                              onClick={() => { 
                                setEditingRecapId(session.id); 
                                setRecapDraft(session.notes ?? ''); 
                                setEditSessionName(session.name);
                                setEditSessionDate(session.date || new Date().toISOString().slice(0, 10));
                              }}
                              className="absolute top-0 right-0 p-0.5 text-outline/30 hover:text-outline transition-colors opacity-0 group-hover/recap:opacity-100"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { 
                              setEditingRecapId(session.id); 
                              setRecapDraft(''); 
                              setEditSessionName(session.name);
                              setEditSessionDate(session.date || new Date().toISOString().slice(0, 10));
                            }}
                            className="text-[10px] text-outline/40 hover:text-outline transition-colors italic"
                          >
                            + Add recap
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sessions.length > 5 && (
                  <button onClick={() => setShowAllSessions(v => !v)} className="w-full text-xs text-primary hover:underline py-2">
                    {showAllSessions ? 'Show Less' : `View All ${sessions.length} Sessions`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 border-t border-outline/10 pt-8">
            <div className="bg-surface-container rounded-lg p-4 border border-outline/10 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary/70" />
              </div>
              <div>
                <span className="font-headline text-[10px] uppercase text-outline tracking-widest">Rounds Fought</span>
                <p className="text-on-surface font-medium">{totalRounds > 0 ? totalRounds : '—'}</p>
              </div>
            </div>
            <div className="bg-surface-container rounded-lg p-4 border border-outline/10 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                <Swords className="w-5 h-5 text-primary/70" />
              </div>
              <div>
                <span className="font-headline text-[10px] uppercase text-outline tracking-widest">Foes Defeated</span>
                <p className="text-on-surface font-medium">{totalEnemies > 0 ? totalEnemies : '—'}</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════ LORE TAB ══════════ */}
      {activeSubtab === 'lore' && (
        <div className="pb-12 space-y-8">
          {campaign.description ? (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-center gap-2">
                <span className="h-px w-6 bg-primary inline-block" />
                <span className="font-headline text-primary text-xs tracking-[0.3em] uppercase">Adventure Summary</span>
              </div>
              <div className="space-y-4 text-sm text-outline leading-relaxed">
                {campaign.description.split('\n').filter(p => p.trim()).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-outline/40">
              <Scroll className="w-10 h-10" />
              <p className="text-sm">No campaign overview yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ NOW TAB ══════════ */}
      {activeSubtab === 'now' && (
        <div className="pb-12 space-y-8">
          {/* Active encounter banner */}
          {isEncounterActive && (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <Swords className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold text-emerald-400">Active Encounter: {currentEncounterName || 'In Combat'}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
            {/* Map */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="relative rounded-xl overflow-hidden border border-outline/10 shadow-2xl group">
                <img
                  src={campaign.mapImage || YON_MAP}
                  alt={`Map of ${campaign.name}`}
                  className="w-full object-cover max-h-[420px] opacity-90 transition-transform duration-[15s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-5 left-5 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-primary/20">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-headline text-sm font-bold tracking-tight text-on-surface">Yon · The Feywild</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="font-headline text-2xl font-bold text-white drop-shadow-lg">The Frostolero Plains</h2>
                  <p className="text-sm text-blue-200 drop-shadow-md mt-1">Region: Prismeer · Ruled by Endelyn Moongrave</p>
                </div>
              </div>

              {/* Recent encounters */}
              <div className="rounded-xl border border-outline/10 bg-surface-container-low overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-outline/10">
                  <Swords className="w-4 h-4 text-primary" />
                  <h3 className="font-headline text-sm font-bold tracking-widest uppercase">Recent Encounters</h3>
                </div>
                {recentEncounters.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-outline/30">
                    <p className="text-xs">No encounters recorded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-outline/5">
                    {recentEncounters.map(enc => {
                      const parentSession = sessions.find(s => s.id === enc.sessionId);
                      return (
                        <div key={enc.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-container transition-colors group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <button onClick={() => onOpenEncounter(enc)} className="text-sm font-semibold text-on-surface hover:text-primary transition-colors flex items-center gap-1.5">
                                {enc.name}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                              </button>
                              {enc.difficulty && (
                                <span className={`px-1.5 py-0.5 rounded border text-[8px] font-headline font-bold uppercase ${DIFFICULTY_COLOR[enc.difficulty.toLowerCase()] ?? 'bg-outline/10 text-outline border-outline/20'}`}>
                                  {enc.difficulty}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-outline/50 mt-0.5">
                              {parentSession?.name ?? 'Unassigned'}
                              {enc.encounterStats && ` · ${enc.encounterStats.totalRounds} rounds · ${enc.encounterStats.enemiesDefeated} defeated`}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingEncounter(enc)}
                            className="p-1.5 text-outline/50 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit encounter settings"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Party overview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-headline text-sm font-bold tracking-widest uppercase">Party Overview</h3>
              </div>

              {players.length === 0 ? (
                <p className="text-xs text-outline/40 italic">No players imported yet.</p>
              ) : (
                <div className="space-y-3">
                  {players.map(player => {
                    const level = player.level ?? parseInt(player.subtitle?.match(/\d+/)?.[0] ?? '0');
                    return (
                      <div key={player.id} className="flex gap-3 p-3 bg-surface-container rounded-xl border border-outline/10 hover:bg-surface-container-high transition-colors">
                        <AvatarImg src={player.avatar} name={player.name} className="h-14 w-14 shrink-0 rounded-lg text-lg" />
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-on-surface truncate">{player.name}</span>
                            {level > 0 && <span className="text-[10px] text-primary font-headline shrink-0 ml-1">LVL {level}</span>}
                          </div>
                          <p className="text-[10px] text-outline/60 truncate mb-2">{player.subtitle}</p>
                          <div className="flex gap-2 text-[10px] text-outline">
                            <span>HP <span className="font-bold text-on-surface/80">{player.hp_max}</span></span>
                            <span>AC <span className="font-bold text-on-surface/80">{player.ac}</span></span>
                            {player.speed && <span>SPD <span className="font-bold text-on-surface/80">{player.speed.split(',').map((s: string) => s.trim()).filter((s: string) => !/ 0 ft\.?/.test(s)).join(', ') || player.speed}</span></span>}
                            {player.passivePerception && <span>PP <span className="font-bold text-on-surface/80">{player.passivePerception}</span></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingEncounter && (
        <SaveEncounterModal
          isOpen={!!editingEncounter}
          onClose={() => setEditingEncounter(null)}
          onSave={(name, folder, backgroundImage, youtubeUrl, soundIds) => {
            onUpdateEncounter(editingEncounter.id, { name, folder, backgroundImage, youtubeUrl, soundIds });
            setEditingEncounter(null);
          }}
          initialName={editingEncounter.name}
          initialFolder={editingEncounter.folder}
          initialBackgroundImage={editingEncounter.backgroundImage}
          initialYoutubeUrl={editingEncounter.youtubeUrl}
          initialSoundIds={editingEncounter.soundIds}
          sounds={sounds}
          title="Edit Encounter"
        />
      )}
    </div>
  );
};
