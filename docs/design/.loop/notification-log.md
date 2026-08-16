# Notifications screen — design-match log

Target: `NotificationsPage.tsx`, route `/dashboard/notifications`. Ref:
`docs/design/notification.png`.

## Already built

Same story as Reports and AI Assistant: already a real, complete rebuild
onto this reference — real activity events (bookings, availability
requests, completions), grouped by day, All/Unread/Archived tabs, a
category filter sidebar, a real notification-preferences panel
(`localStorage`-backed, genuinely functional), and a status card. Verified
against real data on first screenshot: 43 real events, all derived from
actual bookings — no stored `notifications` table exists (documented in the
file's own comment), by design.

## Iteration 1 — one real gap: no unread-count badge on the header title

The reference shows a small red circular badge with the unread count next
to the "Notifications" H1. The build had a plain string title with no
badge anywhere on the page itself (the badge exists on the sidebar nav
row and the bell icon elsewhere in the shell, but not here).

- `DashboardLayout`'s `title` prop already accepted `ReactNode` — no shell
  change needed. Replaced the plain string with a `<span>` wrapping the
  text and a conditional badge, reusing the exact pill classes already
  used for the sidebar nav's own unread badges
  (`inline-flex min-w-5 items-center justify-center rounded-full bg-primary
  px-1.5 py-0.5 text-xs font-semibold text-primary-foreground`) rather than
  inventing new badge styling.
- Verified live: badge reads "43" on load, clicking a notification marks it
  read and the badge live-updates to "42" in the same render as the tab
  count and the bottom "Stay on top of things" card — one source of truth
  (`unreadCount`), not three separately-tracked numbers that could drift.

## Blocked briefly by unrelated pre-existing breakage

`npm run build` failed on `src/components/dashboard/calendar/DayView.tsx`
— pre-existing, uncommitted, unrelated to this task (confirmed via `git
status`: that file was already modified before this session's Notifications
work started, matching the `RESCHEDULABLE is not defined` /
`moving is not defined` HMR errors flagged earlier this session on the
Calendar/Appointments pages). Did not touch or fix it — not this task's
file, and altering someone else's in-progress uncommitted edit without
being asked isn't this session's call to make. Confirmed
`NotificationsPage.tsx` itself is clean by running `tsc --noEmit` and
filtering out `DayView.tsx`'s pre-existing errors — zero remaining.
Verified via the dev server (which serves routes independently) instead of
the full production build for this screen.

**This still needs the user's attention** — `npm run build` is currently
broken repo-wide until `DayView.tsx` is fixed or its in-progress change is
finished/reverted.

## Verification

Dark theme and mobile (390×844) both checked — clean. `npx vitest run`:
154/154 passing (this suite doesn't depend on the broken `DayView.tsx`
build path). Full production build blocked by the unrelated issue above,
not by anything in this change.

## Stop

Converged after 1 iteration — already close; this pass closed the one real
gap (header unread badge) and verified the rest matches.
