import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';

interface FormState {
  slotGranularity: string;
  defaultBuffer: string;
  leadTime: string;
  horizon: string;
  dailyCap: string;
  cancellationWindow: string;
  approveFirstTime: boolean;
  approvalWindow: string;
  googleReviewUrl: string;
}

/**
 * Booking policy.
 *
 * These values are enforced inside `book_appointment()`, not in the browser, so
 * changing them here genuinely changes what can be booked — including from a
 * page a customer already has open.
 */
export function SettingsPage(): JSX.Element {
  const { settings, loading, error, update, refresh } = useBusinessSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      googleReviewUrl: settings.google_review_url ?? '',
    });
  }, [settings]);

  if (loading || !form) {
    return (
      <DashboardLayout title="Settings">
        {error ? (
          <ErrorState error={error} onRetry={() => void refresh()} />
        ) : (
          <LoadingState />
        )}
      </DashboardLayout>
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
      setFormError('Every value must be a number.');
      return;
    }
    // Mirrors the database check constraints, so the failure is a sentence
    // rather than a constraint violation.
    if (numbers.slot_granularity_min < 5 || numbers.slot_granularity_min > 60) {
      setFormError('Slot spacing must be between 5 and 60 minutes.');
      return;
    }
    if (numbers.max_horizon_days < 1 || numbers.max_horizon_days > 365) {
      setFormError('Booking horizon must be between 1 and 365 days.');
      return;
    }
    if (numbers.approval_window_h < 1) {
      setFormError('The approval window must be at least an hour.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await update({
        ...numbers,
        approve_first_time: form.approveFirstTime,
        google_review_url: form.googleReviewUrl.trim() || null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle="How online booking behaves">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Booking rules
          </h2>

          <Field
            label="Slot spacing (minutes)"
            hint="Start times are offered on this grid. 15 suits most salons."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.slotGranularity}
                onChange={(e) => setForm({ ...form, slotGranularity: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Default tidy-up time (minutes)"
            hint="Applied to services that do not set their own."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.defaultBuffer}
                onChange={(e) => setForm({ ...form, defaultBuffer: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Minimum notice (minutes)"
            hint={`Customers cannot book closer than this. Currently ${formatDuration(Number(form.leadTime) || 0)}.`}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.leadTime}
                onChange={(e) => setForm({ ...form, leadTime: e.target.value })}
              />
            )}
          </Field>

          <Field label="Book up to (days ahead)">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.horizon}
                onChange={(e) => setForm({ ...form, horizon: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Maximum appointments per day"
            hint="A hard stop, whatever the opening hours allow."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.dailyCap}
                onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
              />
            )}
          </Field>

          <Field label="Free cancellation window (hours)">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.cancellationWindow}
                onChange={(e) => setForm({ ...form, cancellationWindow: e.target.value })}
              />
            )}
          </Field>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            First-time customers
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Returning customers — anyone with a completed appointment — are always
            confirmed instantly. This decides what happens to everyone else.
          </p>

          <Checkbox
            label="Hold first-time bookings for my approval"
            checked={form.approveFirstTime}
            onChange={(e) => setForm({ ...form, approveFirstTime: e.target.checked })}
          />

          <Field
            label="Approval window (hours)"
            hint="The slot is held this long. If you have not answered, it is released and returns to sale automatically."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.approvalWindow}
                onChange={(e) => setForm({ ...form, approvalWindow: e.target.value })}
                disabled={!form.approveFirstTime}
              />
            )}
          </Field>

          {!form.approveFirstTime && (
            <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              With this off, every booking is confirmed the moment it is made. Faster for
              customers, but you lose the chance to vet a first-time booking.
            </p>
          )}

          <h2 className="mb-1 mt-6 font-display text-lg font-semibold text-foreground">
            Reviews
          </h2>
          <Field
            label="Google review link"
            hint="Sent to customers after a completed appointment."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="url"
                value={form.googleReviewUrl}
                onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                placeholder="https://g.page/r/…"
              />
            )}
          </Field>
        </Card>
      </div>

      {formError && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          Save settings
        </Button>
        {saved && (
          <span role="status" className="text-sm text-status-completed">
            Saved.
          </span>
        )}
      </div>
    </DashboardLayout>
  );
}
