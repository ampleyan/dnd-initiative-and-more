import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  const sizeClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-[95vw] h-[95vh] flex flex-col',
  }[size];

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>('input, textarea');
      el?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${sizeClass} bg-surface-container rounded-3xl border border-outline-variant/20 shadow-2xl overflow-hidden`}
          >
            <header className="px-4 sm:px-8 py-4 sm:py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high shrink-0">
              <h3 className="text-base sm:text-xl font-headline font-bold text-on-surface">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-container-highest rounded-full transition-colors text-outline hover:text-on-surface shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div ref={bodyRef} className={`p-4 sm:p-8 overflow-y-auto custom-scrollbar ${size === 'full' ? 'flex-1' : 'max-h-[80vh] sm:max-h-[70vh]'}`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
