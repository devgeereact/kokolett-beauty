/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ResolvedTheme, ThemeMode } from '@/types';

interface ThemeContextValue {
  /** What the user chose: 'system' | 'light' | 'dark'. */
  theme: ThemeMode;
  /** What is actually painted right now. */
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'kokolett-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system'
    ? stored
    : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getInitialTheme() === 'system' ? systemTheme() : (getInitialTheme() as ResolvedTheme),
  );

  useEffect(() => {
    const next: ResolvedTheme = theme === 'system' ? systemTheme() : theme;
    setResolvedTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Track OS changes only while the user is actually on 'system'.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);

  // Cycles system → light → dark → system.
  const toggleTheme = useCallback(
    () =>
      setThemeState((t) =>
        t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system',
      ),
    [],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, toggleTheme, setTheme }),
    [theme, resolvedTheme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }
  return ctx;
}
