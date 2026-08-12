import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { listAppointments } from '@/services/appointmentService';
import { draftEmail, EMAIL_PURPOSE_LABELS, type EmailPurpose } from '@/lib/emailDrafts';
import {
  addDays,
  formatDateShort,
  formatTime,
  salonDayRange,
  toSalonDate,
} from '@/lib/format';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed } from '@/types';

const PURPOSES: EmailPurpose[] = [
  'running_late',
  'reschedule_notice',
  'aftercare',
  'thank_you',
];

/** Pick an appointment and a purpose; get a starting draft to edit, copy, or send. */
export function EmailDraftingPanel({ timezone }: { timezone: string }): JSX.Element {
  const [appointments, setAppointments] = useState<AppointmentDetailed[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [purpose, setPurpose] = useState<EmailPurpose>('running_late');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const today = toSalonDate(new Date(), timezone);
    listAppointments({
      from: salonDayRange(addDays(today, -14), timezone).start,
      to: salonDayRange(addDays(today, 30), timezone).end,
      statuses: [...LIVE_STATUSES],
    })
      .then(setAppointments)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [timezone]);

  const selected = useMemo(
    () => appointments?.find((a) => a.id === selectedId) ?? null,
    [appointments, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setSubject('');
      setBody('');
      return;
    }
    const draft = draftEmail(
      {
        customerName: selected.customer_name ?? 'there',
        reference: selected.reference,
        whenLabel: `${formatDateShort(selected.starts_at, timezone)} at ${formatTime(selected.starts_at, timezone)}`,
      },
      purpose,
    );
    setSubject(draft.subject);
    setBody(draft.body);
    setCopied(false);
  }, [selected, purpose, timezone]);

  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!appointments) return <LoadingState label="Loading appointments…" />;

  const mailHref = selected
    ? `mailto:${selected.customer_email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit p-5">
        <Field label="Appointment">
          {({ id }) => (
            <Select
              id={id}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Choose an appointment…</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.customer_name ?? 'Customer'} —{' '}
                  {formatDateShort(a.starts_at, timezone)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-foreground">
            Purpose
          </legend>
          <div className="space-y-1.5">
            {PURPOSES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="email-purpose"
                  className="h-4 w-4 accent-primary"
                  checked={purpose === p}
                  onChange={() => setPurpose(p)}
                />
                {EMAIL_PURPOSE_LABELS[p]}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Choose an appointment on the left to generate a draft.
          </p>
        ) : (
          <>
            <Field label="Subject">
              {({ id }) => (
                <Input
                  id={id}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              )}
            </Field>
            <Field label="Body">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <a
                href={mailHref}
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                Send
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`${subject}\n\n${body}`);
                  setCopied(true);
                }}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
