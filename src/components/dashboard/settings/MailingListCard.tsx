import { type JSX, useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import {
  listSubscribers,
  listUnsubscribed,
  resubscribeSubscriber,
  unsubscribeSubscriber,
} from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { formatDateShort } from '@/lib/format';
import type { Subscriber } from '@/types';

/**
 * Customers who have subscribed through the mailing-list link. Only the
 * minimum needed to manage the list is shown — name, email, when, and
 * status — never `source` or the row's internal id.
 */
export function MailingListCard(): JSX.Element {
  const { showToast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [unsubscribed, setUnsubscribed] = useState<Subscriber[]>([]);
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Subscriber | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [active, off] = await Promise.all([listSubscribers(), listUnsubscribed()]);
      setSubscribers(active);
      setUnsubscribed(off);
    } catch {
      setSubscribers([]);
      setUnsubscribed([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (subscriber: Subscriber): Promise<void> => {
    try {
      await unsubscribeSubscriber(subscriber.id);
      await load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const addBack = async (subscriber: Subscriber): Promise<void> => {
    try {
      await resubscribeSubscriber(subscriber.id);
      await load();
      showToast({
        message: `${subscriber.full_name ?? subscriber.email} is back on the list.`,
      });
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  return (
    <Card className="flex h-full flex-col p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Mailing List
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Customers who have subscribed through your mailing-list link.
      </p>

      <div className="flex flex-1 flex-col justify-center">
        {subscribers === null ? (
          <LoadingState label="Loading…" />
        ) : subscribers.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-foreground">
              Nobody has subscribed yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your mailing-list link to start building your audience.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {subscribers.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.full_name ?? s.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.email} · {formatDateShort(s.created_at)} ·{' '}
                    {s.confirmed ? 'Confirmed' : 'Pending'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPendingRemove(s)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        Who has opted out, and the one way back onto the list.

        Since `0071` the public sign-up form no longer clears an unsubscribe:
        letting it meant anyone who knew an address could put its owner back
        into the newsletter audience. That makes this panel the re-consent
        path, and it is deliberately a person deciding about a named
        individual rather than an anonymous endpoint clearing a flag.
      */}
      {unsubscribed.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            aria-expanded={showUnsubscribed}
            onClick={() => setShowUnsubscribed((v) => !v)}
            className="min-h-touch text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showUnsubscribed ? 'Hide' : 'Show'} {unsubscribed.length} who opted out
          </button>

          {showUnsubscribed && (
            <ul className="mt-2 divide-y divide-border">
              {unsubscribed.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-muted-foreground">
                      {s.full_name ?? s.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.email}
                      {s.unsubscribed_at
                        ? ` · opted out ${formatDateShort(s.unsubscribed_at)}`
                        : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void addBack(s)}>
                    Add back
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Only add somebody back if they have asked you to. Signing up again on the
            website will not do it for them.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title={
          pendingRemove
            ? `Remove ${pendingRemove.full_name ?? pendingRemove.email} from the list?`
            : ''
        }
        message="They will stop receiving updates. Signing up again on the website will not put them back: only you can, from the list of people who opted out."
        tone="destructive"
        confirmLabel="Remove"
        onConfirm={() => {
          if (!pendingRemove) return;
          const subscriber = pendingRemove;
          setPendingRemove(null);
          void remove(subscriber);
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </Card>
  );
}
