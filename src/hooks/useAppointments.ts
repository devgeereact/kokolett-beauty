import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAppointments } from '@/services/appointmentService';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

interface UseAppointmentsOptions {
  from: Date;
  to: Date;
  statuses?: AppointmentStatus[];
}

interface UseAppointments {
  appointments: AppointmentDetailed[];
  loading: boolean;
  error: Error | null;
  /** Awaiting an approval decision within this window — drives the badge. */
  pendingApproval: AppointmentDetailed[];
  refresh: () => Promise<void>;
}

/**
 * Owner-side appointment queries over a date range.
 *
 * The window is keyed on epoch milliseconds rather than the Date objects
 * themselves: callers construct `new Date(...)` inline during render, so a
 * reference-keyed effect would refetch on every keystroke elsewhere on the page.
 */
export function useAppointments(options: UseAppointmentsOptions): UseAppointments {
  const { from, to, statuses } = options;
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const statusKey = statuses?.join(',') ?? '';

  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const rows = await listAppointments({
        from: new Date(fromMs),
        to: new Date(toMs),
        statuses: statusKey ? (statusKey.split(',') as AppointmentStatus[]) : undefined,
      });
      setAppointments(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [fromMs, toMs, statusKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingApproval = useMemo(
    () => appointments.filter((a) => a.status === 'pending_approval'),
    [appointments],
  );

  return { appointments, loading, error, pendingApproval, refresh: load };
}
