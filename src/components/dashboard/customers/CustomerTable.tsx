import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatDateShort } from '@/lib/format';
import type { CustomerWithStats } from '@/services/customerService';
import { cn } from '@/lib/utils';

function isNew(customer: CustomerWithStats): boolean {
  if (customer.completed_count > 1) return false;
  const ageMs = Date.now() - new Date(customer.first_seen_at ?? customer.created_at).getTime();
  return ageMs < 14 * 24 * 60 * 60 * 1000;
}

function isInactive(customer: CustomerWithStats): boolean {
  if (!customer.last_visit_at) return false;
  return Date.now() - new Date(customer.last_visit_at).getTime() > 180 * 24 * 60 * 60 * 1000;
}

/** The customer book, in the reference's table shape — one selectable row per customer, everything scannable at a glance. */
export function CustomerTable({
  customers,
  selectedId,
  onSelect,
  timezone,
}: {
  customers: CustomerWithStats[];
  selectedId: string | null;
  onSelect: (customer: CustomerWithStats) => void;
  timezone: string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Customer</th>
            <th className="px-4 py-3 font-semibold">Contact</th>
            <th className="px-4 py-3 font-semibold">Last visit</th>
            <th className="px-4 py-3 font-semibold">Total visits</th>
            <th className="px-4 py-3 font-semibold">Favourite services</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const inactive = isInactive(customer);
            const selected = customer.id === selectedId;
            return (
              <tr
                key={customer.id}
                onClick={() => onSelect(customer)}
                className={cn(
                  'cursor-pointer border-b border-border last:border-0',
                  selected ? 'bg-tint-primary' : 'hover:bg-muted',
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={customer.full_name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{customer.full_name}</p>
                        {isNew(customer) && <Badge tone="primary">New</Badge>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p className="truncate">{customer.email}</p>
                  {customer.mobile && <p className="truncate">{customer.mobile}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {customer.last_visit_at ? formatDateShort(customer.last_visit_at, timezone) : '—'}
                </td>
                <td className="px-4 py-3 text-foreground">{customer.completed_count}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {customer.favourite_services.slice(0, 2).map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                    {customer.favourite_services.length > 2 && (
                      <Badge tone="neutral">+{customer.favourite_services.length - 2}</Badge>
                    )}
                    {customer.favourite_services.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={inactive ? 'neutral' : 'completed'}>{inactive ? 'Inactive' : 'Active'}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={`More options for ${customer.full_name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(customer);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
