import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { ok: CheckCircle2, bad: AlertCircle, info: Info };
const TONE_TEXT = { ok: 'text-ok', bad: 'text-bad', info: 'text-info' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ tone = 'info', title, description, duration = 4500 }) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, title, description }]);
      if (duration) window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'bad' ? 'alert' : 'status'}
              className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-raised p-3.5 shadow-xl shadow-black/20"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[t.tone] || 'text-info'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-faint transition-colors hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
