-- =====================================================================
-- 0059_payment_corrections.sql
--
-- KOKO_GAP.md P2: "'Correction' = insert another payment row; no
-- void/negative/linkage semantics." `payments` was already append-only by
-- design (0027) — a mis-logged amount was always meant to be corrected by
-- logging a second row, never by editing the first — but nothing linked
-- that second row back to the one it corrects, and the `amount_pence > 0`
-- check meant a correction could only ever add money, never take it away
-- (no way to log a refund or a downward adjustment).
--
-- This adds the missing linkage, not a new correction mechanism: a
-- correction is still just a row in the same append-only table, now
-- optionally pointing at the payment it corrects, and allowed to be
-- negative only when it does. A plain new payment (no link) still must be
-- positive — that half of the original constraint stays exactly as strict
-- as before.
-- =====================================================================

alter table public.payments
  add column if not exists corrects_payment_id uuid references public.payments(id);

create index if not exists payments_corrects_payment_id_idx
  on public.payments (corrects_payment_id);

comment on column public.payments.corrects_payment_id is
  'Set when this row corrects an earlier one on the same appointment (e.g. a refund or an amount fix). Null for a plain payment.';

alter table public.payments drop constraint if exists payments_amount_pence_check;
alter table public.payments add constraint payments_amount_pence_check
  check (
    (corrects_payment_id is null and amount_pence > 0)
    or (corrects_payment_id is not null and amount_pence <> 0)
  );

-- ---------- log_payment: add the optional linkage ------------------------

drop function if exists public.log_payment(uuid, int, text);

create or replace function public.log_payment(
  p_appointment_id      uuid,
  p_amount_pence        int,
  p_note                text default null,
  p_corrects_payment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id                     uuid;
  v_target_appointment_id  uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_amount_pence is null or p_amount_pence = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  -- A plain payment (no correction target) must still be positive — only a
  -- correction may reduce the total.
  if p_corrects_payment_id is null and p_amount_pence < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_corrects_payment_id is not null then
    select appointment_id into v_target_appointment_id
    from public.payments
    where id = p_corrects_payment_id;

    if v_target_appointment_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;

    -- A correction has to reference a payment on the same appointment —
    -- otherwise the owner could accidentally (or a bug could silently)
    -- link two unrelated bookings' money together.
    if v_target_appointment_id <> p_appointment_id then
      raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
    end if;
  end if;

  insert into public.payments (appointment_id, amount_pence, note, recorded_by, corrects_payment_id)
  values (p_appointment_id, p_amount_pence, p_note, auth.uid(), p_corrects_payment_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_payment(uuid, int, text, uuid) from public, anon;
grant execute on function public.log_payment(uuid, int, text, uuid) to authenticated;
