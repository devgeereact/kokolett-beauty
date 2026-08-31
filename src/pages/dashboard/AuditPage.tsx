import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { listAuditEvents } from '@/services/auditService';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { cn } from '@/lib/utils';
import type { AuditEvent } from '@/types';

type Lane = 'all' | AuditEvent['action'];

const LANES: { key: Lane; label: string }[] = [
  { key: 'all', label: 'All actions' },
  { key: 'appointment.created', label: 'Booking created' },
  { key: 'appointment.status_changed', label: 'Status changed' },
  { key: 'appointment.rescheduled', label: 'Rescheduled' },
  { key: 'appointment.deleted', label: 'Booking deleted' },
  { key: 'customer.erased', label: 'Customer erased' },
  { key: 'payment.recorded', label: 'Payment recorded' },
  { key: 'settings.login_slug_changed', label: 'Sign-in link changed' },
  { key: 'day.closed', label: 'Day closed' },
  { key: 'customer.data_exported', label: 'Data exported' },
  { key: 'broadcast.sent', label: 'Broadcast sent' },
  { key: 'customer.sessions_revoked', label: 'Sessions revoked' },
];

/**
 * A read-only log of the highest-risk owner actions (migration 0052):
 * the booking lifecycle, customer erasure, payment logging, and the
 * secret sign-in link. Immutable by design — there is no edit or delete
 * affordance anywhere on this page, because there is nothing underneath
 * it for one to call.
 */
export function AuditPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback((): void => {
    setError(null);
    listAuditEvents()
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<Lane, number> = {
      all: 0,
      'appointment.created': 0,
      'appointment.status_changed': 0,
      'appointment.rescheduled': 0,
      'appointment.deleted': 0,
      'customer.erased': 0,
      'payment.recorded': 0,
      'settings.login_slug_changed': 0,
      'day.closed': 0,
      'customer.data_exported': 0,
      'broadcast.sent': 0,
      'customer.sessions_revoked': 0,
    };
    for (const e of events ?? []) {
      c.all += 1;
      c[e.action] += 1;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (events ?? []).filter((e) => {
      if (lane !== 'all' && e.action !== lane) return false;
      if (!q) return true;
      return e.summary.toLowerCase().includes(q);
    });
  }, [events, lane, search]);

  const exportCsv = (): void => {
    const header = ['When', 'Action', 'Entity', 'Summary'];
    const rows = filtered.map((e) => [
      formatDateTime(e.created_at, timezone),
      e.action,
      e.entity_type,
      e.summary,
    ]);
    downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, [
      header,
      ...rows,
    ]);
  };

  if (error) {
    return (
      <DashboardLayout title="Audit Log">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Audit Log"
      subtitle="The highest-risk actions on this account — bookings, erasures, payments and the sign-in link."
      actions={
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Export
        </Button>
      }
    >
      {!events ? (
        <LoadingState label="Loading the audit log…" />
      ) : events.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description="Booking changes, erasures, payments and sign-in link changes will appear here as they happen."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
          <div className="space-y-1">
            {LANES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLane(l.key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
                  lane === l.key
                    ? 'bg-tint-brand text-primary'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span>{l.label}</span>
                <span className="text-xs text-muted-foreground">{counts[l.key]}</span>
              </button>
            ))}
          </div>

          <Card className="flex flex-col p-0">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the log…"
                  className="h-10 w-full rounded-sm border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No actions match.</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((e) => {
                  const expanded = expandedId === e.id;
                  const hasDetail = e.old_value !== null || e.new_value !== null;
                  return (
                    <div key={e.id}>
                      <button
                        type="button"
                        onClick={() => hasDetail && setExpandedId(expanded ? null : e.id)}
                        className={cn(
                          'flex w-full items-start gap-3 p-3 text-left',
                          hasDetail && 'hover:bg-muted',
                        )}
                      >
                        <History
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          strokeWidth={2}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {e.summary}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDateTime(e.created_at, timezone)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {e.entity_type} · {e.actor}
                          </p>
                        </div>
                      </button>
                      {expanded && (
                        <div className="grid grid-cols-2 gap-3 bg-muted px-3 pb-3 text-xs">
                          {e.old_value !== null && (
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">
                                Before
                              </p>
                              <pre className="whitespace-pre-wrap break-words text-foreground">
                                {JSON.stringify(e.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {e.new_value !== null && (
                            <div>
                              <p className="mb-1 font-medium text-muted-foreground">
                                After
                              </p>
                              <pre className="whitespace-pre-wrap break-words text-foreground">
                                {JSON.stringify(e.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
