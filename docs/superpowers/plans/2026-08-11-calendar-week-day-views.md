# Calendar Week/Day/Month Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the month-grid-only `CalendarPage` with Week / Day / Month views on an Apple-Calendar-style hour-axis grid, rendering real appointment and open-slot data with a live now-line — no drag-to-reschedule yet (that's a follow-on plan against migration `0024`).

**Architecture:** Pure grid math lives in `src/lib/calendar.ts` (extended, not replaced). Presentational pieces live under `src/components/dashboard/calendar/`. `CalendarPage.tsx` stays the data-loading owner (`pages → services → lib` dependency direction, per `docs/ARCHITECTURE.md` §2) and passes plain data down; nothing under `calendar/` talks to Supabase directly.

**Tech Stack:** React 18, TypeScript strict, Tailwind (design tokens from `tailwind.config.ts` / `src/index.css` only — no raw hex), Vitest + Testing Library.

## Global Constraints

- TypeScript strict: no implicit `any`, explicit return types on every function and component (this repo's existing convention, visible throughout `src/lib` and `src/components`).
- Import app code via the `@/…` path alias, never a relative path across a directory boundary.
- Colour comes from design tokens only (`bg-status-pending`, `text-destructive`, etc.) — never a raw hex value, and never a Tailwind opacity modifier against a token (`bg-primary/50` silently renders nothing per `docs/DESIGN.md` §8, because these resolve to `var(--token)`).
- Every interactive element needs a visible focus ring and a real `<button>`/`<a>` — no `onClick` on a bare `<div>` (`docs/DESIGN.md` §7).
- Keep files under 500 lines (project `CLAUDE.md`).
- This codebase only unit-tests pure logic and hooks (`src/lib/*.test.ts`, `src/hooks/*.test.ts`) — it does **not** unit-test presentational components (nothing under `src/components/dashboard` has a `.test.tsx`). Follow that convention: write tests for Tasks 1–3, skip inventing component tests for Tasks 4–10.
- Tests must pass with no `.env` present (`vite.config.ts` `test.env` supplies placeholder Supabase credentials) — don't add a new module-scope Supabase call outside `src/services`.
- Comments only where the _why_ isn't obvious from the code — match the existing terse-JSDoc style visible in `src/lib/calendar.ts` and `src/lib/format.ts`, don't restate what a line does.

---

## File Structure

| File                                                        | Responsibility                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/lib/calendar.ts` (modify)                              | Add hour-axis math: `HourRange`, `hourRange`, `offsetPercent`, `hourLabels`, `weekDates`, `CalendarView`, `shiftAnchor` |
| `src/lib/calendar.test.ts` (new)                            | Unit tests for the above                                                                                                |
| `src/lib/format.ts` (modify)                                | Add `minutesSinceMidnight`                                                                                              |
| `src/lib/format.test.ts` (modify)                           | Tests for `minutesSinceMidnight`                                                                                        |
| `src/hooks/useNowLine.ts` (new)                             | Live minutes-since-midnight, refreshed on an interval                                                                   |
| `src/hooks/useNowLine.test.ts` (new)                        | Fake-timer tests, same style as `useSalonToday.test.ts`                                                                 |
| `src/components/dashboard/calendar/EventBlock.tsx` (new)    | One positioned appointment or open-slot block                                                                           |
| `src/components/dashboard/calendar/NowLine.tsx` (new)       | The live time indicator line                                                                                            |
| `src/components/dashboard/calendar/AgendaList.tsx` (new)    | Accessible chronological list — the non-visual alternative required by `docs/DESIGN.md` §7                              |
| `src/components/dashboard/calendar/WeekView.tsx` (new)      | 7-day hour-axis grid                                                                                                    |
| `src/components/dashboard/calendar/DayView.tsx` (new)       | Single-day hour-axis grid + `AgendaList` + relocated `DayPanel`                                                         |
| `src/components/dashboard/calendar/MonthView.tsx` (new)     | Month grid, extracted from `CalendarPage`, with event pills added                                                       |
| `src/components/dashboard/calendar/CalendarShell.tsx` (new) | Week/Day/Month tab switcher                                                                                             |
| `src/pages/dashboard/CalendarPage.tsx` (rewrite)            | Owns view/anchor state, data loading, wires everything together                                                         |

---

### Task 1: Hour-axis grid math

**Files:**

- Modify: `src/lib/calendar.ts`
- Test: `src/lib/calendar.test.ts` (new)

**Interfaces:**

- Consumes: `addDays` from `@/lib/format` (already exported); `dayOfWeek`, `parseDate` already defined in this file.
- Produces:

  ```ts
  export interface HourRange {
    startMin: number;
    endMin: number;
  }
  export const HOUR_ROW_PX = 64;
  export function hourRange(minutesOfDay: number[]): HourRange;
  export function offsetPercent(minutesOfDay: number, range: HourRange): number;
  export function hourLabels(range: HourRange): string[];
  export function weekDates(anchorDate: string): string[];
  export type CalendarView = 'month' | 'week' | 'day';
  export function shiftAnchor(
    view: CalendarView,
    anchor: string,
    direction: 1 | -1,
  ): string;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calendar.test.ts
import { describe, expect, it } from 'vitest';
import {
  hourRange,
  offsetPercent,
  hourLabels,
  weekDates,
  shiftAnchor,
} from '@/lib/calendar';

describe('hourRange', () => {
  it('falls back to 08:00–20:00 when there is nothing to fit', () => {
    expect(hourRange([])).toEqual({ startMin: 480, endMin: 1200 });
  });

  it('fits tightly around the given times with an hour of padding', () => {
    // 09:15 and 13:00 -> pad to 08:00 and floor(14*60/60)=14:00
    expect(hourRange([9 * 60 + 15, 13 * 60])).toEqual({ startMin: 480, endMin: 840 });
  });

  it('never produces a span shorter than 6 hours', () => {
    const range = hourRange([9 * 60, 9 * 60 + 30]);
    expect(range.endMin - range.startMin).toBeGreaterThanOrEqual(360);
  });

  it('clamps to a single day', () => {
    const range = hourRange([0, 23 * 60 + 59]);
    expect(range.startMin).toBeGreaterThanOrEqual(0);
    expect(range.endMin).toBeLessThanOrEqual(24 * 60);
  });
});

describe('offsetPercent', () => {
  const range = { startMin: 480, endMin: 720 }; // 08:00-12:00, 240 min span

  it('places the range start at 0% and the end at 100%', () => {
    expect(offsetPercent(480, range)).toBe(0);
    expect(offsetPercent(720, range)).toBe(100);
  });

  it('places the midpoint at 50%', () => {
    expect(offsetPercent(600, range)).toBe(50);
  });

  it('clamps outside the range instead of overflowing', () => {
    expect(offsetPercent(0, range)).toBe(0);
    expect(offsetPercent(2000, range)).toBe(100);
  });
});

describe('hourLabels', () => {
  it('lists one label per hour, half-open', () => {
    expect(hourLabels({ startMin: 540, endMin: 720 })).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
  });
});

describe('weekDates', () => {
  it('returns the Monday-first week containing the anchor', () => {
    // 2026-08-11 is a Tuesday
    expect(weekDates('2026-08-11')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('handles a Sunday anchor as the last day of its own week', () => {
    expect(weekDates('2026-08-16')[0]).toBe('2026-08-10');
    expect(weekDates('2026-08-16')[6]).toBe('2026-08-16');
  });
});

describe('shiftAnchor', () => {
  it('moves a week anchor by 7 days', () => {
    expect(shiftAnchor('week', '2026-08-11', 1)).toBe('2026-08-18');
    expect(shiftAnchor('week', '2026-08-11', -1)).toBe('2026-08-04');
  });

  it('moves a day anchor by 1 day', () => {
    expect(shiftAnchor('day', '2026-08-11', 1)).toBe('2026-08-12');
  });

  it('moves a month anchor to the 1st of the next/previous month', () => {
    expect(shiftAnchor('month', '2026-08-11', 1)).toBe('2026-09-01');
    expect(shiftAnchor('month', '2026-08-11', -1)).toBe('2026-07-01');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/calendar.test.ts`
Expected: FAIL — `hourRange`, `offsetPercent`, `hourLabels`, `weekDates`, `shiftAnchor` are not exported yet.

- [ ] **Step 3: Implement**

Append to `src/lib/calendar.ts` (keep the existing `monthGrid`/`gridRange`/etc. untouched above this):

```ts
import { addDays } from '@/lib/format';

/** Minutes-since-midnight bounds for the hour axis. Always multiples of 60. */
export interface HourRange {
  startMin: number;
  endMin: number;
}

/** Pixel height of one hour row — shared by the axis labels and the grid lines. */
export const HOUR_ROW_PX = 64;

const FALLBACK_RANGE: HourRange = { startMin: 8 * 60, endMin: 20 * 60 };
const MIN_SPAN_MIN = 6 * 60;
const DAY_MIN = 24 * 60;

/**
 * The hour axis to render, fitted to whatever is actually happening that day.
 *
 * An owner with one 9am booking should not see a 24-hour axis — but the axis
 * also should not be so tight that a single appointment fills the screen, so
 * it pads an hour either side and floors the span at 6 hours.
 */
export function hourRange(minutesOfDay: number[]): HourRange {
  if (minutesOfDay.length === 0) return FALLBACK_RANGE;

  const min = Math.min(...minutesOfDay);
  const max = Math.max(...minutesOfDay);

  let startMin = Math.max(0, Math.floor((min - 60) / 60) * 60);
  let endMin = Math.min(DAY_MIN, Math.ceil((max + 60) / 60) * 60);

  if (endMin - startMin < MIN_SPAN_MIN) {
    endMin = Math.min(DAY_MIN, startMin + MIN_SPAN_MIN);
    startMin = Math.max(0, endMin - MIN_SPAN_MIN);
  }

  return { startMin, endMin };
}

/** Where a time falls within the axis, as a percentage — clamped, never overflows. */
export function offsetPercent(minutesOfDay: number, range: HourRange): number {
  const span = range.endMin - range.startMin;
  if (span <= 0) return 0;
  const pct = ((minutesOfDay - range.startMin) / span) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** One label per hour row, e.g. `["09:00", "10:00", …]`. */
export function hourLabels(range: HourRange): string[] {
  const labels: string[] = [];
  for (let m = range.startMin; m < range.endMin; m += 60) {
    labels.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`);
  }
  return labels;
}

/** The Monday-first week containing `anchorDate`. */
export function weekDates(anchorDate: string): string[] {
  const dow = dayOfWeek(anchorDate); // 0 = Sunday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(anchorDate, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type CalendarView = 'month' | 'week' | 'day';

/** Moves the focused date by one step of whichever view is showing. */
export function shiftAnchor(
  view: CalendarView,
  anchor: string,
  direction: 1 | -1,
): string {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  const { year, month } = shiftMonth(
    parseDate(anchor).getUTCFullYear(),
    parseDate(anchor).getUTCMonth(),
    direction,
  );
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/calendar.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/calendar.ts src/lib/calendar.test.ts
git commit -m "feat(calendar): add hour-axis grid math"
```

---

### Task 2: `minutesSinceMidnight`

**Files:**

- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`

**Interfaces:**

- Produces: `export function minutesSinceMidnight(iso: string | Date, timeZone = DEFAULT_TIMEZONE): number`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/format.test.ts`:

```ts
import { minutesSinceMidnight } from '@/lib/format';

describe('minutesSinceMidnight', () => {
  it('reads the salon-local wall clock, not UTC', () => {
    // 09:15 UTC in August is 10:15 BST for Europe/London.
    expect(minutesSinceMidnight('2026-08-11T09:15:00Z', 'Europe/London')).toBe(
      10 * 60 + 15,
    );
  });

  it('reads UTC directly when the timezone is UTC', () => {
    expect(minutesSinceMidnight('2026-08-11T14:30:00Z', 'UTC')).toBe(14 * 60 + 30);
  });

  it('treats local midnight as 0, not 24 times 60', () => {
    // 23:00 UTC in August is 00:00 BST the next day.
    expect(minutesSinceMidnight('2026-08-11T23:00:00Z', 'Europe/London')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/format.test.ts`
Expected: FAIL — `minutesSinceMidnight` is not exported.

- [ ] **Step 3: Implement**

Add to `src/lib/format.ts`, near `toSalonDate` (reuses the same `formatToParts` approach as `zoneOffsetMs`):

```ts
/** Minutes since local midnight in `timeZone` — for positioning on a time axis. */
export function minutesSinceMidnight(
  iso: string | Date,
  timeZone = DEFAULT_TIMEZONE,
): number {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  // hour12: false can emit "24" for local midnight.
  return (get('hour') % 24) * 60 + get('minute');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(format): add minutesSinceMidnight for the calendar time axis"
```

---

### Task 3: `useNowLine`

**Files:**

- Create: `src/hooks/useNowLine.ts`
- Test: `src/hooks/useNowLine.test.ts`

**Interfaces:**

- Consumes: `minutesSinceMidnight` from `@/lib/format` (Task 2).
- Produces: `export function useNowLine(timezone: string): number`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useNowLine.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNowLine } from '@/hooks/useNowLine';

describe('useNowLine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current salon-local minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z')); // 10:15 BST
    const { result } = renderHook(() => useNowLine('Europe/London'));
    expect(result.current).toBe(10 * 60 + 15);
  });

  it('advances on the interval while mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z'));
    const { result } = renderHook(() => useNowLine('Europe/London'));

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T09:20:00Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBe(10 * 60 + 20);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/hooks/useNowLine.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/hooks/useNowLine.ts
import { useEffect, useState } from 'react';
import { minutesSinceMidnight } from '@/lib/format';

/**
 * Minutes since local midnight, refreshed while the calendar stays open.
 *
 * 30s is enough resolution for a line on an hour-tall grid row — tighter
 * repaints for no visible difference, and this screen can sit open on a
 * salon tablet for hours.
 */
export function useNowLine(timezone: string): number {
  const [minutes, setMinutes] = useState(() =>
    minutesSinceMidnight(new Date(), timezone),
  );

  useEffect(() => {
    const sync = (): void => setMinutes(minutesSinceMidnight(new Date(), timezone));
    sync();
    const timer = window.setInterval(sync, 30_000);
    return () => window.clearInterval(timer);
  }, [timezone]);

  return minutes;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/hooks/useNowLine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/hooks/useNowLine.ts src/hooks/useNowLine.test.ts
git commit -m "feat(calendar): add useNowLine hook"
```

---

### Task 4: `EventBlock`

**Files:**

- Create: `src/components/dashboard/calendar/EventBlock.tsx`

**Interfaces:**

- Consumes: `STATUS_DOTS` from `@/lib/status` (existing — these are already solid `bg-status-*` classes); `cn` from `@/lib/utils`; `AppointmentStatus` from `@/types`.
- Produces:

  ```ts
  export interface EventBlockProps {
    topPercent: number;
    heightPercent: number;
    variant: 'booked' | 'open';
    status?: AppointmentStatus;
    time: string;
    label: string;
    onClick?: () => void;
  }
  export function EventBlock(props: EventBlockProps): JSX.Element;
  ```

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/EventBlock.tsx
import { STATUS_DOTS } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

export interface EventBlockProps {
  topPercent: number;
  heightPercent: number;
  variant: 'booked' | 'open';
  /** Required when `variant` is `'booked'`. */
  status?: AppointmentStatus;
  time: string;
  label: string;
  onClick?: () => void;
}

/**
 * One positioned block on the hour-axis grid — a booking or a published,
 * unbooked time. `STATUS_DOTS` already resolves to a solid `bg-status-*`
 * class per status, so a booked block's fill reuses it directly rather than
 * introducing a second status-to-colour mapping.
 */
export function EventBlock({
  topPercent,
  heightPercent,
  variant,
  status,
  time,
  label,
  onClick,
}: EventBlockProps): JSX.Element {
  const style = { top: `${topPercent}%`, height: `${heightPercent}%` };

  if (variant === 'open') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={cn(
          'absolute inset-x-1 flex items-center justify-center rounded-md border-2 border-dashed',
          'border-border text-xs text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick && 'hover:border-primary hover:text-primary',
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status ? STATUS_DOTS[status] : 'bg-muted-foreground',
      )}
    >
      <span className="block font-mono text-[11px] font-semibold">{time}</span>
      <span className="block truncate">{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/EventBlock.tsx
git commit -m "feat(calendar): add EventBlock"
```

---

### Task 5: `NowLine` and `AgendaList`

**Files:**

- Create: `src/components/dashboard/calendar/NowLine.tsx`
- Create: `src/components/dashboard/calendar/AgendaList.tsx`

**Interfaces:**

- Produces:

  ```ts
  export function NowLine({ topPercent }: { topPercent: number }): JSX.Element;

  export interface AgendaEntry {
    key: string;
    time: string;
    label: string;
    variant: 'booked' | 'open';
    status?: AppointmentStatus;
    onClick?: () => void;
  }
  export function AgendaList({
    entries,
    emptyLabel,
  }: {
    entries: AgendaEntry[];
    emptyLabel: string;
  }): JSX.Element;
  ```

- [ ] **Step 1: Implement `NowLine`**

```tsx
// src/components/dashboard/calendar/NowLine.tsx
/**
 * The live "now" marker. Reuses the `destructive` token (the closest
 * existing red in the palette, docs/DESIGN.md §3) rather than adding a new
 * one for a single line.
 */
export function NowLine({ topPercent }: { topPercent: number }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{ top: `${topPercent}%` }}
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive"
    >
      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-destructive" />
    </div>
  );
}
```

- [ ] **Step 2: Implement `AgendaList`**

```tsx
// src/components/dashboard/calendar/AgendaList.tsx
import { STATUS_DOTS } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

export interface AgendaEntry {
  key: string;
  time: string;
  label: string;
  variant: 'booked' | 'open';
  status?: AppointmentStatus;
  onClick?: () => void;
}

/**
 * The accessible, chronological alternative to the visual grid — required
 * by docs/DESIGN.md §7, not decorative. Every entry a real `<button>` so it
 * works with no drag and no mouse.
 */
export function AgendaList({
  entries,
  emptyLabel,
}: {
  entries: AgendaEntry[];
  emptyLabel: string;
}): JSX.Element {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.key}>
          <button
            type="button"
            onClick={entry.onClick}
            disabled={!entry.onClick}
            className={cn(
              'flex w-full items-center gap-2.5 py-2 text-left text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              entry.onClick && 'hover:text-primary',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                entry.variant === 'open'
                  ? 'border border-dashed border-muted-foreground'
                  : entry.status
                    ? STATUS_DOTS[entry.status]
                    : 'bg-muted-foreground',
              )}
            />
            <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
              {entry.time}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/NowLine.tsx src/components/dashboard/calendar/AgendaList.tsx
git commit -m "feat(calendar): add NowLine and AgendaList"
```

---

### Task 6: `WeekView`

**Files:**

- Create: `src/components/dashboard/calendar/WeekView.tsx`

**Interfaces:**

- Consumes: `HourRange`, `hourRange`, `offsetPercent`, `hourLabels`, `HOUR_ROW_PX` from `@/lib/calendar` (Task 1); `minutesSinceMidnight` from `@/lib/format`; `useNowLine` (Task 3); `EventBlock` (Task 4); `NowLine` (Task 5); `formatDateShort`, `dayNumber`-equivalent formatting; `OwnerDaySlot` from `@/services/availabilityService`; `AppointmentDetailed` from `@/types`.
- Produces:

  ```ts
  export interface WeekViewProps {
    dates: string[]; // 7 entries, Monday-first
    today: string;
    timezone: string;
    appointmentsByDate: Map<string, AppointmentDetailed[]>;
    openSlotsByDate: Map<string, OwnerDaySlot[]>;
    onSelectAppointment: (appointment: AppointmentDetailed) => void;
    onSelectDate: (date: string) => void;
  }
  export function WeekView(props: WeekViewProps): JSX.Element;
  ```

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/WeekView.tsx
import {
  HOUR_ROW_PX,
  dayNumber,
  hourLabels,
  hourRange,
  offsetPercent,
  WEEKDAY_HEADINGS,
} from '@/lib/calendar';
import { minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { cn } from '@/lib/utils';
import type { OwnerDaySlot } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface WeekViewProps {
  dates: string[];
  today: string;
  timezone: string;
  appointmentsByDate: Map<string, AppointmentDetailed[]>;
  openSlotsByDate: Map<string, OwnerDaySlot[]>;
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  onSelectDate: (date: string) => void;
}

export function WeekView({
  dates,
  today,
  timezone,
  appointmentsByDate,
  openSlotsByDate,
  onSelectAppointment,
  onSelectDate,
}: WeekViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);

  const allMinutes: number[] = [];
  for (const date of dates) {
    for (const a of appointmentsByDate.get(date) ?? []) {
      allMinutes.push(minutesSinceMidnight(a.starts_at, timezone));
      allMinutes.push(minutesSinceMidnight(a.ends_at, timezone));
    }
    for (const s of openSlotsByDate.get(date) ?? []) {
      allMinutes.push(minutesSinceMidnight(s.starts_at, timezone));
    }
  }
  const range = hourRange(allMinutes);
  const labels = hourLabels(range);
  const gridHeight = labels.length * HOUR_ROW_PX;

  /**
   * A real `<table>`, not a `<div>` grid — docs/DESIGN.md §7 requires proper
   * headers on the calendar, not ARIA bolted onto generic elements. Row 0's
   * day cells `rowSpan` the full hour count, so there is exactly one `<td>`
   * per day acting as the positioning container for that day's blocks —
   * later rows contribute only their `<th scope="row">` time label.
   */
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Week of {dates[0]} to {dates[6]}
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-[52px]">
              <span className="sr-only">Time</span>
            </th>
            {dates.map((date) => (
              <th
                key={date}
                scope="col"
                className="border-l border-border py-2.5 text-center font-medium"
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={cn(
                    'flex w-full flex-col items-center gap-0.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {
                      WEEKDAY_HEADINGS[
                        (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
                      ]
                    }
                  </span>
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-[15px]',
                      date === today
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {dayNumber(date)}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th
                scope="row"
                style={{ height: HOUR_ROW_PX }}
                className="pr-2 text-right align-top text-[10px] font-normal text-muted-foreground"
              >
                {label}
              </th>
              {i === 0 &&
                dates.map((date) => {
                  const isToday = date === today;
                  return (
                    <td
                      key={date}
                      rowSpan={labels.length}
                      className={cn(
                        'relative border-l border-border align-top',
                        isToday && 'bg-primary/[0.04]',
                      )}
                    >
                      <div
                        className="relative"
                        style={{
                          height: gridHeight,
                          backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${HOUR_ROW_PX - 1}px, hsl(var(--border)) ${HOUR_ROW_PX - 1}px, hsl(var(--border)) ${HOUR_ROW_PX}px)`,
                        }}
                      >
                        {(openSlotsByDate.get(date) ?? [])
                          .filter((s) => !s.is_booked && !s.is_past)
                          .map((slot) => {
                            const start = minutesSinceMidnight(slot.starts_at, timezone);
                            return (
                              <EventBlock
                                key={slot.starts_at}
                                variant="open"
                                time={slot.local_time}
                                label={`Open · ${slot.local_time}`}
                                topPercent={offsetPercent(start, range)}
                                heightPercent={
                                  offsetPercent(start + 60, range) -
                                  offsetPercent(start, range)
                                }
                              />
                            );
                          })}

                        {(appointmentsByDate.get(date) ?? []).map((appointment) => {
                          const start = minutesSinceMidnight(
                            appointment.starts_at,
                            timezone,
                          );
                          const end = minutesSinceMidnight(appointment.ends_at, timezone);
                          return (
                            <EventBlock
                              key={appointment.id}
                              variant="booked"
                              status={appointment.status}
                              time={appointment.starts_at.slice(11, 16)}
                              label={appointment.customer_name}
                              topPercent={offsetPercent(start, range)}
                              heightPercent={
                                offsetPercent(end, range) - offsetPercent(start, range)
                              }
                              onClick={() => onSelectAppointment(appointment)}
                            />
                          );
                        })}

                        {isToday &&
                          nowMinutes >= range.startMin &&
                          nowMinutes <= range.endMin && (
                            <NowLine topPercent={offsetPercent(nowMinutes, range)} />
                          )}
                      </div>
                    </td>
                  );
                })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Note: `WEEKDAY_HEADINGS` and `dayNumber` are already exported by `src/lib/calendar.ts` (unchanged from before this plan) — this task only adds the import, not new exports.

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/WeekView.tsx
git commit -m "feat(calendar): add WeekView"
```

---

### Task 7: `DayView`

**Files:**

- Create: `src/components/dashboard/calendar/DayView.tsx`

**Interfaces:**

- Consumes: everything `WeekView` consumes (Task 6), plus `AgendaList`/`AgendaEntry` (Task 5) and the existing `DayPanel` (`@/components/dashboard/DayPanel`, unmodified).
- Produces:

  ```ts
  export interface DayViewProps {
    date: string;
    today: string;
    timezone: string;
    appointments: AppointmentDetailed[];
    openSlots: OwnerDaySlot[];
    appointmentMinutes: number;
    onSelectAppointment: (appointment: AppointmentDetailed) => void;
    onChanged: () => void;
  }
  export function DayView(props: DayViewProps): JSX.Element;
  ```

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/DayView.tsx
import { HOUR_ROW_PX, hourLabels, hourRange, offsetPercent } from '@/lib/calendar';
import { formatDateLong, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { AgendaList, type AgendaEntry } from '@/components/dashboard/calendar/AgendaList';
import { DayPanel } from '@/components/dashboard/DayPanel';
import { cn } from '@/lib/utils';
import type { OwnerDaySlot } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface DayViewProps {
  date: string;
  today: string;
  timezone: string;
  appointments: AppointmentDetailed[];
  openSlots: OwnerDaySlot[];
  appointmentMinutes: number;
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  onChanged: () => void;
}

export function DayView({
  date,
  today,
  timezone,
  appointments,
  openSlots,
  appointmentMinutes,
  onSelectAppointment,
  onChanged,
}: DayViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);
  const isToday = date === today;
  const freeSlots = openSlots.filter((s) => !s.is_booked && !s.is_past);

  const allMinutes = [
    ...appointments.flatMap((a) => [
      minutesSinceMidnight(a.starts_at, timezone),
      minutesSinceMidnight(a.ends_at, timezone),
    ]),
    ...freeSlots.map((s) => minutesSinceMidnight(s.starts_at, timezone)),
  ];
  const range = hourRange(allMinutes);
  const labels = hourLabels(range);
  const gridHeight = labels.length * HOUR_ROW_PX;

  const agendaEntries: AgendaEntry[] = [
    ...appointments.map((a) => ({
      key: a.id,
      time: a.starts_at.slice(11, 16),
      label: a.customer_name,
      variant: 'booked' as const,
      status: a.status,
      onClick: () => onSelectAppointment(a),
    })),
    ...freeSlots.map((s) => ({
      key: s.starts_at,
      time: s.local_time,
      label: 'Open',
      variant: 'open' as const,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  // Same real-<table> structure as WeekView (docs/DESIGN.md §7) — here with
  // exactly one day column, so row 0's single `<td>` spans every hour row.
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_15rem]">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            {formatDateLong(`${date}T12:00:00Z`, 'UTC')}
          </h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Schedule for {date}</caption>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label}>
                <th
                  scope="row"
                  style={{ height: HOUR_ROW_PX }}
                  className="w-[52px] pr-2 text-right align-top text-[10px] font-normal text-muted-foreground"
                >
                  {label}
                </th>
                {i === 0 && (
                  <td
                    rowSpan={labels.length}
                    className={cn('relative align-top', isToday && 'bg-primary/[0.04]')}
                  >
                    <div
                      className="relative"
                      style={{
                        height: gridHeight,
                        backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${HOUR_ROW_PX - 1}px, hsl(var(--border)) ${HOUR_ROW_PX - 1}px, hsl(var(--border)) ${HOUR_ROW_PX}px)`,
                      }}
                    >
                      {freeSlots.map((slot) => {
                        const start = minutesSinceMidnight(slot.starts_at, timezone);
                        return (
                          <EventBlock
                            key={slot.starts_at}
                            variant="open"
                            time={slot.local_time}
                            label={`Open · ${slot.local_time}`}
                            topPercent={offsetPercent(start, range)}
                            heightPercent={
                              offsetPercent(start + 60, range) -
                              offsetPercent(start, range)
                            }
                          />
                        );
                      })}

                      {appointments.map((appointment) => {
                        const start = minutesSinceMidnight(
                          appointment.starts_at,
                          timezone,
                        );
                        const end = minutesSinceMidnight(appointment.ends_at, timezone);
                        return (
                          <EventBlock
                            key={appointment.id}
                            variant="booked"
                            status={appointment.status}
                            time={appointment.starts_at.slice(11, 16)}
                            label={appointment.customer_name}
                            topPercent={offsetPercent(start, range)}
                            heightPercent={
                              offsetPercent(end, range) - offsetPercent(start, range)
                            }
                            onClick={() => onSelectAppointment(appointment)}
                          />
                        );
                      })}

                      {isToday &&
                        nowMinutes >= range.startMin &&
                        nowMinutes <= range.endMin && (
                          <NowLine topPercent={offsetPercent(nowMinutes, range)} />
                        )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agenda
          </h3>
          <AgendaList entries={agendaEntries} emptyLabel="Nothing on this day yet." />
        </div>

        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Manage published times
          </summary>
          <div className="mt-3">
            <DayPanel
              date={date}
              timezone={timezone}
              appointmentMinutes={appointmentMinutes}
              onChanged={onChanged}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/DayView.tsx
git commit -m "feat(calendar): add DayView"
```

---

### Task 8: `MonthView`

**Files:**

- Create: `src/components/dashboard/calendar/MonthView.tsx`
- Modify: `src/pages/dashboard/CalendarPage.tsx` — only to remove the month-grid JSX being extracted (the full rewrite happens in Task 10; this step just deletes what moved so the file isn't left with dead duplicate JSX mid-plan). If that removal makes `CalendarPage.tsx` fail to typecheck before Task 10 replaces its data logic too, that's expected — Task 10 finishes the file. Skip this deletion if it would leave the page in a broken intermediate state; simplest is to leave `CalendarPage.tsx` untouched here and let Task 10 replace it wholesale.

**Interfaces:**

- Consumes: `monthGrid`, `dayNumber`, `isSameMonth`, `WEEKDAY_HEADINGS` from `@/lib/calendar` (unchanged, pre-existing exports); `DaySummary` from `@/services/availabilityService`; `AppointmentDetailed` from `@/types`; `cn` from `@/lib/utils`.
- Produces:
  ```ts
  export interface MonthViewProps {
    year: number;
    month: number;
    today: string;
    summary: Map<string, DaySummary>;
    appointmentsByDate: Map<string, AppointmentDetailed[]>;
    onSelectDate: (date: string) => void;
  }
  export function MonthView(props: MonthViewProps): JSX.Element;
  ```

**Decision worth flagging to the reviewer:** clicking any day cell (not just "+N more") now switches straight to `DayView` for that date. The old month page kept `DayPanel` permanently visible beside the grid; that quick-publish path now costs one extra click (cell → Day view → expand "Manage published times"). Traded for a much better month-at-a-glance view. If this turns out to slow down the owner's actual daily workflow, a fast follow-up is a small "publish" affordance directly on hover/long-press of a month cell — not part of this plan.

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/MonthView.tsx
import { WEEKDAY_HEADINGS, dayNumber, isSameMonth, monthGrid } from '@/lib/calendar';
import { STATUS_DOTS } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { DaySummary } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface MonthViewProps {
  year: number;
  month: number;
  today: string;
  summary: Map<string, DaySummary>;
  appointmentsByDate: Map<string, AppointmentDetailed[]>;
  onSelectDate: (date: string) => void;
}

const MAX_PILLS = 2;

export function MonthView({
  year,
  month,
  today,
  summary,
  appointmentsByDate,
  onSelectDate,
}: MonthViewProps): JSX.Element {
  const weeks = monthGrid(year, month);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted">
        {WEEKDAY_HEADINGS.map((heading) => (
          <div
            key={heading}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {heading}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const row = summary.get(date);
          const inMonth = isSameMonth(date, year, month);
          const isToday = date === today;
          const appointments = appointmentsByDate.get(date) ?? [];
          const pills = appointments.slice(0, MAX_PILLS);
          const overflow = appointments.length - pills.length;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              aria-label={`${date}: ${row?.slot_count ?? 0} times, ${row?.booked_count ?? 0} booked`}
              className={cn(
                'flex min-h-[6.5rem] flex-col items-start gap-0.5 border-b border-r border-border p-2 text-left',
                'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                inMonth ? 'bg-card hover:bg-muted' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-sm',
                  isToday
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {dayNumber(date)}
              </span>

              {inMonth &&
                pills.map((a) => (
                  <span
                    key={a.id}
                    className={cn(
                      'w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white',
                      STATUS_DOTS[a.status],
                    )}
                  >
                    {a.starts_at.slice(11, 16)} {a.customer_name.split(' ')[0]}
                  </span>
                ))}
              {overflow > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  +{overflow} more
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/MonthView.tsx
git commit -m "feat(calendar): add MonthView with event pills"
```

---

### Task 9: `CalendarShell`

**Files:**

- Create: `src/components/dashboard/calendar/CalendarShell.tsx`

**Interfaces:**

- Consumes: `CalendarView` type from `@/lib/calendar` (Task 1).
- Produces:

  ```ts
  export interface CalendarShellProps {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
  }
  export function CalendarShell(props: CalendarShellProps): JSX.Element;
  ```

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/CalendarShell.tsx
import { cn } from '@/lib/utils';
import type { CalendarView } from '@/lib/calendar';

export interface CalendarShellProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
];

/** The Week / Day / Month tab switcher. Navigation (prev/today/next) stays in `CalendarPage`'s existing header `actions` slot — this is only the mode switch. */
export function CalendarShell({ view, onViewChange }: CalendarShellProps): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex gap-0.5 rounded-lg bg-muted p-1"
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={view === v.key}
          onClick={() => onViewChange(v.key)}
          className={cn(
            'rounded-md px-3.5 py-1.5 text-sm font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            view === v.key
              ? 'bg-card text-foreground shadow-card'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/calendar/CalendarShell.tsx
git commit -m "feat(calendar): add CalendarShell view tabs"
```

---

### Task 10: Rewrite `CalendarPage`

**Files:**

- Modify (rewrite): `src/pages/dashboard/CalendarPage.tsx`

**Interfaces:**

- Consumes everything from Tasks 1–9, plus existing: `DashboardLayout`, `Button`, `Card`, `ErrorState`, `useBusinessSettings`, `useServices`, `listMonthSummary`/`listDaySlots` (`@/services/availabilityService`), `listAppointments` (`@/services/appointmentService`), `AppointmentCard` (`@/components/dashboard/AppointmentCard`), `setAppointmentStatus`/`setOwnerNote`, `salonDayRange`, `toSalonDate`, `parseDate`/`monthGrid`/`gridRange`/`weekDates`/`shiftAnchor` from `@/lib/calendar`, `LIVE_STATUSES` from `@/types`.
- Produces: default-exported `CalendarPage` page component (route unchanged, still `routes.owner.calendar`).

- [ ] **Step 1: Implement**

```tsx
// src/pages/dashboard/CalendarPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarShell } from '@/components/dashboard/calendar/CalendarShell';
import { WeekView } from '@/components/dashboard/calendar/WeekView';
import { DayView } from '@/components/dashboard/calendar/DayView';
import { MonthView } from '@/components/dashboard/calendar/MonthView';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useServices } from '@/hooks/useServices';
import {
  listMonthSummary,
  listDaySlots,
  type DaySummary,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import {
  listAppointments,
  setAppointmentStatus,
  setOwnerNote,
} from '@/services/appointmentService';
import { salonDayRange, toSalonDate } from '@/lib/format';
import {
  gridRange,
  monthGrid,
  monthLabel,
  parseDate,
  shiftAnchor,
  weekDates,
  type CalendarView,
} from '@/lib/calendar';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

function groupByDate(
  appointments: AppointmentDetailed[],
  timezone: string,
): Map<string, AppointmentDetailed[]> {
  const map = new Map<string, AppointmentDetailed[]>();
  for (const a of appointments) {
    const date = toSalonDate(a.starts_at, timezone);
    const list = map.get(date) ?? [];
    list.push(a);
    map.set(date, list);
  }
  return map;
}

export function CalendarPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { services } = useServices(true);
  const today = toSalonDate(new Date(), timezone);
  const appointmentMinutes = services[0]?.duration_min ?? 60;

  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [summary, setSummary] = useState<Map<string, DaySummary>>(new Map());
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [daySlots, setDaySlots] = useState<Map<string, OwnerDaySlot[]>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  const cursor = useMemo(
    () => ({
      year: parseDate(anchor).getUTCFullYear(),
      month: parseDate(anchor).getUTCMonth(),
    }),
    [anchor],
  );

  const visibleDates = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') return weekDates(anchor);
    return gridRange(cursor.year, cursor.month);
  }, [view, anchor, cursor]);

  const range = useMemo(() => {
    if (view === 'month') {
      const r = gridRange(cursor.year, cursor.month);
      return { from: r.from, to: r.to };
    }
    const dates = visibleDates as string[];
    return { from: dates[0] ?? anchor, to: dates[dates.length - 1] ?? anchor };
  }, [view, cursor, visibleDates, anchor]);

  const requestId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = (requestId.current += 1);
    try {
      const needsSummary = view === 'month';
      const needsSlots = view === 'week' || view === 'day';
      const dates =
        view === 'month'
          ? monthGrid(cursor.year, cursor.month).flat()
          : (visibleDates as string[]);

      const [summaryRows, appts, slotRows] = await Promise.all([
        needsSummary ? listMonthSummary(range.from, range.to) : Promise.resolve([]),
        listAppointments({
          from: salonDayRange(range.from, timezone).start,
          to: salonDayRange(range.to, timezone).end,
          statuses: [...LIVE_STATUSES],
        }),
        needsSlots ? Promise.all(dates.map((d) => listDaySlots(d))) : Promise.resolve([]),
      ]);

      if (id !== requestId.current) return;

      setSummary(new Map(summaryRows.map((r) => [r.on_date, r])));
      setAppointments(appts);
      if (needsSlots) {
        setDaySlots(new Map(dates.map((d, i) => [d, slotRows[i] ?? []])));
      } else {
        setDaySlots(new Map());
      }
      setError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [view, cursor, range.from, range.to, timezone, visibleDates]);

  useEffect(() => {
    void load();
  }, [load]);

  const appointmentsByDate = useMemo(
    () => groupByDate(appointments, timezone),
    [appointments, timezone],
  );
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const changeStatus = useCallback(
    async (id: string, status: AppointmentStatus): Promise<void> => {
      await setAppointmentStatus(id, status);
      await load();
    },
    [load],
  );

  const saveNote = useCallback(async (id: string, note: string): Promise<void> => {
    await setOwnerNote(id, note);
  }, []);

  const heading =
    view === 'month'
      ? monthLabel(cursor.year, cursor.month)
      : view === 'week'
        ? `${(visibleDates as string[])[0]} – ${(visibleDates as string[])[6]}`
        : anchor;

  return (
    <DashboardLayout
      title="Calendar"
      subtitle={heading}
      actions={
        <div className="flex items-center gap-3">
          <CalendarShell view={view} onViewChange={setView} />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous"
              onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
            >
              ‹
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next"
              onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}
            >
              ›
            </Button>
          </div>
        </div>
      }
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      {view === 'month' && (
        <MonthView
          year={cursor.year}
          month={cursor.month}
          today={today}
          summary={summary}
          appointmentsByDate={appointmentsByDate}
          onSelectDate={(date) => {
            setAnchor(date);
            setView('day');
          }}
        />
      )}

      {view === 'week' && (
        <WeekView
          dates={visibleDates as string[]}
          today={today}
          timezone={timezone}
          appointmentsByDate={appointmentsByDate}
          openSlotsByDate={daySlots}
          onSelectAppointment={(a) => setSelectedId(a.id)}
          onSelectDate={(date) => {
            setAnchor(date);
            setView('day');
          }}
        />
      )}

      {view === 'day' && (
        <DayView
          date={anchor}
          today={today}
          timezone={timezone}
          appointments={appointmentsByDate.get(anchor) ?? []}
          openSlots={daySlots.get(anchor) ?? []}
          appointmentMinutes={appointmentMinutes}
          onSelectAppointment={(a) => setSelectedId(a.id)}
          onChanged={() => void load()}
        />
      )}

      {selected && (
        <Card className="mt-5 p-0">
          <AppointmentCard
            appointment={selected}
            timezone={timezone}
            onStatusChange={changeStatus}
            onNoteSave={saveNote}
            className="border-0"
          />
        </Card>
      )}
    </DashboardLayout>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any drift between this file's usage and the exact exports from Tasks 1–9 before moving on — this task is the integration point where a mismatched name or type surfaces.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: PASS — this task adds no new tests of its own (page-level, not unit-tested per this repo's convention), but must not break Tasks 1–3's tests or any pre-existing suite.

- [ ] **Step 4: Run it and look at it**

```bash
npm run dev
```

Open `http://localhost:5082/dashboard/calendar`, sign in as the owner. Check: Week view renders with real appointments and open slots positioned correctly; the now-line sits at the actual current time on today's column; Day view's Agenda list matches the grid; Month view's pills match what Week/Day show for the same dates; clicking an appointment block opens its `AppointmentCard` below the grid with working status-change buttons; clicking a month cell or a week-view day header jumps into Day view for that date; "Manage published times" in Day view still publishes/removes times exactly as `DayPanel` did before.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/CalendarPage.tsx
git commit -m "feat(calendar): wire Week/Day/Month views into CalendarPage"
```

---

## Explicitly out of scope for this plan

Per the design spec's suggested build order, these are separate follow-on plans:

- Migration `0024` and `reschedule_appointment_as_owner`.
- Pointer-based drag-to-reschedule.
- The `AgendaList` "Move" modal (needs the RPC above — `AgendaList` in this plan is read-only for the `open` variant, and booked entries only open the detail card).
