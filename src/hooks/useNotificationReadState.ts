import { useCallback, useEffect, useState } from 'react';

const READ_KEY = 'kokolett-notifications-read';
const ARCHIVED_KEY = 'kokolett-notifications-archived';

function loadSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, value: Set<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Storage unavailable — read/archive state just won't persist across reloads.
  }
}

/**
 * There is no notifications table, so "read"/"archived" are real but
 * per-browser: they live in `localStorage`, not fabricated in memory only.
 * A second device won't see the same read state, same as most local-first
 * read markers.
 */
export function useNotificationReadState(): {
  isRead: (id: string) => boolean;
  isArchived: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  archive: (id: string) => void;
} {
  const [read, setRead] = useState<Set<string>>(() => loadSet(READ_KEY));
  const [archived, setArchived] = useState<Set<string>>(() => loadSet(ARCHIVED_KEY));

  useEffect(() => saveSet(READ_KEY, read), [read]);
  useEffect(() => saveSet(ARCHIVED_KEY, archived), [archived]);

  const markRead = useCallback((id: string): void => {
    setRead((prev) => new Set(prev).add(id));
  }, []);

  const markAllRead = useCallback((ids: string[]): void => {
    setRead((prev) => new Set([...prev, ...ids]));
  }, []);

  const archive = useCallback((id: string): void => {
    setArchived((prev) => new Set(prev).add(id));
  }, []);

  return {
    isRead: (id) => read.has(id),
    isArchived: (id) => archived.has(id),
    markRead,
    markAllRead,
    archive,
  };
}
