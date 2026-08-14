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

## 4. `useOptimizedImage`

`src/hooks/useOptimizedImage.ts`
Builds a transformed ImageKit URL (real-time resize + auto format/quality).

```ts
interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number; // 1–100, default 80
  crop?: 'maintain_ratio' | 'force' | 'at_max';
}
export function useOptimizedImage(path: string, t?: ImageTransform): string;
```

## 5. `useInngestDispatch`

`src/hooks/useInngestDispatch.ts`
Dispatches a typed event to Inngest's ingest endpoint using the write-only key.
Fire-and-forget; failures are reported to Sentry, never thrown into the UI.

```ts
interface DispatchResult {
  ok: boolean;
}
interface UseInngestDispatch {
  sending: boolean;
  send: (name: string, data: Record<string, unknown>) => Promise<DispatchResult>;
}
export function useInngestDispatch(): UseInngestDispatch;
```

---

# Application hooks

Contracts for the salon-specific hooks. Same rule as above: the signature here is the
source of truth.

## 6. `useServices`

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

## 7. `useAvailability`

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

**Slots are generated in the database, not the browser.** Anon has no `SELECT` on `appointments` — deliberately, per the closing comment of `0002_salon.sql` — and a policy broad enough to compute availability client-side would publish the salon's entire schedule. `public.available_slots()` does the subtraction under `security definer` and returns only free starts, applying opening rules, exceptions, lead time, horizon, the daily cap and the overlap check.

## 8. `useAppointments`

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

## 9. `useRealtimeAppointments`

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

## 10. `useCustomerSession`

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
  refresh: () => Promise<void>;
  signOut: () => void;
}
export function useCustomerSession(): UseCustomerSession;
```

## 11. `useBusinessSettings`

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

## 12. `useOwnerSummary`

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

## 13. `useIsOwner`

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

## 14. `useLiveClock`

`src/hooks/useLiveClock.ts`
Current time refreshed while the screen stays open. 30s interval (enough for minute display on a tablet left visible for hours).

```ts
export function useLiveClock(): Date;
```

## 15. `useNowLine`

`src/hooks/useNowLine.ts`
Minutes since local midnight, refreshed for rendering a position line on the calendar. 30s interval.

```ts
export function useNowLine(timezone: string): number;
```

## 16. `useSalonToday`

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

## 17. `useUsualHours`

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

## 18. `useServiceMenu`

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

## 19. `useAppointmentDrag`

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

## Conventions

- Every hook is fully typed with an explicit return interface.
- Hooks never read `import.meta.env` directly — they import from `@/lib/env`.
- Side-effectful hooks clean up their listeners in the `useEffect` return.
- Hooks never call `supabase` directly — they go through `src/services/*`.
- Any hook touching time converts using `booking_settings.timezone`, never the
  browser's local zone.
- Hooks that can fail expose `error` rather than throwing into render.
