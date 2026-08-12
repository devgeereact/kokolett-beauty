import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { formatLocalDate, parseLocalDate } from '@/lib/localDate';
import { useServices } from '@/hooks/useServices';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { submitBooking } from '@/services/bookingService';
import { toAppError } from '@/lib/errors';
import { formatDateLong } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { BookingResult, TimeSlot } from '@/types';

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
  const { services } = useServices();
  const { settings, timezone } = useBusinessSettings();

  // Length still governs how much of the calendar a booking occupies; it is
  // simply not shown to the customer any more.
  const appointmentMinutes = services[0]?.duration_min ?? 60;

  const { slotsByDate, openDates, loading, isEmpty, refresh } =
    useAvailability(appointmentMinutes);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const activeDate = openDate ?? openDates[0] ?? null;
  const openDateSet = useMemo(() => new Set(openDates), [openDates]);

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
    try {
      setResult(await submitBooking({ startsAt: slot.startsAt, ...details }));
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
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Card className="p-6 text-center">
            <p className="font-display text-2xl font-semibold text-foreground">
              {result.status === 'confirmed' ? 'You are booked in' : 'Your slot is held'}
            </p>
            <p className="mt-2 text-muted-foreground">
              {result.status === 'confirmed'
                ? 'We look forward to seeing you.'
                : 'The salon will confirm shortly. Your slot is reserved until then.'}
            </p>

            <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left">
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono font-medium text-foreground">
                  {result.reference}
                </dd>
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
              Keep your reference somewhere safe. Your confirmation and a link to change
              the booking are on their way by email.
            </p>

            <Link
              to={routes.public.home}
              className="mt-6 inline-flex h-11 items-center rounded-lg border border-border px-5 font-semibold text-foreground hover:bg-muted"
            >
              Back to the salon
            </Link>
          </Card>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Book an appointment
        </h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Choose a time that suits you and tell us what you would like doing.
        </p>

        {loading && <LoadingState label="Finding open times…" />}

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
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-border sm:border-b-0 sm:border-r">
                <Calendar
                  size="lg"
                  mode="single"
                  selected={parseLocalDate(activeDate ?? '')}
                  defaultMonth={parseLocalDate(activeDate ?? openDates[0] ?? '')}
                  onSelect={(date) => date && setOpenDate(formatLocalDate(date))}
                  disabled={(date) => !openDateSet.has(formatLocalDate(date))}
                />
              </div>

              <div className="min-w-0 flex-1 p-5 sm:p-6">
                {activeDate ? (
                  <>
                    <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
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
              hint="First name and surname, for example Koko Beauty."
            >
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  autoComplete="name"
                  placeholder="Koko Beauty"
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
              hint="Braids, locs, a weave, colour, a trim. Whatever you have in mind, so we know what to prepare and how long to keep aside."
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
