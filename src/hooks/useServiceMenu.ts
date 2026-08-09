import { useCallback, useEffect, useState } from 'react';
import { fetchPublicMenu } from '@/services/serviceMenuService';
import type { ServiceMenuGroup } from '@/types';

/**
 * The public menu of styles.
 *
 * A failure here is deliberately quiet: the home page renders nothing where the
 * menu would be. A visitor who cannot see the style list can still book, and an
 * error panel in the middle of a marketing page helps nobody.
 */
export function useServiceMenu(): {
  groups: ServiceMenuGroup[];
  loading: boolean;
} {
  const [groups, setGroups] = useState<ServiceMenuGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      setGroups(await fetchPublicMenu());
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { groups, loading };
}
