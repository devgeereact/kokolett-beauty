import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps;

/**
 * The one calendar grid every date picker in the app renders — a thin,
 * token-styled wrapper over `react-day-picker`. Monday-first, matching
 * `lib/calendar.ts`'s own convention everywhere else in the dashboard.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps): JSX.Element {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'space-y-3',
        month_caption: 'flex items-center justify-center pt-1',
        caption_label: 'text-sm font-semibold text-foreground',
        nav: 'flex items-center justify-between absolute inset-x-1 top-1',
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
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-[11px] font-medium uppercase text-muted-foreground',
        week: 'flex w-full mt-1',
        day: 'h-9 w-9 p-0 text-center text-sm relative',
        day_button: cn(
          'h-9 w-9 rounded-md font-normal text-foreground',
          'hover:bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ),
        selected: '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        today: '[&>button]:border [&>button]:border-primary',
        outside: '[&>button]:text-muted-foreground [&>button]:opacity-50',
        disabled: '[&>button]:text-muted-foreground [&>button]:opacity-30 [&>button]:hover:bg-transparent [&>button]:cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => (
          <span aria-hidden="true" className={cn('text-base leading-none', chevronClassName)}>
            {orientation === 'left' ? '‹' : '›'}
          </span>
        ),
      }}
      {...props}
    />
  );
}
