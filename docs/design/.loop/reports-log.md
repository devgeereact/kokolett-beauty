# Reports screen — design-match log

Target: `ReportsPage.tsx`, route `/dashboard/reports`. Ref:
`docs/design/reports.png`.

## Already built

Unlike most rows in `build-loop.md`, this page's own docstring (predating
this pass) already documented a deliberate, largely-complete rebuild onto
this exact reference: real stat tiles with trend arrows, real appointments/
revenue line charts, a real status donut, a real service breakdown, a real
recent-bookings table, real top customers, and a real insights panel — all
computed live from `appointments_detailed`, verified against real data (16
real appointments, £255 real revenue) on first screenshot.

The reference's other six tabs (Appointments/Revenue/Customers/Services/
Staff/Availability) are deliberately not built — documented reasoning
already in the file: this salon has one staff member and one bookable
service, so most of that tab set would either duplicate the Overview tab
shown here or have nothing real to show (e.g. a "Staff" tab for a
single-owner salon).

## Iteration 1 — the one real gap: no way to change the period

Everything matched except: the reference's date-range control ("26 May –
22 Jun 2025 ▾") implies it's interactive — clicking it changes what period
is analysed. The existing build had `const [range] = useState(...)` fixed
to "last 28 days" forever, rendered as plain text with no control at all.

`getReportsOverview(timezone, fromDate, toDate)` was already fully generic
in the service layer — nothing about the fix touched data fetching, only
wiring a real control to it:

- Added a `rangeDays` state (7/14/28/90) and a compact `<select>` in the
  header actions, positioned before the resolved-date text exactly where
  the reference puts its range control, styled to match every other inline
  filter select in the app (`Customers`/`Services`/`InboxPage`'s status
  filters — `h-9 rounded-lg border border-border bg-input`), with a
  `Calendar` icon prefix matching the search-input icon-inset pattern used
  throughout.
- Did **not** build a full custom calendar-range picker widget — no
  precedent component for one exists anywhere in this codebase (only a
  single-date `DatePicker`), and a preset dropdown is both simpler and
  covers the real need (comparing different windows) without inventing a
  new design-system primitive for one screen.

Verified live: switching "Last 28 days" → "Last 7 days" correctly
re-fetches and updates every stat tile, both charts' X-axis, the donut
total, recent bookings, and top customers (14 appointments, £170, 2 top
customers instead of 3) — a real, functional control, not decoration.

## Not implemented — logged, not guessed at

- The six extra tabs (Appointments/Revenue/Customers/Services/Staff/
  Availability) — pre-existing, documented reasoning: single staff member,
  single bookable service (the `service_menu` catalogue is display-only,
  not separately bookable — see `docs/SCHEMA.md`/CLAUDE.md), so most of
  that tab set has nothing distinct to show beyond the Overview already
  here.
- "Appointments by service" is a single bar ("Hair Appointment," 100%) —
  correct given the single-bookable-service reality, not a bug; the
  reference's multi-service breakdown assumes a salon with several
  separately-bookable services, which this app deliberately doesn't have.

## Verification

Dark theme and mobile (390×844) both checked — clean, charts and tables
reflow correctly, no changes needed beyond the range selector.
`npx vitest run`: 154/154 passing. Build clean.

## Stop

Converged after 1 iteration — the page was already close to the reference;
this pass found and closed the one real interactive gap (the date range)
rather than rebuilding what already worked.
