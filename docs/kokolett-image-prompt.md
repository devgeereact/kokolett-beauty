Generate an image of a complete modern web app UI design system and all screen designs for a hair-salon booking and operations platform called "Kokolett Beauty UK".

Kokolett Beauty UK is the booking and operations platform for a single-owner UK women's hair salon — cutting, colouring, styling and treatments only, never a general or unisex beauty business. It is a static, installable, offline-first PWA (no native mobile app) with a public marketing/booking site and a private owner dashboard, both built from one shared design system. The word "Beauty" in the name is branding, not scope.

The app helps:
* Customers discover the salon, browse services and a photo gallery, and read testimonials/FAQs
* Customers book an appointment with zero account creation — identified only by email, with mobile as backup
* Returning customers (anyone with a prior completed visit) get instant confirmation; first-time customers are held for owner approval within a 12-hour window, with the slot reserved the moment they submit
* Customers manage a booking (view, cancel, reschedule) through a passwordless magic-link session, no password ever
* Customers request availability when nothing suits, with flexible date/time/notes
* The owner run her whole day from a phone: today's schedule, drag-to-reschedule calendar, approvals queue, customer CRM, service menu, availability rules, revenue/utilisation reports, an advisory-only AI assistant, notifications and settings

Design Style
* Warm, calm, unfussy — a single terracotta accent against cool neutral greys; the accent carries the salon's personality, the greys keep a twelve-hour dashboard shift legible
* Two rhythms sharing one token set: the marketing site is editorial — generous whitespace, large serif headings, big photography; the owner dashboard is utilitarian — dense, scannable, sans-serif throughout
* Content sits on white cards floating just above a soft grey page ground — one restrained shadow only, no stacked depth
* Soft rounded corners: 12px default, 16–24px on hero/marketing cards
* Pill-shaped filter chips and status chips; every status chip carries a text label, never colour alone
* Light mode first, with a full dark mode (`system` default, user-overridable, persisted as a preference not a resolved value)
* Restrained motion only — 150–300ms ease-out fades and gentle upward entrances; instant, easing-free feedback on slot selection and calendar drag; everything collapses under reduced-motion
* Accessibility is structural, not decorative: 44×44px minimum touch targets, visible focus rings everywhere, WCAG 2.2 AA contrast, real labels on every field
* NOT trendy-for-its-own-sake, NOT a generic spa/beauty-industry template, NOT cluttered — a small, trustworthy, single-owner business tool, not a chain SaaS product

