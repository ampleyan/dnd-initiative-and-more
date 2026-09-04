import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import type { Dispatch, SetStateAction } from 'react';
import type { Encounter } from '../types';

interface RouterSyncParams {
  setCurrentEncounterId: Dispatch<SetStateAction<string | null>>;
  setActiveCampaignId: Dispatch<SetStateAction<string | null>>;
  setIsPlayerView: Dispatch<SetStateAction<boolean>>;
  handleLoadEncounter: (encounter: Encounter) => Promise<void>;
  fetchEncounterData: (encounterId: string) => Promise<void>;
  savedEncounters: Encounter[];
  currentEncounterId: string | null;
}

export function useRouterSync({
  setCurrentEncounterId,
  setActiveCampaignId,
  setIsPlayerView,
  handleLoadEncounter,
  fetchEncounterData,
  savedEncounters,
  currentEncounterId,
}: RouterSyncParams) {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/player')) {
      setIsPlayerView(true);
      const playerMatch = matchPath('/player/:id', location.pathname);
      const playerEncId = playerMatch?.params?.id;
      if (playerEncId && playerEncId !== currentEncounterId) {
        setCurrentEncounterId(playerEncId);
        fetchEncounterData(playerEncId);
      }
    } else {
      setIsPlayerView(false);
    }

    const encMatch = matchPath('/encounters/:id', location.pathname);
    const encId = encMatch?.params?.id;

    if (encId) {
      if (encId !== currentEncounterId) {
        const enc = savedEncounters.find((encounter) => encounter.id === encId);
        if (enc) {
          handleLoadEncounter(enc);
        } else {
          setCurrentEncounterId(encId);
        }
      }
    } else if (location.pathname === '/encounters') {
      setCurrentEncounterId(null);
    }

    const campMatch = matchPath('/campaigns/:id', location.pathname);
    const campId = campMatch?.params?.id;

    if (campId) {
      setActiveCampaignId(campId);
    } else if (location.pathname === '/campaigns') {
      setActiveCampaignId(null);
    }
  }, [location.pathname, setCurrentEncounterId, setActiveCampaignId, setIsPlayerView, handleLoadEncounter, fetchEncounterData, savedEncounters, currentEncounterId]);
}
