import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ApprovalCard } from '@/components/dashboard/approvals/ApprovalCard';
import { ApprovalDetailPanel } from '@/components/dashboard/approvals/ApprovalDetailPanel';
import { ApprovalPolicyFooter } from '@/components/dashboard/approvals/ApprovalPolicyFooter';
import { ApprovalStats } from '@/components/dashboard/approvals/ApprovalStats';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import {
  RequestsQueue,
  type RequestsQueueHandle,
} from '@/components/dashboard/requests/RequestsQueue';
import { ContactMessagesQueue } from '@/components/dashboard/requests/ContactMessagesQueue';
import { countNewContactMessages } from '@/services/contactService';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useOwnerSummary } from '@/hooks/useOwnerSummary';
import {
  approveAppointment,
  getApprovalStats,
  listPendingApprovals,
  rejectAppointment,
  type ApprovalStats as ApprovalStatsData,
} from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

type Tab = 'approvals' | 'requests' | 'messages';

/**
 * Everything the owner needs to answer sits in one queue with two lanes.
 *
 * Approvals are first-time bookings that already hold a slot — the calendar
 * treats `pending_approval` as occupied, so the deadline on each card is the
 * important number: when it passes, `expire_pending_approvals()` releases the
 * slot automatically. Requests exist because nothing was open when someone
 * asked; they carry no deadline, only a queue position and how long they have
 * waited. Different urgency shapes, same mental job — "what needs an answer" —
 * so they share a page instead of two separate ones behind separate nav
 * entries.
 *
 * The active lane is a `?tab=` query param rather than its own route, since
 * this page owns both queues. `/dashboard/approvals` and `/dashboard/requests`
 * redirect here (see `src/App.tsx`) so old links and Today's stat cards still
 * land on the right tab.
 */
