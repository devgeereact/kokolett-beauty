import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TodayPage } from '@/pages/dashboard/TodayPage';
import { ApprovalsPage } from '@/pages/dashboard/ApprovalsPage';
import { AppointmentsPage } from '@/pages/dashboard/AppointmentsPage';
import { RequestsPage } from '@/pages/dashboard/RequestsPage';
import { CustomersPage } from '@/pages/dashboard/CustomersPage';
import { ServicesPage } from '@/pages/dashboard/ServicesPage';
import { AvailabilityPage } from '@/pages/dashboard/AvailabilityPage';
import { SettingsPage } from '@/pages/dashboard/SettingsPage';
import { routes } from '@/lib/routes';

/**
 * Owner routes are wrapped individually rather than by a layout route, because
 * each page owns its own `DashboardLayout` header, badges and actions — a
 * shared parent would have to guess them.
 */
function owner(element: JSX.Element): JSX.Element {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path={routes.public.home} element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path={routes.owner.dashboard} element={owner(<TodayPage />)} />
            <Route path={routes.owner.approvals} element={owner(<ApprovalsPage />)} />
            <Route
              path={routes.owner.appointments}
              element={owner(<AppointmentsPage />)}
            />
            <Route path={routes.owner.requests} element={owner(<RequestsPage />)} />
            <Route path={routes.owner.customers} element={owner(<CustomersPage />)} />
            <Route path={routes.owner.services} element={owner(<ServicesPage />)} />
            <Route
              path={routes.owner.availability}
              element={owner(<AvailabilityPage />)}
            />
            <Route path={routes.owner.settings} element={owner(<SettingsPage />)} />

            {/* Not built yet — send these to the dashboard rather than a 404,
                so a stale bookmark does not look like a broken app. */}
            <Route
              path={routes.owner.calendar}
              element={<Navigate to={routes.owner.appointments} replace />}
            />
            <Route
              path={routes.owner.reports}
              element={<Navigate to={routes.owner.dashboard} replace />}
            />
            <Route
              path={routes.owner.assistant}
              element={<Navigate to={routes.owner.dashboard} replace />}
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Global PWA affordances */}
          <UpdatePrompt />
          <InstallPrompt />
          <OfflineBanner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
