import type { JSX } from 'react';
import { Eye } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { StatusChip } from '@/components/ui/StatusChip';
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
 *
 * The table chrome itself (sticky header, grouping, row click) is the
 * shared `DataTable` primitive — this file is now just column definitions.
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

  const columns: DataTableColumn<AppointmentDetailed>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (a) => (
        <>
          <p className="font-mono font-semibold tabular-nums text-foreground">
            {formatTime(a.starts_at, timezone)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDuration(
              (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000,
            )}
          </p>
        </>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      className: 'max-w-[190px]',
      render: (a) => (
        <div className="flex items-start gap-2">
          <Avatar name={a.customer_name ?? 'Customer'} size="sm" className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{a.customer_name}</p>
            <p className="truncate text-xs text-muted-foreground">{a.customer_email}</p>
            {a.customer_mobile && (
              <p className="truncate text-xs text-muted-foreground">
                {a.customer_mobile}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      className: 'max-w-[130px] truncate text-foreground',
      render: (a) => a.service_name,
    },
    {
      key: 'staff',
      header: 'Staff',
      className: 'text-foreground',
      render: () => ownerName,
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => <StatusChip status={a.status} variant="pill" />,
    },
    {
      key: 'reference',
      header: 'Reference',
      className: 'font-mono text-xs text-muted-foreground',
      render: (a) => a.reference,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (a) => (
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
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      minWidth="720px"
      getRowKey={(a) => a.id}
      onRowClick={onView}
      groups={groups.map((group) => ({
        key: group.date,
        label: formatDateLong(`${group.date}T12:00:00Z`, 'UTC'),
        rows: group.rows,
      }))}
      footer={
        showPagination && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange}
          />
        )
      }
    />
  );
}
