import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface Toast { id: number; message: string; type: 'success' | 'error'; }
interface ToastCtx { toast: (msg: string, type?: 'success' | 'error') => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });

let id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const t = { id: ++id, message, type };
    setToasts((p) => [...p, t]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg border ${
              t.type === 'success'
                ? 'bg-[#141416] border-green-500/30 text-green-400'
                : 'bg-[#141416] border-red-500/30 text-red-400'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {t.message}
            <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
              <X size={13} className="text-[#a1a1aa]" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
