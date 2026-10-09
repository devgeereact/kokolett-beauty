import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Guarded: a pure-module test file may run without a DOM storage shim, and a
  // teardown that throws turns every passing test in the file red for a reason
  // that has nothing to do with the assertions.
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
});

/** Same shim, same Node 22 reason. Used by the analytics session id. */
function inMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    getItem: (key: string): string | null => store.get(String(key)) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(String(key), String(value));
    },
    removeItem: (key: string): void => {
      store.delete(String(key));
    },
    clear: (): void => {
      store.clear();
    },
  };
}

if (!globalThis.sessionStorage) {
  const storage = inMemoryStorage();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

/**
 * In-memory `localStorage`.
 *
 * jsdom is active and the origin is real, but on Node 22 the runtime's own
 * experimental web-storage global shadows jsdom's implementation and resolves to
 * `undefined` unless the process is started with `--localstorage-file`. The
 * customer session lives in localStorage, so without this every session test
 * fails on the shim rather than on what it is asserting. This is a faithful
 * `Storage`: string coercion, `null` for a missing key, and a working `length`.
 */
if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length(): number {
      return store.size;
    },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    getItem: (key: string): string | null => store.get(String(key)) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(String(key), String(value));
    },
    removeItem: (key: string): void => {
      store.delete(String(key));
    },
    clear: (): void => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

// jsdom implements neither of these, and both are used on the app's boot path:
// ThemeContext reads matchMedia before first paint, and the dashboard layout
// relies on it for the responsive breakpoint.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      addListener: (): void => {},
      removeListener: (): void => {},
      dispatchEvent: (): boolean => false,
    }) as MediaQueryList;
}

// jsdom has no layout engine, so it ships no `scrollIntoView` at all. The
// dashboard sidebar calls it to pull the current nav entry back into the
// scrolling list, which is a no-op worth keeping out of the component as a
// defensive optional-call.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// jsdom has no layout engine and no ResizeObserver. Anything that measures a
// box to decide what fits (the Today timeline's blocks) needs one to exist;
// a stub that never fires leaves the component on its pre-measurement
// defaults, which is the right behaviour for a test that is not about size.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
