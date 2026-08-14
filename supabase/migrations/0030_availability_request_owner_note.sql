-- Private notes on an availability request — visible only to the owner,
-- never emailed to the customer (unlike `owner_response`, which is the
-- customer-facing decline message). Mirrors `appointments.owner_note`
-- (migration 0003), which already draws exactly this distinction for
-- bookings.

alter table public.availability_requests
  add column if not exists owner_note text;

create or replace function public.set_request_owner_note(
  p_request_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.availability_requests
     set owner_note = nullif(trim(p_note), '')
   where id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.set_request_owner_note(uuid, text) from public, anon;
grant execute on function public.set_request_owner_note(uuid, text) to authenticated;
