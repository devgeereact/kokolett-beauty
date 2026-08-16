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
      <Card className="flex gap-3 p-5">
        <CalendarClock
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <div>
          <p className="font-serif text-sm font-semibold text-foreground">Approval policy</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>
              First-time customers are held for your approval within {approvalWindowHours} hours.
            </li>
            <li>The requested time slot is reserved as soon as they submit.</li>
            <li>Returning customers receive instant confirmation.</li>
          </ul>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-4 bg-tint-completed p-5">
        <div className="flex gap-3">
          <CalendarPlus
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-status-completed"
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
