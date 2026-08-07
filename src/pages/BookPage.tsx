import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useServices } from '@/hooks/useServices';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { submitBooking } from '@/services/bookingService';
import { toAppError } from '@/lib/errors';
import { formatDateLong, formatDuration, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import type { BookingResult, Service, TimeSlot } from '@/types';

type Step = 'service' | 'slot' | 'details' | 'done';

interface Details {
  fullName: string;
  email: string;
  mobile: string;
  note: string;
  marketingConsent: boolean;
}

const EMPTY_DETAILS: Details = {
  fullName: '',
  email: '',
  mobile: '',
  note: '',
  marketingConsent: false,
};

/**
 * The booking flow: service → slot → details → done.
 *
 * Availability-first — a customer is only ever shown times that are genuinely
 * bookable, because `available_slots()` has already subtracted everything live
 * on the calendar. The remaining failure is the race between two people
 * choosing the same slot, which the database settles: the loser gets
 * `SLOT_TAKEN` and is sent back to pick again, rather than a double booking.
 */
export function BookPage(): JSX.Element {
  const { serviceSlug } = useParams<{ serviceSlug?: string }>();
  const { services, loading: servicesLoading, error: servicesError } = useServices();
  const { settings, timezone } = useBusinessSettings();

  const [chosen, setChosen] = useState<Service | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  // A /book/:serviceSlug link picks the service without a click.
  const service = useMemo(() => {
    if (chosen) return chosen;
    if (serviceSlug) return services.find((s) => s.slug === serviceSlug) ?? null;
    return null;
  }, [chosen, serviceSlug, services]);

  const {
    slotsByDate,
    openDates,
    loading: slotsLoading,
    isEmpty,
    refresh,
  } = useAvailability(service);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const activeDate = openDate ?? openDates[0] ?? null;

  const step: Step = result ? 'done' : slot ? 'details' : service ? 'slot' : 'service';

  const book = async (): Promise<void> => {
    if (!service || !slot) return;

    if (!details.fullName.trim()) return setError('Please give your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email.trim())) {
      return setError(
        'Please give a valid email address — your confirmation goes there.',
      );
    }

    setSubmitting(true);
    setError(null);
    try {
      const booking = await submitBooking({
        serviceId: service.id,
        startsAt: slot.startsAt,
        ...details,
      });
      setResult(booking);
    } catch (e) {
      const appError = toAppError(e);
      setError(appError.message);
      // The slot is gone; showing it as still selectable would be a lie.
      if (appError.code === 'SLOT_TAKEN') {
        setSlot(null);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (servicesLoading) {
    return (
      <SiteShell>
        <LoadingState label="Loading services…" />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {step !== 'done' && (
          <>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Book an appointment
            </h1>
            <ol className="mb-8 mt-3 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
              {(['service', 'slot', 'details'] as const).map((name, index) => (
                <li key={name} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true">›</span>}
                  <span className={cn(step === name && 'font-medium text-foreground')}>
                    {index + 1}.{' '}
                    {name === 'service'
                      ? 'Service'
                      : name === 'slot'
                        ? 'Time'
                        : 'Details'}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        {servicesError && <ErrorState error={servicesError} />}

        {/* ---- 1. Service ------------------------------------------------ */}
        {step === 'service' && (
          <>
            {services.length === 0 ? (
              <EmptyState
                title="Nothing bookable online just yet"
                description="The salon has not published its services yet. Please get in touch and we will sort you out."
                action={
                  <a
                    className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
                    href="mailto:booking@koko.gakinz.com"
                  >
                    Email the salon
                  </a>
                }
              />
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setChosen(s);
                      setOpenDate(null);
                    }}
                    className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display text-lg font-semibold text-foreground">
                        {s.name}
                      </p>
                      <p className="font-medium text-foreground">
                        {formatMoney(s.price_pence)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(s.duration_min)}
                      {s.description ? ` · ${s.description}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- 2. Slot --------------------------------------------------- */}
        {step === 'slot' && service && (
          <>
            <Card className="mb-6 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(service.duration_min)} ·{' '}
                    {formatMoney(service.price_pence)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChosen(null);
                    setOpenDate(null);
                  }}
                >
                  Change
                </Button>
              </div>
            </Card>

            {slotsLoading && <LoadingState label="Finding open times…" />}

            {isEmpty && (
              <EmptyState
                title="No open times in the next three weeks"
                description="Rather than leave you stuck, tell us when suits and the salon will come back to you."
                action={
                  <Link
                    className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
                    to={routes.public.requestAvailability}
                  >
                    Request a time
                  </Link>
                }
              />
            )}

            {!slotsLoading && openDates.length > 0 && (
              <>
                <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                  Pick a day
                </h2>
                <div className="mb-6 flex flex-wrap gap-2">
                  {openDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setOpenDate(date)}
                      className={cn(
                        'min-h-11 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        date === activeDate
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary',
                      )}
                    >
                      {new Intl.DateTimeFormat('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${date}T12:00:00Z`))}
                      <span className="ml-1 opacity-70">
                        ({slotsByDate[date]?.length ?? 0})
                      </span>
                    </button>
                  ))}
                </div>

                {activeDate && (
                  <>
                    <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                      {formatDateLong(`${activeDate}T12:00:00Z`, 'UTC')}
                    </h2>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {(slotsByDate[activeDate] ?? []).map((s) => (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => {
                            setSlot(s);
                            setError(null);
                          }}
                          className="min-h-11 rounded-lg border border-border bg-card font-mono text-sm text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- 3. Details ------------------------------------------------ */}
        {step === 'details' && service && slot && (
          <>
            <Card className="mb-6 p-4">
              <p className="font-medium text-foreground">{service.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateLong(slot.startsAt, timezone)} at {slot.label} ·{' '}
                {formatMoney(service.price_pence)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSlot(null)}
              >
                Pick another time
              </Button>
            </Card>

            <Field label="Your name" required>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  autoComplete="name"
                  value={details.fullName}
                  onChange={(e) => setDetails({ ...details, fullName: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="Email"
              required
              hint="Your confirmation and booking reference go here."
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="email"
                  autoComplete="email"
                  value={details.email}
                  onChange={(e) => setDetails({ ...details, email: e.target.value })}
                />
              )}
            </Field>

            <Field label="Mobile" hint="Optional, in case the salon needs to reach you.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="tel"
                  autoComplete="tel"
                  value={details.mobile}
                  onChange={(e) => setDetails({ ...details, mobile: e.target.value })}
                />
              )}
            </Field>

            <Field label="Anything we should know?">
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  value={details.note}
                  onChange={(e) => setDetails({ ...details, note: e.target.value })}
                  placeholder="First time here, hair is quite long…"
                />
              )}
            </Field>

            <Checkbox
              label="Email me occasional offers and news. You can stop at any time."
              checked={details.marketingConsent}
              onChange={(e) =>
                setDetails({ ...details, marketingConsent: e.target.checked })
              }
            />

            {settings?.approve_first_time && (
              <p className="mb-4 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                If this is your first visit, your slot is held while the salon confirms —
                usually within {settings.approval_window_h} hours. Returning customers are
                confirmed straight away.
              </p>
            )}

            {error && (
              <p role="alert" className="mb-4 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="w-full"
              loading={submitting}
              onClick={() => void book()}
            >
              Confirm booking
            </Button>
          </>
        )}

        {/* ---- 4. Done --------------------------------------------------- */}
        {step === 'done' && result && service && (
          <Card className="p-6 text-center">
            <p className="font-display text-2xl font-semibold text-foreground">
              {result.status === 'confirmed' ? 'You are booked in' : 'Your slot is held'}
            </p>
            <p className="mt-2 text-muted-foreground">
              {result.status === 'confirmed'
                ? 'We look forward to seeing you.'
                : `Because this is your first visit, the salon will confirm shortly — usually within ${settings?.approval_window_h ?? 12} hours. Your slot is reserved until then.`}
            </p>

            <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left">
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono font-medium text-foreground">
                  {result.reference}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="text-foreground">{service.name}</dd>
              </div>
              {slot && (
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">When</dt>
                  <dd className="text-foreground">
                    {formatDateLong(slot.startsAt, timezone)}, {slot.label}
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-6 text-sm text-muted-foreground">
              Please keep your reference. Email confirmations are not switched on yet, so
              take a note or a screenshot.
            </p>

            <Link
              to={routes.public.home}
              className="mt-6 inline-flex h-11 items-center rounded-lg border border-border px-5 font-semibold text-foreground hover:bg-muted"
            >
              Back to the salon
            </Link>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}
