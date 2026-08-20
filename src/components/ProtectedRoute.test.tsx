import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';

const mockAuth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  signOut: vi.fn(async () => {}),
}));
const mockOwner = vi.hoisted(() => ({
  isOwner: false,
  loading: false,
  failed: false,
  retry: vi.fn(),
}));

vi.mock('@/hooks/useSupabaseAuth', () => ({ useSupabaseAuth: () => mockAuth }));
vi.mock('@/hooks/useIsOwner', () => ({ useIsOwner: () => mockOwner }));

const { ProtectedRoute } = await import('@/components/ProtectedRoute');

/** Surfaces the redirect state's `from` so tests can assert what survived
 * the round trip, without disturbing the plain "Login page" text the other
 * tests already look for. */
function LoginPageStub(): JSX.Element {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return (
    <div>
      <p>Login page</p>
      <p data-testid="redirect-from">{from}</p>
    </div>
  );
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPageStub />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <p>Dashboard</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/inbox"
          element={
            <ProtectedRoute>
              <p>Dashboard</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * The gate has four states, and conflating two of them locked the owner out.
 * `is_owner()` goes through postgrest-js, which *resolves* with `{ error }` when
 * the request never reaches the server — so a dropped request used to render
 * "you are not salon staff", a screen whose only control is Sign out.
 *
 * Also the router smoke test: these exercise real `MemoryRouter` navigation and
 * `<Navigate>` redirects, which is the coverage the v6 to v7 upgrade needed.
 */
describe('ProtectedRoute', () => {
  it('sends a signed-out visitor to the login page', () => {
    Object.assign(mockAuth, { user: null, loading: false });
    Object.assign(mockOwner, { isOwner: false, loading: false, failed: false });

    renderAt('/dashboard');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('preserves the query string through the login redirect (Fix E)', () => {
    Object.assign(mockAuth, { user: null, loading: false });
    Object.assign(mockOwner, { isOwner: false, loading: false, failed: false });

    // A bookmarked deep link — e.g. a specific Inbox tab — must round-trip
    // through login intact. Capturing only `location.pathname` used to drop
    // everything after the `?`, landing the owner back on whatever the
    // default tab resolves to instead of the one she bookmarked.
    renderAt('/dashboard/inbox?tab=requests');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('redirect-from')).toHaveTextContent(
      '/dashboard/inbox?tab=requests',
    );
  });

  it('lets salon staff through', () => {
    Object.assign(mockAuth, { user: { id: 'u1' }, loading: false });
    Object.assign(mockOwner, { isOwner: true, loading: false, failed: false });

    renderAt('/dashboard');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows the closed door to a signed-in non-staff account', () => {
    Object.assign(mockAuth, { user: { id: 'u2' }, loading: false });
    Object.assign(mockOwner, { isOwner: false, loading: false, failed: false });

    renderAt('/dashboard');
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('offers a retry — NOT the closed door — when the check could not be made', () => {
    Object.assign(mockAuth, { user: { id: 'u1' }, loading: false });
    Object.assign(mockOwner, { isOwner: false, loading: false, failed: true });

    renderAt('/dashboard');

    expect(screen.getByText('Cannot reach the salon right now')).toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('re-asks when the retry is pressed', async () => {
    Object.assign(mockAuth, { user: { id: 'u1' }, loading: false });
    Object.assign(mockOwner, { isOwner: false, loading: false, failed: true });
    mockOwner.retry.mockClear();

    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mockOwner.retry).toHaveBeenCalledOnce();
  });

  /**
   * The actual production shape post-fix: one pathless parent route mounts
   * `<ProtectedRoute><Outlet/></ProtectedRoute>` once, and every dashboard
   * page is a plain child route with no wrapper of its own — this is what
   * stops the gate (and its `is_owner` check) from remounting per navigation.
   * `renderAt` above still covers the explicit-children usage; this covers
   * the `children ?? <Outlet/>` fallback the fix introduced.
   */
  describe('as a layout route (children ?? <Outlet/>)', () => {
    function renderLayout(initialPath: string): void {
      render(
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<LoginPageStub />} />
            <Route
              element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <div>
                    <p>Today</p>
                    <Link to="/dashboard/inbox">Go to inbox</Link>
                  </div>
                }
              />
              <Route path="/dashboard/inbox" element={<p>Inbox</p>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    }

    it('gates first entry into a nested route exactly like the explicit-children usage', () => {
      Object.assign(mockAuth, { user: null, loading: false });
      Object.assign(mockOwner, { isOwner: false, loading: false, failed: false });

      renderLayout('/dashboard/inbox');
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });

    it('lets an owner navigate between sibling child routes without hitting the gate again', async () => {
      Object.assign(mockAuth, { user: { id: 'u1' }, loading: false });
      Object.assign(mockOwner, { isOwner: true, loading: false, failed: false });

      renderLayout('/dashboard');
      expect(screen.getByText('Today')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('link', { name: 'Go to inbox' }));

      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.queryByText('Login page')).not.toBeInTheDocument();
      expect(screen.queryByText('No access')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Cannot reach the salon right now'),
      ).not.toBeInTheDocument();
    });
  });
});
