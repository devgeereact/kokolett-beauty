import { type JSX, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';

interface SalonForm {
  addressLine: string;
  phone: string;
  instagramUrl: string;
}

/** Blank is fine (the field is optional) — otherwise it must actually be an Instagram link. */
function instagramProblem(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed)) return 'Must start with https://';
  if (!/instagram\.com/i.test(trimmed)) return 'Must be an instagram.com link';
  return null;
}

/** Address/phone/Instagram — shown in the website footer and every customer email. */
export function SalonDetailsCard(): JSX.Element {
  const { settings, loading, update, error: loadError, refresh } = useBusinessSettings();
  const [form, setForm] = useState<SalonForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instagramError, setInstagramError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      addressLine: settings.address_line ?? '',
      phone: settings.phone ?? '',
      instagramUrl: settings.instagram_url ?? '',
    });
  }, [settings]);

  if (loading) {
    return (
      <Card className="flex h-full items-center justify-center p-5">
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
      <Card className="p-5">
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
    const problem = instagramProblem(form.instagramUrl);
    if (problem) {
      setInstagramError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await update({
        address_line: form.addressLine.trim() || null,
        phone: form.phone.trim() || null,
        instagram_url: form.instagramUrl.trim() || null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex h-full flex-col justify-center p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
          <MapPin aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </span>
        <h2 className="font-serif text-base font-semibold text-foreground">
          Salon Details
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Shown on your website footer and at the bottom of customer emails.
      </p>
      <Field label="Address" hint="Leave blank if you would rather not publish it.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={form.addressLine}
            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
            placeholder="12 Example Street, Town, AB1 2CD"
          />
        )}
      </Field>
      <Field label="Phone number" hint="Customers can tap this to call you.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="07700 900123"
          />
        )}
      </Field>
      <Field
        label="Instagram"
        hint="Add the full link to your Instagram profile."
        error={instagramError}
      >
        {({ controlProps }) => (
          <Input
            {...controlProps}
            type="url"
            value={form.instagramUrl}
            onChange={(e) => {
              setInstagramError(null);
              setForm({ ...form, instagramUrl: e.target.value });
            }}
            placeholder="https://www.instagram.com/yourname"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
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
