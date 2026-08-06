import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listActiveServices,
  listAllServices,
  listCategories,
} from '@/services/serviceCatalogService';
import type { Service, ServiceCategory } from '@/types';

interface UseServices {
  services: Service[];
  categories: ServiceCategory[];
  loading: boolean;
  error: Error | null;
  bySlug: (slug: string) => Service | undefined;
  refresh: () => Promise<void>;
}

/**
 * The service catalogue.
 *
 * `includeInactive` is the owner's view — on the public site an inactive service
 * must not appear at all, and RLS would filter it anyway. Passing it here keeps
 * one hook for both surfaces rather than two that drift.
 */
export function useServices(includeInactive = false): UseServices {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [rows, cats] = await Promise.all([
        includeInactive ? listAllServices() : listActiveServices(),
        listCategories(),
      ]);
      setServices(rows);
      setCategories(cats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const bySlugMap = useMemo(() => new Map(services.map((s) => [s.slug, s])), [services]);

  const bySlug = useCallback(
    (slug: string): Service | undefined => bySlugMap.get(slug),
    [bySlugMap],
  );

  return { services, categories, loading, error, bySlug, refresh: load };
}
