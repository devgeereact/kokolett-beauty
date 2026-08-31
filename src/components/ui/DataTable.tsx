import { Fragment, type JSX, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * KOKO_GAP.md P3: no dedicated DataTable component — `AppointmentsTable.tsx`
 * hand-rolled a real `<table>` (sticky header, grouped rows, per-row click)
 * that any future data-grid would have re-hand-rolled from scratch. This is
 * that chrome — header/grouping/row-click/sticky-header — extracted behind a
 * column-definition API, with `AppointmentsTable.tsx` now the first real
 * consumer rather than unused scaffolding.
 *
 * Deliberately not used for the Customers grid — that page moved from a
 * table to cards per an explicit owner request (`CustomerCard.tsx`'s own
 * comment), so a generic table primitive is the wrong fit there regardless
 * of how flexible this one is.
 */
export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Extra classes on every `<td>`/`<th>` in this column, e.g. a max-width clamp. */
  className?: string;
}

export interface DataTableGroup<T> {
  key: string;
  label: ReactNode;
  rows: T[];
}

export function DataTable<T>({
  columns,
  groups,
  getRowKey,
  onRowClick,
  minWidth = '640px',
  footer,
}: {
  columns: DataTableColumn<T>[];
  groups: DataTableGroup<T>[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  minWidth?: string;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-sticky bg-card">
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-3 py-3',
                    col.align === 'right' && 'text-right',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                {group.label !== null && (
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={columns.length}
                      className="bg-muted px-3 py-2 text-left text-sm font-semibold text-foreground"
                    >
                      {group.label}
                    </th>
                  </tr>
                )}
                {group.rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border last:border-b-0',
                      onRowClick && 'cursor-pointer hover:bg-muted',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-3 align-top',
                          col.align === 'right' && 'text-right',
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
