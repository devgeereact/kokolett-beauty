import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useServices } from '@/hooks/useServices';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  archiveService,
  createService,
  slugify,
  updateService,
} from '@/services/serviceCatalogService';
import { errorMessage } from '@/lib/errors';
import { formatDuration, formatMoney, parseMoney } from '@/lib/format';
import type { Service } from '@/types';

interface FormState {
  name: string;
  categoryId: string;
  description: string;
  durationMin: string;
  bufferMin: string;
  price: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: '',
  categoryId: '',
  description: '',
  durationMin: '60',
  bufferMin: '',
  price: '',
  isActive: true,
};

function toForm(service: Service, defaultBuffer: number): FormState {
  return {
    name: service.name,
    categoryId: service.category_id ?? '',
    description: service.description ?? '',
    durationMin: String(service.duration_min),
    bufferMin: service.buffer_min === defaultBuffer ? '' : String(service.buffer_min),
    price: (service.price_pence / 100).toFixed(2),
    isActive: service.is_active,
  };
}

/**
 * The service catalogue.
 *
 * Nothing is bookable until this page has rows: `book_appointment()` reads
 * duration, buffer and price from the service, so an empty catalogue means an
 * empty booking flow. It is the first screen the owner has to complete.
 */
export function ServicesPage(): JSX.Element {
  const { services, categories, loading, error, refresh } = useServices(true);
  const { settings } = useBusinessSettings();
  const defaultBuffer = settings?.default_buffer_min ?? 10;

  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = (): void => {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY);
    setFormError(null);
  };

  const openEdit = (service: Service): void => {
    setCreating(false);
    setEditing(service);
    setForm(toForm(service, defaultBuffer));
    setFormError(null);
  };

  const close = (): void => {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  };

  const save = async (): Promise<void> => {
    const name = form.name.trim();
    const duration = Number(form.durationMin);
    const pricePence = parseMoney(form.price);

    if (!name) return setFormError('Give the service a name.');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
      return setFormError('Duration must be between 1 and 600 minutes.');
    }
    if (pricePence === null) {
      return setFormError('Enter a price like 45 or 45.50.');
    }

    const buffer = form.bufferMin.trim() === '' ? defaultBuffer : Number(form.bufferMin);
    if (!Number.isFinite(buffer) || buffer < 0) {
      return setFormError('Tidy-up time must be zero or more minutes.');
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name,
        category_id: form.categoryId || null,
        description: form.description.trim() || null,
        duration_min: duration,
        buffer_min: buffer,
        price_pence: pricePence,
        is_active: form.isActive,
      };

      if (editing) {
        await updateService(editing.id, payload);
      } else {
        // The slug is only generated on create. Changing it later would break
        // any link a customer has already been sent.
        await createService({ ...payload, slug: slugify(name) });
      }
      await refresh();
      close();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (service: Service): Promise<void> => {
    if (
      !window.confirm(
        `Remove “${service.name}” from the catalogue?\n\nExisting appointments keep it, and it stops being bookable.`,
      )
    ) {
      return;
    }
    try {
      await archiveService(service.id);
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const showForm = creating || editing !== null;

  return (
    <DashboardLayout
      title="Services"
      subtitle="What customers can book, how long it takes, and what it costs"
      actions={
        !showForm ? (
          <Button size="sm" onClick={openCreate}>
            Add service
          </Button>
        ) : undefined
      }
    >
      {showForm && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            {editing ? `Edit ${editing.name}` : 'New service'}
          </h2>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Name" required>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Cut and blow dry"
                />
              )}
            </Field>

            <Field label="Category">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Chair time (minutes)"
              required
              hint="How long you are with the client."
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="numeric"
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="Tidy-up time (minutes)"
              hint={`Reserved after the appointment. Blank uses the default of ${defaultBuffer}.`}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="numeric"
                  value={form.bufferMin}
                  onChange={(e) => setForm({ ...form, bufferMin: e.target.value })}
                  placeholder={String(defaultBuffer)}
                />
              )}
            </Field>

            <Field label="Price (£)" required hint="Stored to the penny.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="45.00"
                />
              )}
            </Field>

            <div className="sm:col-span-2">
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
            </div>
          </div>

          <Checkbox
            label="Bookable online"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />

          {formError && (
            <p role="alert" className="mb-4 text-sm font-medium text-destructive">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <Button loading={saving} onClick={() => void save()}>
              {editing ? 'Save changes' : 'Add service'}
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {loading && <LoadingState label="Loading services…" />}
      {error && <ErrorState error={error} onRetry={() => void refresh()} />}

      {!loading && !error && services.length === 0 && !showForm && (
        <EmptyState
          title="No services yet"
          description="Add your first service — customers cannot book anything until at least one exists."
          action={<Button onClick={openCreate}>Add service</Button>}
        />
      )}

      <div className="space-y-3">
        {services.map((service) => (
          <Card key={service.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{service.name}</p>
                {!service.is_active && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Hidden
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDuration(service.duration_min)}
                {service.buffer_min > 0 && ` + ${service.buffer_min}m tidy-up`} ·{' '}
                {formatMoney(service.price_pence)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void archive(service)}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
