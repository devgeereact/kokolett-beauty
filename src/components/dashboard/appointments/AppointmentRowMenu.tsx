import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

const DELETABLE = new Set(['cancelled', 'rejected', 'no_show']);

/**
 * The row's "…" quick actions — a plain absolutely-positioned popover closed
 * on outside pointerdown or Escape, the same hand-rolled pattern
 * `DatePicker` already uses. Deliberately just the two things that don't fit
 * "view this appointment" — everything else (change time, cancel, mark
 * complete, …) lives in the detail popup the eye icon / row click opens.
 */
export function AppointmentRowMenu({
  appointment,
  onDelete,
}: {
  appointment: AppointmentDetailed;
  onDelete: (id: string) => Promise<void>;
}): JSX.Element {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-card"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              if (appointment.customer_id) {
                void navigate(`${routes.owner.customers}?customer=${appointment.customer_id}`);
              }
            }}
          >
            View customer profile
          </button>
          {DELETABLE.has(appointment.status) && (
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, 'text-destructive')}
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              Delete appointment
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this appointment?"
        message="This removes it entirely — not the same as cancelling. There is no undo."
        tone="destructive"
        confirmLabel="Delete appointment"
        onConfirm={() => {
          setConfirming(false);
          void onDelete(appointment.id);
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
