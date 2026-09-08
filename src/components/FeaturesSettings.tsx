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

export function FeaturesSettings({ features, onChange }: FeaturesSettingsProps) {
  return <section aria-labelledby="features-heading" className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
    <h3 id="features-heading" className="text-base font-headline font-bold text-on-surface">Features</h3>
    <p className="mt-1 text-xs text-outline">Choose which optional tools appear in this browser. Existing notes, scenes, and sounds are kept.</p>
    <div className="mt-4 divide-y divide-outline-variant/15">
      {([
        { key: 'sessionBoard', label: 'Session board', description: 'Session widgets and the board shortcut.', Icon: LayoutDashboard },
        { key: 'dmNotes', label: 'DM notes', description: 'The floating encounter note and its reopen button.', Icon: StickyNote },
        { key: 'ambientMusic', label: 'Ambient music', description: 'The YouTube player and playback controls. Turning off stops playback.', Icon: Music },
        { key: 'combatLog', label: 'Combat log', description: 'The DM combat log, its sidebar control, and player log sharing.', Icon: ScrollText },
        { key: 'playerViewTools', label: 'Player view tools', description: 'The Player View and player-log controls in the encounter menu.', Icon: Monitor },
        { key: 'soundpad', label: 'Soundpad', description: 'The floating Soundpad launcher. The Soundboard library stays available.', Icon: Music },
      ] as const).map(({ key, label, description, Icon }) => <div key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
        <Icon className="h-5 w-5 shrink-0 text-outline" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">{label}</p>
          <p id={`feature-${key}-description`} className="mt-0.5 text-xs leading-relaxed text-outline">{description}</p>
        </div>
        <button type="button" role="switch" aria-label={label} aria-describedby={`feature-${key}-description`} aria-checked={features[key]}
          onClick={() => onChange(key, !features[key])}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="text-xs text-outline">{features[key] ? 'On' : 'Off'}</span>
          <span className={`relative h-6 w-11 rounded-full transition-colors ${features[key] ? 'bg-primary' : 'bg-surface-container-highest border border-outline/40'}`}>
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${features[key] ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </div>)}
    </div>
  </section>;
}
