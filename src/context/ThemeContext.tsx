import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import {
  applyGlassClasses,
  DEFAULT_GLASS_SETTINGS,
  GLASS_STORAGE_KEY,
  loadGlassSettings,
  loadThemeMode,
  resolveThemeMode,
  sanitizeGlassSettings,
  sanitizeThemeMode,
  saveGlassSettings,
  saveThemeMode,
  THEME_STORAGE_KEY,
  type GlassSettings,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme';

export interface ThemeRevealOrigin {
  x: number;
  y: number;
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: (origin?: ThemeRevealOrigin) => void;
  glassSettings: GlassSettings;
  updateGlassSettings: (patch: Partial<GlassSettings>) => void;
  resetGlassSettings: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Quản lý chế độ Sáng / Tối / Theo thiết bị và đồng bộ class `.dark` lên thẻ html.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => loadThemeMode());
  const [glassSettings, setGlassSettings] = useState<GlassSettings>(() => loadGlassSettings());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => readSystemPrefersDark());
  const switchTimerRef = useRef<number | null>(null);

  const resolvedTheme = resolveThemeMode(theme, systemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncMedia = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    mediaQuery.addEventListener('change', syncMedia);
    return () => mediaQuery.removeEventListener('change', syncMedia);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    applyGlassClasses(document.documentElement, DEFAULT_GLASS_SETTINGS);
  }, [glassSettings]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const triggerSmoothTransition = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
    }
    switchTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-switching');
      switchTimerRef.current = null;
    }, 240);
  }, []);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      triggerSmoothTransition();
      saveThemeMode(mode);
      setThemeState(mode);
    },
    [triggerSmoothTransition]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeRevealOrigin) => {
      const next: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
      const rm =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };

      if (!rm && origin && typeof docWithTransition.startViewTransition === 'function') {
        const root = document.documentElement;
        const radius = Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y)
        );
        root.style.setProperty('--u219-cx', `${origin.x.toFixed(0)}px`);
        root.style.setProperty('--u219-cy', `${origin.y.toFixed(0)}px`);
        root.style.setProperty('--u219-r', `${Math.ceil(radius)}px`);
        root.classList.add('u219-transitioning');

        const transition = docWithTransition.startViewTransition(() => {
          flushSync(() => {
            saveThemeMode(next);
            setThemeState(next);
          });
          root.classList.toggle('dark', next === 'dark');
        });

        void transition.finished.finally(() => {
          root.classList.remove('u219-transitioning');
        });
        return;
      }

      setTheme(next);
    },
    [resolvedTheme, setTheme]
  );

  const updateGlassSettings = useCallback(
    (patch: Partial<GlassSettings>) => {
      triggerSmoothTransition();
      setGlassSettings((prev) => {
        const next = sanitizeGlassSettings({ ...prev, ...patch });
        saveGlassSettings(next);
        return next;
      });
    },
    [triggerSmoothTransition]
  );

  const resetGlassSettings = useCallback(() => {
    triggerSmoothTransition();
    const next = { ...DEFAULT_GLASS_SETTINGS };
    saveGlassSettings(next);
    setGlassSettings(next);
  }, [triggerSmoothTransition]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(sanitizeThemeMode(event.newValue));
      } else if (event.key === GLASS_STORAGE_KEY) {
        try {
          setGlassSettings(
            sanitizeGlassSettings(event.newValue ? JSON.parse(event.newValue) : null)
          );
        } catch {
          setGlassSettings({ ...DEFAULT_GLASS_SETTINGS });
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      glassSettings,
      updateGlassSettings,
      resetGlassSettings,
    }),
    [
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      glassSettings,
      updateGlassSettings,
      resetGlassSettings,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme phải được dùng bên trong ThemeProvider');
  }
  return ctx;
}

