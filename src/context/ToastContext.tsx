'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms — default 4000
  exiting?: boolean; // triggers slide-out animation before removal
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'exiting'>) => void;
  removeToast: (id: string) => void;
}

// ─── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'MARK_EXITING'; id: string }
  | { type: 'REMOVE'; id: string };

const MAX_VISIBLE = 5;

function toastReducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':
      // Keep max visible, discard oldest if overflow
      return [...state, action.toast].slice(-MAX_VISIBLE);
    case 'MARK_EXITING':
      return state.map((t) =>
        t.id === action.id ? { ...t, exiting: true } : t,
      );
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Unique ID generator (safe across Web + SSR) ───────────────────────────────

let idCounter = 0;
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${++idCounter}`;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // First mark as exiting (triggers slide-out animation)
    dispatch({ type: 'MARK_EXITING', id });
    // Then actually remove after animation completes (300ms)
    setTimeout(() => {
      dispatch({ type: 'REMOVE', id });
    }, 300);
    // Clean up timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id' | 'exiting'>) => {
      const id = generateId();
      const duration = toast.duration ?? 4000;

      dispatch({ type: 'ADD', toast: { ...toast, id, exiting: false } });

      // Auto-dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [removeToast],
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // ─── Listen for imperative toast events from outside React tree ─────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Omit<Toast, 'id' | 'exiting'>;
      if (detail && detail.title) {
        addToast(detail);
      }
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ─── useToast Hook ─────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');

  const { addToast } = ctx;
  return useMemo(
    () => ({
      success: (title: string, message?: string) =>
        addToast({ type: 'success', title, message }),
      error: (title: string, message?: string) =>
        addToast({ type: 'error', title, message }),
      warning: (title: string, message?: string) =>
        addToast({ type: 'warning', title, message }),
      info: (title: string, message?: string) =>
        addToast({ type: 'info', title, message }),
    }),
    [addToast],
  );
}

// ─── Imperative emit (for use outside React tree, e.g., api.ts) ────────────────

export const toast = {
  success: (title: string, message?: string) =>
    typeof window !== 'undefined' &&
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { type: 'success', title, message } }),
    ),
  error: (title: string, message?: string) =>
    typeof window !== 'undefined' &&
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { type: 'error', title, message } }),
    ),
  warning: (title: string, message?: string) =>
    typeof window !== 'undefined' &&
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { type: 'warning', title, message } }),
    ),
  info: (title: string, message?: string) =>
    typeof window !== 'undefined' &&
    window.dispatchEvent(
      new CustomEvent('app:toast', { detail: { type: 'info', title, message } }),
    ),
};

// ─── Style config per type ─────────────────────────────────────────────────────

const TOAST_STYLES: Record<
  ToastType,
  { icon: React.ReactNode; borderColor: string; bg: string; progressColor: string }
> = {
  success: {
    icon: <CheckCircle size={16} className="text-emerald-600 shrink-0" />,
    borderColor: 'border-l-emerald-600',
    bg: 'bg-white',
    progressColor: 'bg-emerald-600',
  },
  error: {
    icon: <XCircle size={16} className="text-[#D92D20] shrink-0" />,
    borderColor: 'border-l-[#D92D20]',
    bg: 'bg-white',
    progressColor: 'bg-[#D92D20]',
  },
  warning: {
    icon: <AlertTriangle size={16} className="text-amber-600 shrink-0" />,
    borderColor: 'border-l-amber-500',
    bg: 'bg-white',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: <Info size={16} className="text-slate-700 shrink-0" />,
    borderColor: 'border-l-slate-800',
    bg: 'bg-white',
    progressColor: 'bg-slate-800',
  },
};

// ─── Toast Container ───────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Single Toast Item ─────────────────────────────────────────────────────────

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const style = TOAST_STYLES[t.type];
  const duration = t.duration ?? 4000;
  const [paused, setPaused] = React.useState(false);

  return (
    <div
      className={cn(
        'pointer-events-auto w-[360px] max-w-[calc(100vw-3rem)] rounded-lg border border-slate-200 border-l-2 shadow-md overflow-hidden',
        style.borderColor,
        style.bg,
        t.exiting ? 'animate-toast-slide-out' : 'animate-toast-slide-in',
      )}
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="mt-0.5">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 leading-4">{t.title}</p>
          {t.message && (
            <p className="text-xs text-slate-500 mt-0.5 leading-4">{t.message}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          className="shrink-0 p-0.5 rounded hover:bg-slate-100 transition-colors"
          aria-label="Đóng thông báo"
        >
          <X size={13} className="text-slate-400" />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-[2px] w-full bg-slate-100">
          <div
            className={cn('h-full', style.progressColor)}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}
