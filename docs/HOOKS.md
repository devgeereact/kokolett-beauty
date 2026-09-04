# Custom Hooks Specification — Kokolett Beauty UK

Contracts for every reusable hook in `src/hooks`. Signatures here are the source
of truth — implementations must match.

## 1. `usePWAInstall`

`src/hooks/usePWAInstall.ts`
Captures the deferred `beforeinstallprompt` event and drives the install UI.

```ts
interface UsePWAInstall {
  isInstallable: boolean; // a prompt is available
  isInstalled: boolean; // running in standalone / already installed
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}
export function usePWAInstall(): UsePWAInstall;
```

## 2. `useOnlineStatus`

`src/hooks/useOnlineStatus.ts`
Reactive network connectivity based on `online`/`offline` window events.

```ts
export function useOnlineStatus(): boolean; // true when online
```

## 3. `useSupabaseAuth`

`src/hooks/useSupabaseAuth.ts`
Thin consumer of `AuthContext` — the single source of session truth. The provider
(`src/context/AuthContext.tsx`) owns the listener; this hook exposes it.

```ts
interface UseSupabaseAuth {
  user: User | null;
  session: Session | null;
  loading: boolean; // initial session resolve in flight
  signOut: () => Promise<void>;
}
export function useSupabaseAuth(): UseSupabaseAuth;
```

## 4. `useServices`

`src/hooks/useServices.ts`
Active service catalogue with categories, for the marketing site and booking flow.

```ts
interface UseServices {
  services: Service[];
  categories: ServiceCategory[];
  loading: boolean;
  error: Error | null;
  bySlug: (slug: string) => Service | undefined;
  refresh: () => Promise<void>;
}
export function useServices(includeInactive?: boolean): UseServices;
```

## 5. `useAvailability`

`src/hooks/useAvailability.ts`
Bookable slots over a rolling window. No service argument since 0011 — one appointment type means slots are absolute.

```ts
interface UseAvailability {
  /** ISO date (yyyy-mm-dd) → slots open that day. Empty array = closed/full. */
  slotsByDate: Record<string, TimeSlot[]>;
  /** Days with at least one slot, for enabling the date grid. */
  openDates: string[];
  loading: boolean;
  error: Error | null;
  /** True when the whole window is empty — trigger the request path. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
}
export function useAvailability(
  appointmentMinutes: number,
  startDate?: string,
  days?: number,
): UseAvailability;
```

**Slots are generated in the database, not the browser.** Anon has no `SELECT` on `appointments` — deliberately, per the closing comment of `0002_salon.sql` — and a policy broad enough to compute availability client-side would publish the salon's entire schedule. `public.available_slots(p_from, p_to)` does the subtraction under `security definer` and returns only free starts: the published `availability_slots` rows, minus live appointments, minus lead time, capped at `booking_settings.max_horizon_days` and the daily cap. Opening rules and exceptions are not consulted — `0011` dropped both tables, and a day is now exactly its own list of times.

## 6. `useAppointments`

`src/hooks/useAppointments.ts`
Owner-side appointment queries over a date range, with status filtering.

```ts
interface UseAppointmentsOptions {
  from: Date;
  to: Date;
  statuses?: AppointmentStatus[];
}
interface UseAppointments {
  appointments: AppointmentDetailed[];
  loading: boolean;
  error: Error | null;
  /** Awaiting an approval decision within this window — drives the badge. */
  pendingApproval: AppointmentDetailed[];
  refresh: () => Promise<void>;
}
export function useAppointments(options: UseAppointmentsOptions): UseAppointments;
```

## 7. `useRealtimeAppointments`

`src/hooks/useRealtimeAppointments.ts`
Supabase Realtime subscription so the owner's calendar reflects new bookings without
polling. Unsubscribes on unmount; silently no-ops while offline.

```ts
interface UseRealtimeAppointments {
  connected: boolean;
  lastEventAt: Date | null;
}
export function useRealtimeAppointments(
  onChange: (a: Appointment, kind: 'insert' | 'update' | 'delete') => void,
): UseRealtimeAppointments;
```

## 8. `useCustomerSession`

`src/hooks/useCustomerSession.ts`
The customer's own view of their bookings. Passwordless — no Supabase auth session, no password.

