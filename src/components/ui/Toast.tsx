import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { wrap: string; icon: typeof CheckCircle2 }> = {
  success: {
    wrap: 'border-status-successBorder bg-status-successBg text-status-successText',
    icon: CheckCircle2,
  },
  error: {
    wrap: 'border-status-dangerBorder bg-status-dangerBg text-status-dangerText',
    icon: AlertCircle,
  },
  info: {
    wrap: 'border-brand-navy/20 bg-brand-navySoft text-brand-navy',
    icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message) => showToast(message, 'success'),
      error: (message) => showToast(message, 'error'),
      info: (message) => showToast(message, 'info'),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        {items.map((item) => {
          const style = TOAST_STYLES[item.type];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              className={`glass-toast pointer-events-auto flex items-start gap-2 rounded-xl border p-4 shadow-lg ${style.wrap}`}
              role="status"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm font-semibold">{item.message}</p>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Đóng thông báo"
                className="rounded p-1 opacity-75 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast phải được dùng bên trong ToastProvider');
  }
  return ctx;
}

