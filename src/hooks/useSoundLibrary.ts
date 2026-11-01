import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

export type LibrarySource = 'ambiences' | 'local' | 'online' | 'youtube' | 'foundry';

export interface LibrarySound {
  id: string;
  name: string;
  description?: string;
  pack?: string;
  category: string;
  tags: string[];
  volume: number;
  url: string;
}

interface AmbienceVariant {
  label: string;
  url: string;
}

export interface AmbienceTrack {
  id: string;
  name: string;
  genre: string;
  defaultUrl: string;
  variants: AmbienceVariant[];
}

interface UseSoundLibraryOptions {
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export const useSoundLibrary = ({ onRefresh, onClose }: UseSoundLibraryOptions) => {
  const [library, setLibrary] = useState<LibrarySound[]>([]);
  const [localLibrary, setLocalLibrary] = useState<LibrarySound[]>([]);
  const [ambienceLibrary, setAmbienceLibrary] = useState<AmbienceTrack[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [source, setSource] = useState<LibrarySource>('ambiences');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState('');
  const [ytName, setYtName] = useState('');
  const [ytCategory, setYtCategory] = useState('ambient');
  const [ytVolume, setYtVolume] = useState(0.8);
  const [ytFetching, setYtFetching] = useState(false);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytSuccess, setYtSuccess] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytRecent, setYtRecent] = useState<string[]>([]);
  const [foundryDataPath, setFoundryDataPath] = useState(() => localStorage.getItem('foundry_data_path') ?? '');
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  const [selectedWorld, setSelectedWorld] = useState('');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [foundryLoading, setFoundryLoading] = useState(false);

  const updateFoundryDataPath = (path: string) => {
    setFoundryDataPath(path);
    localStorage.setItem('foundry_data_path', path);
    setWorlds([]);
    setSelectedWorld('');
    setPlaylists([]);
  };

  const loadSource = useCallback(async (nextSource: 'ambiences' | 'local' | 'online', forceReload = false) => {
    setLibraryError(null);
    if (nextSource === 'ambiences' && (ambienceLibrary.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const data = await api.sounds.ambiences(); setAmbienceLibrary(data as AmbienceTrack[]); } catch (error: any) { setLibraryError(error.message ?? 'Could not load ambiences'); }
      finally { setLibraryLoading(false); }
    }
    if (nextSource === 'local' && (localLibrary.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const data = await api.sounds.local(); setLocalLibrary(data as LibrarySound[]); } catch (error: any) { setLibraryError(error.message ?? 'Could not load local sounds'); }
      finally { setLibraryLoading(false); }
    }
    if (nextSource === 'online' && (library.length === 0 || forceReload)) {
      setLibraryLoading(true);
      try { const data = await api.sounds.library(); setLibrary(data as LibrarySound[]); } catch (error: any) { setLibraryError(error.message ?? 'Could not load online library'); }
      finally { setLibraryLoading(false); }
    }
  }, [ambienceLibrary.length, localLibrary.length, library.length]);

  const searchYoutube = useCallback(async (query: string) => {
    if (!query.trim() || ytSearching) return;
    setYtSearching(true);
    setYtError(null);
    setYtResults([]);
    try {
      const results = await api.sounds.youtubeSearch(query);
      setYtResults(results);
      setYtRecent(previous => [query, ...previous.filter(item => item !== query)].slice(0, 5));
    } catch (error: any) {
      setYtError(error.message ?? 'Search failed');
    }
    setYtSearching(false);
  }, [ytSearching]);

  const loadFoundryWorlds = useCallback(async () => {
    setFoundryLoading(true);
    setLibraryError(null);
    try {
      const configured = foundryDataPath.trim() || (await api.foundry.getConfig()).dataPath;
      if (configured && configured !== foundryDataPath) {
        setFoundryDataPath(configured);
        localStorage.setItem('foundry_data_path', configured);
      }
      const data = await api.foundry.worlds(configured || undefined);
      setWorlds(data);
    } catch (error: any) { setLibraryError(error.message ?? 'Could not load Foundry worlds'); }
    finally { setFoundryLoading(false); }
  }, [foundryDataPath]);

  const loadFoundryPlaylists = useCallback(async (worldId: string) => {
    setFoundryLoading(true);
    setLibraryError(null);
    try {
      const data = await api.foundry.playlists(worldId, foundryDataPath.trim() || undefined);
      setPlaylists(data);
    } catch (error: any) { setLibraryError(error.message ?? 'Could not load Foundry playlists'); }
    finally { setFoundryLoading(false); }
  }, [foundryDataPath]);

  useEffect(() => {
    if (source === 'foundry' && worlds.length === 0) loadFoundryWorlds();
  }, [source, worlds.length, loadFoundryWorlds]);