Color Palette — Light (default)
* Page ground `#e8ebed` · body text `#333333`
* Card / popover surfaces `#ffffff` on `#333333` text
* Primary / brand — terracotta `#e05d38` with `#ffffff` foreground (white text only — terracotta-on-white fails body-text contrast, so it's reserved for large text, buttons and UI chrome)
* Secondary `#f3f4f6` / `#4b5563`
* Muted surfaces `#f9fafb` / hint text `#6b7280`
* Accent (highlights, selected slot) `#d6e4f0` / `#1e3a8a`
* Destructive (cancel, delete) `#ef4444` / `#ffffff`
* Border/hairline `#dcdfe2` · input fill `#f4f5f7` · focus ring `#e05d38`

Color Palette — Dark
* Page ground `#1c2433` · body text `#e5e5e5`
* Card `#2a3040` · popover `#262b38`
* Primary unchanged `#e05d38` / `#ffffff`
* Secondary `#2a303e` / `#e5e5e5` · muted `#2a303e` / `#a3a3a3`
* Accent `#2a3656` / `#bfdbfe` · destructive `#ef4444` / `#ffffff`
* Border/input `#3d4354` · ring `#e05d38`

Chart palette (reports only, always in this order): `#86a7c8` `#eea591` `#5a7ca6` `#466494` `#334c82`

Appointment-status palette (load-bearing, colour never stands alone — always paired with a text label):
* Pending approval — amber `#d97706` (dark `#f59e0b`)
* Confirmed — blue `#2563eb` (dark `#60a5fa`)
* In service — violet `#7c3aed` (dark `#a78bfa`)
* Completed — green `#059669` (dark `#34d399`)
* Cancelled / rejected — grey `#6b7280` (dark `#9ca3af`)
* No-show — red `#dc2626` (dark `#f87171`)

Typography
* UI and body copy: **Inter**, weights 400/500/600
* Marketing and display headings: **Source Serif 4**, weights 400/600, large editorial scale
* Numerals, booking references, appointment times: **JetBrains Mono**, 400 — gives times and references a ticket-stub precision against the soft serif/sans around them
* Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px. Body line-height 1.6, headings 1.2. Nothing a customer must read to book drops below 14px
* Strong hierarchy: serif editorial headlines on marketing pages, bold sans section labels and medium-weight sans body in the dashboard, mono for anything that is a number or a code

Screens

Marketing site
1. Home — full-width hero photograph of finished hairstyles, serif headline, primary CTA into booking, services teaser grid, testimonial strip
2. About — salon story, owner portrait, editorial serif typography, generous whitespace
3. Services catalogue — card grid of services (cut, colour, styling, treatments) with duration and category, each opening to a detail page with description and imagery — no price shown to a customer anywhere in this app
4. Gallery — masonry grid of finished-look photography
5. Testimonials — quote cards, star ratings, client first names only
6. FAQs — accordion list, calm serif question headers
7. Contact — address, hours, contact form, embedded map card

Booking flow (single continuous flow, progress indicator at top)
8. Service selection — pill category filters, service cards with duration chips
9. Date & time — calendar date grid (keyboard-operable, arrow keys), time-slot buttons at minimum 44×44px, terracotta selected state
10. Details & review — name/email/mobile fields with real labels, appointment summary card, mono appointment reference preview
11. Confirmation state — two distinct outcomes on one template: "Confirmed" (green check, .ics download) for returning customers, and "Held — you'll hear within 12 hours" (amber, calm reassurance copy) for first-timers
12. Request availability — empty-calendar fallback form: preferred dates, times, flexibility chips (any/morning/afternoon/evening), notes

Customer portal (passwordless, magic-link session)
13. My bookings — upcoming and past appointments as cards, status chip per card, one-tap rebook
14. Manage appointment — detail view with cancel and reschedule actions, mono reference number prominent

Owner dashboard (dense, scannable, sans-serif, sidebar chrome in its own grey ramp)
15. Today at a glance — the day's schedule as a vertical timeline, next-up card, quick stats
16. Calendar — day/week/month/agenda toggle, drag-to-reschedule, conflict highlighting, status-coloured appointment blocks
17. Approvals queue — first-time-booking cards awaiting a decision, countdown to the 12-hour window, approve/decline actions
18. Appointments — searchable, filterable list with status chips
19. Availability requests inbox — new / awaiting response / converted / declined tabs, priority indicators, "offer this slot" one-click action
20. Customers (CRM) — list with visit history and favourite services; detail view with private notes, marketing-consent toggle, email history
21. Service menu management — create/edit/archive, duration, buffer, category, image, active toggle
22. Availability rules — weekly hours grid, breaks, closures, booking-window settings
23. Reports — revenue and bookings summary cards, day-of-week and peak-hour bar charts in the five-colour chart palette, top-customers table, returning-rate and no-show-rate stat tiles
24. AI assistant — advisory-only recommendation feed (cancellation-to-waitlist matches, under-utilised days, requested-but-unavailable windows, opening-hours suggestions, drafted replies), each card with accept/dismiss — never an auto-applied action
25. Notifications — chronological alert list, unread state, filter by type
26. Profile & settings — salon profile, branded email preview, booking policy text, shareable booking links, theme toggle (system/light/dark)

Direction
Design this like a real, calm, small-business SaaS product built by people who understand a single hairdresser's actual day, not a generic salon-chain template. The marketing site should feel like a boutique editorial brand; the dashboard should feel like something you can operate one-handed between clients. Every screen shares the same tokens, the same 12px radius, the same single soft shadow, the same terracotta accent used sparingly and deliberately. The experience should feel: warm, calm, trustworthy, precise, unfussy, accessible, quietly premium.

Generate high-quality, production-ready responsive web app mockups (desktop dashboard views + mobile-width booking/marketing views) with realistic spacing, real UK salon photography, and interface quality suitable for an actual live product at kokolettbeauty.com.
