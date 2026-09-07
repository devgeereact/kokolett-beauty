import type { JSX } from 'react';
import {
  Calendar,
  Clock,
  History,
  Mail,
  MessageSquareQuote,
  Phone,
  Scissors,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import {
  formatCountdown,
  formatDateLong,
  formatDateTime,
  formatDuration,
  formatTime,
} from '@/lib/format';
import type { AppointmentDetailed } from '@/types';

/**
 * The queue's decision surface: the selected hold, full detail, and the two
 * actions that resolve it. The list (`ApprovalCard`) can act too — a card's
 * own Approve/Decline are for someone who already knows this customer and
 * doesn't need to read further — but this panel is where a Decline's reason
 * is actually written, since that's the one action a screen's worth of
 * context should sit behind.
 */
export function ApprovalDetailPanel({
  row,
  timezone,
  busy,
  declining,
  reason,
  onReasonChange,
  onApprove,
  onDeclineStart,
  onDeclineConfirm,
  onDeclineCancel,
}: {
  row: AppointmentDetailed | null;
  timezone: string;
  busy: boolean;
  declining: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onApprove: () => void;
  onDeclineStart: () => void;
  onDeclineConfirm: () => void;
  onDeclineCancel: () => void;
}): JSX.Element {
  return (
    <Card pad="standard" className="flex flex-col gap-4">
      {!row && (
        <p className="text-sm text-muted-foreground">
          Select a pending approval to see its details here.
        </p>
      )}

      {row && (
        <>
          <div className="flex items-start gap-3">
            <Avatar name={row.customer_name ?? 'Customer'} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-serif text-base font-semibold text-foreground">
                  {row.customer_name}
                </p>
                <Badge tone="pending">First-time customer</Badge>
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <a
                    href={`mailto:${row.customer_email}`}
                    className="truncate text-foreground hover:underline hover:underline-offset-4"
                  >
                    {row.customer_email}
                  </a>
                </p>
                {row.customer_mobile && (
                  <p className="flex items-center gap-2">
                    <Phone
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                    />
                    <a
                      href={`tel:${row.customer_mobile.replace(/\s/g, '')}`}
                      className="truncate text-foreground hover:underline hover:underline-offset-4"
                    >
                      {row.customer_mobile}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {row.approval_deadline && (
            <Badge tone="pending" className="w-full rounded-lg px-3 py-2">
              Needs approval · {formatCountdown(row.approval_deadline)}
            </Badge>
          )}

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Booking details
            </p>
            <div className="space-y-1.5 text-sm text-foreground">
              <p className="flex items-center gap-2">
                <Calendar
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                {formatDateLong(row.starts_at, timezone)}
              </p>
              <p className="flex items-center gap-2">
                <Clock
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                {formatTime(row.starts_at, timezone)} to{' '}
                {formatTime(row.ends_at, timezone)}
              </p>
              <p className="flex items-center gap-2">
                <Scissors
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                {row.service_name} ({formatDuration(row.service_duration_min ?? 0)})
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareQuote
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                  strokeWidth={2}
                />
                Requested: {formatDateTime(row.created_at, timezone)}
              </p>
            </div>
          </div>

          {row.customer_note && (
            <div className="border-t border-border pt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer notes
              </p>
              <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                &ldquo;{row.customer_note}&rdquo;
              </p>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer history
            </p>
            <p className="flex items-center gap-2 text-sm text-foreground">
              <History
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              {(row.customer_completed_count ?? 0) === 0
                ? 'First booking'
                : `${row.customer_completed_count} completed booking${row.customer_completed_count === 1 ? '' : 's'}`}
            </p>
          </div>

          {declining ? (
            <div className="border-t border-border pt-4">
              <Field
                label="Reason for declining"
                hint="The customer is emailed this. Keep it brief and kind."
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder="I'm afraid I'm already committed at that time."
                  />
                )}
              </Field>
              <div className="flex flex-col gap-2">
                <Button variant="destructive" loading={busy} onClick={onDeclineConfirm}>
                  Confirm decline
                </Button>
                <Button variant="ghost" onClick={onDeclineCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button loading={busy} onClick={onApprove}>
                Approve booking
              </Button>
              <Button variant="ghost" disabled={busy} onClick={onDeclineStart}>
                Decline booking
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
