import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { ShareLink } from '@/components/dashboard/ShareLink';
import { useToast } from '@/context/ToastContext';
import {
  createCalendarFeed,
  listCalendarFeeds,
  revokeCalendarFeed,
  webcalUrl,
} from '@/services/calendarFeedService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { CalendarFeed } from '@/types';

/**
 * Subscribe the owner's own calendar to the salon diary.
 *
 * Two things are said plainly here rather than buried, because getting either
 * wrong costs the owner something real:
 *
 *   * The link is a password. Anyone who has it can read every customer's
 *     name, email and phone number, and there is no second factor to stop
 *     them. It gets shown once and can be revoked.
 *
 *   * It is not live. No calendar client streams; they poll. Apple honours the
 *     fifteen-minute hint the feed sends, Google ignores it and refreshes on
 *     its own schedule. Promising "realtime" here would mean the owner trusts
 *     a phone screen that can be hours stale, which is worse than her knowing
 *     to open the dashboard when it matters.
 */
export function CalendarSubscription(): JSX.Element {
  const { showToast } = useToast();
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [label, setLabel] = useState('My phone');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<CalendarFeed | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setFeeds(await listCalendarFeeds());
    } catch {
      setFeeds([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (): Promise<void> => {
    setCreating(true);
    setError(null);
    try {
      const feed = await createCalendarFeed(label);
      setFresh(feed.url);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (feed: CalendarFeed): Promise<void> => {
    try {
      await revokeCalendarFeed(feed.id);
      if (fresh) setFresh(null);
      await load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  return (
    <>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Your calendar
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Subscribe your phone or laptop calendar to the salon diary, so bookings show up
        beside everything else in your week without opening this dashboard.
      </p>

      {fresh && (
        <div className="mb-5 rounded-lg border border-primary p-4">
          <p className="mb-1 text-sm font-semibold text-foreground">
            Here is your link. Copy it now.
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            This is the only time it is shown. Close this page and it is gone for good,
            and you will need to make a new one.
          </p>
          <ShareLink
            label="Calendar subscription"
            hint="On iPhone or Mac, tap Subscribe. In Google Calendar, choose Other calendars, then From URL."
            url={fresh}
          />
          <p>
            <a
              href={webcalUrl(fresh)}
              className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Add to my calendar
            </a>
          </p>
        </div>
      )}

      {feeds.length > 0 && (
        <ul className="mb-5 divide-y divide-border border-y border-border">
          {feeds.map((feed) => (
            <li key={feed.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {feed.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {feed.last_fetched_at
                    ? `Last checked ${formatDateTime(feed.last_fetched_at)} · ${feed.fetch_count} times`
                    : 'Not checked yet. Your calendar app will fetch it shortly after you subscribe.'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPendingRevoke(feed)}>
                Stop it working
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Field
        label="What is this link for?"
        hint="A name for your own benefit, so you know which one to stop if you lose a device."
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My phone"
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button loading={creating} onClick={() => void create()}>
        {feeds.length > 0 ? 'Make another link' : 'Make my calendar link'}
      </Button>

      <div className="mt-5 space-y-2 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Treat it like a password.</span>{' '}
          Anyone with this link can see your customers&rsquo; names, emails and phone
          numbers. Do not post it anywhere public. If it gets out, stop it working and
          make a new one.
        </p>
        <p>
          <span className="font-semibold text-foreground">It is not instant.</span> Your
          calendar app decides how often to check. iPhone and Mac can be set to every five
          minutes; Google Calendar refreshes on its own schedule and can take a few hours.
          For anything time-critical, this dashboard is the truth.
        </p>
      </div>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title={pendingRevoke ? `Stop "${pendingRevoke.label}" from working?` : ''}
        message="Any calendar using this link will stop updating, and you cannot switch it back on."
        tone="destructive"
        confirmLabel="Stop it working"
        onConfirm={() => {
          if (!pendingRevoke) return;
          const feed = pendingRevoke;
          setPendingRevoke(null);
          void revoke(feed);
        }}
        onCancel={() => setPendingRevoke(null)}
      />
    </>
  );
}
