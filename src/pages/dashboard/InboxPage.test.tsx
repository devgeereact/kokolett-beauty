import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

interface FakeSummary {
  pending_approval_count: number;
  new_request_count: number;
}

/** A pending-approval row shaped like `AppointmentDetailed`, minus the fields
 * the Approvals card doesn't read. */
function makeApproval(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    reference: `REF-${id}`,
    customer_name: 'Demo Customer',
    customer_email: 'demo@example.invalid',
    customer_mobile: null,
    service_name: 'Hair Appointment',
    price_pence: 4500,
    starts_at: '2026-08-20T10:00:00Z',
    ends_at: '2026-08-20T11:00:00Z',
    approval_deadline: '2026-08-20T09:00:00Z',
    customer_note: null,
    created_at: '2026-08-19T09:00:00Z',
    ...overrides,
  };
}

const summaryBus = vi.hoisted(() => {
  let current: FakeSummary | null = null;
  const listeners = new Set<(s: FakeSummary | null) => void>();
  return {
    get: () => current,
    set: (next: FakeSummary | null) => {
      current = next;
      listeners.forEach((l) => l(next));
    },
    subscribe: (l: (s: FakeSummary | null) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});

const approvalsBus = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/hooks/useSupabaseAuth', () => ({
  useSupabaseAuth: () => ({ user: { email: 'owner@example.invalid' }, signOut: vi.fn() }),
}));

vi.mock('@/hooks/useBusinessSettings', () => ({
  useBusinessSettings: () => ({ timezone: 'Europe/London', settings: null }),
}));

// Stable identity across renders, matching the real hook's `useCallback`'d
// `load`. An inline `vi.fn()` recreated on every render would give
// InboxPage's `loadApprovals` (itself `useCallback([refreshSummary])`) a new
// dependency every render, re-triggering its own mount effect in a loop.
const refreshSummaryMock = vi.fn(() => {
  // Simulates the server round trip a real refreshSummary() makes: the
  // count reflects however many approval rows are left.
  summaryBus.set({
    pending_approval_count: approvalsBus.rows.length,
    new_request_count: 3,
  });
  return Promise.resolve();
});

vi.mock('@/hooks/useOwnerSummary', () => ({
  useOwnerSummary: () => {
    const [summary, setSummary] = useState<FakeSummary | null>(summaryBus.get());
    useEffect(() => {
      const unsubscribe = summaryBus.subscribe(setSummary);
      return () => {
        unsubscribe();
      };
    }, []);
    return {
      summary,
      loading: false,
      error: null,
      refresh: refreshSummaryMock,
    };
  },
}));

vi.mock('@/services/appointmentService', () => ({
  listPendingApprovals: vi.fn(() => Promise.resolve([...approvalsBus.rows])),
  getApprovalStats: vi.fn(() =>
    Promise.resolve({
      avgWaitMinutes: null,
      approvedPercent: null,
      thisWeekCount: approvalsBus.rows.length,
    }),
  ),
  approveAppointment: vi.fn((id: string) => {
    approvalsBus.rows = approvalsBus.rows.filter((r) => r.id !== id);
    return Promise.resolve();
  }),
  rejectAppointment: vi.fn(() => Promise.resolve()),
}));

// RequestsQueue (real, unmocked, so mounting the Requests tab exercises the
// actual component) pulls in requestService itself — stub it so the
// explicit-`?tab=requests` test doesn't reach for a real Supabase client.
vi.mock('@/services/requestService', () => ({
  listQueuedRequests: vi.fn(() => Promise.resolve([])),
  listAllRequests: vi.fn(() => Promise.resolve([])),
  offerSlotToRequest: vi.fn(() => Promise.resolve({})),
  declineRequest: vi.fn(() => Promise.resolve()),
  setRequestOwnerNote: vi.fn(() => Promise.resolve()),
  whoIsAhead: vi.fn(() => null),
}));

const { InboxPage } = await import('@/pages/dashboard/InboxPage');

/** The active tab button carries `bg-primary text-primary-foreground`; the
 * inactive one doesn't. Reading this off the rendered DOM (rather than
 * asserting on component internals) is what makes this a true regression
 * test for what the owner actually sees. */
