import { useCallback, useEffect, useState } from 'react';
import { CalendarSubscription } from '@/components/dashboard/CalendarSubscription';
import { ShareLink } from '@/components/dashboard/ShareLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { listSubscribers } from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { Subscriber } from '@/types';

const SITE = 'https://www.kokolettbeauty.com';

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
  googlePlaceId: string;
  instagramUrl: string;
  addressLine: string;
  phone: string;
}

/**
 * How the salon runs online — booking rules `book_appointment()` actually
 * enforces, contact details shown to customers, review wiring, and the
 * share links / mailing list. This is the old page's "Salon details" +
 * "Booking rules" + "Reviews" + "Your links" tabs folded into the one
 * `settings.png`-shaped "Business" tab.
 */
export function BusinessTabContent(): JSX.Element {
  const { settings, loading, update } = useBusinessSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);

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
      googlePlaceId: settings.google_place_id ?? '',
      instagramUrl: settings.instagram_url ?? '',
      addressLine: settings.address_line ?? '',
      phone: settings.phone ?? '',
    });
  }, [settings]);

  const loadSubscribers = useCallback(async (): Promise<void> => {
    try {
      setSubscribers(await listSubscribers());
    } catch {
      setSubscribers([]);
    }
  }, []);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  if (loading || !form) return <LoadingState />;

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
        google_place_id: form.googlePlaceId.trim() || null,
        instagram_url: form.instagramUrl.trim() || null,
        address_line: form.addressLine.trim() || null,
        phone: form.phone.trim() || null,
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
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
            Salon details
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Shown in your website footer and at the bottom of every email a customer gets.
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
          <Field label="Instagram" hint="The full link to your profile.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="url"
                value={form.instagramUrl}
                onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
                placeholder="https://www.instagram.com/yourname"
              />
            )}
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
            Booking rules
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Enforced by the database, so these apply even to a booking page someone
            already had open.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="Book up to (days)">
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={form.horizon}
                  onChange={(e) => setForm({ ...form, horizon: e.target.value })}
                />
              )}
            </Field>
            <Field label="Max per day">
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={form.dailyCap}
                  onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
                />
              )}
            </Field>
            <Field label="Free cancellation (h)">
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={form.cancellationWindow}
                  onChange={(e) =>
                    setForm({ ...form, cancellationWindow: e.target.value })
                  }
                />
              )}
            </Field>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <Checkbox
              label="Hold first-time bookings for my approval"
              checked={form.approveFirstTime}
              onChange={(e) => setForm({ ...form, approveFirstTime: e.target.checked })}
            />
            <Field
              label="Approval window (hours)"
              hint="Held this long, then released back to sale automatically."
            >
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={form.approvalWindow}
                  onChange={(e) => setForm({ ...form, approvalWindow: e.target.value })}
                  disabled={!form.approveFirstTime}
                />
              )}
            </Field>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
            Google reviews
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The link is where you send customers; the Place ID lets your reviews appear on
            your website.
          </p>
          <Field
            label="Google review link"
            hint="Sent automatically after an appointment is completed."
          >
            {({ id }) => (
              <Input
                id={id}
                type="url"
                value={form.googleReviewUrl}
                onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                placeholder="https://g.page/r/…"
              />
            )}
          </Field>
          <Field label="Google Place ID" hint="Starts with ChIJ.">
            {({ id }) => (
              <Input
                id={id}
                value={form.googlePlaceId}
                onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })}
                placeholder="ChIJ…"
              />
            )}
          </Field>
        </Card>

        <Card className="p-5">
          <CalendarSubscription />
        </Card>
      </div>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          Save business settings
        </Button>
        {saved && (
          <span role="status" className="text-sm text-status-completed">
            Saved.
          </span>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
            Links to share
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Paste these into your Instagram bio, a story, or a WhatsApp reply.
          </p>
          <ShareLink
            label="Book an appointment"
            hint="Goes straight to the times you have open."
            url={`${SITE}${routes.public.book}`}
          />
          <ShareLink
            label="Join my mailing list"
            hint="Name and email only."
            url={`${SITE}${routes.public.subscribe}`}
          />
          <ShareLink
            label="Ask for a time"
            hint="For when nothing on the calendar suits them."
            url={`${SITE}${routes.public.requestAvailability}`}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
            Mailing list
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Everyone who signed up through your link.
          </p>
          {subscribers === null ? (
            <LoadingState label="Counting…" />
          ) : subscribers.length === 0 ? (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Nobody yet. Share the link and they will appear here.
            </p>
          ) : (
            <>
              <p className="font-serif text-3xl font-semibold text-foreground">
                {subscribers.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscribers.length === 1 ? 'person' : 'people'} on the list
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
