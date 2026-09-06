export interface HueScene {
  id: string;
  label: string;
  colors: string[];
}

export const DEFAULT_HUE_SCENES: HueScene[] = [
  { id: 'battle', label: 'Battle', colors: ['#7f1d1d', '#ea580c', '#facc15'] },
  { id: 'calm', label: 'Calm', colors: ['#172554', '#2563eb', '#14b8a6'] },
  { id: 'danger', label: 'Danger', colors: ['#450a0a', '#dc2626', '#fb7185'] },
  { id: 'victory', label: 'Victory', colors: ['#713f12', '#eab308', '#4ade80'] },
];

export function normalizeHueScenes(value: unknown): HueScene[] {
  if (!Array.isArray(value)) return DEFAULT_HUE_SCENES;
  const scenes = value.filter((scene): scene is HueScene => {
    if (!scene || typeof scene !== 'object') return false;
    const candidate = scene as Partial<HueScene>;
    return typeof candidate.id === 'string' && /^[a-z0-9_-]+$/.test(candidate.id) && typeof candidate.label === 'string' && candidate.label.trim().length > 0 && Array.isArray(candidate.colors) && candidate.colors.length > 0 && candidate.colors.every(color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color));
  }).map(scene => ({ id: scene.id, label: scene.label.trim(), colors: scene.colors.slice(0, 6) }));
  return scenes.length ? scenes : DEFAULT_HUE_SCENES;
}
