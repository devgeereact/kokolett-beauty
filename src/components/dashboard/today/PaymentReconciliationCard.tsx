import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/States';
import { AppointmentDetailModal } from '@/components/dashboard/AppointmentDetailModal';
import { listUnpaidCompletedAppointments } from '@/services/appointmentService';
import { logPayment } from '@/services/paymentService';
import { formatDateShort, formatMoney } from '@/lib/format';
import { routes } from '@/lib/routes';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

const PREVIEW_COUNT = 4;
const WINDOW_DAYS = 30;

/**
 * Completed appointments from the last 30 days with nothing logged against
 * them in `payments` — the owner's own append-only record of what she
 * actually charged (docs/KOKO_GAP.md §5, P1: money lost by forgetting to
 * record a payment is the one gap here with a direct income impact).
 *
 * Owns its own record-payment modal rather than only linking out to
 * Appointments — this card's 30-day window can include appointments outside
 * Today's own dataset, so it fetches and updates independently.
 */
export function PaymentReconciliationCard({
  className,
}: {
  className?: string;
}): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AppointmentDetailed[] | null>(null);
  const [selected, setSelected] = useState<AppointmentDetailed | null>(null);

  const load = (): void => {
    listUnpaidCompletedAppointments(WINDOW_DAYS)
      .then(setRows)
      .catch(() => setRows([]));
  };

  useEffect(load, []);

  const handleLogPayment = async (
    id: string,
    amountPence: number,
    note: string,
    correctsPaymentId?: string,
  ): Promise<void> => {
    await logPayment(id, amountPence, note, correctsPaymentId);
    showToast({ message: 'Payment recorded.' });
    setSelected(null);
    load();
  };

  const preview = rows?.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Payments to record
        </h2>
        <Link
          to={routes.owner.appointments}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {rows === null && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState
          title="All caught up"
          description="Every completed appointment in the last 30 days has a payment logged."
        />
      )}

      <div className="divide-y divide-border">
        {preview.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <Avatar name={row.customer_name ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.customer_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.service_name}
                {row.starts_at && ` · ${formatDateShort(row.starts_at)}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(row.price_pence)}
            </span>
            <button
              type="button"
              onClick={() => setSelected(row)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-tint-brand px-2.5 py-1.5 text-xs font-semibold text-primary hover:brightness-95"
            >
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Record
            </button>
          </div>
        ))}
      </div>

      {rows !== null && rows.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            {rows.length} unrecorded ·{' '}
            {formatMoney(rows.reduce((sum, r) => sum + r.price_pence, 0))} outstanding
          </span>
          <Link
            to={routes.owner.appointments}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        ariaLabel="Record payment"
        className="max-w-modal-lg"
      >
        {selected && (
          <AppointmentDetailModal
            appointment={selected}
            timezone={timezone}
            onClose={() => setSelected(null)}
            onLogPayment={handleLogPayment}
          />
        )}
      </Modal>
    </Card>
  );
}
