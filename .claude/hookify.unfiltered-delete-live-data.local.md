---
name: block-unfiltered-delete-live-data
enabled: true
event: bash
action: block
pattern: (?i)(delete\s+from|truncate)\s+(public\.)?(appointments|customers|service_menu|subscribers|email_messages|calendar_feeds|availability_slots|weekly_template)(\s*;|\s*$|\s+where\s+(true|1\s*=\s*1))
---

**Blocked: a delete with no filter, against a table that holds real data.**

This has already destroyed real customer data on this project. A cleanup script
looped over every row in `customers` instead of the test ones and permanently
deleted booking `KB-LFQEJK`, belonging to a real person. There was no backup.

`koko.gakinz.com` is live and taking bookings, so these tables are production.

**Before deleting anything, name what you are deleting.** Collect the specific
ids or references first, print them, then delete by that list:

```sql
-- Wrong: deletes everything
delete from public.appointments;
delete from public.customers where true;

-- Right: bounded to exactly what the test created
delete from public.appointments where reference in ('KB-TJX2VL', 'KB-QMQFKT');
delete from public.customers   where email = 'someone@example.com';
```

If you genuinely need to clear a table, say so out loud to the user, get an
explicit yes, and take a dump first. Do not work around this rule by rewriting
the query to slip past the pattern.

See the `never-bulk-delete-live-tables` memory.
