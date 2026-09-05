/**
 * Typed API client — all fetch calls go through here.
 * Every method throws an ApiError on non-OK responses so callers can
 * handle errors uniformly (e.g. catch → showError(e.message)).
 */

import type {
  Combatant,
  Encounter,
  MonsterTemplate,
  Player,
  Spell,
  Sound,
  Campaign,
  Session,
  ClassFeature,
} from '../types';

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core helpers ──────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(path, {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `${method} ${path} failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content or empty body
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const get            = <T>(path: string, signal?: AbortSignal) => request<T>('GET',    path, undefined, signal);
const getWithHeaders = <T>(path: string, headers?: Record<string, string>) => request<T>('GET', path, undefined, undefined, headers);
const post           = <T>(path: string, body: unknown)         => request<T>('POST',   path, body);
const put            = <T>(path: string, body: unknown)         => request<T>('PUT',    path, body);
const del            = <T>(path: string, body?: unknown)        => request<T>('DELETE', path, body);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  me:     ()                                   => get<{ id: string; username: string; role: string }>('/api/auth/me'),
  login:  (username: string, password: string) => post<{ id: string; username: string; role: string }>('/api/auth/login', { username, password }),
  logout: ()                                   => post<void>('/api/auth/logout', {}),
};

// ── Encounters ────────────────────────────────────────────────────────────────

export const encounters = {
  list:   ()          => get<Encounter[]>('/api/encounters'),
  get:    (id: string) => get<Encounter>(`/api/encounters/${id}`),
  create: (data: Partial<Encounter>) => post<Encounter>('/api/encounters', data),
  update: (id: string, data: Partial<Encounter>) => put<Encounter>(`/api/encounters/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/encounters/${id}`),
  bulkDelete: (ids: string[]) => del<{ success: boolean }>('/api/encounters/bulk', { ids }),
  revealWave: (encounterId: string, waveId: string) => post<{ success: boolean; revealed: number }>(`/api/encounters/${encodeURIComponent(encounterId)}/waves/${encodeURIComponent(waveId)}/reveal`, {}),
  concealWave: (encounterId: string, waveId: string) => post<{ success: boolean; concealed: number }>(`/api/encounters/${encodeURIComponent(encounterId)}/waves/${encodeURIComponent(waveId)}/conceal`, {}),
};

// ── Combatants ────────────────────────────────────────────────────────────────

export const combatants = {
  list:   (encounterId: string) => get<Combatant[]>(`/api/encounters/${encounterId}/combatants`),
  listForPlayer: (encounterId: string) => get<Combatant[]>(`/api/encounters/${encounterId}/player-combatants`),
  create: (data: Partial<Combatant>) => post<Combatant>('/api/combatants', data),
  update: (id: string, data: Partial<Combatant>) => put<Combatant>(`/api/combatants/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/combatants/${id}`),
  clearAll: (encounterId: string) => del<{ success: boolean }>(`/api/encounters/${encounterId}/combatants`),
  bulkUpdate: (encounterId: string, combatants: Combatant[], encounter?: Partial<Encounter>) =>
    put<{ success: boolean; updated: number }>(`/api/encounters/${encounterId}/combatants/bulk`, { combatants, encounter }),
};

// ── Monsters ──────────────────────────────────────────────────────────────────

export const monsters = {
  list:      () => get<MonsterTemplate[]>('/api/monsters'),
  create:    (data: Partial<MonsterTemplate>) => post<{ success: boolean }>('/api/monsters', data),
  update:    (id: string, data: Partial<MonsterTemplate>) => put<{ success: boolean }>(`/api/monsters/${id}`, data),
  delete:    (id: string) => del<{ success: boolean }>(`/api/monsters/${id}`),
  deleteAll: () => del<{ success: boolean }>('/api/monsters'),
};

// ── Players ───────────────────────────────────────────────────────────────────

export const players = {
  list:   () => get<Player[]>('/api/players'),
  create: (data: Partial<Player>) => post<Player>('/api/players', data),
  update: (id: string, data: Partial<Player>) => put<Player>(`/api/players/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/players/${id}`),
  patch:  (id: string, data: {
    hp_current?: number | null;
    ac?: number;
    speed?: string;
    subtitle?: string;
    stats?: Player['stats'];
    spellSlots?: Player['spellSlots'];
    featureUses?: Player['featureUses'];
  }, signal?: AbortSignal) => request<Player>('PATCH', `/api/players/${id}`, data, signal),
};

// ── Spells ────────────────────────────────────────────────────────────────────

export const spells = {
  list:   () => get<Spell[]>('/api/spells'),
  create: (data: Partial<Spell>) => post<{ success: boolean }>('/api/spells', data),
  delete: (id: string) => del<{ success: boolean }>(`/api/spells/${id}`),
};

// ── Sounds ────────────────────────────────────────────────────────────────────

export const sounds = {
  list:   () => get<Sound[]>('/api/sounds'),
  create: (data: Partial<Sound>) => post<Sound>('/api/sounds', data),
  update: (id: string, data: Partial<Sound>) => put<Sound>(`/api/sounds/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/sounds/${id}`),
  upload: (formData: FormData): Promise<Sound> =>
    fetch('/api/sounds', { method: 'POST', body: formData }).then(async r => {
      if (!r.ok) throw new ApiError(r.status, `Sound upload failed (${r.status})`);
      return r.json() as Promise<Sound>;
    }),
  library:   () => get<unknown[]>('/api/sounds/library'),
  local:     () => get<unknown[]>('/api/sounds/local'),
  ambiences: () => get<unknown[]>('/api/sounds/ambiences'),
  importAmbiences:   (items: unknown[]) => post<{ success: boolean }>('/api/sounds/ambiences/import', { items }),
  importSfxItem:     (data: unknown)    => post<{ success: boolean }>('/api/sounds/sfx/import', data),
  importBulkVisible: (endpoint: string, ids: string[]) =>
    post<{ success: boolean }>(endpoint, { ids }),
  youtubeMeta:     (url: string) => get<{ title: string }>(`/api/sounds/youtube/meta?url=${encodeURIComponent(url)}`),
  youtubeSearch:   (q: string) => get<any[]>(`/api/sounds/youtube/search?q=${encodeURIComponent(q)}`),
  youtubeDownload: (data: { url: string; name?: string; category?: string; volume?: number }) =>
    post<{ id: string; name: string; url: string; category: string }>('/api/sounds/youtube/download', data),
};

// ── Campaigns & Sessions ──────────────────────────────────────────────────────

export const campaigns = {
  list:   () => get<Campaign[]>('/api/campaigns'),
  create: (data: Partial<Campaign>) => post<Campaign>('/api/campaigns', data),
  update: (id: string, data: Partial<Campaign>) => put<Campaign>(`/api/campaigns/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/campaigns/${id}`),
};

export const sessions = {
  list:   (campaignId: string) => get<Session[]>(`/api/campaigns/${campaignId}/sessions`),
  create: (campaignId: string, data: Partial<Session>) => post<Session>(`/api/campaigns/${campaignId}/sessions`, data),
  update: (id: string, data: Partial<Session>) => put<Session>(`/api/sessions/${id}`, data),
  delete: (id: string) => del<{ success: boolean }>(`/api/sessions/${id}`),
};

// ── Folder settings ───────────────────────────────────────────────────────────

export interface FolderSettingsPayload {
  folder: string;
  backgroundImage?: string;
  musicUrl?: string;
}

export const folderSettings = {
  get:  (folder: string) => get<FolderSettingsPayload>(`/api/folder-settings?folder=${encodeURIComponent(folder)}`),
  list: () => get<FolderSettingsPayload[]>('/api/folder-settings'),
  save: (data: FolderSettingsPayload) => post<{ success: boolean }>('/api/folder-settings', data),
};

// ── DB ────────────────────────────────────────────────────────────────────────

export const db = {
  reset: () => post<{ success: boolean }>('/api/db/reset', {}),
  exportBackup: async () => {
    const res = await fetch('/api/backups/export');
    if (!res.ok) throw new ApiError(res.status, 'Backup export failed');
    return res.blob();
  },
  importBackup: (backup: unknown) => post<{ success: boolean }>('/api/backups/import', backup),
};

// ── Class features ────────────────────────────────────────────────────────────

export const classFeatures = {
  bulkCreate: (features: ClassFeature[]) => post<{ success: boolean }>('/api/class-features/bulk', features),
};

// ── D&D Beyond proxy ──────────────────────────────────────────────────────────

export const dndBeyond = {
  importCharacter: (id: string, cobaltSession?: string) => {
    const headers: Record<string, string> = {};
    if (cobaltSession) headers['X-Cobalt-Session'] = cobaltSession;
    return getWithHeaders<Partial<import('../types').Player>>(`/api/dnd-beyond/character/${id}`, headers);
  },
  campaignCharacters: (data: Record<string, unknown>) =>
    post<unknown>('/api/ddb/campaign-characters', data),
};

// ── Hue ──────────────────────────────────────────────────────────────────────

export const hue = {
  getConfig:     () => get<Record<string, unknown>>('/api/hue/config'),
  getLights:     () => get<unknown[]>('/api/hue/lights'),
  discover:      () => get<unknown[]>('/api/hue/discover'),
  pair:          (bridgeIp: string) => post<{ username: string }>('/api/hue/pair', { bridgeIp }),
  saveConfig:    (data: Record<string, unknown>) => post<{ success: boolean }>('/api/hue/config', data),
  flash:         (data: Record<string, unknown>) => post<{ success: boolean }>('/api/hue/flash', data),
  setSceneColor: (data: Record<string, unknown>) => post<{ success: boolean }>('/api/hue/scene-color', data),
};

// ── Home Assistant ────────────────────────────────────────────────────────────

export const ha = {
  getConfig:  () => get<Record<string, unknown>>('/api/ha/config'),
  getLights:  () => get<unknown[]>('/api/ha/lights'),
  saveConfig: (data: Record<string, unknown>) => post<{ success: boolean }>('/api/ha/config', data),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = {
  list:   () => get<{ id: string; username: string; role: string }[]>('/api/users'),
  create: (username: string, password: string, role: string) =>
    post<{ id: string; username: string; role: string }>('/api/users', { username, password, role }),
  delete: (id: string) => del<{ success: boolean }>(`/api/users/${id}`),
};

// ── Adventures ────────────────────────────────────────────────────────────────

export const adventures = {
  fetchMeta:    (id: string) =>
    get<unknown>(`/api/adventures/5etools/meta?id=${encodeURIComponent(id)}`),
  parseUrl:     (url: string) => post<unknown>('/api/adventures/parse-url', { url }),
  fetchChapter: (id: string, chapterIndex: number) =>
    get<unknown>(`/api/adventures/5etools/chapter?id=${encodeURIComponent(id)}&chapterIndex=${chapterIndex}`),
};

// ── Session Stats ─────────────────────────────────────────────────────────────

export const sessionStats = {
  get: () => get<Record<string, unknown>>('/api/session-stats'),
};

// ── Image proxy ───────────────────────────────────────────────────────────────

export const imageProxy = {
  fetch: (url: string) =>
    get<{ base64?: string; mimeType?: string }>(`/api/image-proxy?url=${encodeURIComponent(url)}`),
  // fetchBlob is used when the caller needs the raw binary (e.g. createObjectURL).
  // Can't go through the JSON request() helper.
  fetchBlob: (url: string): Promise<Response> =>
    fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`),
};

