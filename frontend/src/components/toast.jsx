import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const colors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-red-600 text-white',
            warning: 'bg-amber-500 text-white',
            info: 'bg-slate-800 text-white',
          };
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${colors[t.type]}`}
              onClick={() => removeToast(t.id)}
              role="alert"
            >
              <span>{t.message}</span>
              <button className="ml-2 text-white/70 hover:text-white" aria-label="Dismiss">&times;</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
