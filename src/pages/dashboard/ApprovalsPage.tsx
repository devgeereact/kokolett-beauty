import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  approveAppointment,
  listPendingApprovals,
  rejectAppointment,
} from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, formatRelative, formatTime } from '@/lib/format';
import type { AppointmentDetailed } from '@/types';

/**
 * First-time bookings waiting on a decision.
 *
 * The slot is already held — `pending_approval` occupies the calendar — so this
 * queue is not "requests to consider", it is "slots currently out of sale". The
 * deadline is therefore the most important thing on each card: when it passes,
 * `expire_pending_approvals()` releases the slot automatically.
 */
export function ApprovalsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [rows, setRows] = useState<AppointmentDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setRows(await listPendingApprovals());
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

  const approve = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await approveAppointment(id);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await rejectAppointment(id, reason);
      setDecliningId(null);
      setReason('');
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout
      title="Approvals"
      subtitle="First-time bookings holding a slot until you decide"
      badges={{ approvals: rows.length }}
      actions={
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {loading && <LoadingState label="Loading approvals…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Nothing waiting"
          description="First-time customers appear here. Returning customers are confirmed instantly and never reach this queue."
        />
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const deadline = row.approval_deadline;
          const urgent =
            deadline !== null &&
            new Date(deadline).getTime() - Date.now() < 2 * 60 * 60 * 1000;

          return (
            <Card key={row.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {row.customer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.customer_email}
                    {row.customer_mobile ? ` · ${row.customer_mobile}` : ''}
                  </p>
                </div>
                <p className="font-mono text-sm text-muted-foreground">{row.reference}</p>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Service
                  </dt>
                  <dd className="text-sm font-medium text-foreground">
                    {row.service_name} · {formatMoney(row.price_pence)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Requested slot
                  </dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatDateTime(row.starts_at, timezone)}–
                    {formatTime(row.ends_at, timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Hold expires
                  </dt>
                  <dd
                    className={`text-sm font-medium ${urgent ? 'text-status-pending' : 'text-foreground'}`}
                  >
                    {deadline ? formatRelative(deadline) : 'No deadline'}
                    {urgent && ' — slot released automatically'}
                  </dd>
                </div>
              </dl>

              {row.customer_note && (
                <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  &ldquo;{row.customer_note}&rdquo;
                </p>
              )}

              {decliningId === row.id ? (
                <div className="mt-4 border-t border-border pt-4">
                  <Field
                    label="Reason for declining"
                    hint="The customer is emailed this. Keep it brief and kind."
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        aria-describedby={describedBy}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="I'm afraid I'm already committed at that time."
                      />
                    )}
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={busyId === row.id}
                      onClick={() => void decline(row.id)}
                    >
                      Confirm decline
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDecliningId(null);
                        setReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    size="sm"
                    loading={busyId === row.id}
                    onClick={() => void approve(row.id)}
                  >
                    Approve booking
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDecliningId(row.id);
                      setReason('');
                    }}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