function activeTabLabel(): string | null {
  const buttons = screen.getAllByRole('button', { name: /Approvals|Requests/ });
  for (const btn of buttons) {
    if (
      btn.className.includes('bg-primary') &&
      btn.className.includes('text-primary-foreground')
    ) {
      return btn.textContent?.replace(/\d+$/, '').trim() ?? null;
    }
  }
  return null;
}

function renderInbox(initialPath: string): void {
  render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <InboxPage />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

/**
 * Regression coverage for a shipped, owner-facing bug: on a bare
 * `/dashboard/inbox` URL, `defaultTab` used to be a plain `const` recomputed
 * from live `summary` state on every render. Because `summary` is refreshed
 * after every approve/decline, the visible tab kept tracking
 * `pending_approval_count` for the component's whole lifetime — an owner
 * could open Inbox on Approvals, approve the last pending item, and watch
 * the page silently swap to Requests mid-interaction with no click and no
 * URL change.
 *
 * The fix freezes `defaultTab` the first time `summary` becomes available
 * and never recomputes it. These tests exist specifically because this page
 * is flagged for a Phase 2 tab-machinery rewrite that is likely to touch
 * this exact code path again — deleting this coverage after proving the fix
 * once would leave the regression class unguarded going into that rewrite.
 */
describe('InboxPage — default tab freeze', () => {
  it('does not swap tabs when summary alone changes, with no user action', async () => {
    approvalsBus.rows = [makeApproval('apt-1')];
    summaryBus.set({ pending_approval_count: 1, new_request_count: 3 });

    renderInbox('/dashboard/inbox');

    await waitFor(() =>
      expect(screen.getAllByText('Demo Customer').length).toBeGreaterThan(0),
    );
    expect(activeTabLabel()).toBe('Approvals');

    // Nothing the owner did — just the summary itself reporting the count
    // is now zero (e.g. another tab, a webhook, a background refetch).
    act(() => {
      summaryBus.set({ pending_approval_count: 0, new_request_count: 3 });
    });

    expect(activeTabLabel()).toBe('Approvals');
  });

  it('does not swap from Approvals to Requests when the last pending approval is approved', async () => {
    approvalsBus.rows = [makeApproval('apt-1')];
    summaryBus.set({ pending_approval_count: 1, new_request_count: 3 });

    renderInbox('/dashboard/inbox');

    // Bare URL, one pending approval — both the pre-fix and fixed code
    // default here, so this is the exact scenario from the bug report.
    await waitFor(() =>
      expect(screen.getAllByText('Demo Customer').length).toBeGreaterThan(0),
    );
    expect(activeTabLabel()).toBe('Approvals');

    // `findByRole`, not `getByRole`. The button lives in ApprovalDetailPanel,
    // which renders only once `selectedId` has been set, and that happens in an
    // effect one render *after* the card text this test waited on above. Locally
    // the two land in the same tick and `getByRole` appeared to work; on a
    // loaded CI runner it did not, which is exactly the sort of race a
    // synchronous query hides until it matters.
    await userEvent.click(await screen.findByRole('button', { name: 'Approve booking' }));

    // The approval lands, the row disappears, and pending_approval_count
    // (via the mocked refresh, exercising the same code path
    // `loadApprovals()` really calls) drops to 0 — the trigger for the bug.
    // The queue then shows its real empty state.
    await waitFor(() => {
      expect(
        screen.getByText(/Your published hours book instantly for everyone/),
      ).toBeInTheDocument();
    });

    // Still Approvals. No click on Requests, no `?tab=` in the URL — the
    // tab must not have moved on its own.
    expect(activeTabLabel()).toBe('Approvals');
  });

  it('still honours an explicit ?tab= over the frozen default', async () => {
    approvalsBus.rows = [makeApproval('apt-1')];
    summaryBus.set({ pending_approval_count: 1, new_request_count: 3 });

    // Default would resolve to Approvals (count > 0); the explicit query
    // string must win regardless.
    renderInbox('/dashboard/inbox?tab=requests');

    expect(activeTabLabel()).toBe('Requests');
    // Let RequestsQueue's own mocked fetch settle before the test tears down.
    await screen.findByText('Nobody waiting');
  });
});
