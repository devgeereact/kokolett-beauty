-- Give the review-request templates a link a customer can actually click.
--
-- `0032` seeded `review_request` as "We would love to hear your feedback. Would
-- you leave us a Google review?" with no link, and `appointment_completed`
-- with none either. That has been harmless so far only because both rows have
-- `include_in_automation = false`, so `send-emails` falls back to the built-in
-- copy in `_shared/templates.ts`, which does render a "Leave a review" button.
--
-- The trap is that the fallback is invisible from the dashboard. The owner sees
-- two review templates in the Template Editor, switches one into automation
-- because that is the obvious thing to do, and every review request from then on
-- asks for a review while giving no way to leave one. Nothing errors.
--
-- `{{google_review_url}}` is already a supported token (`buildTokens` in
-- `_shared/templates.ts`) and is already declared for both keys in
-- `src/lib/templateCatalog.ts`. It resolves to `booking_settings.google_review_url`,
-- which is Google's `g.page/r/<id>/review` link and opens the write-a-review
-- dialog directly.
--
-- Written as a conditional update so it only touches a row still carrying the
-- seeded wording. If Christy has already rewritten either template, hers is left
-- exactly as she wrote it and this migration does nothing to that row.

update public.email_templates
set html_body = html_body ||
      '<p><a href="{{google_review_url}}">Leave a review on Google</a></p>'
where key = 'review_request'
  and html_body not like '%{{google_review_url}}%'
  and html_body not like '%href=%';

update public.email_templates
set html_body = html_body ||
      '<p>If you have a moment, a few words on Google genuinely help a small salon. '
      || '<a href="{{google_review_url}}">Leave a review</a>.</p>'
where key = 'appointment_completed'
  and html_body not like '%{{google_review_url}}%'
  and html_body not like '%href=%';
