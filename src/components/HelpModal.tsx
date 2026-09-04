import React, { useState } from 'react';
import { X, LayoutDashboard, Map, Swords, Zap, BookOpen, Sparkles, Shield, Lightbulb, Music, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface HelpItem {
  title: string;
  body: string;
}

interface HelpSection {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  intro: string;
  items: HelpItem[];
}

const SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    icon: LayoutDashboard,
    iconColor: 'text-slate-400',
    title: 'Getting Started',
    intro: 'Trackertje is a DM command center for running D&D 5e encounters. Here\'s how the pieces fit together.',
    items: [
      {
        title: 'Home — live encounter view',
        body: 'The Home tab (/dashboard) is your DM command center. Add monsters and players, roll initiative, and run fights round by round. Six stat cards show your campaign status at a glance.',
      },
      {
        title: 'Sidebar navigation',
        body: 'Use the left sidebar to move between dedicated URLs like /campaigns, /encounters, /monsters, /spells, and /abilities. You can now bookmark specific screens or share links directly to encounters.',
      },
      {
        title: 'New Encounter',
        body: 'The blue "New Encounter" button at the bottom of the sidebar resets the board and opens the encounter creator. It\'s also accessible from the dashboard header.',
      },
      {
        title: 'Player View',
        body: 'Click the monitor icon in the top bar to switch to Player View — a stripped-down screen safe to project on a TV or second monitor. No HP totals, no hidden stat blocks.',
      },
      {
        title: 'Combat Log',
        body: 'Every damage roll, heal, condition, and death save is recorded in the Combat Log. Open it with the Scroll icon in the sidebar or the Log button in the top bar.',
      },
    ],
  },
  {
    id: 'campaigns',
    icon: Map,
    iconColor: 'text-teal-400',
    title: 'Campaigns & Sessions',
    intro: 'Campaigns organise your sessions and encounters into a persistent story timeline.',
    items: [
      {
        title: 'Create a campaign',
        body: 'Go to Campaigns → click "New Campaign". Give it a name and an optional description. Campaigns imported from 5etools auto-populate name and summary.',
      },
      {
        title: 'Import a full adventure from 5etools',
        body: 'On the Import screen choose the 5etools source, type an adventure ID (e.g. "wbtw" for The Wild Beyond the Witchlight), and tick which chapters to include. Each chapter becomes a session; each encounter room becomes an encounter.',
      },
      {
        title: 'Sessions',
        body: 'Inside a campaign, scroll below the dashboard grid to the Sessions section. Click "New Session" to add one, set a play date, and write a post-session recap in the text area.',
      },
      {
        title: 'Assign encounters to sessions',
        body: 'Encounters that haven\'t been linked yet appear under "Assign (N)". Pick the target session from the dropdown, then click any encounter name to link it.',
      },
      {
        title: 'Adventure Summary — Lore tab',
        body: 'The Lore tab inside a campaign shows the full adventure description imported from 5etools, rendered as readable paragraphs. Long summaries are clipped on the Overview tab with a "Read More" link.',
      },
    ],
  },
  {
    id: 'encounters',
    icon: Swords,
    iconColor: 'text-violet-400',
    title: 'Encounters',
    intro: 'Build, save, and run tactical encounters. The encounter list is split into Saved (your library) and Recent (last 20 run).',
    items: [
      {
        title: 'Build an encounter',
        body: 'Click "New Encounter" or press the button in the sidebar. Add monsters from the Library with the + icon, set quantities, write optional DM notes, then click "Start Initiative".',
      },
      {
        title: 'Roll initiative',
        body: 'The Initiative Modal lists every combatant. Type each roll manually, or click "Roll All" to randomise the entire table. Players are sorted by their existing initiative; monsters reroll each fight.',
      },
      {
        title: 'Saving & loading',
        body: 'During or after combat, click the floppy-disk icon ("Save Encounter") to store a reusable template. Load any saved encounter from the Encounters → Saved tab.',
      },
      {
        title: 'Auto-play sounds on load',
        body: 'In the Encounter Creator or Save dialog, pick sounds from your Soundboard library under "Auto-play Sounds". Those sounds trigger automatically every time the encounter is loaded.',
      },
      {
        title: 'Combatant preview',
        body: 'In the Encounters list, click the chevron (›) on any encounter row to expand a portrait preview of all monsters and players in that encounter — with avatars, names, and roles.',
      },
      {
        title: 'Simulate difficulty',
        body: 'In the Saved Encounters list, hover a card and click the lightning bolt icon to run an auto-simulation and see projected rounds and difficulty without starting live play.',
      },
      {
        title: 'XP & difficulty bar',
        body: 'The encounter header shows total adjusted XP and a colour-banded Easy → Deadly bar. The marker updates live as you add or remove combatants.',
      },
    ],
  },
  {
    id: 'combat',
    icon: Zap,
    iconColor: 'text-red-400',
    title: 'Combat Actions',
    intro: 'Everything you need mid-fight: damage, healing, conditions, death saves, and spells.',
    items: [
      {
        title: 'Inline HP editing',
        body: 'Click any HP value to edit it in place. Type -8 for damage, +4 to heal, or 14 to set it exactly. Temporary HP absorbs incoming damage automatically before reducing max HP.',
      },
      {
        title: 'Quick actions',
        body: 'Click the ⚡ icon on any combatant row to open the Quick Action panel — deal damage, apply healing, or pick a condition without navigating menus.',
      },
      {
        title: 'Conditions & timers',
        body: 'Open the Status panel to add any 5e condition. Set an optional round countdown — the condition auto-expires at the end of that combatant\'s turn and logs a "condition removed" event.',
      },
      {
        title: 'Concentration',
        body: 'In the Status panel, mark an active spell as "Concentration". A ✦ badge appears on the combatant. Taking damage automatically prompts the Constitution save DC (damage ÷ 2, min 10).',
      },
      {
        title: 'Death saves',
        body: 'Players at 0 HP show three failure and three success pips. On their turn, a Death Save banner lets you record Pass, Fail, Nat 20 (immediate stabilisation + 1 HP), or Nat 1 (counts as two failures).',
      },
      {
        title: 'Casting spells',
        body: 'Click the wand icon on a combatant\'s row to open their spell list. Select a spell to open the Action Execution modal — apply damage, set healing, or attach conditions, all in one step.',
      },
    ],
  },
  {
    id: 'library',
    icon: BookOpen,
    iconColor: 'text-red-400',
    title: 'Library & Import',
    intro: 'The Library holds all your monster templates. Import from multiple sources to populate it quickly.',
    items: [
      {
        title: 'Import from 5etools',
        body: 'Import → Source: 5etools. Paste a creature URL from 5e.tools and click Parse. Alternatively, use "Import Chapter" from an adventure to bulk-import an entire bestiary in one step.',
      },
      {
        title: 'Import from D&D Beyond',
        body: 'Import → Source: D&D Beyond. Paste a character profile URL to import a single player, or paste a campaign join link to fetch all party members at once.',
      },
      {
        title: 'Import from Foundry VTT',
        body: 'Export your Foundry world as JSON and paste or upload it in Import → Source: Foundry. Monsters, spells, and player characters are extracted and mapped automatically.',
      },
      {
        title: 'Custom monsters',
        body: 'In Library, click "New Monster" to create a fully custom creature. Fill in stat block, actions, legendary actions, and abilities — they behave identically to imported monsters in combat.',
      },
      {
        title: 'Copy & edit existing',
        body: 'Hover any library card and click the copy icon to duplicate it as a custom template, then tweak stats to create variants like an Elite Goblin or Veteran Troll.',
      },
    ],
  },
  {
    id: 'spells',
    icon: Sparkles,
    iconColor: 'text-sky-400',
    title: 'Spells',
    intro: 'The Spells tab shows every spell linked to your active players and monsters in one masonry grid.',
    items: [
      {
        title: 'Browsing & filtering',
        body: 'Filter by spell level, school, target type (Self / Touch / Ranged), or spells that apply conditions. Each card shows cast time, range, duration, and components at a glance.',
      },
      {
        title: 'Cast from the Spells tab',
        body: 'Any spell belonging to a currently active combatant shows a Cast button. Clicking it opens the Action Execution modal so you can apply damage, healing, or conditions right away.',
      },
      {
        title: 'Spell linking on import',
        body: 'When you import a player from D&D Beyond, their known spells are automatically matched against the full spell library. Missing spells can be added manually on the player edit screen.',
      },
      {
        title: 'Spell slot tracking',
        body: 'Player spell slots are tracked during combat. The player row shows remaining slots per level; casting a levelled spell decrements the slot automatically.',
      },
    ],
  },
  {
    id: 'abilities',
    icon: Shield,
    iconColor: 'text-amber-400',
    title: 'Abilities',
    intro: 'The Abilities screen (/abilities) tracks class features and special actions for each player in your party.',
    items: [
      {
        title: 'Importing abilities',
        body: 'Go to Import → Local File and upload a 5etools class JSON. You can selectively choose which features to add to your library from the import preview, helping you avoid duplicates.',
      },
      {
        title: 'Dashboard view',
        body: 'Features are automatically grouped by class. Use the Grid/List toggle to switch between a dense overview or a detailed list. Filter by level, source (2024 vs 2014), or specific classes.',
      },
      {
        title: 'Using abilities in combat',
        body: 'On any player combatant row during combat, click the shield icon to see their ability list. Selecting one opens the Action Execution modal.',
      },
      {
        title: 'Use tracking',
        body: 'Abilities with limited uses (e.g. Channel Divinity, Bardic Inspiration) show pip counters. Click pips to mark uses; reset them manually or on a short/long rest.',
      },
    ],
  },
  {
    id: 'soundboard',
    icon: Music,
    iconColor: 'text-green-400',
    title: 'Soundboard',
    intro: 'Play ambient music, sound effects, and spell audio during your sessions. Sounds can be linked to encounters and spells for automatic playback.',
    items: [
      {
        title: 'Playing sounds',
        body: 'Open the Soundboard from the sidebar. Click any sound card to play it. Use the volume slider to adjust per-sound volume. Multiple sounds can play simultaneously for layered ambience.',
      },
      {
        title: 'Link sounds to encounters',
        body: 'In the Encounter Creator (Settings tab) or the Save Encounter dialog, open "Auto-play Sounds" and select any sounds from your library. They play automatically each time that encounter is loaded.',
      },
      {
        title: 'Link sounds to spells',
        body: 'In the Soundboard, click the pencil (Manage) icon on any sound card. Use the Spell dropdown to associate a spell — that sound fires automatically whenever the linked spell is cast in combat.',
      },
      {
        title: 'Adding & editing sounds',
        body: 'Click "Add Sound" to upload an audio file or paste a URL. You can rename, change volume, and set a loop mode. In Manage mode, each card also exposes the spell-link dropdown.',
      },
    ],
  },
  {
    id: 'hue',
    icon: Lightbulb,
    iconColor: 'text-amber-300',
    title: 'Philips Hue',
    intro: 'Connect a Philips Hue bridge to trigger lighting effects that react to what\'s happening at the table.',
    items: [
      {
        title: 'Setup',
        body: 'Set HUE_BRIDGE_IP and HUE_API_KEY in your server .env file (or enter them in Settings → Hue). Press the physical link button on the bridge, then click Connect to authorise.',
      },
      {
        title: 'Built-in combat effects',
        body: 'Damage flashes red, healing pulses green, downed creatures loop deep red, stabilised creatures glow soft green, and victory fires a golden celebration pulse at encounter end.',
      },
      {
        title: 'Spell school colours',
        body: 'Each magic school fires a distinct colour: Evocation → orange, Necromancy → deep purple, Conjuration → teal, Illusion → fuchsia, Enchantment → rose, Abjuration → sky blue, Divination → pale gold, Transmutation → lime.',
      },
      {
        title: 'Per-effect on/off',
        body: 'In Settings → Hue, every effect can be individually toggled. If a flash is too distracting for a specific event (e.g. round start), disable it without affecting the others.',
      },
      {
        title: 'Player I vs monster targeting',
        body: 'Each effect can be scoped to player lights only, monster lights only, or all lights. Set this per-effect in the Hue settings panel.',
      },
      {
        title: 'Concentration tracking',
        body: 'Concentration Start fires a violet glow; Concentration Broken fades to grey. Both are separate toggles — disable one independently of the other.',
      },
    ],
  },
];

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const section = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];
  const Icon = section.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            className="relative w-full max-w-4xl bg-surface-container rounded-3xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <header className="px-8 py-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-headline font-bold text-on-surface">Help & Guide</h3>
                  <p className="text-[10px] text-outline uppercase tracking-widest">How to use Trackertje</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-container-highest rounded-full transition-colors text-outline hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left nav */}
              <nav className="w-48 shrink-0 border-r border-outline-variant/10 bg-surface-container-low overflow-y-auto py-3">
                {SECTIONS.map(s => {
                  const SIcon = s.icon;
                  const isActive = s.id === activeId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-outline hover:bg-white/5 hover:text-on-surface'
                      }`}
                    >
                      <SIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : s.iconColor}`} />
                      <span className="text-xs font-semibold">{s.title}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </nav>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${section.iconColor}`} />
                  <h2 className="font-headline text-xl font-bold text-on-surface">{section.title}</h2>
                </div>
                <p className="text-sm text-outline leading-relaxed mb-6 border-l-2 border-primary/30 pl-3">{section.intro}</p>
                <div className="space-y-3">
                  {section.items.map(item => (
                    <div key={item.title} className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10">
                      <p className="text-sm font-bold text-on-surface mb-1">{item.title}</p>
                      <p className="text-xs text-outline leading-relaxed">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
