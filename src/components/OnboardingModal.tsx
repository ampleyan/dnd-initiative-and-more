import React, { useState, useLayoutEffect, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  target?: string;
  placement?: 'right' | 'below' | 'above';
}

const STEPS: Step[] = [
  {
    icon: '⚔️',
    title: 'Welcome to your DM command centre',
    subtitle: 'Everything for D&D 5e combat — initiative, HP, conditions, player view, and integrations — in one local tool.',
    bullets: [
      { icon: '🖥️', text: 'Runs in your browser. Share the /player/<id> URL with players at the table.' },
      { icon: '🔒', text: 'All data stays local — no account, no cloud sync required.' },
      { icon: '⚡', text: 'Keyboard-first: Space advances turns, Ctrl+Z undoes any HP or condition change.' },
    ],
  },
  {
    icon: '🗂️',
    title: 'Encounters',
    subtitle: 'Your encounter library. Load saved encounters, build new ones, and prep hidden waves.',
    bullets: [
      { icon: '📁', text: 'Organised into folders — filter by difficulty, drag to reorder.' },
      { icon: '🌊', text: 'Prep hidden reinforcement waves that appear mid-combat when you reveal them.' },
      { icon: '📊', text: 'The budget calculator rates difficulty from Trivial to Deadly as you build.' },
    ],
    target: '[data-onboarding="nav-encounters"]',
    placement: 'right',
  },
  {
    icon: '🐉',
    title: 'Monster library',
    subtitle: 'Browse every monster in your library. Import new ones from 5etools JSON or Foundry VTT.',
    bullets: [
      { icon: '🔍', text: 'Filter by CR, type, source, or full-text search.' },
      { icon: '✏️', text: 'Edit any stat block and save as a custom version.' },
      { icon: '⭐', text: 'Star favourites to keep them pinned at the top.' },
    ],
    target: '[data-onboarding="nav-library"]',
    placement: 'right',
  },
  {
    icon: '📥',
    title: 'Import',
    subtitle: 'Bring in monsters, spells, players, and encounters from Foundry VTT, D&D Beyond, and 5etools.',
    bullets: [
      { icon: '🐉', text: 'Drop a 5etools bestiary JSON to bulk-import monsters.' },
      { icon: '🔮', text: "Browse your Foundry world's actors and import any character or NPC." },
      { icon: '🔄', text: 'Foundry actors stay live — equipping an item in Foundry updates AC here instantly via the live sync module.' },
    ],
    target: '[data-onboarding="nav-import"]',
    placement: 'right',
  },
  {
    icon: '⚙️',
    title: 'Settings & integrations',
    subtitle: 'Connect Philips Hue, Foundry VTT, and Home Assistant for atmosphere automation.',
    bullets: [
      { icon: '💡', text: 'Hue lights sync to combat conditions and scene colours automatically.' },
      { icon: '🏠', text: 'Home Assistant triggers scene events on combat start, end, and more.' },
      { icon: '🟢', text: 'Foundry live sync pushes derived stats (AC, speed, spell slots) to linked combatants in real time — no reimport needed.' },
    ],
    target: '[data-onboarding="nav-settings"]',
    placement: 'right',
  },
  {
    icon: '➕',
    title: 'Ready to play',
    subtitle: 'Hit New Encounter to build your first initiative order and start running.',
    bullets: [
      { icon: '🎲', text: 'Roll or type initiatives, add monsters from the library, and click Start.' },
      { icon: '❤️', text: 'Click any HP number to edit inline — type -8, +4, or 14 to set directly.' },
      { icon: '🔗', text: 'Share the Join URL with your players before combat begins.' },
    ],
    target: '[data-onboarding="new-encounter"]',
    placement: 'above',
  },
];

function useTargetRect(selector: string | undefined, step: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    const el = document.querySelector(selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [selector, step]);

  useEffect(() => {
    if (!selector) return;
    const update = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [selector]);

  return rect;
}

interface TooltipPos {
  top?: number;
  bottom?: number;
  left?: number;
  maxWidth: number;
}

function computeTooltipPos(rect: DOMRect, placement: 'right' | 'below' | 'above'): TooltipPos {
  const GAP = 14;
  const W = 340;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (placement === 'right') {
    const left = Math.min(rect.right + GAP, vw - W - 8);
    const top = Math.max(8, Math.min(rect.top, vh - 320));
    return { top, left, maxWidth: W };
  }
  if (placement === 'above') {
    const left = Math.max(8, Math.min(rect.left, vw - W - 8));
    const bottom = vh - rect.top + GAP;
    return { bottom, left, maxWidth: W };
  }
  const left = Math.max(8, Math.min(rect.left, vw - W - 8));
  const top = Math.min(rect.bottom + GAP, vh - 320);
  return { top, left, maxWidth: W };
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const rect = useTargetRect(current.target, step);
  const PADDING = 6;

  const handleClose = () => {
    markOnboardingComplete();
    onClose();
  };

  const handleFinish = () => {
    markOnboardingComplete();
    onClose();
  };

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const hasTarget = !!rect;
  const spotlightStyle: React.CSSProperties = hasTarget
    ? {
        position: 'fixed',
        top: rect!.top - PADDING,
        left: rect!.left - PADDING,
        width: rect!.width + PADDING * 2,
        height: rect!.height + PADDING * 2,
        borderRadius: 10,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px rgba(99,102,241,0.55)',
        zIndex: 200,
        pointerEvents: 'none',
      }
    : {};

  const tooltipPos = hasTarget && current.placement
    ? computeTooltipPos(rect!, current.placement)
    : null;

  const Tooltip = (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={{ duration: 0.16 }}
        style={tooltipPos ? { position: 'fixed', ...tooltipPos, zIndex: 202 } : undefined}
        className={
          tooltipPos
            ? 'bg-surface-container-highest rounded-2xl border border-white/10 shadow-2xl overflow-hidden'
            : 'relative w-full max-w-md bg-surface-container-highest rounded-2xl border border-white/10 shadow-2xl overflow-hidden'
        }
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 pt-6">
          <div className="text-3xl mb-3">{current.icon}</div>
          <h2 className="font-headline font-bold text-lg text-on-surface leading-snug">{current.title}</h2>
          <p className="text-xs text-outline mt-1.5 leading-relaxed">{current.subtitle}</p>
          <ul className="mt-4 space-y-2">
            {current.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs">
                <span className="text-sm leading-none mt-0.5 shrink-0">{b.icon}</span>
                <span className="text-on-surface/80 leading-relaxed">{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 pb-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-white/20 hover:bg-white/30'}`}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Start playing
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      {hasTarget && <div style={spotlightStyle} aria-hidden />}

      {hasTarget ? (
        Tooltip
      ) : (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-md">
            {Tooltip}
          </div>
        </div>
      )}
    </>
  );
};
