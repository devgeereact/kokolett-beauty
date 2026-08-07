import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useServices } from '@/hooks/useServices';
import {
  declineRequest,
  listQueuedRequests,
  offerSlotToRequest,
  whoIsAhead,
  type QueuedRequest,
} from '@/services/requestService';
import { errorMessage, toAppError } from '@/lib/errors';
import { formatDateTime, formatRelative, salonInstant } from '@/lib/format';

const FLEXIBILITY_LABELS: Record<string, string> = {
  any: 'Any time',
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
};

/**
 * The request queue — the only place approval happens under the current policy.
 *
 * Published hours book instantly, so a request exists only because nothing was
 * open. That makes this the screen where a cancellation gets filled, and the
 * reason order matters: whoever asked first is served first, and the position
 * is shown rather than implied.
 *
 * The order is enforced in the database, not here. `offer_slot_to_request`
 * refuses to book a later request into a date an earlier one also wanted,
 * unless the owner gives a reason — which is then recorded on the request.
 */
export function RequestsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { services } = useServices(true);

  const [requests, setRequests] = useState<QueuedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [offer, setOffer] = useState({ serviceId: '', date: '', time: '10:00' });
  const [declineReason, setDeclineReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [aheadWarning, setAheadWarning] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setRequests(await listQueuedRequests());
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

  const openFor = (request: QueuedRequest): void => {
    setOpenId(request.id);
    setFormError(null);
    setAheadWarning(null);
    setDeclineReason('');
    setOverrideReason('');
    setOffer({
      serviceId: request.service_id ?? services[0]?.id ?? '',
      date: request.preferred_dates[0] ?? '',
      time: '10:00',
    });
  };

  const book = async (request: QueuedRequest, override?: string): Promise<void> => {
    if (!offer.serviceId) return setFormError('Choose which service this is for.');
    if (!offer.date) return setFormError('Choose a date.');

    setBusy(true);
    setFormError(null);
    try {
      // The typed time is salon wall-clock, not the browser's.
      const when = salonInstant(offer.date, offer.time, timezone);

      const result = await offerSlotToRequest(
        request.id,
        offer.serviceId,
        when.toISOString(),
        override,
      );
      window.alert(`Booked in — reference ${result.reference}. They have been emailed.`);
      setOpenId(null);
      await load();
    } catch (e) {
      const appError = toAppError(e);
      const ahead = whoIsAhead(e);
      if (ahead) {
        setAheadWarning(ahead);
        setFormError(null);
      } else {
        setFormError(appError.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const decline = async (request: QueuedRequest): Promise<void> => {
    setBusy(true);
    try {
      await declineRequest(request.id, declineReason);
      setOpenId(null);
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout
      title="Requests"
      subtitle="Answered oldest first — whoever asked first is served first"
      badges={{ requests: requests.length }}
      actions={
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {loading && <LoadingState label="Loading the queue…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="Nobody waiting"
          description="Requests arrive when someone wants a time you have not published. If a booking cancels, this is where you find the next person in line."
        />
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  title={`Position ${request.queue_position} in the queue`}
                >
                  {request.queue_position}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {request.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.email}
                    {request.mobile ? ` · ${request.mobile}` : ''}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Asked {formatRelative(request.created_at)}
              </p>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Wants
                </dt>
                <dd className="text-sm text-foreground">
                  {request.service_name ?? 'Not sure yet'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Preferred dates
                </dt>
                <dd className="text-sm text-foreground">
                  {request.preferred_dates.length > 0
                    ? request.preferred_dates.join(', ')
                    : 'Any date'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Time of day
                </dt>
                <dd className="text-sm text-foreground">
                  {FLEXIBILITY_LABELS[request.flexibility] ?? request.flexibility}
                  {request.preferred_times ? ` · ${request.preferred_times}` : ''}
                </dd>
              </div>
            </dl>

            {request.notes && (
              <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                &ldquo;{request.notes}&rdquo;
              </p>
            )}

            {openId === request.id ? (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-3 font-display text-base font-semibold text-foreground">
                  Offer them a time
                </h3>

                <div className="grid gap-x-3 sm:grid-cols-3">
                  <Field label="Service">
                    {({ id }) => (
                      <Select
                        id={id}
                        value={offer.serviceId}
                        onChange={(e) =>
                          setOffer({ ...offer, serviceId: e.target.value })
                        }
                      >
                        <option value="">Choose…</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Date">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="date"
                        value={offer.date}
                        onChange={(e) => setOffer({ ...offer, date: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Time">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="time"
                        value={offer.time}
                        onChange={(e) => setOffer({ ...offer, time: e.target.value })}
                      />
                    )}
                  </Field>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  This books them straight in and emails a confirmation. It does not have
                  to be inside your published hours — you are choosing it deliberately.
                </p>

                {aheadWarning && (
                  <div
                    role="alert"
                    className="mb-4 rounded-md border border-border bg-muted p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      Someone asked before them
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {aheadWarning} also wanted that date. Serve them first, or say why
                      you are skipping ahead — the reason is recorded on the request.
                    </p>
                    <Field label="Reason for going out of order" className="mt-3 mb-2">
                      {({ id }) => (
                        <Input
                          id={id}
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="They asked for a different service"
                        />
                      )}
                    </Field>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy}
                      disabled={overrideReason.trim().length === 0}
                      onClick={() => void book(request, overrideReason)}
                    >
                      Book anyway
                    </Button>
                  </div>
                )}

                {formError && (
                  <p role="alert" className="mb-3 text-sm font-medium text-destructive">
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={busy} onClick={() => void book(request)}>
                    Book them in
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
                    Cancel
                  </Button>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <Field
                    label="Or turn it down"
                    hint="They are emailed this. Keep it brief and kind."
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        aria-describedby={describedBy}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="I'm afraid I'm fully booked that week."
                      />
                    )}
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy}
                    onClick={() => void decline(request)}
                  >
                    Decline this request
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button size="sm" onClick={() => openFor(request)}>
                  Answer
                </Button>
                <a
                  className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted"
                  href={`mailto:${request.email}?subject=Your enquiry at Kokolett Beauty`}
                >
                  Email directly
                </a>
                <span className="self-center text-xs text-muted-foreground">
                  Waiting {request.waiting_hours}h · asked{' '}
                  {formatDateTime(request.created_at, timezone)}
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
