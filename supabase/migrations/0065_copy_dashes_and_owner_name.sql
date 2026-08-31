-- copy-check: allow-dashes
--   This file has to quote the offending strings in order to replace them.
--
-- Customer-facing email copy: remove em dashes, and correct the owner's name.
--
-- Two separate faults, both live in `email_templates` and both visible to a
-- customer:
--
--   1. Em dashes. `0020_subject_lines_without_em_dashes.sql` cleared them from
--      the subject lines seeded by `0018`, but the bodies seeded by `0032` kept
--      four. Copy in this project carries no em dashes (docs/RULES.md §9.7).
--
--   2. The owner is Christy. `0032` seeded "Koko Lett" as the sign-off on the
--      confirmation email and "Hi Koko," on her own password reset. The About
--      page has always said Christy, so a customer could receive a confirmation
--      signed by someone who does not work here.
--
-- Written as targeted `replace()` calls rather than as an overwrite of the row.
-- The owner can edit any of these templates from the dashboard, and a blanket
-- UPDATE would silently discard whatever she had written since `0032` ran.
-- `replace()` on a substring that is not present is a no-op, so a template she
-- has already rewritten is left exactly as she left it.

update public.email_templates
set html_body = replace(
      html_body,
      'Thanks for your request — as a first-time customer, we hold your slot while we confirm it.',
      'Thanks for your request. As a first-time customer, we hold your slot while we confirm it.'
    )
where key = 'booking_held';

update public.email_templates
set html_body = replace(
      html_body,
      'We are sorry — we are not able to offer the time you held.',
      'We are sorry, we are not able to offer the time you held.'
    )
where key = 'booking_declined';

update public.email_templates
set html_body = replace(
      html_body,
      'Just a reminder — your appointment is tomorrow',
      'Just a reminder, your appointment is tomorrow'
    )
where key = 'reminder_24h';

update public.email_templates
set html_body = replace(
      html_body,
      'We would love to hear your feedback — would you leave us a Google review?',
      'We would love to hear your feedback. Would you leave us a Google review?'
    )
where key = 'review_request';

update public.email_templates
set html_body = replace(html_body, 'Koko Lett<br>', 'Christy<br>')
where key = 'booking_confirmed';

update public.email_templates
set html_body = replace(html_body, '<p>Hi Koko,</p>', '<p>Hi Christy,</p>')
where key = 'owner_password_reset';
