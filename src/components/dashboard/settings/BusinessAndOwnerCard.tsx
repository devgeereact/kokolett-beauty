import { type JSX, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabase';
import { formatDateLong } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { AccountSecuritySection } from '@/components/dashboard/settings/AccountSecurityCard';

/**
 * Salon identity and how to reach its owner — one card, one edit. There is
 * no separate "owner name" here: the business name already identifies who's
 * running the salon, so a second personal-name field would just repeat it.
 * `booking_settings.phone` doubles as both the salon's public contact number
 * and the owner's own, since this is a single-owner business — one number,
 * shown once. Time zone stays read-only: this is a single UK salon, and
 * every slot/lead-time calculation in `book_appointment()` assumes
 * `Europe/London` — letting the owner change it would silently break
 * booking math, not just a label.
 */
export function BusinessAndOwnerCard(): JSX.Element {
  const { user } = useSupabaseAuth();
  const { settings, update } = useBusinessSettings();
  const [editing, setEditing] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = (): void => {
    setBusinessName(settings?.business_name ?? '');
    setCategory(settings?.business_category ?? '');
    setCountry(settings?.country ?? '');
    setPhone(settings?.phone ?? '');
    setEmail(user?.email ?? '');
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await update({
        business_name: businessName.trim() || 'Kokolett Beauty UK',
        business_category: category.trim() || 'Hair Salon',
        country: country.trim() || 'United Kingdom',
        phone: phone.trim() || null,
      });

      const trimmedEmail = email.trim();
      let emailChangeRequested = false;
      if (trimmedEmail && trimmedEmail !== user?.email) {
        const { error: err } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (err) throw err;
        emailChangeRequested = true;
      }

      setSaved(true);
      if (!emailChangeRequested) setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex h-full flex-col justify-center p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">
            Business &amp; Owner
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your salon and owner information.
          </p>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Business name" className="mb-0">
              {({ id }) => (
                <Input
                  id={id}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Category" className="mb-0">
              {({ id }) => (
                <Input
                  id={id}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              )}
            </Field>
            <Field label="Country" className="mb-0">
              {({ id }) => (
                <Input
                  id={id}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              )}
            </Field>
            <Field label="Time zone" className="mb-0">
              {({ id }) => <Input id={id} value="London (GMT/BST)" disabled />}
            </Field>
            <Field
              label="Contact Number"
              hint="Customers can tap this to call you."
              className="mb-0"
            >
              {({ id }) => (
                <Input
                  id={id}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07700 900123"
                />
              )}
            </Field>
            <Field
              label="Email"
              hint="Changing this sends a confirmation link to both the old and new address."
              className="mb-0"
            >
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="mt-3 text-sm text-status-completed">
              Saved.
              {email.trim() !== user?.email
                ? ' Check both inboxes to confirm the new email.'
                : ''}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {saved ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Business name</p>
            <p className="text-base text-foreground">
              {settings?.business_name ?? 'Kokolett Beauty UK'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <p className="text-base text-foreground">
              {settings?.business_category ?? 'Hair Salon'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Country</p>
            <p className="text-base text-foreground">
              {settings?.country ?? 'United Kingdom'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Time zone</p>
            <p className="text-base text-foreground">London (GMT/BST)</p>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium text-muted-foreground">Email</p>
            <p className="truncate text-base text-foreground">{user?.email}</p>
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium text-muted-foreground">Contact Number</p>
            <p className="text-base text-foreground">{settings?.phone ?? '—'}</p>
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium text-muted-foreground">Member since</p>
            <p className="text-base text-foreground">
              {user?.created_at ? formatDateLong(user.created_at) : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <AccountSecuritySection />
      </div>
    </Card>
  );
}
