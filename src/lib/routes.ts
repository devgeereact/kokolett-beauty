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
    about: '/about',
    services: '/services',
    gallery: '/gallery',
    testimonials: '/testimonials',
    faqs: '/faqs',
    contact: '/contact',
    book: '/book',
    requestAvailability: '/request-availability',
    privacy: '/privacy',
    bookingPolicy: '/booking-policy',
    terms: '/terms',
  },
  customer: {
    /** Magic-link landing. Exchanges the token for a customer session. */
    access: (token: string) => `/access/${token}`,
    home: '/my',
    appointments: '/my/appointments',
    appointment: (reference: string) => `/my/appointments/${reference}`,
  },
  owner: {
    dashboard: '/dashboard',
    calendar: '/dashboard/calendar',
    appointments: '/dashboard/appointments',
    /** First-time bookings waiting on the owner. */
    approvals: '/dashboard/approvals',
    /** Enquiries raised when no slot was available. */
    requests: '/dashboard/requests',
    customers: '/dashboard/customers',
    customer: (id: string) => `/dashboard/customers/${id}`,
    /** The single appointment type: its length and price. */
    appointmentType: '/dashboard/appointment',
    reports: '/dashboard/reports',
    assistant: '/dashboard/assistant',
    settings: '/dashboard/settings',
  },
} as const;

export type PublicRoute = typeof routes.public;
export type OwnerRoute = typeof routes.owner;
