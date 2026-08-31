-- =====================================================================
-- 0061_email_template_history.sql
--
-- KOKO_GAP.md P2: "Editing overwrites in place, no rollback to a prior
-- version." Adds an append-only revision log for `email_templates`,
-- written automatically by a trigger whenever `subject` or `html_body`
-- actually changes -- not on every save (toggling `active`/`allow_edit_
-- before_sending`/`include_in_automation` alone logs nothing, since
-- those aren't content edits).
--
-- No new RPC for "revert": a revert is just a normal owner UPDATE of
-- `email_templates` with an earlier revision's subject/html_body, going
-- through the exact same client-side `updateEmailTemplate()` path a
-- regular save already uses. The trigger fires on that update too, so
-- reverting automatically snapshots the pre-revert content as a new
-- revision -- full undo history, no special-casing.
-- =====================================================================

create table if not exists public.email_template_revisions (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null references public.email_templates(key) on delete cascade,
  subject      text not null,
  html_body    text not null,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists email_template_revisions_key_idx
  on public.email_template_revisions (template_key, created_at desc);

alter table public.email_template_revisions enable row level security;

drop policy if exists email_template_revisions_owner_select on public.email_template_revisions;
create policy email_template_revisions_owner_select on public.email_template_revisions
  for select using (public.is_owner());

-- No insert/update/delete policy for any role -- written only by the
-- security definer trigger function below, same pattern as every other
-- append-only log in this schema (audit_events, payments).

create or replace function public.log_email_template_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subject is distinct from old.subject or new.html_body is distinct from old.html_body then
    insert into public.email_template_revisions (template_key, subject, html_body)
    values (old.key, old.subject, old.html_body);
  end if;
  return new;
end;
$$;

revoke all on function public.log_email_template_revision() from public;

drop trigger if exists email_templates_log_revision on public.email_templates;
create trigger email_templates_log_revision
  before update on public.email_templates
  for each row execute function public.log_email_template_revision();
