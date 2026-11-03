import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (params: { type?: ToastType; title: string; message?: string }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type = 'info',
      title,
      message,
    }: {
      type?: ToastType;
      title: string;
      message?: string;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { id, type, title, message }]);
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => toast({ type: 'success', title, message }),
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string) => toast({ type: 'error', title, message }),
    [toast]
  );

  const warning = useCallback(
    (title: string, message?: string) => toast({ type: 'warning', title, message }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {items.map((item) => {
          const iconMap = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
            info: <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />,
          };
          const badgeBgMap = {
            success: 'bg-emerald-50 text-emerald-600',
            error: 'bg-rose-50 text-rose-600',
            warning: 'bg-amber-50 text-amber-600',
            info: 'bg-indigo-50 text-brand-primary',
          };

          return (
            <div
              key={item.id}
              className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl shadow-dropdown p-3.5 flex items-start justify-between gap-3 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`p-1 rounded-lg shrink-0 ${badgeBgMap[item.type]}`}>
                  {iconMap[item.type]}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-slate-900 leading-snug">
                    {item.title}
                  </p>
                  {item.message && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">
                      {item.message}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