```ts
interface UseCustomerSession {
  customer: CustomerIdentity | null;
  appointments: CustomerAppointment[];
  /** Whether a session token is held — the only honest test of "signed in". */
  hasSession: boolean;
  loading: boolean;
  error: Error | null;
  /** Exchange a single-use token from /access/:token. */
  exchangeToken: (token: string) => Promise<boolean>;
  /** Email a fresh link. Always resolves true — never reveal who is on file. */
  requestLink: (email: string) => Promise<boolean>;
  cancel: (appointmentId: string, reason?: string) => Promise<void>;
  /** Move a booking to another published time. Resolves to the new reference. */
  reschedule: (appointmentId: string, newStartsAt: string) => Promise<string>;
  /** `null` until loaded — distinct from "no", which is `false`. */
  marketingConsent: boolean | null;
  setMarketingConsent: (consent: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => void;
}
export function useCustomerSession(): UseCustomerSession;
```

`marketingConsent`/`setMarketingConsent` (2026-08-31) read and write the customer's own
`customers.marketing_consent` via `customer_from_session()`-gated RPCs
(`customer_communication_preferences()` / `customer_set_marketing_consent()`,
migration `0060`) — the same session token every other call here already uses, no new
auth mechanism. `setMarketingConsent` is optimistic (updates local state immediately,
reverts on failure).

