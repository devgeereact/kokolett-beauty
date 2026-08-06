import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { listAvailabilityRequests, respondToRequest } from '@/services/dashboardService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import type { AvailabilityRequest, AvailabilityRequestStatus } from '@/types';

const STATUS_LABELS: Record<AvailabilityRequestStatus, string> = {
  new: 'New',
  awaiting_response: 'Replied',
  offer_sent: 'Slot offered',
  converted: 'Booked',
  declined: 'Declined',
  expired: 'Expired',
};

const FLEXIBILITY_LABELS: Record<string, string> = {
  any: 'Any time',
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
};

/**
 * Enquiries raised when the booking flow found no slots.
 *
 * These are the bookings the salon nearly lost, so they are worth answering
 * first — someone who reached this form wanted an appointment badly enough to
 * type their details after being told there was nothing available.
 */
export function RequestsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setRequests(await listAvailabilityRequests());
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

  const respond = async (
    id: string,
    status: 'awaiting_response' | 'declined',
  ): Promise<void> => {
    setBusy(true);
    try {
      await respondToRequest(id, message, status);
      setReplyingTo(null);
      setMessage('');
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const newCount = requests.filter((r) => r.status === 'new').length;

  return (
    <DashboardLayout
      title="Enquiries"
      subtitle="Customers who could not find a slot"
      badges={{ requests: newCount }}
      actions={
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {loading && <LoadingState label="Loading enquiries…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="No enquiries"
          description="When someone finds no available slot, their request lands here instead of a dead end."
        />
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  {request.full_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {request.email}
                  {request.mobile ? ` · ${request.mobile}` : ''}
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {STATUS_LABELS[request.status]}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Preferred dates
                </dt>
                <dd className="text-sm text-foreground">
                  {request.preferred_dates.length > 0
                    ? request.preferred_dates.join(', ')
                    : 'No preference'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Flexibility
                </dt>
                <dd className="text-sm text-foreground">
                  {FLEXIBILITY_LABELS[request.flexibility] ?? request.flexibility}
                  {request.preferred_times ? ` · ${request.preferred_times}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Received
                </dt>
                <dd className="text-sm text-foreground">
                  {formatDateTime(request.created_at, timezone)}
                </dd>
              </div>
            </dl>

            {request.notes && (
              <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                &ldquo;{request.notes}&rdquo;
              </p>
            )}

            {request.owner_response && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Your reply:</span>{' '}
                {request.owner_response}
              </p>
            )}

            {replyingTo === request.id ? (
              <div className="mt-4 border-t border-border pt-4">
                <Field
                  label="Reply"
                  hint="Recorded against the enquiry. Email delivery is not wired up yet — contact them directly for now."
                >
                  {({ id, describedBy }) => (
                    <Textarea
                      id={id}
                      aria-describedby={describedBy}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  )}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={() => void respond(request.id, 'awaiting_response')}
                  >
                    Save reply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy}
                    onClick={() => void respond(request.id, 'declined')}
                  >
                    Decline enquiry
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setReplyingTo(request.id);
                    setMessage(request.owner_response ?? '');
                  }}
                >
                  Respond
                </Button>
                <a
                  className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted"
                  href={`mailto:${request.email}?subject=Your enquiry at Kokolett Beauty`}
                >
                  Email directly
                </a>
              </div>
            )}
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
