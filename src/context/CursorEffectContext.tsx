import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CURSOR_EFFECT_STORAGE_KEY,
  DEFAULT_CURSOR_EFFECT_SETTINGS,
  loadCursorEffectSettings,
  sanitizeCursorEffectSettings,
  saveCursorEffectSettings,
  type CursorEffectSettings,
} from '@/lib/cursorEffects';

interface CursorEffectContextValue {
  settings: CursorEffectSettings;
  updateSettings: (patch: Partial<CursorEffectSettings>) => void;
  resetSettings: () => void;
}

const CursorEffectContext = createContext<CursorEffectContextValue | null>(null);

/**
 * Cung cấp và đồng bộ cấu hình hiệu ứng con trỏ chuột trên toàn bộ ứng dụng.
 */
export function CursorEffectProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CursorEffectSettings>(() => loadCursorEffectSettings());

  const updateSettings = useCallback((patch: Partial<CursorEffectSettings>) => {
    setSettings((prev) => {
      const next = sanitizeCursorEffectSettings({ ...prev, ...patch });
      saveCursorEffectSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_CURSOR_EFFECT_SETTINGS };
    saveCursorEffectSettings(next);
    setSettings(next);
  }, []);

  // Đồng bộ nếu người dùng mở nhiều tab cùng lúc
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CURSOR_EFFECT_STORAGE_KEY) return;
      if (!event.newValue) {
        setSettings({ ...DEFAULT_CURSOR_EFFECT_SETTINGS });
        return;
      }
      try {
        setSettings(sanitizeCursorEffectSettings(JSON.parse(event.newValue)));
      } catch {
        setSettings({ ...DEFAULT_CURSOR_EFFECT_SETTINGS });
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
  );

  return <CursorEffectContext.Provider value={value}>{children}</CursorEffectContext.Provider>;
}

export function useCursorEffects(): CursorEffectContextValue {
  const ctx = useContext(CursorEffectContext);
  if (!ctx) {
    throw new Error('useCursorEffects phải được dùng bên trong CursorEffectProvider');
  }
  return ctx;
}

