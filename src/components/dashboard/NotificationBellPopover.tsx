import { type JSX, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import {
  getNotifications,
  type NotificationEvent,
} from '@/services/notificationsService';
import { useNotificationReadState } from '@/hooks/useNotificationReadState';
import { metaFor } from '@/lib/notificationCategory';
import { TONE_BG, TONE_TEXT } from '@/lib/tone';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * The header bell, as a popover rather than a link to the full Notifications
 * page — a glance at what's new without leaving whatever screen the owner is
 * on. "Mark all as read" here writes the same `localStorage` read-state the
 * full page uses (`useNotificationReadState`), so opening the real page
 * afterwards shows the same caught-up state.
 */
export function NotificationBellPopover({
  timezone,
  badgeCount,
}: {
  timezone: string;
  badgeCount: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const { isRead, isArchived, markAllRead } = useNotificationReadState();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || events) return;
    getNotifications(timezone)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [open, events, timezone]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const visible = (events ?? []).filter((e) => !isArchived(e.id)).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-lg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-layer-popover w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover shadow-popover">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="font-serif text-sm font-semibold text-foreground">
              Notifications
            </p>
            <button
              type="button"
              onClick={() => markAllRead((events ?? []).map((e) => e.id))}
              className="flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline"
            >
              <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!events ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing new.</p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((e) => {
                  const meta = metaFor(e.kind);
                  const read = isRead(e.id);
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        'flex items-start gap-3 p-3',
                        !read && 'bg-tint-brand',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          TONE_BG[meta.tone],
                        )}
                      >
                        <meta.icon
                          aria-hidden="true"
                          className={cn('h-4 w-4', TONE_TEXT[meta.tone])}
                          strokeWidth={2}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {e.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.detail}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelative(e.at)}
                        </p>
                      </div>
                      {!read && (
                        <span
                          aria-hidden="true"
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to={routes.owner.notifications}
            onClick={() => setOpen(false)}
            className="block border-t border-border p-3 text-center text-sm font-medium text-brand-ink hover:underline"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
