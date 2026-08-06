import { useCallback, useEffect, useState } from 'react';
import { getOwnerSummary } from '@/services/dashboardService';
import type { OwnerSummary } from '@/types';

interface UseOwnerSummary {
  summary: OwnerSummary | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Headline counts for the dashboard, in one round trip. */
export function useOwnerSummary(): UseOwnerSummary {
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setSummary(await getOwnerSummary());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, refresh: load };
}
