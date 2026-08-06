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
export function useServices(): UseServices;
```

## 7. `useAvailability`

`src/hooks/useAvailability.ts`
Generates bookable slots for one service across a month, from opening rules minus
exceptions minus live appointments. Client-side only — advisory, never authoritative.

```ts
interface UseAvailability {
  /** ISO date (yyyy-mm-dd) → slots open that day. Empty array = closed/full. */
  slotsByDate: Record<string, TimeSlot[]>;
  /** Days with at least one slot, for enabling the date grid. */
  openDates: string[];
  loading: boolean;
  error: Error | null;
  /** True when the whole window is empty — trigger the availability-request path. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
}
export function useAvailability(serviceId: string | null, month: Date): UseAvailability;
```

## 8. `useBookingFlow`

`src/hooks/useBookingFlow.ts`
Owns the whole booking wizard in one reducer: service → date → slot → details →
review → submit. Single reducer so back-navigation and slot-expiry recovery stay sane.

```ts
type BookingStep = 'service' | 'date' | 'slot' | 'details' | 'review' | 'done';

interface BookingDetails {
  fullName: string;
  email: string;
  mobile: string;
  note: string;
  marketingConsent: boolean;
}

interface UseBookingFlow {
  step: BookingStep;
  service: Service | null;
  slot: TimeSlot | null;
  details: BookingDetails;
  submitting: boolean;
  /** Coded failure from book_appointment, already mapped to display copy. */
  error: { code: BookingErrorCode; message: string } | null;
  result: BookingResult | null;
  selectService: (s: Service) => void;
  selectSlot: (s: TimeSlot) => void;
  setDetails: (patch: Partial<BookingDetails>) => void;
  back: () => void;
  submit: () => Promise<void>;
  reset: () => void;
}
export function useBookingFlow(): UseBookingFlow;
```

## 9. `useAppointments`

`src/hooks/useAppointments.ts`
Owner-side appointment queries over a date range, with status filtering.

```ts
interface UseAppointmentsOptions {
  from: Date;
  to: Date;
  statuses?: AppointmentStatus[];
}
interface UseAppointments {
  appointments: Appointment[];
  loading: boolean;
  error: Error | null;
  /** Awaiting an approval decision — drives the dashboard badge. */
  pendingApproval: Appointment[];
  refresh: () => Promise<void>;
}
export function useAppointments(o: UseAppointmentsOptions): UseAppointments;
```

## 10. `useRealtimeAppointments`

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

## 11. `useCustomerSession`

`src/hooks/useCustomerSession.ts`
The passwordless customer identity. Distinct from `useSupabaseAuth` — a customer is
**not** an auth user. Exchanges a magic-link token via an Edge Function and holds the
resulting 30-day session.

```ts
interface UseCustomerSession {
  customer: Customer | null;
  loading: boolean;
  /** Exchange a single-use token from /access/:token. */
  exchangeToken: (token: string) => Promise<boolean>;
  /** Email a fresh magic link to an address. Always resolves true — never reveal
   *  whether an address is on file. */
  requestLink: (email: string) => Promise<boolean>;
  signOut: () => void;
}
export function useCustomerSession(): UseCustomerSession;
```

## 12. `useAvailabilityRequests`

`src/hooks/useAvailabilityRequests.ts`
The owner's enquiry inbox.

```ts
interface UseAvailabilityRequests {
  requests: AvailabilityRequest[];
  counts: Record<AvailabilityRequestStatus, number>;
  loading: boolean;
  error: Error | null;
  respond: (id: string, message: string) => Promise<void>;
  decline: (id: string, reason: string) => Promise<void>;
  /** Sends a single-use booking link for a specific slot. */
  offerSlot: (id: string, slot: TimeSlot) => Promise<void>;
  refresh: () => Promise<void>;
}
export function useAvailabilityRequests(): UseAvailabilityRequests;
```

## 13. `useAIRecommendations`

`src/hooks/useAIRecommendations.ts`
Advisory queue. Accepting a recommendation does **not** mutate the business here — it
resolves to the concrete action the owner then confirms.

```ts
interface UseAIRecommendations {
  recommendations: AiRecommendation[];
  loading: boolean;
  accept: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}
export function useAIRecommendations(): UseAIRecommendations;
```

## 14. `useBusinessSettings`

`src/hooks/useBusinessSettings.ts`
The single `booking_settings` row. Public-readable (the booking UI needs lead time and
horizon); owner-writable.

```ts
interface UseBusinessSettings {
  settings: BookingSettings | null;
  loading: boolean;
  update: (patch: Partial<BookingSettings>) => Promise<void>;
}
export function useBusinessSettings(): UseBusinessSettings;
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
