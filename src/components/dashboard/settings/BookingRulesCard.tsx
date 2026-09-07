import { type JSX, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeading } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';

interface BookingRulesForm {
  slotGranularity: string;
  defaultBuffer: string;
  leadTime: string;
  horizon: string;
  dailyCap: string;
  cancellationWindow: string;
  approveFirstTime: boolean;
  approvalWindow: string;
}

/**
 * Everything `book_appointment()` enforces, grouped by what each rule
 * actually governs rather than a flat list of numbers.
 */
export function BookingRulesCard(): JSX.Element {
  const { settings, loading, update, error: loadError, refresh } = useBusinessSettings();
  const [form, setForm] = useState<BookingRulesForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      slotGranularity: String(settings.slot_granularity_min),
      defaultBuffer: String(settings.default_buffer_min),
      leadTime: String(settings.lead_time_min),
      horizon: String(settings.max_horizon_days),
      dailyCap: String(settings.max_appointments_per_day),
      cancellationWindow: String(settings.cancellation_window_h),
      approveFirstTime: settings.approve_first_time,
      approvalWindow: String(settings.approval_window_h),
    });
  }, [settings]);

  if (loading) {
    return (
      <Card pad="standard" className="flex h-full items-center justify-center">
        <LoadingState />
      </Card>
    );
  }

  /* Not folded into the `loading` guard above. `useBusinessSettings` uses
     `.maybeSingle()`, and its catch sets `loading: false` while leaving
     `settings` null, so a missing row or a failed read both land here with
     nothing in flight. Treating that as "still loading" left the card
     spinning forever, with no error and no way to retry. */
  if (!form) {
    return (
      <Card pad="standard">
        <ErrorState
          error={
            loadError ??
            'The salon settings could not be read, so there is nothing to edit here yet.'
          }
          onRetry={() => void refresh()}
        />
      </Card>
    );
  }

  const save = async (): Promise<void> => {
    const numbers = {
      slot_granularity_min: Number(form.slotGranularity),
      default_buffer_min: Number(form.defaultBuffer),
      lead_time_min: Number(form.leadTime),
      max_horizon_days: Number(form.horizon),
      max_appointments_per_day: Number(form.dailyCap),
      cancellation_window_h: Number(form.cancellationWindow),
      approval_window_h: Number(form.approvalWindow),
    };
    if (Object.values(numbers).some((n) => !Number.isFinite(n))) {
      setError('Every value must be a number.');
      return;
    }
    if (numbers.slot_granularity_min < 5 || numbers.slot_granularity_min > 60) {
      setError('Slot spacing must be between 5 and 60 minutes.');
      return;
    }
    if (numbers.max_horizon_days < 1 || numbers.max_horizon_days > 365) {
      setError('Booking horizon must be between 1 and 365 days.');
      return;
    }
    if (form.approveFirstTime && numbers.approval_window_h < 1) {
      setError('The approval window must be at least an hour.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await update({ ...numbers, approve_first_time: form.approveFirstTime });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card pad="standard" id="booking-rules" className="scroll-mt-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
          <CalendarCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </span>
        <CardHeading size="compact" title="Booking Rules" />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        These rules are enforced by the booking system, including when a customer already
        has the booking page open.
      </p>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-foreground">Booking timing</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Slot spacing (min)">
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                value={form.slotGranularity}
                onChange={(e) => setForm({ ...form, slotGranularity: e.target.value })}
              />
            )}
          </Field>
          <Field label="Tidy-up time (min)">
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                value={form.defaultBuffer}
                onChange={(e) => setForm({ ...form, defaultBuffer: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Minimum notice (min)"
            hint={formatDuration(Number(form.leadTime) || 0)}
          >
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                value={form.leadTime}
                onChange={(e) => setForm({ ...form, leadTime: e.target.value })}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <h3 className="col-span-2 text-sm font-medium text-foreground">Booking limits</h3>
        <h3 className="text-sm font-medium text-foreground">Cancellation</h3>
        <Field label="Book up to (days)" className="mb-0">
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              value={form.horizon}
              onChange={(e) => setForm({ ...form, horizon: e.target.value })}
            />
          )}
        </Field>
        <Field label="Max per day" className="mb-0">
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              value={form.dailyCap}
              onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
            />
          )}
        </Field>
        <Field label="Free cancellation (h)" className="mb-0">
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              value={form.cancellationWindow}
              onChange={(e) => setForm({ ...form, cancellationWindow: e.target.value })}
            />
          )}
        </Field>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-medium text-foreground">First-time customers</h3>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            Hold first-time bookings for my approval
          </p>
          <Switch
            checked={form.approveFirstTime}
            aria-label="Hold first-time bookings for my approval"
            onChange={(next) => setForm({ ...form, approveFirstTime: next })}
          />
        </div>
        {form.approveFirstTime && (
          <Field
            label="Approval window (hours)"
            hint="Held for this long, then released back to availability automatically."
          >
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                value={form.approvalWindow}
                onChange={(e) => setForm({ ...form, approvalWindow: e.target.value })}
              />
            )}
          </Field>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" loading={saving} onClick={() => void save()}>
          Save changes
        </Button>
        {saved && (
          <span role="status" className="text-sm text-status-completed">
            Saved.
          </span>
        )}
      </div>
    </Card>
  );
}
