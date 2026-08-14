import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CountdownChip } from '@/components/ui/CountdownChip';
import { formatDateShort, formatDuration, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

/** One pending hold in the approvals queue — everything the owner needs to decide, without opening the detail panel. */
export function ApprovalCard({
  row,
  timezone,
  selected,
  busy,
  onSelect,
  onApprove,
  onDecline,
}: {
  row: AppointmentDetailed;
  timezone: string;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onDecline: () => void;
}): JSX.Element {
  return (
    <Card
      className={cn(
        'cursor-pointer p-5 transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/20',
      )}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={row.customer_name ?? 'Customer'} size="md" />

        <div className="min-w-[11rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-foreground">
              {row.customer_name}
            </p>
            <Badge tone="pending">First-time customer</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{row.customer_email}</p>
          {row.customer_mobile && (
            <p className="text-sm text-muted-foreground">{row.customer_mobile}</p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[7rem] text-sm">
            <p className="font-medium text-foreground">{row.service_name}</p>
            <p className="text-muted-foreground">{formatDuration(row.service_duration_min ?? 0)}</p>
          </div>

          <div className="min-w-[6rem] text-sm">
            <p className="flex items-center gap-1.5 text-foreground">
              {formatDateShort(row.starts_at, timezone)}
            </p>
            <p className="text-muted-foreground">{formatTime(row.starts_at, timezone)}</p>
          </div>

          {row.approval_deadline && <CountdownChip deadline={row.approval_deadline} />}

          <div className="flex shrink-0 flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" loading={busy} onClick={onApprove}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onDecline}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
