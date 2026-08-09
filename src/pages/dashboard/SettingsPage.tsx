import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ShareLink } from '@/components/dashboard/ShareLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { listSubscribers } from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { Subscriber } from '@/types';

/**
 * Everything about how the salon runs online, in the order it matters.
 *
 * Grouped into four tabs rather than one long scroll. The old page put booking
 * arithmetic, the salon's address and a Google Place ID in the same column,
 * which meant the owner scrolled past six numbers she sets once a year to reach
 * the phone number she actually wanted to change.
 *
 * Every value in "Booking rules" is enforced inside `book_appointment()`, not
 * in the browser, so changing one here genuinely changes what can be booked,
 * including from a page a customer already has open.
 */

const TABS = [
  { key: 'share', label: 'Your links' },
  { key: 'salon', label: 'Salon details' },
  { key: 'booking', label: 'Booking rules' },
  { key: 'reviews', label: 'Reviews' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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

/** The live site, not wherever the dashboard happens to be open. */
const SITE = 'https://koko.gakinz.com';

export function SettingsPage(): JSX.Element {
  const { settings, loading, error, update, refresh } = useBusinessSettings();
  const [tab, setTab] = useState<TabKey>('share');
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
    <DashboardLayout title="Settings" subtitle="How the salon runs online">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Your links ------------------------------------------------- */}
      {tab === 'share' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Links to share
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Paste these into your Instagram bio, a story, or a WhatsApp reply. They work
              for anyone, with no account and no app.
            </p>

            <ShareLink
              label="Book an appointment"
              hint="The one to put in your bio. Goes straight to the times you have open."
              url={`${SITE}${routes.public.book}`}
            />
            <ShareLink
              label="Join my mailing list"
              hint="For people who are not ready to book. Name and email only."
              url={`${SITE}${routes.public.subscribe}`}
            />
            <ShareLink
              label="Ask for a time"
              hint="Send this when someone says nothing on the calendar suits them."
              url={`${SITE}${routes.public.requestAvailability}`}
            />
            {form.googleReviewUrl && (
              <ShareLink
                label="Leave a review"
                hint="Sent automatically after an appointment is completed. Handy to have for asking in person."
                url={form.googleReviewUrl}
              />
            )}
          </Card>

          <Card className="h-fit p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Mailing list
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Everyone who signed up through your link.
            </p>

            {subscribers === null ? (
              <LoadingState label="Counting…" />
            ) : subscribers.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Nobody yet. Share the link above and they will appear here.
              </p>
            ) : (
              <>
                <p className="font-display text-3xl font-semibold text-foreground">
                  {subscribers.length}
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  {subscribers.length === 1 ? 'person' : 'people'} on the list
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {subscribers.slice(0, 50).map((s) => (
                    <li key={s.id} className="truncate text-muted-foreground">
                      {s.full_name ? `${s.full_name} · ` : ''}
                      {s.email}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-4"
                  onClick={() =>
                    window.open(
                      `mailto:?bcc=${subscribers.map((s) => s.email).join(',')}`,
                      '_self',
                    )
                  }
                >
                  Email everyone
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Opens your mail app with everyone in Bcc, so no one sees anyone else&rsquo;s
                  address.
                </p>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ---- Salon details ---------------------------------------------- */}
      {tab === 'salon' && (
        <Card className="max-w-xl p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            Salon details
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            These appear in the footer of your website and at the bottom of every email a
            customer gets. Anything left blank is simply not shown.
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
      )}

      {/* ---- Booking rules ---------------------------------------------- */}
      {tab === 'booking' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Booking rules
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Enforced by the database, so these apply even to a booking page someone
              already had open.
            </p>

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
              label="Tidy-up time between appointments (minutes)"
              hint="Kept clear after every booking so you are not starting the next one late."
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

            <Field
              label="Book up to (days ahead)"
              hint="How far in advance the calendar goes."
            >
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
              hint="A hard stop, whatever times you have published."
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

            <Field
              label="Free cancellation window (hours)"
              hint="Printed in confirmation emails and on your booking policy page."
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="numeric"
                  value={form.cancellationWindow}
                  onChange={(e) =>
                    setForm({ ...form, cancellationWindow: e.target.value })
                  }
                />
              )}
            </Field>
          </Card>

          <Card className="h-fit p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              First-time customers
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Returning customers, meaning anyone with a completed appointment, are always
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
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                With this off, every booking is confirmed the moment it is made. Faster
                for customers, but you lose the chance to vet a first-time booking.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* ---- Reviews ----------------------------------------------------- */}
      {tab === 'reviews' && (
        <Card className="max-w-xl p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            Google reviews
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Two different things, and they are easy to mix up. The link is where you send
            customers; the Place ID is what lets your reviews appear on your own website.
          </p>

          <Field
            label="Google review link"
            hint="Sent to every customer a couple of hours after their appointment is marked complete."
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

          <Field
            label="Google Place ID"
            hint="Starts with ChIJ. Find it at developers.google.com/maps/documentation/places/web-service/place-id. The share link above is not the same thing and will not work here."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.googlePlaceId}
                onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })}
                placeholder="ChIJ…"
              />
            )}
          </Field>

          {!form.googlePlaceId && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Until this is filled in, the reviews section stays off your website
              entirely. An empty reviews panel is worse than none.
            </p>
          )}
        </Card>
      )}

      {formError && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      {tab !== 'share' && (
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
      )}
    </DashboardLayout>
  );
}
