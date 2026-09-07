import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';

/** Context for a screen the owner opens rarely — what the policy is, and the one lever (more slots) that shrinks the queue. */
export function ApprovalPolicyFooter({
  approvalWindowHours,
}: {
  approvalWindowHours: number;
}): JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card pad="standard" className="flex gap-3">
        <CalendarClock
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <div>
          <p className="font-serif text-sm font-semibold text-foreground">
            Approval policy
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>
              First-time customers are held for your approval within {approvalWindowHours}{' '}
              hours.
            </li>
            <li>The requested time slot is reserved as soon as they submit.</li>
            <li>Returning customers receive instant confirmation.</li>
          </ul>
        </div>
      </Card>

      {/* `variant="accent"` — the design system's own "highlighted callout"
          surface (docs/DESIGN.md §6.2) — rather than `bg-tint-completed`. A
          status tint belongs to an appointment status, and this is a
          navigation prompt; more concretely, the status tints are tuned to
          carry their own saturated status text, so the supporting line here
          measured 4.43:1 in dark mode (axe, 2026-09-05) against a green it
          was never paired with. */}
      <Card
        variant="accent"
        pad="standard"
        className="flex items-center justify-between gap-4"
      >
        <div className="flex gap-3">
          <CalendarPlus
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-brand-ink"
            strokeWidth={2}
          />
          <div>
            <p className="font-serif text-sm font-semibold text-foreground">
              Need a different time?
            </p>
            <p className="text-sm text-muted-foreground">
              Edit your availability rules to offer more slots.
            </p>
          </div>
        </div>
        <Link
          to={routes.owner.weeklyDefault}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Manage availability
        </Link>
      </Card>
    </div>
  );
}
