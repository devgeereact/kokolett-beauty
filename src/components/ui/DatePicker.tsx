import { useEffect, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/Calendar';
import { formatLocalDate, parseLocalDate } from '@/lib/localDate';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  id?: string;
  /** `yyyy-mm-dd`, or `''` for no date selected — same shape `<input type="date">` used. */
  value: string;
  onChange: (value: string) => void;
  /** `yyyy-mm-dd` bounds, inclusive. */
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const DISPLAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The app's one date picker. Every date field in the dashboard renders this
 * instead of the native `<input type="date">`, whose calendar popup look is
 * entirely up to the OS and browser and can't be styled or made consistent
 * with the rest of the app.
 *
 * No portal, no floating-ui dependency: the panel is a plain absolutely-
 * positioned child of a `relative` wrapper, closed on outside pointerdown or
 * Escape. That's enough here because it never needs to escape a scroll
 * container or a small viewport the way a full popover library handles.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = 'Pick a date',
  className,
  ...aria
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseLocalDate(value);
  const minDate = parseLocalDate(min ?? '');
  const maxDate = parseLocalDate(max ?? '');

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // Stops this Escape from also reaching another document-level Escape
      // handler further up the tree — e.g. QuickActionLauncher's own
      // "Escape closes everything" handler, when this picker renders inside
      // its booking form. Without this, that handler would discard the
      // whole in-progress form instead of just this popover closing.
      //
      // Registered on the capture phase deliberately, not just calling
      // stopPropagation() from a bubble-phase listener: this listener and
      // an ancestor's Escape listener are both bound directly to
      // `document`, so for two bubble-phase listeners on the same node,
      // dispatch order is registration order — and an ancestor that opened
      // first (e.g. the launcher) always registers its listener before
      // this popover even exists, so it would fire first regardless of
      // stopPropagation() called here. Capture-phase listeners on
      // `document` run before any bubble-phase listener on that same node,
      // so this reliably wins the race no matter which mounted first.
      e.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-input px-3 py-2.5 text-left text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? DISPLAY.format(selected) : placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-dropdown mt-1 rounded-xl border border-border bg-popover shadow-popover">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) onChange(formatLocalDate(date));
              setOpen(false);
            }}
            disabled={(date) =>
              (minDate !== undefined && date < minDate) ||
              (maxDate !== undefined && date > maxDate)
            }
          />
        </div>
      )}
    </div>
  );
}
