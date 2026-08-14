import { useState } from 'react';
import { Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';

/**
 * `booking_settings.business_name` / `business_category` / `country`
 * (migration 0033) — real, owner-writable identity fields. Time zone stays
 * read-only here: this is a single UK salon, and every slot/lead-time
 * calculation in `book_appointment()` assumes `Europe/London` — letting the
 * owner change it would silently break booking math, not just a label.
 */
export function OrganisationDetailsCard(): JSX.Element {
  const { settings, update } = useBusinessSettings();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = (): void => {
    setName(settings?.business_name ?? '');
    setCategory(settings?.business_category ?? '');
    setCountry(settings?.country ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await update({
        business_name: name.trim() || 'Kokolett Beauty UK',
        business_category: category.trim() || 'Hair Salon',
        country: country.trim() || 'United Kingdom',
      });
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-primary text-primary">
            <Building2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Organisation details</h2>
            <p className="text-sm text-muted-foreground">Manage your salon business information.</p>
          </div>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" className="mb-0">
              {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Category" className="mb-0">
              {({ id }) => <Input id={id} value={category} onChange={(e) => setCategory(e.target.value)} />}
            </Field>
            <Field label="Country" className="mb-0">
              {({ id }) => <Input id={id} value={country} onChange={(e) => setCountry(e.target.value)} />}
            </Field>
            <Field label="Time zone" className="mb-0">
              {({ id }) => <Input id={id} value="London (GMT/BST)" disabled />}
            </Field>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Business name</p>
            <p className="text-sm text-foreground">{settings?.business_name ?? 'Kokolett Beauty UK'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <p className="text-sm text-foreground">{settings?.business_category ?? 'Hair Salon'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Country</p>
            <p className="text-sm text-foreground">{settings?.country ?? 'United Kingdom'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Time zone</p>
            <p className="text-sm text-foreground">London (GMT/BST)</p>
          </div>
        </div>
      )}
    </Card>
  );
}
