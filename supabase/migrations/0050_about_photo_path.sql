-- The About page's "About Christy" portrait was a hardcoded ImageKit path
-- (`AboutPage.tsx`). The owner can now upload her own photo from the
-- dashboard; this column is where it lives.
--
-- Added to `booking_settings`, not `profiles.avatar_url`, even though the
-- latter already exists: `booking_settings` is already public-read +
-- owner-write with no RLS change needed, and this is public marketing
-- content shown to anonymous visitors — the same kind of value as the
-- existing `google_review_url` column on this table — not private account
-- data. `profiles` RLS is `auth.uid() = id` only, so exposing one field from
-- it publicly would need a new carve-out for no real benefit here.

alter table public.booking_settings
  add column if not exists about_photo_path text;
