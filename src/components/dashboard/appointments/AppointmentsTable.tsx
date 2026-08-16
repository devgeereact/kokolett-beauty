import { Fragment } from 'react';
import { Eye } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Pagination } from '@/components/ui/Pagination';
import { StatusPill } from '@/components/ui/StatusPill';
import { AppointmentRowMenu } from '@/components/dashboard/appointments/AppointmentRowMenu';
import { formatDateLong, formatDuration, formatTime } from '@/lib/format';
import type { AppointmentDetailed } from '@/types';

export interface AppointmentTableGroup {
  date: string;
  rows: AppointmentDetailed[];
}

/**
 * A real `<table>`, grouped by day with a full-width divider row — the
 * primary surface of the Appointments screen (docs/design/appointment.png).
 * Row click and the eye icon do the same thing (open the detail popup,
 * which carries every other action — change time, cancel, mark complete,
 * …); the "…" menu is only for the two things that aren't "view this
 * appointment": jumping to the customer's profile, and deleting the row.
 */
export function AppointmentsTable({
  groups,
  timezone,
  ownerName,
  onView,
  onDelete,
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  groups: AppointmentTableGroup[];
  timezone: string;
  ownerName: string;
  onView: (appointment: AppointmentDetailed) => void;
  onDelete: (id: string) => Promise<void>;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const showPagination = pageCount > 1 || totalItems > pageSize;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-sticky bg-card">
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-3">
              Time
            </th>
            <th scope="col" className="px-3 py-3">
              Client
            </th>
            <th scope="col" className="px-3 py-3">
              Service
            </th>
            <th scope="col" className="px-3 py-3">
              Staff
            </th>
            <th scope="col" className="px-3 py-3">
              Status
            </th>
            <th scope="col" className="px-3 py-3">
              Reference
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.date}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={7}
                  className="bg-muted px-3 py-2 text-left text-sm font-semibold text-foreground"
                >
                  {formatDateLong(`${group.date}T12:00:00Z`, 'UTC')}
                </th>
              </tr>
              {group.rows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => onView(a)}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted"
                >
                  <td className="px-3 py-3 align-top">
                    <p className="font-mono font-semibold tabular-nums text-foreground">
                      {formatTime(a.starts_at, timezone)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(
                        (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) /
                          60000,
                      )}
                    </p>
                  </td>
                  <td className="max-w-[190px] px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <Avatar name={a.customer_name ?? 'Customer'} size="sm" className="shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {a.customer_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.customer_email}
                        </p>
                        {a.customer_mobile && (
                          <p className="truncate text-xs text-muted-foreground">
                            {a.customer_mobile}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[130px] truncate px-3 py-3 align-top text-foreground">
                    {a.service_name}
                  </td>
                  <td className="px-3 py-3 align-top text-foreground">{ownerName}</td>
                  <td className="px-3 py-3 align-top">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-muted-foreground">
                    {a.reference}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`View ${a.customer_name ?? 'appointment'}'s details`}
                        onClick={() => onView(a)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <AppointmentRowMenu appointment={a} onDelete={onDelete} />
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
      {showPagination && (
        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} />
      )}
    </div>
  );
}
