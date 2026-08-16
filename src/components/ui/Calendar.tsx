import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps & {
  /**
   * `sm` (default) is fixed-size — right for a compact dropdown under an
   * input, like `DatePicker`'s popover, where the calendar must not push its
   * own width around. `lg` is fluid: day cells are `flex-1` and grow to fill
   * whatever width the parent gives them, for a page where the calendar
   * *is* the content, like the booking flow's date grid.
   */
  size?: 'sm' | 'lg';
};

/**
 * The one calendar grid every date picker in the app renders — a thin,
 * token-styled wrapper over `react-day-picker`. Monday-first, matching
 * `lib/calendar.ts`'s own convention everywhere else in the dashboard.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  size = 'sm',
  ...props
}: CalendarProps): JSX.Element {
  const sizeClassNames =
    size === 'lg'
      ? {
          month_caption: 'flex items-center justify-center pt-1',
          caption_label: 'text-base font-semibold text-foreground md:text-lg',
          button_previous: cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          button_next: cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          weekday:
            'flex-1 text-center text-xs font-medium uppercase text-muted-foreground md:text-sm',
          day: 'flex-1 aspect-square p-0.5 text-center text-sm relative md:text-base',
          day_button: cn(
            'flex h-full w-full items-center justify-center rounded-lg font-normal text-foreground',
            'hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        }
      : {
          month_caption: 'flex items-center justify-center pt-1',
          caption_label: 'text-sm font-semibold text-foreground',
          button_previous: cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          button_next: cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          weekday:
            'w-9 text-center text-[11px] font-medium uppercase text-muted-foreground',
          day: 'h-9 w-9 p-0 text-center text-sm relative',
          day_button: cn(
            'h-9 w-9 rounded-md font-normal text-foreground',
            'hover:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn(size === 'lg' ? 'w-full p-4 md:p-6' : 'p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'w-full space-y-3',
        nav: 'flex items-center justify-between absolute inset-x-1 top-1',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        week: 'flex w-full mt-1',
        selected:
          '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        today: '[&>button]:border [&>button]:border-primary',
        outside: '[&>button]:text-muted-foreground [&>button]:opacity-50',
        disabled:
          '[&>button]:text-muted-foreground [&>button]:opacity-30 [&>button]:hover:bg-transparent [&>button]:cursor-not-allowed',
        hidden: 'invisible',
        ...sizeClassNames,
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => (
          <span
            aria-hidden="true"
            className={cn(
              size === 'lg' ? 'text-xl' : 'text-base',
              'leading-none',
              chevronClassName,
            )}
          >
            {orientation === 'left' ? '‹' : '›'}
          </span>
        ),
      }}
      {...props}
    />
  );
}
