-- Editable overlay for the transactional email templates
-- (`supabase/functions/_shared/templates.ts`), so the owner's Template
-- Editor (docs/design/Email-Template-Editor.png) has something real to
-- save to. `key` matches the `template` values already written to
-- `email_messages` (booking_confirmed, reminder_24h, …) — one row per
-- template in that fixed set, not a table of arbitrary user-created
-- templates.
--
-- Editing a row here does not yet change what the outbox actually sends —
-- `send-emails` still renders from the hard-coded switch. This is a real,
-- saved draft/preview layer; wiring it into delivery is a follow-up that
-- touches the live transactional sender and deserves its own careful pass.

create table if not exists public.email_templates (
  key                       text primary key,
  category                  text not null,
  subject                   text not null,
  html_body                 text not null,
  active                    boolean not null default true,
  allow_edit_before_sending boolean not null default true,
  include_in_automation     boolean not null default true,
  updated_at                timestamptz not null default timezone('utc', now())
);

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;

drop policy if exists email_templates_owner_all on public.email_templates;
create policy email_templates_owner_all on public.email_templates
  for all using (public.is_owner()) with check (public.is_owner());

insert into public.email_templates (key, category, subject, html_body) values
  ('booking_confirmed', 'Booking', 'Your appointment is confirmed', '<p>Hi {{customer_name}},</p><p>Thank you for booking with Kokolett Beauty UK.</p><p>Your appointment has been confirmed. Please find your details below.</p><p>Date: {{appointment_date}}<br>Time: {{appointment_time}}<br>Service: {{service_name}}<br>Location: {{location}}<br>Staff: {{staff_name}}</p><p>If you need to make any changes, please let us know.</p><p>We look forward to seeing you!</p><p>Best regards,<br>Koko Lett<br>Kokolett Beauty UK</p>'),
  ('booking_approved', 'Booking', 'Your appointment is approved', '<p>Hi {{customer_name}},</p><p>Your held appointment has been approved and is now confirmed.</p><p>Date: {{appointment_date}}<br>Time: {{appointment_time}}</p><p>See you soon!</p>'),
  ('booking_rescheduled', 'Booking', 'Your appointment has moved', '<p>Hi {{customer_name}},</p><p>Your appointment has been rescheduled.</p><p>New date: {{appointment_date}}<br>New time: {{appointment_time}}</p>'),
  ('booking_held', 'Booking', 'We have received your booking request', '<p>Hi {{customer_name}},</p><p>Thanks for your request — as a first-time customer, we hold your slot while we confirm it. We will be in touch within {{approval_window_h}} hours.</p>'),
  ('booking_declined', 'Booking', 'About your booking request', '<p>Hi {{customer_name}},</p><p>We are sorry — we are not able to offer the time you held. Please get in touch or try booking another slot.</p>'),
  ('booking_cancelled', 'Booking', 'Your appointment has been cancelled', '<p>Hi {{customer_name}},</p><p>Your appointment on {{appointment_date}} has been cancelled.</p>'),
  ('reminder_24h', 'Reminders', 'See you tomorrow', '<p>Hi {{customer_name}},</p><p>Just a reminder — your appointment is tomorrow at {{appointment_time}}.</p>'),
  ('reminder_2h', 'Reminders', 'See you in a couple of hours', '<p>Hi {{customer_name}},</p><p>Your appointment is coming up at {{appointment_time}} today.</p>'),
  ('reminder_1h', 'Reminders', 'See you in an hour', '<p>Hi {{customer_name}},</p><p>Your appointment is in an hour, at {{appointment_time}}.</p>'),
  ('appointment_completed', 'Reviews', 'Thanks for visiting Kokolett Beauty UK', '<p>Hi {{customer_name}},</p><p>Thank you for visiting us today. We hope you love the result!</p>'),
  ('review_request', 'Reviews', 'How did we do?', '<p>Hi {{customer_name}},</p><p>We would love to hear your feedback — would you leave us a Google review?</p>'),
  ('request_received', 'Availability requests', 'We have your request', '<p>Hi {{customer_name}},</p><p>We have logged your request for a time and will be in touch as soon as something opens up.</p>'),
  ('access_link', 'Account access', 'Manage your booking', '<p>Hi {{customer_name}},</p><p>Use the link below to view or change your booking.</p>'),
  ('owner_password_reset', 'Account access', 'Reset your Kokolett Beauty password', '<p>Hi Koko,</p><p>Use the link below to choose a new password for your dashboard.</p>'),
  ('owner_approval_needed', 'Owner notifications', 'A booking needs your approval', '<p>{{customer_name}} has requested {{service_name}} on {{appointment_date}}. Please review and respond.</p>'),
  ('owner_booking_moved', 'Owner notifications', 'A customer moved their booking', '<p>{{customer_name}} rescheduled their appointment to {{appointment_date}} at {{appointment_time}}.</p>'),
  ('owner_new_booking', 'Owner notifications', 'New booking received', '<p>{{customer_name}} booked {{service_name}} on {{appointment_date}} at {{appointment_time}}.</p>'),
  ('owner_new_request', 'Owner notifications', 'New availability request', '<p>{{customer_name}} requested a time you have not published.</p>')
on conflict (key) do nothing;

revoke all on table public.email_templates from public, anon;
grant select, insert, update, delete on public.email_templates to authenticated;
