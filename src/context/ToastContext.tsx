/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type JSX,
} from 'react';
import { ToastStack } from '@/components/ui/Toast';
import type { ToastItem, ToastOptions } from '@/types';

export interface ToastContextValue {
  /** Queues a toast and returns its id, in case a caller needs to dismiss it early. */
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

// null = "not inside a provider"; the hook guards against this (mirrors AuthContext/ThemeContext).
const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Mount once, high in the tree (alongside `ThemeProvider` in `App.tsx`), so any
 * page can fire a toast without prop-drilling a rendered component through
 * every route.
 *
 * Replaces `window.alert(message)` for simple confirmations, and generalises
 * the undo-banner pattern that used to live as page-local state in
 * `TodayPage` (message + optional action + auto-dismiss + manual dismiss).
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // A monotonic counter rather than crypto.randomUUID(): ids only need to be
  // unique within this tab's lifetime, and this avoids depending on Web
  // Crypto availability in every test/runtime environment.
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions): string => {
    const id = `toast-${nextId.current++}`;
    setToasts((current) => [...current, { id, ...options }]);
    return id;
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }
  return ctx;
}
