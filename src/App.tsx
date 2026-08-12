import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomePage } from '@/pages/HomePage';
import { BookPage } from '@/pages/BookPage';
import { RequestAvailabilityPage } from '@/pages/RequestAvailabilityPage';
import { SubscribePage } from '@/pages/SubscribePage';
import { MyBookingsPage } from '@/pages/MyBookingsPage';
import { PrivacyPage, BookingPolicyPage, TermsPage } from '@/pages/PolicyPages';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TodayPage } from '@/pages/dashboard/TodayPage';
import { CalendarPage } from '@/pages/dashboard/CalendarPage';
import { WeeklyDefaultPage } from '@/pages/dashboard/WeeklyDefaultPage';
import { ApprovalsPage } from '@/pages/dashboard/ApprovalsPage';
import { AppointmentsPage } from '@/pages/dashboard/AppointmentsPage';
import { CustomersPage } from '@/pages/dashboard/CustomersPage';
import { AppointmentTypePage } from '@/pages/dashboard/AppointmentTypePage';
import { ServiceMenuPage } from '@/pages/dashboard/ServiceMenuPage';
import { AssistantPage } from '@/pages/dashboard/AssistantPage';
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
            <Route path={routes.public.book} element={<BookPage />} />
            <Route
              path={routes.public.requestAvailability}
              element={<RequestAvailabilityPage />}
            />
            {/* Customer identity is passwordless: /access/:token redeems a
                single-use link, /my uses the session it produced. */}
            <Route path={routes.public.subscribe} element={<SubscribePage />} />

            <Route path="/access/:token" element={<MyBookingsPage />} />
            <Route path={routes.customer.home} element={<MyBookingsPage />} />
            <Route path={routes.customer.appointments} element={<MyBookingsPage />} />

            <Route path={routes.public.privacy} element={<PrivacyPage />} />
            <Route path={routes.public.bookingPolicy} element={<BookingPolicyPage />} />
            <Route path={routes.public.terms} element={<TermsPage />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path={routes.auth.resetPassword} element={<ResetPasswordPage />} />

            <Route path={routes.owner.dashboard} element={owner(<TodayPage />)} />
            <Route path={routes.owner.approvals} element={owner(<ApprovalsPage />)} />
            <Route
              path={routes.owner.appointments}
              element={owner(<AppointmentsPage />)}
            />
            {/* Requests is a tab inside AppointmentsPage, not its own page —
                the route stays so `routes.owner.requests` links (Today's
                "New enquiries" stat) still land on the right tab. */}
            <Route path={routes.owner.requests} element={owner(<AppointmentsPage />)} />
            <Route path={routes.owner.customers} element={owner(<CustomersPage />)} />
            <Route
              path={routes.owner.appointmentType}
              element={owner(<AppointmentTypePage />)}
            />
            <Route path={routes.owner.serviceMenu} element={owner(<ServiceMenuPage />)} />
            <Route path={routes.owner.settings} element={owner(<SettingsPage />)} />

            <Route path={routes.owner.calendar} element={owner(<CalendarPage />)} />
            <Route
              path={routes.owner.weeklyDefault}
              element={owner(<WeeklyDefaultPage />)}
            />

            <Route path={routes.owner.assistant} element={owner(<AssistantPage />)} />

            {/* Not built yet — send this to the dashboard rather than a 404,
                so a stale bookmark does not look like a broken app. */}
            <Route
              path={routes.owner.reports}
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
