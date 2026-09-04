// src/components/KeyboardShortcutsModal.tsx
import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SHORTCUTS = [
  { keys: 'Space', action: 'Next turn' },
  { keys: 'Shift + Space', action: 'Previous turn' },
  { keys: 'D', action: 'Damage active combatant' },
  { keys: 'H', action: 'Heal active combatant' },
  { keys: 'C', action: 'Conditions for active combatant' },
  { keys: 'Ctrl + Z', action: 'Undo last change' },
  { keys: 'Ctrl + Shift + Z', action: 'Redo' },
  { keys: 'Shift + ?', action: 'Toggle this help overlay' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#0f1419] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h2 className="font-headline font-bold text-on-surface text-lg">Keyboard Shortcuts</h2>
              <p className="text-[11px] text-outline">Active during combat</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-3">
            {SHORTCUTS.map(s => (
              <div key={s.keys} className="flex items-center justify-between gap-4">
                <span className="text-sm text-on-surface/70">{s.action}</span>
                <kbd className="shrink-0 px-2 py-1 bg-surface-container-highest rounded text-xs font-mono text-outline border border-white/10 whitespace-nowrap">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