  useEffect(() => {
    if (selectedWorld) loadFoundryPlaylists(selectedWorld);
    else setPlaylists([]);
  }, [selectedWorld, loadFoundryPlaylists]);

  useEffect(() => {
    if (source !== 'youtube' || !ytUrl.trim() || !ytUrl.startsWith('http')) return;
    const timer = setTimeout(async () => {
      setYtFetching(true);
      try {
        const { title } = await api.sounds.youtubeMeta(ytUrl);
        if (title) setYtName(previous => previous || title);
      } catch {}
      setYtFetching(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [ytUrl, source]);

  const downloadYoutube = useCallback(async () => {
    if (!ytUrl.trim() || ytDownloading) return;
    setYtDownloading(true);
    setYtError(null);
    setYtSuccess(null);
    try {
      const result = await api.sounds.youtubeDownload({ url: ytUrl, name: ytName.trim() || undefined, category: ytCategory, volume: ytVolume });
      setYtSuccess(`"${result.name}" imported successfully!`);
      setYtUrl('');
      setYtName('');
      await onRefresh();
    } catch (error: any) {
      setYtError(error.message ?? 'Download failed');
    }
    setYtDownloading(false);
  }, [ytUrl, ytName, ytCategory, ytVolume, ytDownloading, onRefresh]);

  const importSelected = useCallback(async (ids: Set<string>, selectedVariants: Record<string, string>) => {
    if (ids.size === 0) return;
    setImporting(true);
    try {
      if (source === 'ambiences') {
        const items = Array.from(ids).map(id => {
          const track = ambienceLibrary.find(item => item.id === id)!;
          return { id, name: track.name, url: selectedVariants[id] ?? track.defaultUrl, genre: track.genre };
        });
        await api.sounds.importAmbiences(items);
      } else {
        const endpoint = source === 'local' ? '/api/sounds/local/import' : '/api/sounds/library/import';
        await api.sounds.importBulkVisible(endpoint, Array.from(ids));
      }
      await onRefresh();
      onClose();
    } finally {
      setImporting(false);
    }
  }, [source, ambienceLibrary, onRefresh, onClose]);

  const importFoundry = useCallback(async (ids: Set<string>) => {
    if (ids.size === 0) return false;
    setImporting(true);
    try {
      const result = await api.sounds.importFoundry(selectedWorld, Array.from(ids));
      await onRefresh();
      setImportStatus(`Imported ${result.inserted}; skipped ${result.skipped}; unavailable ${result.invalid}.`);
      return true;
    } catch (error: any) {
      setImportStatus(error.message || 'Foundry import failed');
      return false;
    } finally {
      setImporting(false);
    }
  }, [selectedWorld, onRefresh]);

  const importAll = useCallback(async (ids: string[], selectedVariants: Record<string, string>) => {
    setImporting(true);
    try {
      if (source === 'ambiences') {
        const items = ids.map(id => {
          const track = ambienceLibrary.find(item => item.id === id)!;
          return { id, name: track.name, url: selectedVariants[id] ?? track.defaultUrl, genre: track.genre };
        });
        await api.sounds.importAmbiences(items);
      } else {
        const endpoint = source === 'local' ? '/api/sounds/local/import' : '/api/sounds/library/import';
        await api.sounds.importBulkVisible(endpoint, ids);
      }
      await onRefresh();
      onClose();
    } finally {
      setImporting(false);
    }
  }, [source, ambienceLibrary, onRefresh, onClose]);

  const reset = () => {
    setImportStatus(null);
    setLibraryError(null);
    setSource('ambiences');
    setYtUrl('');
    setYtName('');
    setYtCategory('ambient');
    setYtVolume(0.8);
    setYtError(null);
    setYtSuccess(null);
    setWorlds([]);
    setSelectedWorld('');
    setPlaylists([]);
  };

  return {
    source,
    setSource,
    library,
    localLibrary,
    ambienceLibrary,
    libraryLoading,
    libraryError,
    importing,
    importStatus,
    setImportStatus,
    loadSource,
    importSelected,
    importFoundry,
    importAll,
    reset,
    youtube: {
      url: ytUrl,
      setUrl: setYtUrl,
      name: ytName,
      setName: setYtName,
      category: ytCategory,
      setCategory: setYtCategory,
      volume: ytVolume,
      setVolume: setYtVolume,
      fetching: ytFetching,
      downloading: ytDownloading,
      error: ytError,
      success: ytSuccess,
      results: ytResults,
      searching: ytSearching,
      recent: ytRecent,
      search: searchYoutube,
      download: downloadYoutube,
    },
    foundry: {
      dataPath: foundryDataPath,
      setDataPath: updateFoundryDataPath,
      worlds,
      selectedWorld,
      setSelectedWorld,
      playlists,
      loading: foundryLoading,
      loadWorlds: loadFoundryWorlds,
    },
  };
};
