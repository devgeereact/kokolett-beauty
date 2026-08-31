import { type JSX, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { trackEvent } from '@/lib/analytics';
import { formatLocalDate, parseLocalDate } from '@/lib/localDate';
import { useServices } from '@/hooks/useServices';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { submitBooking } from '@/services/bookingService';
import { toAppError } from '@/lib/errors';
import { formatDateLong } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { BookingResult, TimeSlot } from '@/types';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

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
 * Booking: pick a time, leave your details.
 *
 * There is no service step any more. Every appointment is one hair appointment
 * of the same length, and what the customer actually wants is a note plus a
 * conversation in the chair — which is how the salon works regardless.
 *
 * Only genuinely bookable times are shown. The remaining race, two people
 * choosing the same time, is settled by the database: the loser gets
 * `SLOT_TAKEN`, the list refreshes, and they pick again.
 */
export function BookPage(): JSX.Element {
  useDocumentMeta({
    title: 'Book an appointment',
    description:
      "Pick a time that is genuinely free in the diary at Kokolett Beauty UK, a women's hair salon in Thamesmead, South East London. No account and no password.",
    path: routes.public.book,
  });
  const { services } = useServices();
  const { settings, timezone } = useBusinessSettings();

  // Length still governs how much of the calendar a booking occupies; it is
  // simply not shown to the customer any more.
  const appointmentMinutes = services[0]?.duration_min ?? 60;

  const {
    slotsByDate,
    openDates,
    loading,
    isEmpty,
    error: availabilityError,
    refresh,
  } = useAvailability(appointmentMinutes);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const activeDate = openDate ?? openDates[0] ?? null;
  const openDateSet = useMemo(() => new Set(openDates), [openDates]);

  useEffect(() => {
    trackEvent('book_page_viewed');
  }, []);

  const book = async (): Promise<void> => {
    if (!slot) return;
    // A first name alone cannot tell two customers apart in a diary, so the
    // salon asks for both. The same rules are enforced in book_appointment —
    // validation that only lives in the browser is a suggestion.
    const nameParts = details.fullName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      return setError('Please give your full name, first name and surname.');
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email.trim())) {
      return setError(
        'Please give a valid email address, because your confirmation goes there.',
      );
    }
    if (details.mobile.replace(/\D/g, '').length < 7) {
      return setError('Please give a mobile number the salon can reach you on.');
    }

    setSubmitting(true);
    setError(null);
    trackEvent('booking_submitted');
    try {
      const booked = await submitBooking({ startsAt: slot.startsAt, ...details });
      setResult(booked);
      trackEvent('booking_confirmed');
    } catch (e) {
      const appError = toAppError(e);
      setError(appError.message);
      if (appError.code === 'SLOT_TAKEN') {
        setSlot(null);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Booked ------------------------------------------------------- */
  if (result) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-md px-4 py-10 md:px-6">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="bg-primary px-6 py-6 text-center text-primary-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                Kokolett Beauty
              </p>
              <p className="mt-2 font-serif text-2xl font-semibold">
                {result.status === 'confirmed'
                  ? 'You are booked in'
                  : 'Your slot is held'}
              </p>
              <p className="mt-1 text-sm">
                {result.status === 'confirmed'
                  ? 'We look forward to seeing you.'
                  : `The salon will confirm shortly, usually within ${settings?.approval_window_h ?? 'a few'} hours.`}
              </p>
            </div>

            {/* The torn-stub line: a dashed rule with a punched circle at
                each edge, cut from the card down to the page ground behind
                it — a ticket, not a plain confirmation card. */}
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
              />
              <span
                aria-hidden="true"
                className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
              />
              <div className="border-t border-dashed border-border" />
            </div>

            <div className="p-6">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Booking reference
              </p>
              <p className="mt-1 text-center font-mono text-3xl font-bold tracking-[0.15em] text-foreground">
                {result.reference}
              </p>

              {slot && (
                <dl className="mx-auto mt-6 max-w-xs space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatDateLong(slot.startsAt, timezone)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Time</dt>
                    <dd className="text-right font-medium text-foreground">
                      {slot.label}
                    </dd>
                  </div>
                </dl>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Keep your reference somewhere safe. Your confirmation and a link to change
                the booking are on their way by email.
              </p>

              <Link
                to={routes.public.home}
                className="mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-border font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to the salon
              </Link>
            </div>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Book an appointment
        </h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Choose a time that suits you and tell us what you would like doing.
        </p>

        {loading && <LoadingState label="Finding open times…" />}

        {/*
          `useAvailability` has always exposed `error`; this page never read
          it. Because `isEmpty` is itself gated on `error === null`, a failed
          fetch rendered neither the slot grid nor the empty state — the
          customer got a heading, a sentence, and then nothing at all, with no
          way to tell a network failure from a page still thinking.
        */}
        {availabilityError && (
          <ErrorState
            error="We could not load the diary just now. Check your connection and try again."
            onRetry={() => void refresh()}
          />
        )}

        {isEmpty && (
          <EmptyState
            title="No times open at the moment"
            description="Rather than leave you stuck, tell us when suits and the salon will come back to you as soon as something frees up."
            action={
              <Link
                className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
                to={routes.public.requestAvailability}
              >
                Ask for a time
              </Link>
            }
          />
        )}

        {!loading && openDates.length > 0 && !slot && (
          <Card className="mb-8 overflow-hidden p-0">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-border md:border-b-0 md:border-r">
                <Calendar
                  size="lg"
                  mode="single"
                  selected={parseLocalDate(activeDate ?? '')}
                  defaultMonth={parseLocalDate(activeDate ?? openDates[0] ?? '')}
                  onSelect={(date) => date && setOpenDate(formatLocalDate(date))}
                  disabled={(date) => !openDateSet.has(formatLocalDate(date))}
                />
              </div>

              <div className="min-w-0 flex-1 p-5 md:p-6">
                {activeDate ? (
                  <>
                    <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
                      {formatDateLong(`${activeDate}T12:00:00Z`, 'UTC')}
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground">
                      {slotsByDate[activeDate]?.length ?? 0} time
                      {(slotsByDate[activeDate]?.length ?? 0) === 1 ? '' : 's'} available
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(slotsByDate[activeDate] ?? []).map((s) => (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => {
                            setSlot(s);
                            setError(null);
                            trackEvent('slot_selected');
                          }}
                          className="min-h-12 rounded-lg border border-border bg-card font-mono text-base text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pick a day on the calendar to see times.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {slot && (
          <div className="mx-auto max-w-xl">
            <Card className="mb-6 p-4">
              <p className="font-medium text-foreground">
                {formatDateLong(slot.startsAt, timezone)} at {slot.label}
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

            <Field
              label="Full name"
              required
              hint="First name and surname, for example Sarah Bennett."
            >
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  autoComplete="name"
                  placeholder="Sarah Bennett"
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
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="email"
                  autoComplete="email"
                  value={details.email}
                  onChange={(e) => setDetails({ ...details, email: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="Mobile number"
              required
              hint="So the salon can reach you if anything changes."
            >
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="tel"
                  autoComplete="tel"
                  value={details.mobile}
                  onChange={(e) => setDetails({ ...details, mobile: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="What are you after?"
              hint="Braids, twists, a weave, colour, a trim. Whatever you have in mind, so we know what to prepare and how long to keep aside."
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  value={details.note}
                  onChange={(e) => setDetails({ ...details, note: e.target.value })}
                  placeholder="Trim and blow dry. My hair is quite long."
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
                First visit? Your slot is held while the salon confirms, usually within{' '}
                {settings.approval_window_h} hours.
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
          </div>
        )}
      </div>
    </SiteShell>
  );
}
