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
import {
  loadThemeMode,
  resolveThemeMode,
  sanitizeThemeMode,
  saveThemeMode,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
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

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(sanitizeThemeMode(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
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

