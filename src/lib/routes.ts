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
    /* Reinstated 2026-08-25: the single-page simplification (docs/PRD.md §7)
       is superseded by the marketing rebrand — real navigation, not anchors. */
    about: '/about',
    gallery: '/gallery',
    services: '/services',
    testimonials: '/testimonials',
    faqs: '/faqs',
    contact: '/contact',
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
    /** Read-only log of the highest-risk owner actions (docs/SCHEMA.md, migration 0052). */
    audit: '/dashboard/audit',
    /** pg_cron job status, email/reviews health, and the running build version (migration 0053). */
    systemHealth: '/dashboard/system-health',
    /** End-of-day reconciliation, today only (migration 0054/0055). */
    dailyClose: '/dashboard/daily-close',
  },
  auth: {
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

/**
 * Every real top-level path segment, plus a handful of predictable words an
 * attacker would try first regardless of what's actually routed. The owner
 * cannot set her secret sign-in slug (`staff.login_slug`, migration 0051) to
 * any of these — `set_owner_login_slug()` keeps its own copy of this list in
 * Postgres, since client-side validation alone is not a security boundary
 * and there is no shared source of truth across the TS/SQL boundary. Keep
 * the two in sync by hand whenever a new top-level route is added here.
 */
export const RESERVED_SLUGS = [
  'about',
  'gallery',
  'services',
  'testimonials',
  'faqs',
  'contact',
  'book',
  'request-availability',
  'subscribe',
  'privacy',
  'booking-policy',
  'terms',
  'my',
  'access',
  'dashboard',
  'login',
  'reset-password',
  'admin',
  'owner',
  'staff',
  'signin',
  'signup',
  'logout',
  'api',
  'app',
] as const;
