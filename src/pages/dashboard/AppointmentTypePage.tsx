import { type JSX, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarCapacityTabs } from '@/components/dashboard/CalendarCapacityTabs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useServices } from '@/hooks/useServices';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { updateService } from '@/services/serviceCatalogService';
import { errorMessage } from '@/lib/errors';
import { formatDuration, parseMoney } from '@/lib/format';

/**
 * The one appointment type.
 *
 * The catalogue is gone: since 0011 there is a single "Hair Appointment" and
 * every slot is one of them. This screen sets its length and price, which is
 * all that is left to decide — what a customer actually wants arrives as a note
 * on the booking and is settled in the chair.
 *
 * Length matters more than it looks. It decides how much of the calendar an
 * appointment occupies, so two published times closer together than this can
 * never both be taken.
 */
export function AppointmentTypePage(): JSX.Element {
  const { services, loading, error, refresh } = useServices(true);
  const { settings } = useBusinessSettings();

  const appointment = services[0];
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration: '',
    price: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment) return;
    setForm({
      name: appointment.name,
      description: appointment.description ?? '',
      duration: String(appointment.duration_min),
      price:
        appointment.price_pence > 0 ? (appointment.price_pence / 100).toFixed(2) : '',
    });
  }, [appointment]);

  if (loading) {
    return (
      <DashboardLayout title="Appointment type">
        <CalendarCapacityTabs />
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (error || !appointment) {
    return (
      <DashboardLayout title="Appointment type">
        <CalendarCapacityTabs />
        <ErrorState
          error={error ?? new Error('No appointment type found.')}
          onRetry={() => void refresh()}
        />
      </DashboardLayout>
    );
  }

  const save = async (): Promise<void> => {
    const duration = Number(form.duration);
    if (!form.name.trim()) return setFormError('Give the appointment a name.');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
      return setFormError('Length must be between 1 and 600 minutes.');
    }

    const pricePence = form.price.trim() === '' ? 0 : parseMoney(form.price);
    if (pricePence === null)
      return setFormError('Enter a price like 45 or 45.50, or leave it blank.');

    setSaving(true);
    setFormError(null);
    try {
      await updateService(appointment.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_min: duration,
        price_pence: pricePence,
      });
      await refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const granularity = settings?.slot_granularity_min ?? 15;
  const duration = Number(form.duration) || 0;

  return (
    <DashboardLayout
      title="Appointment type"
      subtitle="One appointment type. Every time you publish is one of these"
    >
      <CalendarCapacityTabs />

      <div className="max-w-xl">
        <Card pad="standard">
          <Field label="What it is called" required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="How long it takes"
            required
            hint={
              duration > 0
                ? `${formatDuration(duration)}. Times published closer together than this cannot both be booked.`
                : 'In minutes.'
            }
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Price (£)"
            hint="Leave blank if it depends on what the customer wants. Most salons settle this in person."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="Leave blank for 'from consultation'"
              />
            )}
          </Field>

          <Field label="Description" hint="Shown on the booking page.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>

          {formError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button loading={saving} onClick={() => void save()}>
              Save
            </Button>
            {saved && (
              <span role="status" className="text-sm text-status-completed">
                Saved.
              </span>
            )}
          </div>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          Times can be published on any {granularity}-minute boundary. Customers say what
          they are after in a note when they book, so you do not need a menu of services,
          just this one appointment and the times you are free.
        </p>
      </div>
    </DashboardLayout>
  );
}
