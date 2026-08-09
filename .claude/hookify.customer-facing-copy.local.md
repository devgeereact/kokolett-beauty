---
name: warn-price-in-customer-copy
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/(pages/(HomePage|BookPage|MyBookingsPage|SubscribePage|PolicyPages|RequestAvailabilityPage)|components/public/)
  - field: new_text
    operator: regex_match
    pattern: formatMoney|price_pence|£
---

**A price is going onto a page a customer sees.**

No price is shown to a customer anywhere on this site. `price_pence` is a
placeholder on the appointment type, not a quote: what a visit costs is agreed
in the chair, because a full head of knotless braids and a trim are not the
same afternoon. Printing a number is a promise the salon cannot keep.

This already leaked once. `My bookings` rendered "£42.50" against every
appointment until 2026-08-09.

`price_pence` may still be **read** for internal arithmetic, such as feeding
`useAvailability` a slot length. The rule is that it is never **rendered**.

The owner's own screens under `src/pages/dashboard/` are exempt and deliberately
show money. This rule only covers customer-facing files.
