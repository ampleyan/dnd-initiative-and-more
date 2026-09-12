import React from 'react';
import { LayoutDashboard, Monitor, Music, ScrollText, StickyNote } from 'lucide-react';

export interface OptionalFeatures {
  sessionBoard: boolean;
  dmNotes: boolean;
  ambientMusic: boolean;
  combatLog: boolean;
  playerViewTools: boolean;
  soundpad: boolean;
}

export const DEFAULT_FEATURES: OptionalFeatures = { sessionBoard: true, dmNotes: true, ambientMusic: true, combatLog: true, playerViewTools: true, soundpad: true };

interface FeaturesSettingsProps {
  features: OptionalFeatures;
  onChange: (feature: keyof OptionalFeatures, enabled: boolean) => void;
}

const ITEMS = [
  { key: 'sessionBoard', label: 'Session board', description: 'Session widgets and the board shortcut.', Icon: LayoutDashboard },
  { key: 'dmNotes', label: 'DM notes', description: 'The floating encounter note and its reopen button.', Icon: StickyNote },
  { key: 'ambientMusic', label: 'Ambient music', description: 'The YouTube player and playback controls. Turning off stops playback.', Icon: Music },
  { key: 'combatLog', label: 'Combat log', description: 'The DM combat log, its sidebar control, and player log sharing.', Icon: ScrollText },
  { key: 'playerViewTools', label: 'Player view tools', description: 'The Player View and player-log controls in the encounter menu.', Icon: Monitor },
  { key: 'soundpad', label: 'Soundpad', description: 'The floating Soundpad launcher. The Soundboard library stays available.', Icon: Music },
] as const;

export function FeaturesSettings({ features, onChange }: FeaturesSettingsProps) {
  const enabledCount = ITEMS.filter(({ key }) => features[key]).length;

  return (
    <details className="rounded-2xl border border-outline-variant/20 bg-surface-container-low overflow-hidden" aria-labelledby="features-heading">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="min-w-0">
          <h3 id="features-heading" className="text-sm font-bold text-on-surface">Features</h3>
          <p className="mt-0.5 text-xs text-outline">Optional tools shown in this browser.</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-outline">
          {enabledCount}/{ITEMS.length} on
        </span>
      </summary>
      <div className="border-t border-outline-variant/10 divide-y divide-outline-variant/15 px-4 pb-4 sm:px-5 sm:pb-5">
        {ITEMS.map(({ key, label, description, Icon }) => (
          <div key={key} className="flex items-center gap-3 py-3 first:pt-3 last:pb-0">
            <Icon className="h-5 w-5 shrink-0 text-outline" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface">{label}</p>
              <p id={`feature-${key}-description`} className="mt-0.5 text-xs leading-relaxed text-outline">{description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label={label}
              aria-describedby={`feature-${key}-description`}
              aria-checked={features[key]}
              onClick={() => onChange(key, !features[key])}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="text-xs text-outline">{features[key] ? 'On' : 'Off'}</span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${features[key] ? 'bg-primary' : 'bg-surface-container-highest border border-outline/40'}`}>
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${features[key] ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
