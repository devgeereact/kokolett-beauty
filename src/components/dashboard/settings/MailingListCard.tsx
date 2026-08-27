import { type JSX, useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { listSubscribers, unsubscribeSubscriber } from '@/services/subscriberService';
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
  const [pendingRemove, setPendingRemove] = useState<Subscriber | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setSubscribers(await listSubscribers());
    } catch {
      setSubscribers([]);
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

      <ConfirmDialog
        open={pendingRemove !== null}
        title={
          pendingRemove
            ? `Remove ${pendingRemove.full_name ?? pendingRemove.email} from the list?`
            : ''
        }
        message="They will stop receiving updates. They would need to sign up again to rejoin."
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
