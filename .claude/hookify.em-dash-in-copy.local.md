---
name: warn-em-dash-in-customer-copy
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/pages/|src/components/|src/lib/|src/hooks/|supabase/migrations/|supabase/functions/_shared/templates\.ts|public/offline\.html|vite\.config\.ts
  - field: new_text
    operator: regex_match
    pattern: [—–]
---

**An em dash is going into copy a customer reads.**

Em dashes were swept out of every customer-facing string on 2026-08-09, 19 of
them, and they keep coming back. They are the most reliable tell that a machine
wrote the sentence, and this salon's voice is a person talking to a customer.

Replace with a full stop, a comma, a colon, or parentheses. Usually a full stop
is right: it produces two sentences that each say one thing.

```
Wrong:  Choose a time that suits you — we will do the rest.
Right:  Choose a time that suits you. We will do the rest.

Wrong:  Your appointment is confirmed — KB-XXXXXX
Right:  Your appointment is confirmed · KB-XXXXXX
```

This applies to email templates too. Subject lines are the worst place for one,
because the em dash is visible in the inbox list before the message is opened.
That happened: 0018 was applied to the live database before its subject strings
were corrected, and 0020 had to be written to fix it.

Scope was widened on 2026-08-31. It used to cover only `src/pages/` outside the
dashboard, `src/components/public/` and the email templates, and every one of
these was leaking customer-visible dashes past it: `src/lib/errors.ts` (five
booking errors a customer reads), `src/components/OfflineBanner.tsx`,
`src/components/ErrorBoundary.tsx`, the PWA manifest in `vite.config.ts`,
`public/offline.html`, and the seeded email bodies in
`supabase/migrations/0032_email_templates.sql`.

It now matches the en dash (–) as well. Time and date ranges were rendering as
"09:00 – 17:00" throughout, and a screen reader announces that dash as nothing
at all, so the range read as two unconnected times. They are now "09:00 to
17:00".

Note this rule matches the characters themselves, so it also fires on dashes in
code comments in these files. A comment is not copy: if the match is a comment,
say so and carry on. The CI gate (`npm run lint:copy`,
`scripts/check-copy.py`) strips comments before checking, so it will not stop a
merge over one.
