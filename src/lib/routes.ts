/**
 * The complete route map for Kokolett Beauty UK.
 *
 * Every navigable destination is declared here so there is exactly one place to
 * check when asking "does this link go anywhere?". Nothing in the app should
 * hard-code a path string.
 */
export const routes = {
  public: {
    home: '/',
    /* There is deliberately no About, Gallery, Testimonials, FAQs or Contact
       route. An earlier multi-page plan was simplified to a single marketing
       page (docs/PRD.md §7); the five constants outlived it here, resolving to
       paths no <Route> mounts, which is exactly the question this file exists
       to answer correctly. */
    book: '/book',
    requestAvailability: '/request-availability',
    subscribe: '/subscribe',
    privacy: '/privacy',
    bookingPolicy: '/booking-policy',
    terms: '/terms',
  },
  customer: {
    /** Magic-link landing. Exchanges the token for a customer session. */
    access: (token: string) => `/access/${token}`,
    home: '/my',
    appointments: '/my/appointments',
  },
  owner: {
    dashboard: '/dashboard',
    calendar: '/dashboard/calendar',
    appointments: '/dashboard/appointments',
    /** Approvals + Requests, tabbed. The only place either queue renders. */
    inbox: '/dashboard/inbox',
    /**
     * First-time bookings waiting on the owner.
     * @deprecated Renders nothing — `/dashboard/approvals` redirects to
     * `inbox?tab=approvals` (see `src/App.tsx`). Kept as a constant because
     * other code may still reference the path during migration.
     */
    approvals: '/dashboard/approvals',
    /**
     * Enquiries raised when no slot was available.
     * @deprecated Renders nothing — `/dashboard/requests` redirects to
     * `inbox?tab=requests` (see `src/App.tsx`). Kept as a constant because
     * other code may still reference the path during migration.
     */
    requests: '/dashboard/requests',
    customers: '/dashboard/customers',
    /** The single appointment type: its length and price. */
    appointmentType: '/dashboard/appointment',
    /** The menu of styles shown on the website. Descriptive, not bookable. */
    serviceMenu: '/dashboard/services',
    /** The repeating week that generates days on the calendar. */
    weeklyDefault: '/dashboard/weekly',
    reports: '/dashboard/reports',
    assistant: '/dashboard/assistant',
    settings: '/dashboard/settings',
    notifications: '/dashboard/notifications',
    /** Delivery log for the email_messages outbox (docs/SCHEMA.md §10). */
    email: '/dashboard/email',
    /** Named transactional email templates referenced by email_messages.template. */
    templates: '/dashboard/templates',
    templateEditor: (key: string) => `/dashboard/templates/${key}/edit`,
    profile: '/dashboard/profile',
  },
  auth: {
    login: '/login',
    /**
     * Where a recovery email lands. Outside `owner` on purpose: it must be
     * reachable *without* a session, since being unable to sign in is the whole
     * reason for arriving here.
     */
    resetPassword: '/reset-password',
  },
} as const;

export type PublicRoute = typeof routes.public;
export type OwnerRoute = typeof routes.owner;
