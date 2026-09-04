import React from 'react';
import { Modal } from './Modal';

const APP_VERSION = '1.9.0';

interface Release {
  version: string;
  date: string;
  features: { icon: string; title: string; description: string }[];
}

const RELEASES: Release[] = [
  {
    version: '1.9.0',
    date: 'September 2026',
    features: [
      {
        icon: '🧭',
        title: 'Basic Mode',
        description: 'A one-click toggle in the sidebar menu strips the interface down to just Encounters and Monsters — perfect for guests or new players sitting at the DM screen. Flip back to Full mode any time.',
      },
      {
        icon: '☀️',
        title: 'Light Theme',
        description: 'A new light theme joins the existing dark and pink options. Switch it from the "More" menu in the sidebar, next to the mode toggle.',
      },
      {
        icon: '💾',
        title: 'Backup & Restore',
        description: 'Export a versioned JSON backup of your whole tracker from Settings and restore it with explicit confirmation. Restores now validate the file first, so a bad or incomplete backup can no longer overwrite your data.',
      },
      {
        icon: '🌊',
        title: 'Hidden Waves & Condition Timers',
        description: 'Stage reinforcements as hidden waves and reveal them mid-combat, and condition timers now count down right on each combatant.',
      },
      {
        icon: '💡',
        title: 'Home Assistant Lighting',
        description: 'Home Assistant lighting is now toggleable alongside Philips Hue, so you can drive encounter mood cues from either system.',
      },
      {
        icon: '📁',
        title: 'Smoother Imports & Editing',
        description: 'Imported encounters now appear immediately without a page refresh, you can select or deselect all encounters at once when importing, and you can pick an existing Location / Group when editing an encounter.',
      },
      {
        icon: '🎲',
        title: 'Fresh Look & Safer Hosting',
        description: 'A new d20 app icon and favicon throughout, plus a DISABLE_LAN_AUTH_BYPASS option so you can require a login on every network when hosting publicly.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: 'July 2026',
    features: [
      {
        icon: '↩️',
        title: 'Undo / Redo',
        description: 'Made a mistake mid-combat? Press Ctrl+Z to step back up to 20 actions — HP changes, conditions, turn advances, all of it. Ctrl+Shift+Z redoes. Undo and redo buttons also live in the combat header.',
      },
      {
        icon: '💀',
        title: 'Death Save Banner Fixed',
        description: 'The Pass / Fail / Nat 20 / Nat 1 banner now appears correctly when a player reaches 0 HP from any source — spells, action modal damage, or inline edits. Previously it only triggered from the quick-damage chips.',
      },
      {
        icon: '🔮',
        title: 'Spell Slot Tracking Fixed',
        description: 'Clicking a spell slot pip now correctly marks it spent and persists to the database. A stale-state read was silently dropping all slot changes.',
      },
      {
        icon: '🔁',
        title: 'Player Reimport Syncs Combat',
        description: 'Reimporting a player from D&D Beyond or Foundry now updates their stats, HP max, AC, and speed in the active encounter immediately. Previously the encounter kept the old values until combat ended.',
      },
      {
        icon: '🔃',
        title: 'DDB Refresh Button Restored',
        description: 'The individual Refresh button on each player in the D&D Beyond import screen is now visible again for all players with a D&D Beyond ID.',
      },
    ],
  },
  {
    version: '1.7.0',
    date: 'July 2026',
    features: [
      {
        icon: '💾',
        title: 'Encounter Persistence',
        description: 'Active encounters now survive server restarts. Come back to a fight mid-session — initiative order, round number, and all combatant state are preserved exactly where you left off.',
      },
      {
        icon: '❤️',
        title: 'Persistent PC Health',
        description: 'Player HP carries over between encounters. If your party ends a fight wounded, they start the next one at the same HP — no manual tracking needed.',
      },
      {
        icon: '🔄',
        title: 'Live PC Stat Sync',
        description: 'AC, speed, spell slots, and feature uses edited during combat are written back to the player record immediately. Changes persist across sessions automatically.',
      },
      {
        icon: '🛡️',
        title: 'Friendly NPCs',
        description: 'Mark any monster or NPC as friendly with a shield toggle. Friendly combatants show a green badge on their portrait and are excluded from encounter difficulty XP calculations.',
      },
      {
        icon: '⚠️',
        title: 'Disadvantage Reminder',
        description: 'When the active combatant is blinded, frightened, poisoned, prone, restrained, or disadvantaged, an amber warning strip appears on their row as a reminder before you roll.',
      },
      {
        icon: '🔶',
        title: 'In-Progress Encounter Badge',
        description: 'Active encounters show an amber ⚔ Round N badge in the encounter list and a persistent indicator in the sidebar — so you can always find your way back to a fight from any screen.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: 'July 2026',
    features: [
      {
        icon: '⚔️',
        title: 'Combat Focus Mode',
        description: 'When combat is active the sidebar hides and a sticky header shows the current round, active combatant, and a one-tap Next Turn button — keeping the screen uncluttered during play.',
      },
      {
        icon: '💥',
        title: 'Quick Damage Chips',
        description: 'Each combatant row now has –5, –10, and + buttons. The presets apply damage instantly with temp HP absorption and trigger concentration checks. The + button opens the full damage/heal modal.',
      },
      {
        icon: '🎵',
        title: 'Compact Music Bar',
        description: 'During combat the floating music player collapses into a slim bottom bar. Audio never stops — the same player keeps playing while the interface switches modes.',
      },
      {
        icon: '📋',
        title: 'Session Board Auto-Minimizes',
        description: 'The Session Board panel automatically collapses when you start combat so it stays out of the way. You can still expand it manually mid-fight.',
      },
      {
        icon: '🔮',
        title: 'Spell Slots Persist Across Reloads',
        description: 'Consumed spell slots and feature uses are now saved to the database. Reloading the page during combat no longer resets tracked resources back to full.',
      },
      {
        icon: '🔒',
        title: 'Security Hardening',
        description: 'Fixed a path traversal exploit in the Foundry file endpoint, removed the X-Forwarded-For auth bypass, and added authentication to the DM log sync socket handler.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: 'April 2026',
    features: [
      {
        icon: '🎵',
        title: 'Encounter & Spell Sound Linking',
        description: 'Attach sounds from your Soundboard to any encounter — they auto-play when the encounter loads. Spells can also be linked to sounds in the Soundboard, which play automatically when that spell is cast in combat.',
      },
      {
        icon: '🖼️',
        title: 'Combatant Portraits in Encounters List',
        description: 'Expand any encounter in the list to see a rich preview panel showing each monster and player with their portrait, name, and role — split into separate Monsters and Players sections.',
      },
      {
        icon: '🏠',
        title: 'Local Network Auto-Login',
        description: 'Accessing the app from your local network (192.168.x.x, 10.x.x.x) now bypasses the login screen entirely. Only external visitors need credentials.',
      },
      {
        icon: '💡',
        title: 'Hue Scene Color Fixed',
        description: 'Background images now correctly sync to Philips Hue lights. Images are fetched server-side via proxy and converted to a blob URL to avoid canvas CORS restrictions.',
      },
      {
        icon: '🎭',
        title: 'Player View Starts Collapsed',
        description: 'The mini summary panel on the Player View is now collapsed by default for a cleaner initial look.',
      },
      {
        icon: '🔧',
        title: 'crypto.randomUUID Compatibility',
        description: 'Fixed a crash during adventure import when deployed over HTTP (non-secure context). All ID generation now works with or without HTTPS.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: 'April 2026',
    features: [
      {
        icon: '🔗',
        title: 'Explicit Navigation URLs',
        description: 'Deep-link directly to any part of the app. Views like /encounters, /campaigns, and /monsters are now reflected in the browser URL for better navigation.',
      },
      {
        icon: '🛡️',
        title: 'Selective Class Feature Import',
        description: 'Class features are now part of the main import preview. Choose exactly which abilities to add to your library and avoid duplicates with intelligent detection.',
      },
      {
        icon: '🎨',
        title: 'Redesigned Abilities View',
        description: 'The class features screen has been overhauled with a modern dashboard layout, better grouping, and new Grid/List view toggles.',
      },
      {
        icon: '🔄',
        title: 'Unified Combat State',
        description: 'Navigation no longer resets your active view state. The application accurately tracks your active encounter and campaign based on the current URL.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: 'March 2026',
    features: [
      {
        icon: '🪄',
        title: 'Spell Card in Action Modal',
        description: 'When casting a spell, the action execution modal now shows the full spell card — cast time, range, duration, components, and description — just like the sidebar view.',
      },
      {
        icon: '⟳',
        title: 'Auto-Concentration from Duration',
        description: 'Concentration is now detected from the spell\'s Duration field ("Concentration, up to X"). Opening the action modal for any concentration spell automatically flags the caster.',
      },
      {
        icon: '🧙',
        title: 'Default Party Auto-Import',
        description: 'On first launch with SEED_DDB_COBALT set, the default party is automatically imported from D&D Beyond — no need to visit the Import screen.',
      },
      {
        icon: '📱',
        title: 'Mobile Nav Parity',
        description: 'The bottom navigation bar on mobile now matches the desktop sidebar — Home, Campaigns, Encounters, Library, Spells, Abilities, and Settings are all accessible on small screens.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: 'March 2026',
    features: [
      {
        icon: '✨',
        title: 'Spells Tab',
        description: 'Browse all spells assigned to your players and monsters in a masonry grid. Filter by level, school, target (Self / Touch / Ranged), and spells that apply conditions.',
      },
      {
        icon: '🔗',
        title: 'Spell Library Linking',
        description: 'Player spells are now matched to the full spell library on import and edit. Linked spells show cast time, range, components, and duration automatically.',
      },
      {
        icon: '🪄',
        title: 'Cast from Spells Tab',
        description: 'Any spell linked to an active combatant shows a Cast button. Opens the action execution modal to apply damage, healing, or conditions.',
      },
      {
        icon: '📊',
        title: 'Dashboard Stats',
        description: 'Home screen now shows 6 live stat cards — Encounters, Monsters, Players, Spells, Campaigns, and Last Session.',
      },
      {
        icon: '🗂️',
        title: 'Denser Layouts',
        description: 'Monster library and player grids now pack more cards per row. Masonry layout uses pretext for pixel-perfect height calculation with no gaps.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: 'March 2026',
    features: [
      {
        icon: '⚔️',
        title: 'Inline HP Editing',
        description: 'Click any HP value to edit directly. Type -8 for damage, +4 to heal, or 14 to set directly. Temp HP absorbs damage automatically.',
      },
      {
        icon: '💀',
        title: 'Death Saves',
        description: 'Downed players show failure/success pips. On their turn, a Death Save banner lets you record Pass, Fail, Nat 20, or Nat 1.',
      },
      {
        icon: '↩️',
        title: 'Reaction Tracker',
        description: 'Toggle the reaction icon on any combatant to mark it used. Reactions automatically reset at the start of each new round.',
      },
      {
        icon: '⏱️',
        title: 'Timed Conditions',
        description: "When adding a condition, set an optional round countdown. It auto-expires at the end of that combatant's turn.",
      },
      {
        icon: '✦',
        title: 'Concentration Tracker',
        description: 'Mark a spell in the Status panel. A ✦ badge appears on the combatant. Taking damage prompts a Constitution check DC.',
      },
      {
        icon: '📜',
        title: 'Combat Log',
        description: 'Session event feed tracking damage, heals, conditions, and death saves. Toggle via the Log button in the top bar.',
      },
      {
        icon: '📝',
        title: 'DM Notes Panel',
        description: 'Encounters imported from adventure text now show their read-aloud description above the combatant list during combat.',
      },
      {
        icon: '📊',
        title: 'Difficulty Range Bar',
        description: 'The encounter difficulty now shows a colour-banded bar (Easy → Deadly) with all four XP thresholds and the current adjusted XP marker.',
      },
      {
        icon: '🎲',
        title: 'Auto-Numbering',
        description: 'Duplicate monsters are automatically numbered by initiative order — Goblin 1, Goblin 2, Goblin 3 — everywhere in the UI.',
      },
      {
        icon: '🏰',
        title: 'DDB Campaign Import',
        description: 'Paste a D&D Beyond campaign join link in the Import screen to fetch all player characters at once.',
      },
    ],
  },
];

export const CURRENT_VERSION = APP_VERSION;

export function hasSeenWhatsNew(): boolean {
  return localStorage.getItem(`whats-new-seen-${APP_VERSION}`) === '1';
}

export function markWhatsNewSeen(): void {
  localStorage.setItem(`whats-new-seen-${APP_VERSION}`, '1');
}

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const handleClose = () => {
    markWhatsNewSeen();
    onClose();
  };

  const release = RELEASES[0];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`What's New in v${release.version}`}>
      <div className="space-y-1 pb-2">
        <p className="text-xs text-outline mb-4">{release.date}</p>
        <div className="space-y-3">
          {release.features.map(f => (
            <div key={f.title} className="flex gap-3 p-3 rounded-xl bg-surface-container-high">
              <span className="text-lg leading-none mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{f.title}</p>
                <p className="text-xs text-outline leading-relaxed mt-0.5">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleClose}
          className="w-full mt-4 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Let's go!
        </button>
      </div>
    </Modal>
  );
};
