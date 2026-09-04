import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { cn } from '../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 3000,
  info: 3500,
  warning: 5000,
  error: 7000,
};

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const STYLE: Record<ToastType, string> = {
  success: 'bg-green-900/90 border-green-500/40 text-green-100',
  error:   'bg-red-900/90 border-red-500/40 text-red-100',
  warning: 'bg-amber-900/90 border-amber-500/40 text-amber-100',
  info:    'bg-blue-900/90 border-blue-500/40 text-blue-100',
};

const ICON_STYLE: Record<ToastType, string> = {
  success: 'text-green-400',
  error:   'text-red-400',
  warning: 'text-amber-400',
  info:    'text-blue-400',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // max 5 at once
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[type]);
    timers.current.set(id, timer);
  }, [dismiss]);

  const showSuccess = useCallback((m: string) => showToast(m, 'success'), [showToast]);
  const showError   = useCallback((m: string) => showToast(m, 'error'),   [showToast]);
  const showWarning = useCallback((m: string) => showToast(m, 'warning'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md',
            'pointer-events-auto max-w-sm text-sm',
            STYLE[toast.type],
          )}
        >
          <span className={cn('mt-0.5 shrink-0 font-bold text-xs', ICON_STYLE[toast.type])}>
            {ICON[toast.type]}
          </span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-1 shrink-0 opacity-50 hover:opacity-100 transition-opacity text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