export function InboxPage(): JSX.Element {
  const { timezone, settings } = useBusinessSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // `useOwnerSummary` is the number the sidebar and Today's stat cards already
  // trust — it stays correct no matter which tab (if any) is mounted, so it
  // backstops the local, tab-gated state below rather than replacing it.
  const { summary, refresh: refreshSummary } = useOwnerSummary();

  const tabParam = new URLSearchParams(location.search).get('tab');
  const explicitTab: Tab | null =
    tabParam === 'requests'
      ? 'requests'
      : tabParam === 'approvals'
        ? 'approvals'
        : tabParam === 'messages'
          ? 'messages'
          : null;
  // Under the current policy Approvals is structurally always empty (see
  // `isDemo` below), so a bare `/dashboard/inbox` — no `?tab=` — should
  // land the owner on the queue she actually answers day to day. An explicit
  // `?tab=approvals` (e.g. a bookmark, or Today's own stat-card link) is
  // always honoured.
  //
  // `defaultTab` is chosen once, from the first `summary` value seen, and
  // then frozen. `summary` keeps updating after every approve/decline
  // (`refreshSummary()` runs inside `loadApprovals()` and
  // `handleRequestsCountChange`), so recomputing this on every render would
  // silently swap the visible tab out from under the owner mid-interaction
  // — e.g. approving the last pending item would flip a bare `/dashboard/inbox`
  // from Approvals to Requests with no click and no URL change. Freezing it
  // means the default is decided once, when the page first has enough
  // information to decide, and never revisited on its own afterwards.
  const [defaultTab, setDefaultTab] = useState<Tab | null>(null);
  useEffect(() => {
    if (defaultTab === null && summary) {
      setDefaultTab(summary.pending_approval_count === 0 ? 'requests' : 'approvals');
    }
  }, [summary, defaultTab]);
  const tab: Tab = explicitTab ?? defaultTab ?? 'approvals';

  const goToTab = (next: Tab): void => {
    void navigate(`${routes.owner.inbox}?tab=${next}`);
  };

  // Approvals queue — moved from the former ApprovalsPage.
  const [rows, setRows] = useState<AppointmentDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<ApprovalStatsData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Same "take a booking on the owner's behalf" entry point every other
  // dashboard page carries in its header — walk-ins and phone bookings can
  // happen while the owner is triaging this queue, not just from Today.
  const [booking, setBooking] = useState(false);

  const loadApprovals = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [approvals, approvalStats] = await Promise.all([
        listPendingApprovals(),
        getApprovalStats(),
      ]);
      setRows(approvals);
      setStats(approvalStats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
    // Keep the summary — the fallback for the inactive tab and the badge
    // before this tab has loaded — in step with every local change.
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    const first = rows[0];
    if (first && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(first.id);
    }
    // Only re-pick when the available rows change — not on every
    // `selectedId` change, or a click could never stick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;

  const approve = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await approveAppointment(id);
      await loadApprovals();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setBusyId(null);
    }
  };

  const startDecline = (id: string): void => {
    setSelectedId(id);
    setDecliningId(id);
    setReason('');
  };

  const decline = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await rejectAppointment(id, reason);
      setDecliningId(null);
      setReason('');
      await loadApprovals();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setBusyId(null);
    }
  };

  // Requests queue — RequestsQueue owns its own data; this page only tracks
  // the count for the tab badge and combined `badges` prop. It only mounts on
  // the Requests tab, so `requestsCount`/`requestsLoaded` stay at their last
  // known value (0/false until first load) whenever Approvals is active.
  const [requestsCount, setRequestsCount] = useState(0);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const requestsRef = useRef<RequestsQueueHandle>(null);

  /* Contact-page enquiries. The count is fetched here rather than taken from
     `owner_dashboard_summary()` so the badge is right before the tab has ever
     been opened; `ContactMessagesQueue` then keeps it in step once it is. */
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    countNewContactMessages()
      .then(setUnreadMessages)
      .catch(() => setUnreadMessages(0));
  }, []);

  const handleRequestsCountChange = useCallback(
    (n: number): void => {
      setRequestsCount(n);
      setRequestsLoaded(true);
      void refreshSummary();
    },
    [refreshSummary],
  );

  const refreshActive = (): void => {
    if (tab === 'requests') void requestsRef.current?.reload();
    else void loadApprovals();
  };

  // Reconciliation: the active tab's own state is freshest once it has
  // loaded (immediate after an approve/decline/offer/decline, no need to
  // wait on a summary refetch); the inactive tab — which may never have
  // mounted, or may be stale since it last was — falls back to the summary.
  // The badge is always the sum of these two, so it can never read a number
  // that disagrees with what either tab is about to show.
  const approvalsLoaded = !loading;
  const effectiveApprovalsCount =
    tab === 'approvals' && approvalsLoaded
      ? rows.length
      : (summary?.pending_approval_count ?? 0);
  const effectiveRequestsCount =
    tab === 'requests' && requestsLoaded
      ? requestsCount
      : (summary?.new_request_count ?? 0);

  return (
    <DashboardLayout
      title={
        tab === 'approvals'
          ? 'Approvals'
          : tab === 'requests'
            ? 'Availability requests'
            : 'Messages'
      }
      subtitle={
        tab === 'approvals'
          ? `Review and approve first-time bookings within the ${settings?.approval_window_h ?? 12}-hour window.`
          : tab === 'requests'
            ? "Respond to customer requests when your calendar doesn't have a suitable slot."
            : 'Enquiries sent from the Contact page.'
      }
      badges={{ approvals: effectiveApprovalsCount, requests: effectiveRequestsCount }}
      actions={
        <>
          {/* The sidebar already carries separate Approvals / Availability Requests
              rows (DashboardLayout's grouped nav), so this pill is redundant on
              desktop — it only earns its keep below `md:`, where the sidebar is
              hidden behind the Menu button. */}
          <div
            role="group"
            aria-label="Inbox queue"
            className="inline-flex rounded-lg border border-border p-0.5 md:hidden"
          >
            <button
              type="button"
              aria-pressed={tab === 'approvals'}
              onClick={() => goToTab('approvals')}
              className={cn(
                'flex items-center rounded-md px-3 py-1.5 text-sm font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === 'approvals'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Approvals
              {effectiveApprovalsCount > 0 && (
                <span
                  className={cn(
                    'ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    tab === 'approvals'
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {effectiveApprovalsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={tab === 'requests'}
              onClick={() => goToTab('requests')}
              className={cn(
                'flex items-center rounded-md px-3 py-1.5 text-sm font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === 'requests'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Requests
              {effectiveRequestsCount > 0 && (
                <span
                  className={cn(
                    'ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    tab === 'requests'
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {effectiveRequestsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={tab === 'messages'}
              onClick={() => goToTab('messages')}
              className={cn(
                'flex items-center rounded-md px-3 py-1.5 text-sm font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === 'messages'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Messages
              {unreadMessages > 0 && (
                <span
                  className={cn(
                    'ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    tab === 'messages'
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {unreadMessages}
                </span>
              )}
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshActive}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => setBooking(true)}>
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            New booking
          </Button>
        </>
      }
    >
      {tab === 'approvals' ? (
        <div className="space-y-6">
          {loading && <LoadingState label="Loading approvals…" />}
          {error && <ErrorState error={error} onRetry={() => void loadApprovals()} />}

          {!loading && !error && (
            <>
              <ApprovalStats
                pendingCount={rows.length}
                avgWaitMinutes={stats?.avgWaitMinutes ?? null}
                approvedPercent={stats?.approvedPercent ?? null}
                thisWeekCount={stats?.thisWeekCount ?? 0}
              />

              <div className="flex items-start gap-3 rounded-lg bg-tint-pending p-4 text-sm text-status-pending">
                <Zap
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={2}
                />
                <p>
                  Slots are reserved immediately when a first-time customer submits a
                  booking.
                </p>
              </div>

              {rows.length === 0 ? (
                <EmptyState
                  title="Nothing waiting"
                  description="Your published hours book instantly for everyone, so nothing needs a decision. Turn on first-time approval in Settings if you would rather check new customers yourself first."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void navigate(routes.owner.settings)}
                    >
                      Open Settings
                    </Button>
                  }
                />
              ) : (
                <>
                  <h2 className="font-serif text-lg font-semibold text-foreground">
                    Pending approvals ({rows.length})
                  </h2>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                      {rows.map((row) => (
                        <ApprovalCard
                          key={row.id}
                          row={row}
                          timezone={timezone}
                          selected={row.id === selectedId}
                          busy={busyId === row.id}
                          onSelect={() => setSelectedId(row.id)}
                          onApprove={() => void approve(row.id)}
                          onDecline={() => startDecline(row.id)}
                        />
                      ))}
                    </div>

                    <ApprovalDetailPanel
                      row={selectedRow}
                      timezone={timezone}
                      busy={selectedRow !== null && busyId === selectedRow.id}
                      declining={selectedRow !== null && decliningId === selectedRow.id}
                      reason={reason}
                      onReasonChange={setReason}
                      onApprove={() => selectedRow && void approve(selectedRow.id)}
                      onDeclineStart={() => selectedRow && startDecline(selectedRow.id)}
                      onDeclineConfirm={() => selectedRow && void decline(selectedRow.id)}
                      onDeclineCancel={() => {
                        setDecliningId(null);
                        setReason('');
                      }}
                    />
                  </div>
                </>
              )}

              <ApprovalPolicyFooter
                approvalWindowHours={settings?.approval_window_h ?? 12}
              />
            </>
          )}
        </div>
      ) : tab === 'requests' ? (
        <RequestsQueue ref={requestsRef} onCountChange={handleRequestsCountChange} />
      ) : (
        <ContactMessagesQueue onCountChange={setUnreadMessages} />
      )}

      <Modal open={booking} onClose={() => setBooking(false)} ariaLabel="Take a booking">
        <NewBookingPanel
          prefill={null}
          onClose={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            refreshActive();
          }}
        />
      </Modal>
    </DashboardLayout>
  );
}
