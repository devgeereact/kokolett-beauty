import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { createAppointmentAsOwner } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { salonInstant, toSalonDate, formatTime } from '@/lib/format';

/**
 * Taking a booking by hand: over the phone, at the door, or a follow-up booked
 * while the customer is still in the chair.
 *
 * This deliberately ignores published availability. Those times are what the
 * website may sell; they are not a limit on what the owner may agree to in
 * person. What it cannot do is double-book, because the overlap constraint
 * lives in the database and applies to every source equally.
 *
 * The customer is emailed a confirmation the moment this saves, exactly as if
 * they had booked it themselves, and the link in it lets them move or cancel
 * without ringing back.
 *
 * Length is set per booking rather than taken from the appointment type. A
 * retouch and a full head of knotless braids are not the same afternoon, and
 * blocking four hours for a one-hour trim is how a day gets wasted.
 */

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480];

export interface PrefilledCustomer {
  fullName: string;
  email: string;
  mobile: string;
}

export function NewBookingPanel({
  prefill,
  initialDate,
  initialTime,
  onBooked,
  onClose,
  initialStartsAt,
  initialDurationMin,
  initialNote,
}: {
  prefill?: PrefilledCustomer | null;
  /** Pre-fills the date field, e.g. from a clicked calendar slot. Defaults to today. */
  initialDate?: string;
  /** Pre-fills the start time field, e.g. from a clicked calendar slot. Defaults to 10:00. */
  initialTime?: string;
  onBooked: (reference: string) => void;
  onClose: () => void;
  initialStartsAt?: string; // ISO UTC
  initialDurationMin?: number;
  initialNote?: string;
}): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [date, setDate] = useState(() =>
    initialStartsAt
      ? toSalonDate(initialStartsAt, timezone)
      : (initialDate ?? toSalonDate(new Date(), timezone)),
  );
  const [time, setTime] = useState(() =>
    initialStartsAt ? formatTime(initialStartsAt, timezone) : (initialTime ?? '10:00'),
  );
  const [duration, setDuration] = useState(() =>
    initialDurationMin ? String(initialDurationMin) : '240',
  );
  const [fullName, setFullName] = useState(prefill?.fullName ?? '');
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [mobile, setMobile] = useState(prefill?.mobile ?? '');
  const [note, setNote] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefill) return;
    setFullName(prefill.fullName);
    setEmail(prefill.email);
    setMobile(prefill.mobile);
  }, [prefill]);

  useEffect(() => {
    // If caller updates initial starts/duration/note, follow it into the form.
    if (initialStartsAt) {
      setDate(toSalonDate(initialStartsAt, timezone));
      setTime(formatTime(initialStartsAt, timezone));
    }
    if (initialDurationMin) setDuration(String(initialDurationMin));
    if (initialNote) setNote(initialNote);
  }, [initialStartsAt, initialDurationMin, initialNote, timezone]);

  const submit = async (): Promise<void> => {
    if (fullName.trim().split(/\s+/).length < 2) {
      setError('Please give a full name, first and last.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('A valid email is needed, because that is where the confirmation goes.');
      return;
    }
    if (!date || !time) {
      setError('Pick a date and a time.');
      return;
    }

    // Salon time, not browser time. The owner may be abroad when she takes a
    // booking by phone, and 10:00 means 10:00 in the salon either way.
    const startsAt = salonInstant(date, time, timezone);

    setBusy(true);
    setError(null);
    try {
      const result = await createAppointmentAsOwner({
        startsAt,
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim() || undefined,
        note: note.trim() || undefined,
        durationMin: Number(duration),
      });
      onBooked(result.reference);
    } catch (e) {
      const message = errorMessage(e);
      setError(
        message.includes('SLOT_TAKEN')
          ? 'Something else is already booked across that time. Pick another slot or shorten this one.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Take a booking
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirmed straight away, and they get the same confirmation email as a web
            booking, with a link to change or cancel it themselves.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-x-4 md:grid-cols-3">
        <Field label="Date" required>
          {({ id }) => <DatePicker id={id} value={date} onChange={setDate} />}
        </Field>
        <Field label="Start time" required>
          {({ id }) => (
            <Input
              id={id}
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </Field>
        <Field label="How long?" hint="Set aside what this style actually needs.">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m >= 60
                    ? `${m / 60} ${m === 60 ? 'hour' : 'hours'}${m % 60 ? ` ${m % 60} min` : ''}`
                    : `${m} minutes`}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="Full name" required hint="First and last, as they would say it.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Koko Beauty"
            />
          )}
        </Field>
        <Field label="Email" required hint="Where the confirmation goes.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="Mobile" hint="So you can reach them if something changes.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="tel"
            autoComplete="off"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="07700 900123"
          />
        )}
      </Field>

      <Field
        label="What are they having?"
        hint="Appears on the booking and in their confirmation."
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Retouch and restyle, six weeks on from the last set"
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button loading={busy} onClick={() => void submit()}>
        Book and send the confirmation
      </Button>
    </Card>
  );
}
