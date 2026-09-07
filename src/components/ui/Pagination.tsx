import type { JSX } from 'react';
import { cn } from '@/lib/utils';

/** First, last, current ± 1, with `null` standing in for an ellipsis gap. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const withGaps: (number | null)[] = [];
  let previous: number | null = null;
  for (const p of sorted) {
    if (previous !== null && p - previous > 1) withGaps.push(null);
    withGaps.push(p);
    previous = p;
  }
  return withGaps;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel = 'appointments',
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** The noun in "Showing 1 to 7 of 12 …" — plural, lowercase. */
  itemLabel?: string;
}): JSX.Element | null {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1 && totalItems <= pageSize) return null;

  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // 44px touch target, stepping down to the dashboard's 36px only where the
  // device actually has a fine pointer.
  //
  // It used to step down at `md:`, which is a WIDTH: a salon tablet in
  // portrait is 768-834px CSS wide and entirely touch-operated, so the one
  // device this dashboard is designed around got the 32px mouse-sized
  // targets. `pointer-fine` asks the question the code was trying to ask.
  const buttonClass = (active: boolean): string =>
    cn(
      'inline-flex h-control-lg min-w-control-lg items-center justify-center rounded-md px-2 text-sm font-medium',
      'pointer-fine:h-control-sm pointer-fine:min-w-control-sm',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
    );

  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {totalItems} {itemLabel}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            buttonClass(false),
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          ‹
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={buttonClass(p === page)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            buttonClass(false),
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
