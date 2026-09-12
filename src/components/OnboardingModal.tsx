import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ONBOARDING_KEY = 'onboarding-complete-v1';

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

interface Step {
  icon: string;
  title: string;
  subtitle: string;
  bullets: { icon: string; text: string }[];
}

const STEPS: Step[] = [
  {
    icon: '⚔️',
    title: 'Welcome to your DM command centre',
    subtitle: 'Everything you need to run D&D 5e combat — initiative tracker, player view, monster library, and more — in one tool.',
    bullets: [
      { icon: '🏠', text: 'The Dashboard is your home. Start here each session.' },
      { icon: '📁', text: 'Encounters, Monsters, Players, Spells, Campaigns — all in the left sidebar.' },
      { icon: '🔗', text: 'Share /player/<id> with your table for a live player-facing screen.' },
    ],
  },
  {
    icon: '🎲',
    title: 'Running combat',
    subtitle: 'Initiative, HP, conditions, and turn flow are all one click (or keystroke) away.',
    bullets: [
      { icon: '▶️', text: 'Press Space to advance to the next turn, Shift+Space to go back.' },
      { icon: '❤️', text: 'Click any HP number to edit inline — type -8, +4, or 14 to set directly.' },
      { icon: '🩸', text: 'D = damage modal, H = heal, T = temp HP, C = condition — all from the keyboard.' },
      { icon: '↩️', text: 'Ctrl+Z undoes the last HP or condition change. Up to 20 steps.' },
    ],
  },
  {
    icon: '🧠',
    title: 'Encounter prep',
    subtitle: 'Build encounters with a budget calculator, save reusable variants, and stage hidden reinforcement waves.',
    bullets: [
      { icon: '📊', text: 'Set party size and levels in the creator — the budget engine rates difficulty from Trivial to Deadly.' },
      { icon: '🗂️', text: 'Save named variants (Ambush Mode, Boss Phase 2) and load them with a two-step confirm.' },
      { icon: '🌊', text: 'Add hidden waves that only appear when you reveal them mid-combat.' },
      { icon: '🔁', text: 'The Encounter Vault organises everything by folder — drag, filter, and launch from there.' },
    ],
  },
  {
    icon: '🖥️',
    title: 'Player view & atmosphere',
    subtitle: 'Give your players a live view of the battlefield — fully customisable without spoiling DM information.',
    bullets: [
      { icon: '🎬', text: 'Pick a preset: Tactical (full stats), Cinematic (no numbers), Mystery (hidden names), or Boss.' },
      { icon: '🔦', text: 'Spotlight any combatant — they appear as a hero banner on the player screen.' },
      { icon: '🔗', text: 'Copy the Join URL from the Player View toolbar and share it with the table.' },
      { icon: '🌧️', text: 'Weather effects, backgrounds, and Hue lighting sync to the player screen automatically.' },
    ],
  },
  {
    icon: '📥',
    title: 'Importing your content',
    subtitle: 'Bring in monsters, spells, players, and encounters from Foundry VTT, D&D Beyond, and 5etools JSON files.',
    bullets: [
      { icon: '🐉', text: 'Drop a 5etools bestiary JSON to bulk-import monsters into your library.' },
      { icon: '🔮', text: "Connect Foundry VTT via the Foundry settings to browse and import your world's actors." },
      { icon: '🧙', text: 'Paste a D&D Beyond character URL (or campaign link) to import player characters.' },
      { icon: '🔍', text: 'The import screen shows New / Update / Unchanged for every item before you confirm.' },
    ],
  },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  const handleClose = () => {
    markOnboardingComplete();
    onClose();
  };

  const handleFinish = () => {
    markOnboardingComplete();
    onClose();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-surface-container-highest rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="p-6 pt-8"
          >
            <div className="text-4xl mb-4">{current.icon}</div>
            <h2 className="font-headline font-bold text-xl text-on-surface leading-snug">{current.title}</h2>
            <p className="text-sm text-outline mt-1.5 leading-relaxed">{current.subtitle}</p>

            <ul className="mt-5 space-y-2.5">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-base leading-none mt-0.5 shrink-0">{b.icon}</span>
                  <span className="text-on-surface/80 leading-relaxed">{b.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="px-6 pb-6 flex items-center justify-between gap-4">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-white/20 hover:bg-white/30'}`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Start playing
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
