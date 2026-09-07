import { type JSX, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown } from '@/components/ui/Dropdown';
import { routes } from '@/lib/routes';
import type { AppointmentDetailed } from '@/types';
import { iconButtonClass } from '@/components/ui/controlClasses';

/** Statuses that already mean "this is over" — deleting one of these is
 * pure housekeeping. Anything else (confirmed, in service, completed, …)
 * is still deletable — the owner asked for that — but gets a stronger
 * warning below, since the customer won't be notified the way Cancel does. */
const ALREADY_CLOSED = new Set(['cancelled', 'rejected', 'no_show']);

/**
 * The row's "…" quick actions, via the shared `Dropdown` primitive.
 * Deliberately just the two things that don't fit "view this appointment" —
 * everything else (change time, cancel, mark complete, …) lives in the
 * detail popup the eye icon / row click opens.
 */
export function AppointmentRowMenu({
  appointment,
  onDelete,
}: {
  appointment: AppointmentDetailed;
  onDelete: (id: string) => Promise<void>;
}): JSX.Element {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Dropdown
        trigger={({ open, toggle }) => (
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={toggle}
            className={iconButtonClass}
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        items={[
          {
            key: 'view-customer',
            label: 'View customer profile',
            onSelect: () => {
              if (appointment.customer_id) {
                void navigate(
                  `${routes.owner.customers}?customer=${appointment.customer_id}`,
                );
              }
            },
          },
          {
            key: 'delete',
            label: 'Delete appointment',
            destructive: true,
            onSelect: () => setConfirming(true),
          },
        ]}
      />

      <ConfirmDialog
        open={confirming}
        title="Delete this appointment?"
        message={
          ALREADY_CLOSED.has(appointment.status)
            ? 'This removes it entirely, which is not the same as cancelling. There is no undo.'
            : `This appointment is still ${appointment.status.replace('_', ' ')}. Deleting it removes the record entirely and, unlike Cancel, does not notify the customer. There is no undo.`
        }
        tone="destructive"
        confirmLabel="Delete appointment"
        onConfirm={() => {
          setConfirming(false);
          void onDelete(appointment.id);
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
