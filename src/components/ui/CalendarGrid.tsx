import type { JSX } from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import type { CalendarProps } from '@/components/ui/Calendar';

/*
 * The DayPicker wrapper itself, split out from `Calendar` so that
 * `react-day-picker` sits behind a dynamic import. Import `Calendar`, never
 * this file: a static import from an eagerly-loaded page puts the 22 kB
 * gzipped calendar chunk back on the marketing home page's critical path.
 */

/**
 * The one calendar grid every date picker in the app renders — a thin,
 * token-styled wrapper over `react-day-picker`. Monday-first, matching
 * `lib/calendar.ts`'s own convention everywhere else in the dashboard.
 */
export function CalendarGrid({
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
            'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          button_next: cn(
            'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
          weekday:
            'flex-1 text-center text-xs font-medium uppercase text-muted-foreground md:text-sm',
          /* The 44px touch floor DESIGN.md §10 mandates. The config has carried
             `min-h-touch`/`min-w-touch` tokens all along and nothing in src/ used
             either of them, so every date cell here was 32-42px on a phone and
             40px on a tablet — the booking flow's own date picker, below the rule
             the design system sets for it.
             The floor goes on the button, not the cell: the cell is a <td>, where
             min-height is not reliably honoured, and the button is the real touch
             target. `aspect-square` went with it — deriving height from a width
             the grid constrains is exactly what dragged the cells under 44.
             Height only, and `p-0.5` stays. Seven 44px cells need 308px, which no
             320-390px viewport has left after the page gutter and card padding, so
             width is bounded by arithmetic rather than by choice; it reaches 44 on
             its own from about 400px up. Dropping `p-0.5` would buy 4px and butt
             the selected day's filled square against today's outlined one. WCAG
             2.5.8's spacing exception covers the shortfall: 46px between centres
             against a 24px requirement. */
          day: 'flex-1 p-0.5 text-center text-sm relative md:text-base',
          day_button: cn(
            'flex min-h-touch h-full w-full items-center justify-center rounded-lg font-normal text-foreground',
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
          weekday: 'w-9 text-center text-2xs font-medium uppercase text-muted-foreground',
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
      /* `relative` is load-bearing: `nav` below is `absolute`, so without a
         positioned root it anchors to the page instead of the calendar and the
         month arrows land at the top of the document, under the sticky header —
         invisible and unclickable, stranding the customer in one month. */
      className={cn('relative', size === 'lg' ? 'w-full p-4 md:p-6' : 'p-3', className)}
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
