import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useOwnerSummary } from '@/hooks/useOwnerSummary';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments';
import { setAppointmentStatus } from '@/services/appointmentService';
import { formatDateLong, formatMoney, salonToday } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { LIVE_STATUSES, type AppointmentStatus } from '@/types';

/**
 * The dashboard opens on today's schedule — the question the owner actually has
 * when she picks up her phone between clients.
 *
 * "Today" is the salon's day, not the browser's: `salonToday` anchors to the
 * salon timezone so an owner abroad still sees the same day her clients booked.
 */
export function TodayPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { summary, refresh: refreshSummary } = useOwnerSummary();

  const { start, end } = useMemo(() => salonToday(timezone), [timezone]);
  const statuses = useMemo<AppointmentStatus[]>(() => [...LIVE_STATUSES], []);
  const { appointments, loading, error, refresh } = useAppointments({
    from: start,
    to: end,
    statuses,
  });

  // A booking taken on the website while this screen is open must appear here.
  const onRealtimeChange = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);
  const { connected } = useRealtimeAppointments(onRealtimeChange);

  const changeStatus = useCallback(
    async (id: string, status: AppointmentStatus): Promise<void> => {
      try {
        await setAppointmentStatus(id, status);
        await Promise.all([refresh(), refreshSummary()]);
      } catch (e) {
        window.alert(errorMessage(e));
      }
    },
    [refresh, refreshSummary],
  );

  const stats = [
    { label: 'Booked today', value: summary ? String(summary.today_count) : '—' },
    {
      label: 'Expected takings',
      value: summary ? formatMoney(summary.today_revenue_pence) : '—',
    },
    {
      label: 'Awaiting approval',
      value: summary ? String(summary.pending_approval_count) : '—',
      to: routes.owner.approvals,
      urgent: (summary?.urgent_approval_count ?? 0) > 0,
    },
    {
      label: 'New enquiries',
      value: summary ? String(summary.new_request_count) : '—',
      to: routes.owner.requests,
    },
  ];

  return (
    <DashboardLayout
      title="Today"
      subtitle={formatDateLong(new Date(), timezone)}
      badges={{
        approvals: summary?.pending_approval_count,
        requests: summary?.new_request_count,
      }}
      actions={
        <span
          className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
          title={connected ? 'Live updates connected' : 'Live updates unavailable'}
        >
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-status-completed' : 'bg-status-cancelled'}`}
            aria-hidden="true"
          />
          {connected ? 'Live' : 'Offline'}
        </span>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const body = (
            <Card className="h-full p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              {stat.urgent && (
                <p className="mt-1 text-xs font-medium text-status-pending">
                  Some expire within 2 hours
                </p>
              )}
            </Card>
          );
          return stat.to ? (
            <Link
              key={stat.label}
              to={stat.to}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {body}
            </Link>
          ) : (
            <div key={stat.label}>{body}</div>
          );
        })}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
        Today&rsquo;s schedule
      </h2>

      {loading && <LoadingState label="Loading today's appointments…" />}
      {error && <ErrorState error={error} onRetry={() => void refresh()} />}

      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          title="Nothing booked today"
          description="When a customer books online it will appear here straight away."
          action={
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            timezone={timezone}
            onStatusChange={changeStatus}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
