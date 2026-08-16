import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { submitAvailabilityRequest } from '@/services/bookingService';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import type { Flexibility } from '@/types';

/**
 * The no-availability path.
 *
 * A customer who finds nothing open must never hit a dead end — that is a
 * booking the salon nearly had. This captures enough for the owner to offer a
 * time: who, what, roughly when, and how flexible they are.
 */
export function RequestAvailabilityPage(): JSX.Element {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    firstChoice: '',
    secondChoice: '',
    preferredTimes: '',
    flexibility: 'any' as Flexibility,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (): Promise<void> => {
    if (!form.fullName.trim()) return setError('Please give your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      return setError('Please give a valid email address so the salon can reply.');
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitAvailabilityRequest({
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile,
        preferredDates: [form.firstChoice, form.secondChoice].filter(Boolean),
        preferredTimes: form.preferredTimes,
        flexibility: form.flexibility,
        notes: form.notes,
      });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-2xl px-4 py-16 md:px-6">
          <Card className="p-6 text-center">
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Thank you, that is with the salon
            </h1>
            <p className="mt-2 text-muted-foreground">
              We will look at what we can open up and come back to you at{' '}
              <span className="font-medium text-foreground">{form.email}</span>.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Requests are answered in the order they arrive.
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
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Tell us when suits
        </h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          If nothing on the calendar works, leave your details and we will see what we can
          open up.
        </p>

        <Card className="p-6">
          <Field label="Your name" required>
            {({ controlProps }) => (
              <Input
                {...controlProps}
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            )}
          </Field>

          <Field label="Email" required>
            {({ controlProps }) => (
              <Input
                {...controlProps}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>

          <Field label="Mobile">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="tel"
                autoComplete="tel"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="What are you after?"
            hint="Braids, locs, a weave, colour, a trim. Whatever you have in mind."
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            )}
          </Field>

          <div className="grid gap-x-4 md:grid-cols-2">
            <Field label="Preferred date">
              {({ id }) => (
                <DatePicker
                  id={id}
                  value={form.firstChoice}
                  onChange={(value) => setForm({ ...form, firstChoice: value })}
                />
              )}
            </Field>
            <Field label="Second choice">
              {({ id }) => (
                <DatePicker
                  id={id}
                  value={form.secondChoice}
                  onChange={(value) => setForm({ ...form, secondChoice: value })}
                />
              )}
            </Field>
          </div>

          <Field label="Time of day">
            {({ id }) => (
              <Select
                id={id}
                value={form.flexibility}
                onChange={(e) =>
                  setForm({ ...form, flexibility: e.target.value as Flexibility })
                }
              >
                <option value="any">Any time</option>
                <option value="morning">Mornings</option>
                <option value="afternoon">Afternoons</option>
                <option value="evening">Evenings</option>
              </Select>
            )}
          </Field>

          <Field label="Anything more specific?">
            {({ id }) => (
              <Input
                id={id}
                value={form.preferredTimes}
                onChange={(e) => setForm({ ...form, preferredTimes: e.target.value })}
                placeholder="After 5pm ideally, or a Saturday"
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="mb-4 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="w-full"
            loading={submitting}
            onClick={() => void submit()}
          >
            Send request
          </Button>
        </Card>
      </div>
    </SiteShell>
  );
}
