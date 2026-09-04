import React, { useCallback } from 'react';
import { Campaign, Session, Encounter } from '../types';
import { uuid } from '../lib/utils';
import { api } from '../api/client';

export interface CampaignActionsParams {
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  activeCampaignId: string | null;
  setActiveCampaignId: React.Dispatch<React.SetStateAction<string | null>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  savedEncounters: Encounter[];
  setSavedEncounters: React.Dispatch<React.SetStateAction<Encounter[]>>;
}

export function useCampaignActions(params: CampaignActionsParams) {
  const {
    setCampaigns,
    setSessions,
    activeCampaignId, setActiveCampaignId,
    activeSessionId, setActiveSessionId,
    setSavedEncounters,
  } = params;

  const handleCreateCampaign = useCallback(async (name: string, description: string, mapImage?: string): Promise<Campaign | null> => {
    const id = uuid();
    try {
      await api.campaigns.create({ id, name, description, mapImage });
    } catch {
      return null;
    }
    const campaign: Campaign = { id, name, description, mapImage, createdAt: new Date().toISOString() };
    setCampaigns(prev => [campaign, ...prev]);
    return campaign;
  }, [setCampaigns]);

  const handleUpdateCampaign = useCallback(async (id: string, updates: Partial<Pick<Campaign, 'name' | 'description' | 'mapImage'>>) => {
    await api.campaigns.update(id, updates);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [setCampaigns]);

  const handleDeleteCampaign = useCallback(async (id: string) => {
    await api.campaigns.delete(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
    if (activeCampaignId === id) setActiveCampaignId(null);
  }, [activeCampaignId, setCampaigns, setActiveCampaignId]);

  const handleLoadSessions = useCallback(async (campaignId: string) => {
    try {
      setSessions(await api.sessions.list(campaignId));
    } catch { /* silently ignore */ }
  }, [setSessions]);

  const handleCreateSession = useCallback(async (campaignId: string, name: string, date: string, notes: string): Promise<Session | null> => {
    const id = uuid();
    try {
      await api.sessions.create(campaignId, { id, name, date, notes });
    } catch {
      return null;
    }
    const session: Session = { id, campaignId, name, date, notes, createdAt: new Date().toISOString() };
    setSessions(prev => [session, ...prev]);
    return session;
  }, [setSessions]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await api.sessions.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [activeSessionId, setSessions, setActiveSessionId]);

  const handleUpdateSession = useCallback(async (id: string, updates: Partial<Pick<Session, 'name' | 'date' | 'notes'>>) => {
    await api.sessions.update(id, updates);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [setSessions]);

  const handleAssignEncounterToSession = useCallback(async (encounterId: string, sessionId: string | null) => {
    await api.encounters.update(encounterId, { sessionId });
    setSavedEncounters(prev => prev.map(e => e.id === encounterId ? { ...e, sessionId } : e));
  }, [setSavedEncounters]);

  return {
    handleCreateCampaign,
    handleUpdateCampaign,
    handleDeleteCampaign,
    handleLoadSessions,
    handleCreateSession,
    handleDeleteSession,
    handleUpdateSession,
    handleAssignEncounterToSession,
  };
}
