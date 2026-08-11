import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/dashboard"
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
});
