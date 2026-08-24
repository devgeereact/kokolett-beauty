import { Suspense, lazy, type JSX } from 'react';
import type { DayPickerProps } from 'react-day-picker';
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

/*
 * `react-day-picker` is 22 kB gzipped and no customer-facing page renders a
 * calendar on arrival: the booking grid waits on the availability fetch, the
 * `DatePicker` popover waits on a click, and the dashboard is lazy already.
 * Statically imported it still landed in the entry graph, so the marketing
 * home page — which has no calendar at all — preloaded it before first paint.
 *
 * The type import above is erased at compile time, so this module carries no
 * runtime dependency on the package.
 */
const CalendarGrid = lazy(() =>
  import('@/components/ui/CalendarGrid').then((m) => ({ default: m.CalendarGrid })),
);

/**
 * Placeholder held while the grid loads, sized to the grid it replaces so the
 * surrounding layout does not jump when it arrives.
 */
function CalendarSkeleton({ size }: { size: 'sm' | 'lg' }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-lg bg-muted',
        size === 'lg' ? 'h-[22rem] w-full' : 'h-[18rem] w-[17rem]',
      )}
    />
  );
}

/**
 * The one calendar every date picker in the app renders. A thin `Suspense`
 * boundary over `CalendarGrid`; every prop passes straight through.
 */
export function Calendar({ size = 'sm', ...props }: CalendarProps): JSX.Element {
  return (
    <Suspense fallback={<CalendarSkeleton size={size} />}>
      <CalendarGrid size={size} {...props} />
    </Suspense>
  );
}
