import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { LoadingState } from '@/components/ui/States';
import { HomePage } from '@/pages/HomePage';
import { BookPage } from '@/pages/BookPage';
import { RequestAvailabilityPage } from '@/pages/RequestAvailabilityPage';
import { SubscribePage } from '@/pages/SubscribePage';
import { MyBookingsPage } from '@/pages/MyBookingsPage';
import { PrivacyPage, BookingPolicyPage, TermsPage } from '@/pages/PolicyPages';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { routes } from '@/lib/routes';

/**
 * The customer-facing pages above are imported eagerly: they are the whole
 * reason a stranger opens this site, and a spinner on the booking page to save
 * bytes the browser then has to fetch anyway is a bad trade.
 *
 * The owner dashboard is the opposite. It is seventeen screens — the calendar
 * grid, the reports charts, the email template editor, the AI assistant — and
 * exactly one person ever signs in to it. Statically imported, all of it sat in
 * the same entry chunk as the booking form, so every customer downloaded the
 * salon's back office to pick a time. Lazily, none of it is fetched until
 * somebody actually navigates into /dashboard.
 */
const TodayPage = lazy(() =>
  import('@/pages/dashboard/TodayPage').then((m) => ({ default: m.TodayPage })),
);
const CalendarPage = lazy(() =>
  import('@/pages/dashboard/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const WeeklyDefaultPage = lazy(() =>
  import('@/pages/dashboard/WeeklyDefaultPage').then((m) => ({
    default: m.WeeklyDefaultPage,
  })),
);
const InboxPage = lazy(() =>
  import('@/pages/dashboard/InboxPage').then((m) => ({ default: m.InboxPage })),
);
const AppointmentsPage = lazy(() =>
  import('@/pages/dashboard/AppointmentsPage').then((m) => ({
    default: m.AppointmentsPage,
  })),
);
const CustomersPage = lazy(() =>
  import('@/pages/dashboard/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const AppointmentTypePage = lazy(() =>
  import('@/pages/dashboard/AppointmentTypePage').then((m) => ({
    default: m.AppointmentTypePage,
  })),
);
const ServiceMenuPage = lazy(() =>
  import('@/pages/dashboard/ServiceMenuPage').then((m) => ({
    default: m.ServiceMenuPage,
  })),
);
const AssistantPage = lazy(() =>
  import('@/pages/dashboard/AssistantPage').then((m) => ({ default: m.AssistantPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/dashboard/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/dashboard/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const EmailPage = lazy(() =>
  import('@/pages/dashboard/EmailPage').then((m) => ({ default: m.EmailPage })),
);
const TemplatesPage = lazy(() =>
  import('@/pages/dashboard/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);
const TemplateEditorPage = lazy(() =>
  import('@/pages/dashboard/TemplateEditorPage').then((m) => ({
    default: m.TemplateEditorPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/dashboard/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/dashboard/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

/**
 * Owner routes are wrapped individually rather than by a layout route, because
 * each page owns its own `DashboardLayout` header, badges and actions — a
 * shared parent would have to guess them.
 */
function owner(element: JSX.Element): JSX.Element {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingState />}>{element}</Suspense>
    </ProtectedRoute>
  );
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ToastProvider>
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
              <Route path={routes.owner.inbox} element={owner(<InboxPage />)} />
              {/* Approvals and Requests used to be separate destinations
                  (Requests a tab inside AppointmentsPage, Approvals its own
                  page). Both queues now live in InboxPage; these routes stay
                  mounted purely as redirects so old links and bookmarks still
                  land somewhere real. */}
              <Route
                path={routes.owner.approvals}
                element={owner(
                  <Navigate to={`${routes.owner.inbox}?tab=approvals`} replace />,
                )}
              />
              <Route
                path={routes.owner.requests}
                element={owner(
                  <Navigate to={`${routes.owner.inbox}?tab=requests`} replace />,
                )}
              />
              <Route
                path={routes.owner.appointments}
                element={owner(<AppointmentsPage />)}
              />
              <Route path={routes.owner.customers} element={owner(<CustomersPage />)} />
              <Route
                path={routes.owner.appointmentType}
                element={owner(<AppointmentTypePage />)}
              />
              <Route
                path={routes.owner.serviceMenu}
                element={owner(<ServiceMenuPage />)}
              />
              <Route path={routes.owner.settings} element={owner(<SettingsPage />)} />

              <Route path={routes.owner.calendar} element={owner(<CalendarPage />)} />
              <Route
                path={routes.owner.weeklyDefault}
                element={owner(<WeeklyDefaultPage />)}
              />

              <Route path={routes.owner.assistant} element={owner(<AssistantPage />)} />
              <Route path={routes.owner.reports} element={owner(<ReportsPage />)} />
              <Route
                path={routes.owner.notifications}
                element={owner(<NotificationsPage />)}
              />
              <Route path={routes.owner.email} element={owner(<EmailPage />)} />
              <Route path={routes.owner.templates} element={owner(<TemplatesPage />)} />
              <Route
                path="/dashboard/templates/:key/edit"
                element={owner(<TemplateEditorPage />)}
              />
              <Route path={routes.owner.profile} element={owner(<ProfilePage />)} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>

            {/* Global PWA affordances */}
            <UpdatePrompt />
            <InstallPrompt />
            <OfflineBanner />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
