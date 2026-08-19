-- =====================================================================
-- 0037_email_templates_opt_in.sql — an owner-edited template only takes
-- over delivery once she has deliberately switched it on.
--
-- 0032 created `email_templates` as a draft/preview layer and seeded all
-- eighteen rows with `active = true` AND `include_in_automation = true`,
-- because at that point nothing read the table: its own header says
-- "editing a row here does not yet change what the outbox actually sends".
--
-- `send-emails` now does read it. With the 0032 defaults left as they are,
-- deploying that function would have swapped every transactional email for
-- its seeded placeholder draft on the very next drain, with nobody having
-- edited anything: `booking_confirmed` would lose its appointment panel,
-- its manage button and its cancellation-window line, and the subject would
-- drop from "Your appointment is confirmed · KB-1234" to a static string
-- with no reference and no customer name.
--
-- So automation is opt-in from here. `active` stays true (the rows are
-- still real, editable drafts and the editor lists them); only the
-- automation flag flips. The owner turns a template on in the Template
-- Editor once she is happy with it, one at a time, seeing a real preview
-- first.
--
-- Scoped to `updated_at = <seed time>` would be neater, but 0032 seeded and
-- stamped every row in the same statement and none has been edited since,
-- so the whole table is the seed.
-- =====================================================================

update public.email_templates
   set include_in_automation = false
 where include_in_automation;

comment on column public.email_templates.include_in_automation is
  'When true, send-emails renders this row instead of the hard-coded template in _shared/templates.ts. Opt-in: seeded rows are false (0037) so an unedited draft can never replace tested copy.';