// ── Image search ──────────────────────────────────────────────────────────

export interface ImageSearchResult {
  thumb: string;
  image: string;
  title: string;
  source: string;
}

export interface ImageSearchResponse {
  results: ImageSearchResult[];
  hasMore: boolean;
  error?: string;
}

export const images = {
  search: (q: string, offset = 0): Promise<ImageSearchResponse> =>
    fetch(`/api/images/search?q=${encodeURIComponent(q)}&offset=${offset}`)
      .then(r => r.json() as Promise<ImageSearchResponse>),
};

// ── Generic proxy ─────────────────────────────────────────────────────────────

export const proxy = {
  fetch: (url: string) => get<unknown>(`/api/fetch?url=${encodeURIComponent(url)}`),
};

// ── Foundry VTT ───────────────────────────────────────────────────────────────

export const foundry = {
  worlds: (dataPath?: string) => get<{ id: string; title: string; system: string; lastPlayed: string }[]>(`/api/foundry/worlds${dataPath ? `?dataPath=${encodeURIComponent(dataPath)}` : ''}`),
  packs:  (world: string, dataPath?: string) => {
    const q = new URLSearchParams({ world });
    if (dataPath) q.set('dataPath', dataPath);
    return get<{ id: string; label: string; type: string }[]>(`/api/foundry/packs?${q}`);
  },
  actors: (params: { world: string; pack?: string; search?: string; ids?: string[]; offset?: number; limit?: number; full?: boolean; dataPath?: string }) => {
    const q = new URLSearchParams({ world: params.world });
    if (params.pack)              q.set('pack', params.pack);
    if (params.search)            q.set('search', params.search);
    if (params.ids?.length)       q.set('ids', params.ids.join(','));
    if (params.offset != null)    q.set('offset', String(params.offset));
    if (params.limit != null)     q.set('limit', String(params.limit));
    if (params.full)              q.set('full', '1');
    if (params.dataPath)          q.set('dataPath', params.dataPath);
    return get<{ actors: any[]; total: number }>(`/api/foundry/actors?${q}`);
  },
  scenes: (world: string, dataPath?: string) => {
    const q = new URLSearchParams({ world });
    if (dataPath) q.set('dataPath', dataPath);
    return get<{ id: string; name: string; active: boolean; backgroundImg: string; playlistSound: string | null }[]>(`/api/foundry/scenes?${q}`);
  },
  playlists: (world: string, dataPath?: string) => {
    const q = new URLSearchParams({ world });
    if (dataPath) q.set('dataPath', dataPath);
    return get<any[]>(`/api/foundry/playlists?${q}`);
  },
  itemPacks: (world: string, dataPath?: string) => {
    const q = new URLSearchParams({ world });
    if (dataPath) q.set('dataPath', dataPath);
    return get<{ id: string; label: string; type: string }[]>(`/api/foundry/item-packs?${q}`);
  },
  spells: (params: { world: string; pack?: string; search?: string; offset?: number; limit?: number; dataPath?: string }) => {
    const q = new URLSearchParams({ world: params.world });
    if (params.pack) q.set('pack', params.pack);
    if (params.search) q.set('search', params.search);
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.dataPath) q.set('dataPath', params.dataPath);
    return get<{ spells: any[]; total: number }>(`/api/foundry/spells?${q}`);
  },
  characters: (params: { world: string; pack?: string; search?: string; ids?: string[]; offset?: number; limit?: number; full?: boolean; dataPath?: string }) => {
    const q = new URLSearchParams({ world: params.world });
    if (params.pack) q.set('pack', params.pack);
    if (params.search) q.set('search', params.search);
    if (params.ids?.length) q.set('ids', params.ids.join(','));
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.full) q.set('full', '1');
    if (params.dataPath) q.set('dataPath', params.dataPath);
    return get<{ actors: any[]; total: number }>(`/api/foundry/characters?${q}`);
  },
  journals: (params: { world: string; search?: string; ids?: string[]; full?: boolean; dataPath?: string }) => {
    const q = new URLSearchParams({ world: params.world });
    if (params.search) q.set('search', params.search);
    if (params.ids?.length) q.set('ids', params.ids.join(','));
    if (params.full) q.set('full', '1');
    if (params.dataPath) q.set('dataPath', params.dataPath);
    return get<any[]>(`/api/foundry/journals?${q}`);
  },
};

// ── Health ────────────────────────────────────────────────────────────────────

export const health = {
  check: () => get<{ status: string; dbAvailable?: boolean }>('/api/health'),
};

// ── Namespace export ──────────────────────────────────────────────────────────

export const api = {
  auth, encounters, combatants, monsters, players, spells,
  sounds, campaigns, sessions, folderSettings, db, classFeatures,
  dndBeyond, hue, ha, users, adventures, sessionStats, imageProxy, proxy, health, foundry,
  images,
};
