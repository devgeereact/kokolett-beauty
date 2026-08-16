import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomerWithStats } from '@/services/customerService';

function isNew(customer: CustomerWithStats): boolean {
  if (customer.completed_count > 1) return false;
  const ageMs = Date.now() - new Date(customer.first_seen_at ?? customer.created_at).getTime();
  return ageMs < 14 * 24 * 60 * 60 * 1000;
}

function isInactive(customer: CustomerWithStats): boolean {
  if (!customer.last_visit_at) return false;
  return Date.now() - new Date(customer.last_visit_at).getTime() > 180 * 24 * 60 * 60 * 1000;
}

/** One customer, card-shaped — same fields the reference's table row carried, laid out for a grid instead of a list per owner request. */
export function CustomerCard({
  customer,
  selected,
  onSelect,
  timezone,
}: {
  customer: CustomerWithStats;
  selected: boolean;
  onSelect: () => void;
  timezone: string;
}): JSX.Element {
  const inactive = isInactive(customer);

  return (
    <Card
      className={cn(
        'flex cursor-pointer flex-col gap-1.5 p-3 transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/20',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <Avatar name={customer.full_name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-serif text-base font-semibold text-foreground">
              {customer.full_name}
            </p>
            {isNew(customer) && <Badge tone="primary">New</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{customer.email}</p>
          {customer.mobile && (
            <p className="truncate text-sm text-muted-foreground">{customer.mobile}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={`More options for ${customer.full_name}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Last visit</p>
          <p className="font-medium text-foreground">
            {customer.last_visit_at ? formatDateShort(customer.last_visit_at, timezone) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total visits</p>
          <p className="font-medium text-foreground">{customer.completed_count}</p>
        </div>
        <Badge tone={inactive ? 'neutral' : 'completed'}>{inactive ? 'Inactive' : 'Active'}</Badge>
      </div>

      <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
        {customer.favourite_services.slice(0, 2).map((s) => (
          <Badge key={s} className="shrink-0" tone="neutral">
            {s}
          </Badge>
        ))}
        {customer.favourite_services.length > 2 && (
          <Badge className="shrink-0" tone="neutral">
            +{customer.favourite_services.length - 2}
          </Badge>
        )}
        {customer.favourite_services.length === 0 && (
          <span className="truncate text-xs text-muted-foreground">No favourite services yet</span>
        )}
      </div>
    </Card>
  );
}
