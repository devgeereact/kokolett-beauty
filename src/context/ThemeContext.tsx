/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type JSX,
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

/**
 * Paint the theme.
 *
 * `colorScheme` matters as much as the class: it is what tells the browser to
 * render form controls, scrollbars and the native date picker dark. Without it
 * a dark dashboard shows a white date picker.
 *
 * The same two lines run inline in index.html before React mounts, so the
 * first frame is already correct.
 */
function apply(next: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.style.colorScheme = next;
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

  /* Paint on every change, but persist only once the visitor has actually
     chosen something. Writing on mount put a key on the device of every
     visitor who never touched the toggle, which is storage nobody asked for
     and one more thing the cookies page would have to account for. */
  const persisted = useRef(false);
  useEffect(() => {
    const next: ResolvedTheme = theme === 'system' ? systemTheme() : theme;
    setResolvedTheme(next);
    apply(next);
    if (!persisted.current) {
      persisted.current = true;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Storage refused. The choice still holds for this visit. */
    }
  }, [theme]);

  // Track OS changes only while the user is actually on 'system'.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      apply(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);

  /**
   * Flip to the opposite of what is on screen right now.
   *
   * Deliberately not a three-way cycle through 'system'. One press should
   * change what the person is looking at; a cycle that lands back on 'system'
   * can leave the screen looking unchanged, which reads as a broken button.
   * Returning to 'system' is its own control.
   */
  const toggleTheme = useCallback(
    () => setThemeState(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme],
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
