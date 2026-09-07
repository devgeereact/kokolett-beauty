import { type JSX, useCallback, useEffect, useState } from 'react';
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
import { CardHeading } from '@/components/ui/Card';

/**
 * Subscribe the owner's own calendar to the salon diary.
 *
 * Two things are true here even though the card no longer spells them out in
 * body copy (trimmed to keep this compact once it sits under Business
 * Settings): the link is a password — anyone who has it can read every
 * customer's name, email and phone number, so it is shown once and can be
 * revoked — and it is not live, since no calendar client streams, they poll
 * on their own schedule.
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
      <CardHeading
        size="compact"
        title="Your Calendar"
        description="Subscribe to your salon diary so appointments appear alongside your personal calendar."
      />

      <div>
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
          label="Calendar name"
          hint="A name for your own reference, so you know which calendar subscription belongs to which device."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. iPhone calendar"
            />
          )}
        </Field>

        {error && (
          <p role="alert" className="mb-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button loading={creating} onClick={() => void create()}>
          Create calendar link
        </Button>
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
