import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScheduleTimeline } from '@/components/dashboard/today/ScheduleTimeline';
import type { AppointmentDetailed } from '@/types';

/**
 * A block on Today's schedule is sized by how long the booking is, so whether
 * its second line fits is a fact about that one block, not about the viewport.
 *
 * Before this, the row carried `hidden lg:flex`. That hid the time and status
 * on a tablet block with room to spare, and still let a short desktop block
 * clip. Before *that* it had no guard at all, and flex squashed the customer's
 * name to a 1px sliver on a phone while the row below, held open by the status
 * chip, kept its full height: the owner's own day named nobody.
 *
 * The axis is 12 opening hours (08:00 to 20:00), so a block's height is its
 * length as a fraction of 720 minutes. Against a 720px axis that is a
 * convenient 1px per minute.
 */

const AXIS_HEIGHT = { current: 720 };

class StubResizeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.cb(
      [{ contentRect: { height: AXIS_HEIGHT.current } } as ResizeObserverEntry],
      this,
    );
    void target;
  }
  unobserve(): void {}
  disconnect(): void {}
}

let original: typeof globalThis.ResizeObserver;
beforeEach(() => {
  original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = StubResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
  vi.restoreAllMocks();
});

/** The block itself, so an assertion cannot match the hour axis label behind it. */
function block(): HTMLElement {
  return screen.getByRole('button', { name: /Harni M/ });
}

/**
 * `AppointmentDetailed` is a wide database row and this component reads five
 * fields of it, so the fixture supplies those five rather than inventing
 * plausible values for thirty columns that no assertion here depends on.
 */
function appointment(startsAt: string, endsAt: string): AppointmentDetailed {
  return {
    id: 'a1',
    customer_name: 'Harni M',
    status: 'confirmed',
    starts_at: startsAt,
    ends_at: endsAt,
  } as unknown as AppointmentDetailed;
}

function renderAt(axisHeight: number, startsAt: string, endsAt: string): void {
  AXIS_HEIGHT.current = axisHeight;
  render(
    <ScheduleTimeline
      appointments={[appointment(startsAt, endsAt)]}
      timezone="Europe/London"
      nextUpId={null}
      expandedId={null}
      onToggle={() => {}}
    />,
  );
}

describe('a timeline block spends its first line on the name', () => {
  it('shows the time and status when the block is tall enough for both', () => {
    // 55 minutes on a 720px axis is a 55px block. Give it the desktop axis.
    renderAt(760, '2026-09-09T08:00:00Z', '2026-09-09T08:58:00Z');

    expect(within(block()).getByText('Harni M')).toBeInTheDocument();
    expect(within(block()).getByText('09:00')).toBeInTheDocument();
    expect(within(block()).getByText('Confirmed')).toBeInTheDocument();
  });

  it('keeps the name and stands the rest down when the block is one line tall', () => {
    // The same 55-minute booking against the 480px floor a phone card gets:
    // 37px, which is one line.
    renderAt(480, '2026-09-09T08:00:00Z', '2026-09-09T08:58:00Z');

    expect(within(block()).getByText('Harni M')).toBeInTheDocument();
    expect(within(block()).queryByText('09:00')).not.toBeInTheDocument();
    expect(within(block()).queryByText('Confirmed')).not.toBeInTheDocument();
  });

  it('shows both on a phone as soon as the booking is long enough', () => {
    // Two hours against the same 480px floor is 80px, which fits both lines.
    // A breakpoint could not tell these two cases apart.
    renderAt(480, '2026-09-09T08:00:00Z', '2026-09-09T10:00:00Z');

    expect(within(block()).getByText('Harni M')).toBeInTheDocument();
    expect(within(block()).getByText('09:00')).toBeInTheDocument();
  });

  it('names the customer before it has measured anything', () => {
    // An observer that never fires leaves the axis at 0. The name is the one
    // thing that must survive that, because it survives every other case too.
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };

    render(
      <ScheduleTimeline
        appointments={[appointment('2026-09-09T08:00:00Z', '2026-09-09T10:00:00Z')]}
        timezone="Europe/London"
        nextUpId={null}
        expandedId={null}
        onToggle={() => {}}
      />,
    );

    expect(within(block()).getByText('Harni M')).toBeInTheDocument();
  });

  it('opens a dialog rather than claiming to expand in place', () => {
    renderAt(760, '2026-09-09T08:00:00Z', '2026-09-09T10:00:00Z');

    expect(block()).toHaveAttribute('aria-haspopup', 'dialog');
  });
});
