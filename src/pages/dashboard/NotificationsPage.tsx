import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Mail, PartyPopper, Smartphone, Tag } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardHeading } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { Switch } from '@/components/ui/Switch';
import { ErrorState, LoadingState, EmptyState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useNotificationReadState } from '@/hooks/useNotificationReadState';
import {
  getNotifications,
  type NotificationEvent,
} from '@/services/notificationsService';
import {
  CATEGORY_LABELS,
  metaFor,
  type NotificationCategory,
} from '@/lib/notificationCategory';
import { TONE_BG, TONE_TEXT } from '@/lib/tone';
import { formatDateTime, formatRelative, toSalonDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { filterBar, filterCount, filterTab } from '@/components/ui/controlClasses';

type Lane = 'all' | 'unread' | 'archived';
const PAGE_SIZE = 8;

const PREFS_KEY = 'kokolett-notification-preferences';
interface Prefs {
  email: boolean;
  push: boolean;
  bookingReminders: boolean;
  marketing: boolean;
}
const DEFAULT_PREFS: Prefs = {
  email: true,
  push: true,
  bookingReminders: true,
  marketing: false,
};

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw
      ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
      : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/** "Today" / "Yesterday" / a weekday name / a date — the same buckets the reference groups by. */
function groupLabel(iso: string, timezone: string): string {
  const day = toSalonDate(iso, timezone);
  const today = toSalonDate(new Date(), timezone);
  const yesterday = toSalonDate(new Date(Date.now() - 86_400_000), timezone);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const daysAgo = Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  if (daysAgo <= 7) return 'Earlier this week';
  return 'Earlier';
}

/**
 * Real activity (bookings, payments, reviews, waitlist requests), rebuilt
 * onto `docs/design/notification.png`'s grouped/filterable layout. There is
 * still no stored notifications table — read/archived state and delivery
 * preferences live in `localStorage` (`useNotificationReadState`, `Prefs`
 * below), genuinely functional per-browser rather than a fabricated toggle
 * that does nothing.
 */
export function NotificationsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const { isRead, isArchived, markRead, markAllRead, archive } =
    useNotificationReadState();

  const load = useCallback((): void => {
    setError(null);
    getNotifications(timezone)
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [timezone]);

  useEffect(load, [load]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preference just won't persist across reloads.
    }
  }, [prefs]);

  const withMeta = useMemo(
    () => (events ?? []).map((e) => ({ event: e, meta: metaFor(e.kind) })),
    [events],
  );

  const unreadCount = withMeta.filter(
    (e) => !isArchived(e.event.id) && !isRead(e.event.id),
  ).length;

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      booking: 0,
      payment: 0,
      review: 0,
      customer: 0,
      system: 0,
    };
    for (const { event, meta } of withMeta) {
      if (isArchived(event.id)) continue;
      counts[meta.category] += 1;
    }
    return counts;
  }, [withMeta, isArchived]);

  const filtered = useMemo(() => {
    return withMeta.filter(({ event, meta }) => {
      const archivedRow = isArchived(event.id);
      if (lane === 'archived' && !archivedRow) return false;
      if (lane !== 'archived' && archivedRow) return false;
      if (lane === 'unread' && isRead(event.id)) return false;
      if (categoryFilter !== 'all' && meta.category !== categoryFilter) return false;
      return true;
    });
  }, [withMeta, lane, categoryFilter, isArchived, isRead]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof pageItems>();
    for (const item of pageItems) {
      const label = groupLabel(item.event.at, timezone);
      const list = groups.get(label) ?? [];
      list.push(item);
      groups.set(label, list);
    }
    return [...groups.entries()];
  }, [pageItems, timezone]);

  const allIds = withMeta.map((e) => e.event.id);

  if (error) {
    return (
      <DashboardLayout title="Notifications">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={
        <span className="flex items-center gap-2">
          Notifications
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </span>
      }
      subtitle="Stay updated with your business activity."
    >
      {!events ? (
        <LoadingState label="Gathering recent activity…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="Filter notifications" className={filterBar}>
                {(
                  [
                    [
                      'all',
                      'All',
                      withMeta.filter((e) => !isArchived(e.event.id)).length,
                    ],
                    ['unread', 'Unread', unreadCount],
                    [
                      'archived',
                      'Archived',
                      withMeta.filter((e) => isArchived(e.event.id)).length,
                    ],
                  ] as [Lane, string, number][]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setLane(key);
                      setPage(1);
                    }}
                    aria-pressed={lane === key}
                    className={filterTab(lane === key)}
                  >
                    {label}
                    <span className={filterCount(lane === key)}>{count}</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => markAllRead(allIds)}>
                <CheckCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                Mark all as read
              </Button>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title={lane === 'archived' ? 'Nothing archived' : 'Nothing here'}
                description="New bookings, payments, reviews and requests will show up here as they happen."
              />
            ) : (
              <div className="space-y-6">
                {grouped.map(([label, items]) => (
                  <div key={label}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <Card className="divide-y divide-border">
                      {items.map(({ event, meta }) => {
                        const read = isRead(event.id);
                        return (
                          <div
                            key={event.id}
                            onClick={() => !read && markRead(event.id)}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 p-4 hover:bg-muted',
                              !read && 'bg-tint-brand',
                            )}
                          >
                            <span
                              className={cn(
                                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
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
                                {event.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {event.detail}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className="whitespace-nowrap text-xs text-muted-foreground"
                                title={formatDateTime(event.at, timezone)}
                              >
                                {formatRelative(event.at)}
                              </span>
                              {!read ? (
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 rounded-full bg-primary"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 rounded-full bg-transparent"
                                />
                              )}
                              {lane !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archive(event.id);
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  Archive
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalItems={filtered.length}
                onPageChange={setPage}
                itemLabel="notifications"
              />
            </div>
          </div>

          <div className="space-y-6">
            <Card pad="standard">
              <CardHeading size="compact" title="Filter notifications" />
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
                    categoryFilter === 'all'
                      ? 'bg-tint-brand text-brand-ink'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  All notifications
                  <span>{Object.values(categoryCounts).reduce((a, b) => a + b, 0)}</span>
                </button>
                {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
                      categoryFilter === cat
                        ? 'bg-tint-brand text-brand-ink'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                    <span>{categoryCounts[cat]}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card pad="standard">
              <CardHeading
                size="compact"
                title="Notification preferences"
                description="Choose how you want to be notified."
              />
              <div className="space-y-4">
                {[
                  {
                    key: 'email' as const,
                    icon: Mail,
                    label: 'Email notifications',
                    desc: 'Receive updates via email',
                  },
                  {
                    key: 'push' as const,
                    icon: Bell,
                    label: 'Push notifications',
                    desc: 'Get instant push notifications',
                  },
                  {
                    key: 'bookingReminders' as const,
                    icon: Smartphone,
                    label: 'Booking reminders',
                    desc: 'Reminders for upcoming appointments',
                  },
                  {
                    key: 'marketing' as const,
                    icon: Tag,
                    label: 'Marketing & offers',
                    desc: 'Receive offers and promotions',
                  },
                ].map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <row.icon
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={prefs[row.key]}
                      onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))}
                      aria-label={row.label}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card pad="standard" className="bg-tint-pending">
              <p className="mb-1 flex items-center gap-1.5 font-serif text-base font-semibold text-foreground">
                {unreadCount === 0 ? (
                  <>
                    You're all caught up!{' '}
                    <PartyPopper aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </>
                ) : (
                  'Stay on top of things'
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {unreadCount === 0
                  ? 'No unread notifications right now.'
                  : `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
              </p>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
