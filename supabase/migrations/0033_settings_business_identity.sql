-- Business identity fields for the Settings > Organisation tab.
-- booking_settings is already the single-row, public-read/owner-write
-- settings table (docs/SCHEMA.md §booking_settings); RLS on it already
-- covers these new columns since policies are row-level, not column-level.
alter table public.booking_settings
  add column if not exists business_name text not null default 'Kokolett Beauty UK',
  add column if not exists business_category text not null default 'Hair Salon',
  add column if not exists country text not null default 'United Kingdom';
