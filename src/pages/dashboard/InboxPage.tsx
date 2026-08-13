import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import {
  RequestsPanel,
  type RequestsPanelHandle,
} from '@/components/dashboard/RequestsPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useOwnerSummary } from '@/hooks/useOwnerSummary';
import {
  approveAppointment,
  listPendingApprovals,
  rejectAppointment,
} from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, formatRelative, formatTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

type Tab = 'approvals' | 'requests';

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
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // `useOwnerSummary` is the number the sidebar and Today's stat cards already
  // trust — it stays correct no matter which tab (if any) is mounted, so it
  // backstops the local, tab-gated state below rather than replacing it.
  const { summary, refresh: refreshSummary } = useOwnerSummary();

  const tabParam = new URLSearchParams(location.search).get('tab');
  const explicitTab: Tab | null =
    tabParam === 'requests' ? 'requests' : tabParam === 'approvals' ? 'approvals' : null;
  // Under the current policy Approvals is structurally always empty (see its
  // empty state below), so a bare `/dashboard/inbox` — no `?tab=` — should
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
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadApprovals = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setRows(await listPendingApprovals());
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

  // Requests queue — RequestsPanel owns its own data; this page only tracks
  // the count for the tab badge and combined `badges` prop. It only mounts on
  // the Requests tab, so `requestsCount`/`requestsLoaded` stay at their last
  // known value (0/false until first load) whenever Approvals is active.
  const [requestsCount, setRequestsCount] = useState(0);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const requestsRef = useRef<RequestsPanelHandle>(null);

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
      title="Inbox"
      subtitle={
        tab === 'approvals'
          ? 'First-time bookings holding a slot until you decide'
          : 'Answered oldest first — whoever asked first is served first'
      }
      badges={{ inbox: effectiveApprovalsCount + effectiveRequestsCount }}
      actions={
        <>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
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
          </div>
          <Button variant="ghost" size="sm" onClick={refreshActive}>
            Refresh
          </Button>
        </>
      }
    >
      {tab === 'approvals' ? (
        <>
          {loading && <LoadingState label="Loading approvals…" />}
          {error && <ErrorState error={error} onRetry={() => void loadApprovals()} />}

          {!loading && !error && rows.length === 0 && (
            <EmptyState
              title="Nothing waiting"
              description="Under your current policy nothing lands here: published hours book instantly for everyone. This queue only fills if you switch first-time approval back on in Settings. What you answer day to day is Requests."
            />
          )}

          <div className="space-y-4">
            {rows.map((row) => {
              const deadline = row.approval_deadline;
              const urgent =
                deadline !== null &&
                new Date(deadline).getTime() - Date.now() < 2 * 60 * 60 * 1000;

              return (
                <Card key={row.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-foreground">
                        {row.customer_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.customer_email}
                        {row.customer_mobile ? ` · ${row.customer_mobile}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-muted-foreground">
                        {row.reference}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Asked {formatRelative(row.created_at)}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Service
                      </dt>
                      <dd className="text-sm font-medium text-foreground">
                        {row.service_name} · {formatMoney(row.price_pence)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Requested slot
                      </dt>
                      <dd className="text-sm font-medium text-foreground">
                        {formatDateTime(row.starts_at, timezone)}–
                        {formatTime(row.ends_at, timezone)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Hold expires
                      </dt>
                      <dd
                        className={`text-sm font-medium ${urgent ? 'text-status-pending' : 'text-foreground'}`}
                      >
                        {deadline ? formatRelative(deadline) : 'No deadline'}
                        {urgent && ' — slot released automatically'}
                      </dd>
                    </div>
                  </dl>

                  {row.customer_note && (
                    <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      &ldquo;{row.customer_note}&rdquo;
                    </p>
                  )}

                  {decliningId === row.id ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <Field
                        label="Reason for declining"
                        hint="The customer is emailed this. Keep it brief and kind."
                      >
                        {({ id, describedBy }) => (
                          <Textarea
                            id={id}
                            aria-describedby={describedBy}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="I'm afraid I'm already committed at that time."
                          />
                        )}
                      </Field>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          loading={busyId === row.id}
                          onClick={() => void decline(row.id)}
                        >
                          Confirm decline
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDecliningId(null);
                            setReason('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        loading={busyId === row.id}
                        onClick={() => void approve(row.id)}
                      >
                        Approve booking
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDecliningId(row.id);
                          setReason('');
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <RequestsPanel ref={requestsRef} onCountChange={handleRequestsCountChange} />
      )}
    </DashboardLayout>
  );
}
