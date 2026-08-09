---
name: warn-em-dash-in-customer-copy
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/pages/(?!dashboard/)|src/components/public/|supabase/functions/_shared/templates\.ts
  - field: new_text
    operator: contains
    pattern: —
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

Note this rule matches the character itself, so it also fires on em dashes in
code comments in these files. If the match is a comment, say so and carry on.
