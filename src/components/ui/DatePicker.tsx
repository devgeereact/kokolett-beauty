import { useEffect, useRef, useState } from 'react';
import { Calendar } from '@/components/ui/Calendar';
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

/** `yyyy-mm-dd` parsed as a local calendar date — never shifts a day at a timezone edge. */
function parseISO(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  const selected = parseISO(value);
  const minDate = parseISO(min ?? '');
  const maxDate = parseISO(max ?? '');

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover shadow-card">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) onChange(toISO(date));
              setOpen(false);
            }}
            disabled={(date) =>
              (minDate !== undefined && date < minDate) || (maxDate !== undefined && date > maxDate)
            }
          />
        </div>
      )}
    </div>
  );
}
