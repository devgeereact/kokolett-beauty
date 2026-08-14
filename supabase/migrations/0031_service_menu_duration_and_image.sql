-- The owner's Services screen (docs/design/service.png) shows duration,
-- buffer time and an image per row. `service_menu` never carried those —
-- it only ever fed the public "what we do" list, which doesn't need them.
-- Adding them here lets the owner-facing screen show a real per-style
-- length instead of fabricating one, without touching `services` (still
-- the single bookable appointment type) or `public_service_menu()` (still
-- returns just group_name/name/note, unchanged).
--
-- Default duration/buffer match the one real bookable service
-- (`hair_appointment()`, migration 0011: 45 min chair time, no buffer at
-- the time of writing) — a genuine current value, not an arbitrary guess,
-- and each row's is individually editable from here on.

alter table public.service_menu
  add column if not exists duration_min integer not null default 45,
  add column if not exists buffer_min integer not null default 10,
  add column if not exists image_path text;

alter table public.service_menu
  add constraint service_menu_duration_range check (duration_min between 1 and 600),
  add constraint service_menu_buffer_range check (buffer_min between 0 and 120);