The `INVALID_SESSION` detection inside `load()`'s catch block reads a `.message`
property off *any* object with one, not `e instanceof Error` — `supabase.rpc()` never
throws a real `Error` for an RPC-level failure unless `.throwOnError()` is called
(this app doesn't), so the `{ data, error }` result's `error` is a plain object. A
version of this hook that checked `instanceof Error` here would silently never detect
an expired or revoked session (found and fixed 2026-08-31, while building bulk
session revocation — the first thing that ever exercised this path for real).

## 9. `useBusinessSettings`

`src/hooks/useBusinessSettings.ts`
The single `booking_settings` row. Public-readable (the booking UI needs lead time and horizon); owner-writable.

```ts
interface UseBusinessSettings {
  settings: BookingSettings | null;
  loading: boolean;
  error: Error | null;
  /** Salon timezone, with a safe fallback while settings are loading. */
  timezone: string;
  update: (patch: BookingSettingsUpdate) => Promise<void>;
  refresh: () => Promise<void>;
}
export function useBusinessSettings(): UseBusinessSettings;
```

## 10. `useOwnerSummary`

`src/hooks/useOwnerSummary.ts`
Headline counts for the dashboard in one round trip.

```ts
interface UseOwnerSummary {
  summary: OwnerSummary | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
export function useOwnerSummary(): UseOwnerSummary;
```

## 11. `useIsOwner`

`src/hooks/useIsOwner.ts`
Whether the signed-in user is salon staff. Resolved by asking the database via `is_owner()` security-definer predicate, not a JWT claim.

```ts
interface UseIsOwner {
  isOwner: boolean;
  loading: boolean;
  /** The question could not be asked — not an answer of "no". Offline and timeout errors fold here. */
  failed: boolean;
  /** Ask again after a failure. */
  retry: () => void;
}
export function useIsOwner(): UseIsOwner;
```

## 12. `useLiveClock`

`src/hooks/useLiveClock.ts`
Current time refreshed while the screen stays open. 30s interval (enough for minute display on a tablet left visible for hours).

```ts
export function useLiveClock(): Date;
```

## 13. `useNowLine`

`src/hooks/useNowLine.ts`
Minutes since local midnight, refreshed for rendering a position line on the calendar. 30s interval.

```ts
export function useNowLine(timezone: string): number;
```

## 14. `useSalonToday`

`src/hooks/useSalonToday.ts`
Today's salon day, kept current while the screen stays open. Detects rollover via timer, `visibilitychange`, and `focus`.

```ts
interface SalonToday {
  /** `yyyy-mm-dd` in the salon's timezone. */
  date: string;
  /** Midnight at the start of that salon day, as an instant. */
  start: Date;
  /** The instant the salon day ends. */
  end: Date;
}
export function useSalonToday(timezone: string): SalonToday;
```

## 15. `useUsualHours`

`src/hooks/useUsualHours.ts`
The salon's usual week, summarized for the footer. Derived from the weekly template so it cannot drift from what the owner publishes.

```ts
interface HoursLine {
  /** e.g. "Tuesday – Sunday" or "Monday" */
  days: string;
  /** e.g. "09:00 – 17:00", or null when closed. */
  hours: string | null;
}
export function useUsualHours(): { lines: HoursLine[]; loading: boolean };
```

## 16. `useServiceMenu`

`src/hooks/useServiceMenu.ts`
Public menu of styles. Failures are quiet (renders nothing) so a visitor without the list can still book.

```ts
interface ServiceMenuGroup {
  // type defined in @/types
}
export function useServiceMenu(): {
  groups: ServiceMenuGroup[];
  loading: boolean;
};
```

## 17. `useAppointmentDrag`

`src/hooks/useAppointmentDrag.ts`
Custom pointer-events drag for reschedule. Touch-friendly (HTML5 Drag and Drop is unreliable on tablets). Distinguishes click from drag with a 6px threshold.

```ts
export interface DragPreview {
  appointmentId: string;
  date: string;
  minutes: number;
  durationMin: number;
}
interface UseAppointmentDrag {
  preview: DragPreview | null;
  busy: boolean;
  error: string | null;
  dismissError: () => void;
  beginDrag: (
    e: React.PointerEvent,
    appointment: AppointmentDetailed,
    date: string,
    columnEl: HTMLElement,
    onClick: () => void,
  ) => void;
}
export function useAppointmentDrag(
  range: HourRange,
  timezone: string,
  onMoved: () => void,
): UseAppointmentDrag;
```

---

## 18. `useAppointmentActions`

`src/hooks/useAppointmentActions.ts`
The status transitions an owner can apply to an appointment (confirm, check in, start,
complete, mark no-show, cancel — `0063` also made `cancelled` reversible, restoring
whichever of confirmed/checked_in/in_service it came from), with the confirmation copy
and the busy state each one needs. Shared by the detail modal, the calendar panel and
the quick-action steps so the same action means the same thing wherever it is offered.

The same hook also owns the payment-logging form: `savePayment()`, plus
`correctingPaymentId`/`setCorrectingPaymentId` and `correctionDirection`/
`setCorrectionDirection` (`'add' | 'deduct'`, migration `0059`) — checking "this
corrects an earlier payment" links the new row to the one it corrects and lets the
amount go negative (a refund/deduction) rather than only ever adding money. The
`onLogPayment` prop it's given takes an optional fourth `correctsPaymentId` argument;
every call site (`TodayPage`, `CalendarPage`, `AppointmentsPage`,
`PaymentReconciliationCard`) has to forward it explicitly — TypeScript's structural
typing means a caller that still only passes three arguments type-checks cleanly
against the four-argument (one optional) prop type, so a silently-dropped correction id
is a real, non-obvious way for this to regress without `tsc` catching it.

---

## 19. `useNotificationReadState`

`src/hooks/useNotificationReadState.ts`
Which notifications the owner has already seen. Read state is local to the device, so
this is a localStorage-backed set rather than a column, and the bell badge counts
against it.

---

## 20. `useFocusTrap`

`src/hooks/useFocusTrap.ts`
Keeps Tab inside an open overlay and closes it on Escape. The caller keeps ownership of
what "closed" means and of where focus goes afterwards; only the trapping is shared.

```ts
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  onEscape: () => void,
): void;
```

This loop was copied character for character into `Modal`, `ConfirmDialog` and
`QuickActionLauncher`, each with its own `FOCUSABLE_SELECTOR`. A keyboard trap that
behaves differently in three dialogs defeats the point of having one.

---

## 21. `useDocumentMeta`

`src/hooks/useDocumentMeta.ts`
Per-page `<head>` for a client-rendered multi-page site: title, description, canonical,
Open Graph, Twitter card, `robots`, and a two-level `BreadcrumbList`. Takes either a
plain title string or a `DocumentMeta` object (`title`, `description`, `fullTitle`,
`path`, `image`, `noindex`).

`path` is the important one. `index.html` carries site-wide defaults for the first paint
before React mounts, and those defaults describe the home page. Any route that does not
pass a `path` inherits the home page's canonical and Open Graph URL, which tells a
crawler and every link preview that it *is* the home page. Until 2026-08-31 every route
did exactly that, and six of them set no head at all.

Everything it writes is restored on unmount, including tags it created, so a page that
unmounts before the next one mounts never leaves a stale head behind.

**Unless a newer page has already claimed the head.** A module-level `headOwner`
counter is incremented by each effect run, and cleanup early-returns without restoring
anything when it no longer holds the claim. Without that guard, an older page's cleanup
running after a newer page's effect puts the previous page's title, canonical and card
back over the current one, which is the exact bug this hook exists to prevent. React can
mount the next route before unmounting the previous one, and StrictMode double-invokes
effects, so the ordering is not hypothetical. Covered by "leaves one page in charge when
another unmounts after it mounted" in `useDocumentMeta.test.ts`.

Undocumented here until 2026-08-31, which is part of how the gap above survived.

---

## 22. `usePrefersReducedMotion`

`src/hooks/usePrefersReducedMotion.ts`
Whether the viewer has asked the operating system to reduce motion. Consumed by
`PhotoCard` to skip the cursor-tracked tilt and glare, and by `Reviews` for its
carousel. Motion that ignores this is an accessibility failure, not a preference
(`docs/DESIGN.md` §7).

---

## 23. `useRealtimeTable`

`src/hooks/useRealtimeTable.ts`
Subscribes to Postgres changes on a table and re-runs a callback. Used on the public
side for `weekly_template` and `availability_slots`, so a customer looking at the
booking page sees a slot disappear when someone else takes it rather than finding out
at submit.

## 24. `useAssistantConversations`

`src/hooks/useAssistantConversations.ts`
Conversation state for the AI assistant chat tab (`AssistantChatTab`): sending a
message, tracking the one action a reply can propose (a booking or a customer email),
and a `localStorage`-backed conversation list (`kokolett-ai-conversations`, most
recent 20) so a thread survives a reload. There is no backend table for it — the
transcript never leaves the device except to the model itself.

```ts
interface UseAssistantConversations {
  conversations: Conversation[];
  messages: DisplayMessage[];
  activeConversationId: string | null;
  sending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  confirmProposal: (index: number, proposal: Proposal) => Promise<void>;
  dismissProposal: (index: number) => void;
  startNewConversation: () => void;
  openConversation: (c: Conversation) => void;
  deleteConversation: (id: string) => void;
}
export function useAssistantConversations(firstName: string): UseAssistantConversations;
```

## 25. `useCalendarData`

`src/hooks/useCalendarData.ts`
The date math and the single Supabase fetch behind all four `CalendarPage` views:
which dates are visible for the current view/anchor, the range that covers them, and
the summary/appointments/open-slots rows for that range. `view` and `anchor` stay
owned by the page (its header controls act on them directly); this hook only reacts
to them.

```ts
interface UseCalendarData {
  cursor: { year: number; month: number };
  visibleDates: string[];
  range: { from: string; to: string };
  heading: string;
  summary: Map<string, DaySummary>;
  appointments: AppointmentDetailed[];
  daySlots: Map<string, OwnerDaySlot[]>;
  error: Error | null;
  reload: () => Promise<void>;
}
export function useCalendarData(
  view: CalendarView,
  anchor: string,
  timezone: string,
  showCancelledNoShow: boolean,
): UseCalendarData;
```

## 26. `useCalendarMutations`

`src/hooks/useCalendarMutations.ts`
The write side shared by `CalendarPage` and `AppointmentsPage`: status changes (with
an Undo toast, matching `TodayPage.changeStatus`), owner notes, payments and deletes.
Every call reloads the caller's data afterwards via the `reload` it's given; the
`onDeleted` callback lets a caller react to a delete (`CalendarPage` clears its
selection, `AppointmentsPage` doesn't need to).

```ts
interface UseCalendarMutations {
  changeStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  saveNote: (id: string, note: string) => Promise<void>;
  logPaymentHandler: (
    id: string,
    amountPence: number,
    note: string,
    correctsPaymentId?: string,
  ) => Promise<void>;
  deleteHandler: (id: string) => Promise<void>;
}
export function useCalendarMutations(
  appointments: AppointmentDetailed[],
  reload: () => Promise<void>,
  onDeleted: () => void,
): UseCalendarMutations;
```

---

## Conventions

- Every hook is fully typed with an explicit return interface.
- Hooks never read `import.meta.env` directly — they import from `@/lib/env`.
- Side-effectful hooks clean up their listeners in the `useEffect` return.
- Hooks never call `supabase` directly — they go through `src/services/*`.
- Any hook touching time converts using `booking_settings.timezone`, never the
  browser's local zone.
- Hooks that can fail expose `error` rather than throwing into render.
