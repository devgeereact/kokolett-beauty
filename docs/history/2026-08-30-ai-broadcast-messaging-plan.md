# AI-Drafted Broadcast Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real AI-drafted broadcast (newsletter/ad) sender to the mailing list, plus a reusable "polish this" AI drafting button on two existing one-off messaging surfaces — with a working unsubscribe link, since none exists anywhere in the app today.

**Architecture:** One new lightweight Edge Function (`draft-copy`) for single-completion AI text generation, one new RPC (`send_broadcast_as_owner`) that queues into the existing `email_messages` outbox (no new sending pathway), one new anon-callable RPC (`unsubscribe_via_link`) keyed on the subscriber's own id (no new token table), and a new render case in the shared email-template renderer.

**Tech Stack:** Postgres/Supabase (migrations, RPCs, RLS), Deno Edge Functions, OpenRouter (`openai/gpt-5-nano`), React 19 + TypeScript + Vite, Vitest, Supabase MCP for live verification (house method — no local Docker in this environment).

**Spec:** `docs/history/2026-08-30-ai-broadcast-messaging-design.md`

## Global Constraints

- Broadcast audience is exactly `subscribers` where `confirmed = true` and
  `unsubscribed_at is null` — never `customers`, regardless of `marketing_consent`.
- Every `owner_broadcast` email must render a working unsubscribe link.
- `draft-copy` must reject any non-owner caller before making an OpenRouter call.
- `audit_events` rows for `broadcast.sent` carry the subject and recipient count only —
  never the recipient list or the message body.
- British English, no pricing anywhere in AI-generated copy, women's-hair-salon scope
  only (docs/RULES.md §9.1, §9.6, CLAUDE.md scope constraint).
- AI drafts, the owner reviews and edits, the owner explicitly sends — never an
  autonomous write (the same governance principle already in force for
  `ai-assistant-chat`).
- The reply panel (`CommunicationAssistancePanel`) keeps sending via `mailto:` — only its
  drafting engine changes.
- Every migration is validated in a rolled-back transaction against the live Supabase
  project (via the Supabase MCP) before being applied for real — this environment has no
  local Docker, so this is the house method, not `supabase test db`.

---

## Task 1: Migration — broadcast send, unsubscribe, audit vocabulary

**Files:**
- Create: `supabase/migrations/0058_broadcast_messaging.sql` (confirm `0058` is still the
  next free number by running `ls supabase/migrations | tail -3` before writing the file —
  renumber if anything landed after `0057_drop_ai_recommendations.sql`)

**Interfaces:**
- Produces: RPC `send_broadcast_as_owner(p_subject text, p_body text) returns jsonb` —
  `{ recipient_count: number }`. RPC `unsubscribe_via_link(p_subscriber_id uuid) returns void`.
  New `audit_events.action` value `'broadcast.sent'`. `set_owner_login_slug()` redefined
  with `'unsubscribe'` added to its reserved-word array — signature unchanged.
- Consumes: `public.is_owner()`, `public.log_audit_event(...)` (both from `0002`/`0052`),
  `public.subscribers` (`0018`), `public.email_messages` (`0002`), `public.staff` (`0002`).

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================================
-- 0058_broadcast_messaging.sql
--
-- send_broadcast_as_owner() queues one email_messages row per confirmed,
-- not-unsubscribed subscriber — no new sending pathway, the existing
-- outbox/drain job/retry behaviour applies unchanged. Logged via
-- log_audit_event() with the subject and recipient count only, never the
-- recipient list or body (same principle as erasure/export).
--
-- unsubscribe_via_link() is anon-callable by design: a visitor clicking
-- the link has no session. It's keyed on the subscriber's own id rather
-- than a hashed token table (see docs/history/2026-08-30-
-- ai-broadcast-messaging-design.md §5.2 for why this is safe) —
-- idempotent, and reveals nothing about whether an id exists or was
-- already unsubscribed.
-- =====================================================================

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'appointment.created',
    'appointment.status_changed',
    'appointment.rescheduled',
    'appointment.deleted',
    'customer.erased',
    'payment.recorded',
    'settings.login_slug_changed',
    'day.closed',
    'customer.data_exported',
    'broadcast.sent'
  ));

create or replace function public.send_broadcast_as_owner(
  p_subject text,
  p_body    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count      integer := 0;
  v_subscriber record;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_subject is null or trim(p_subject) = '' then
    raise exception 'INVALID_SUBJECT' using errcode = 'P0001';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'INVALID_BODY' using errcode = 'P0001';
  end if;

  -- Goes through queue_email() (0005), not a raw insert — it's what sets
  -- scheduled_for to now() when none is given. A raw insert leaving that
  -- column null would never be picked up by the drain job at all: its
  -- `scheduled_for <= now()` filter compares false-or-null against null,
  -- never true. security definer lets this call queue_email() even though
  -- that function is revoked from every client role — the same reasoning
  -- every other RPC in this app already relies on for log_audit_event().
  for v_subscriber in
    select id, email, full_name from public.subscribers
    where confirmed and unsubscribed_at is null
  loop
    perform public.queue_email(
      'owner_broadcast', v_subscriber.email, p_subject, null, null, null,
      jsonb_build_object(
        'full_name', v_subscriber.full_name,
        'custom_body', p_body,
        'subscriber_id', v_subscriber.id
      )
    );
    v_count := v_count + 1;
  end loop;

  perform public.log_audit_event(
    'broadcast.sent', 'broadcast', null,
    format('Broadcast sent to %s subscriber(s): %s', v_count, p_subject),
    null, jsonb_build_object('recipient_count', v_count, 'subject', p_subject));

  return jsonb_build_object('recipient_count', v_count);
end;
$$;

revoke all on function public.send_broadcast_as_owner(text, text) from public, anon;
grant execute on function public.send_broadcast_as_owner(text, text) to authenticated;

create or replace function public.unsubscribe_via_link(p_subscriber_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where id = p_subscriber_id;
end;
$$;

revoke all on function public.unsubscribe_via_link(uuid) from public;
grant execute on function public.unsubscribe_via_link(uuid) to anon, authenticated;

-- ---------- Reserved-slug housekeeping ------------------------------------
-- 'unsubscribe' is a new top-level public route (src/pages/UnsubscribePage.tsx).
-- Redefined verbatim from 0051 with one addition to the array — same
-- signature, same validation, same grants (grants persist across
-- `create or replace function`, so none are restated here).
create or replace function public.set_owner_login_slug(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug     text := lower(trim(p_slug));
  v_old_slug text;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if length(v_slug) < 4 or length(v_slug) > 40 then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug = any (array[
    'about','gallery','services','testimonials','faqs','contact','book',
    'request-availability','subscribe','privacy','booking-policy','terms',
    'my','access','dashboard','login','reset-password',
    'admin','owner','staff','signin','signup','logout','api','app',
    'unsubscribe'
  ]) then
    raise exception 'SLUG_RESERVED' using errcode = 'P0001';
  end if;

  select login_slug into v_old_slug from public.staff where id = auth.uid();

  update public.staff
     set login_slug = v_slug,
         login_slug_updated_at = timezone('utc', now())
   where id = auth.uid();

  perform public.log_audit_event(
    'settings.login_slug_changed', 'staff', auth.uid(),
    'Owner sign-in link changed',
    jsonb_build_object('login_slug', v_old_slug),
    jsonb_build_object('login_slug', v_slug));
end;
$$;
```

- [ ] **Step 2: Validate in a rolled-back transaction against the live project**

Use the Supabase MCP `execute_sql` tool (project id `erqrfjlozqyhogneqraj`) with the
migration's SQL wrapped in `begin; ... rollback;`, plus this verification block inserted
before the `rollback;`:

```sql
-- Seed one throwaway subscriber inside this same rolled-back transaction —
-- never touches real subscriber data.
insert into public.subscribers (id, email, full_name, confirmed)
values ('99999999-9999-9999-9999-999999999999', 'broadcast-test@example.invalid',
        'Broadcast Test Subscriber', true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<a real staff id — query select id from public.staff limit 1 first>')::text, true);

-- Owner call: should insert 1 email_messages row (with scheduled_for set,
-- not null — the bug this design specifically avoids) and 1 audit_events row.
select public.send_broadcast_as_owner('Test broadcast', 'Hello everyone!') as owner_result;
select id, scheduled_for is not null as has_scheduled_for
  from public.email_messages where template = 'owner_broadcast';
select action, entity_type, new_value from public.audit_events where action = 'broadcast.sent';

-- Non-owner call must raise NOT_AUTHORISED (wrap in a DO block matching the pattern
-- used in every prior migration this session's live verification, e.g. 0056/0057).
do $$
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
    perform public.send_broadcast_as_owner('x', 'y');
    raise exception 'SHOULD_NOT_REACH_HERE';
  exception when others then
    if SQLERRM = 'NOT_AUTHORISED' then
      raise notice 'OK: non-owner denied';
    else
      raise;
    end if;
  end;
end $$;

-- unsubscribe_via_link: anon, idempotent, no signal either way.
reset role;
set local role anon;
select public.unsubscribe_via_link('99999999-9999-9999-9999-999999999999');
select unsubscribed_at is not null as unsubscribed
  from public.subscribers where id = '99999999-9999-9999-9999-999999999999';
select public.unsubscribe_via_link('99999999-9999-9999-9999-999999999999'); -- second call, must not error
select public.unsubscribe_via_link(gen_random_uuid()); -- nonexistent id, must not error
```

Confirm: owner call returns `{"recipient_count": 1}`, exactly one `owner_broadcast` row
in `email_messages` **with `scheduled_for` set (not null)** — the specific bug this
design avoids by going through `queue_email()` rather than a raw insert — exactly one
`broadcast.sent` audit row whose `new_value` contains only `recipient_count` and
`subject` (no email address, no body text), non-owner denied, both unsubscribe calls
succeed silently, `unsubscribed_at` is set after the first call.

- [ ] **Step 3: Apply the migration for real**

Use the Supabase MCP `apply_migration` tool with the exact SQL from Step 1 (name:
`broadcast_messaging`).

- [ ] **Step 4: Run the security advisor**

Use the Supabase MCP `get_advisors` tool (`type: "security"`). Expect only the same
generic "Signed-In Users Can Execute SECURITY DEFINER Function" WARN every other owner
RPC already gets (`send_broadcast_as_owner`) — confirm nothing else new appears. Note
`unsubscribe_via_link` is anon-callable *by design* (per the spec) — if the advisor flags
it, that is expected and not a bug to fix.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0058_broadcast_messaging.sql
git commit -m "feat(db): add broadcast sending, unsubscribe link, audit vocabulary"
```

---

## Task 2: `draft-copy` Edge Function

**Files:**
- Create: `supabase/functions/draft-copy/index.ts`

**Interfaces:**
- Consumes: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGIN`
  secrets (already provisioned for `ai-assistant-chat`, no new secret needed).
- Produces: `POST /draft-copy` — request
  `{ kind: 'broadcast' | 'compose' | 'reply'; roughIdea: string; customerName?: string; originalMessage?: string }`,
  response `{ subject?: string; body: string }`. Consumed by
  `src/services/draftCopyService.ts` (Task 4).

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/draft-copy/index.ts
//
// Single-completion AI text generation — no tool-calling loop, no
// business-data reads. A "polish this" button needs an inline
// request/response, not a round trip through the ai-assistant-chat
// conversation. Explicitly checks is_owner() before any OpenRouter call,
// since (unlike ai-assistant-chat's read tools) this function makes no
// other database query for RLS to gate.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENROUTER_MODEL = 'openai/gpt-5-nano';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function createRequestClient(authHeader: string) {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
}

type Kind = 'broadcast' | 'compose' | 'reply';

interface DraftRequest {
  kind: Kind;
  roughIdea: string;
  customerName?: string;
  originalMessage?: string;
}

const SYSTEM_PROMPTS: Record<Kind, string> = {
  broadcast:
    'You draft a short newsletter/ad email for Kokolett Beauty UK, a women\'s hair ' +
    'salon in Woolwich, South East London (braids, locs, weaves, natural hair, colour ' +
    '— women\'s hair only, never nails/brows/lashes or unisex/barbering services). ' +
    'British English. Never mention or invent a price — pricing is agreed in the chair. ' +
    'Warm, brief, no more than 3 short paragraphs. Respond with exactly two lines: ' +
    'the first starting "SUBJECT: ", the second starting "BODY: " (body may contain ' +
    '\\n for paragraph breaks).',
  compose:
    'You draft a one-off email from the owner of Kokolett Beauty UK (a women\'s hair ' +
    'salon) to a named customer. British English. Never mention or invent a price. ' +
    'Respond with exactly two lines: "SUBJECT: " then "BODY: " (body may contain \\n).',
  reply:
    'You draft a short reply from the owner of Kokolett Beauty UK to a customer\'s ' +
    'message. British English. Never mention or invent a price. Respond with exactly ' +
    'one line starting "BODY: " (may contain \\n). No subject.',
};

function buildUserPrompt(req: DraftRequest): string {
  const parts: string[] = [];
  if (req.customerName) parts.push(`Customer's name: ${req.customerName}`);
  if (req.originalMessage) parts.push(`Their message: """${req.originalMessage}"""`);
  parts.push(`What to write: ${req.roughIdea}`);
  return parts.join('\n');
}

function parseCompletion(text: string): { subject?: string; body: string } {
  const subjectMatch = /^SUBJECT:\s*(.*)$/m.exec(text);
  const bodyMatch = /^BODY:\s*([\s\S]*)$/m.exec(text);
  const body = (bodyMatch?.[1] ?? text).trim();
  const subject = subjectMatch?.[1]?.trim();
  return subject ? { subject, body } : { body };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const supabase = createRequestClient(authHeader);
    const { data: isOwner, error: ownerError } = await supabase.rpc('is_owner');
    if (ownerError || !isOwner) {
      return new Response(JSON.stringify({ error: 'NOT_AUTHORISED' }), {
        status: 403,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as DraftRequest;
    if (!body.roughIdea || !body.roughIdea.trim()) {
      return new Response(JSON.stringify({ error: 'roughIdea is required' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env('OPENROUTER_API_KEY');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[body.kind] },
          { role: 'user', content: buildUserPrompt(body) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[draft-copy] OpenRouter error', response.status, detail);
      return new Response(JSON.stringify({ error: 'The drafting service is unavailable right now.' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const completion = await response.json();
    const text: string = completion.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'The drafting service returned nothing.' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parseCompletion(text)), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[draft-copy] unhandled error', e);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Type-check the function**

Run: `deno check supabase/functions/draft-copy/index.ts`
Expected: no errors (matches the CI gate this repo already runs on `supabase/functions`).

- [ ] **Step 3: Deploy it**

Use the Supabase MCP `deploy_edge_function` tool (project id `erqrfjlozqyhogneqraj`,
function name `draft-copy`, the file content from Step 1).

- [ ] **Step 4: Smoke-test it manually**

Use `curl` with a real owner JWT (or test via the frontend once Task 4/7 land) to confirm
a `kind: 'broadcast'` request returns `{ subject, body }` and a request with no
`Authorization` header returns 401.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/draft-copy/index.ts
git commit -m "feat(ai): add draft-copy Edge Function for inline AI drafting"
```

---

## Task 3: `owner_broadcast` email template

**Files:**
- Modify: `supabase/functions/_shared/templates.ts`
- Test: `supabase/functions/_shared/templates.test.ts`

**Interfaces:**
- Consumes: existing `layout()`, `line()`, `small()`, `esc()` helpers, `SITE`/`MUTED`
  constants, all already defined in `templates.ts`.
- Produces: `render('owner_broadcast', payload)` where `payload` includes
  `full_name`, `custom_body`, `subscriber_id`. Consumed by `send-emails/index.ts`'s
  existing `render(row.template, row.payload ?? {}, ...)` call (no change needed there —
  `owner_broadcast` has no `email_templates` override row, so it falls through to the
  switch exactly like `owner_custom_message` already does).

- [ ] **Step 1: Write the failing test**

Add to `supabase/functions/_shared/templates.test.ts`:

```ts
Deno.test('owner_broadcast renders the body and an unsubscribe link', () => {
  const out = render('owner_broadcast', {
    full_name: 'Ada Lovelace',
    custom_body: 'We have new availability this week!',
    subscriber_id: 'deadbeef-0000-0000-0000-000000000000',
  });

  assertStringIncludes(out.html, 'Ada Lovelace');
  assertStringIncludes(out.html, 'We have new availability this week!');
  assertStringIncludes(out.html, '/unsubscribe/deadbeef-0000-0000-0000-000000000000');
  assertStringIncludes(out.text, '/unsubscribe/deadbeef-0000-0000-0000-000000000000');
});

Deno.test('owner_broadcast omits the unsubscribe link if no subscriber_id is given', () => {
  const out = render('owner_broadcast', { custom_body: 'Hello' });
  assert(!out.html.includes('/unsubscribe/'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/_shared/templates.test.ts`
Expected: FAIL — `owner_broadcast` falls into the `default` case (no `subscriber_id` field
on `TemplatePayload` yet either, so this also fails to typecheck).

- [ ] **Step 3: Add `subscriber_id` to `TemplatePayload` and the new render case**

Add one field to the `TemplatePayload` interface (near `custom_body`, `~line 51`):

```ts
  /** The subscriber this broadcast is addressed to, for the unsubscribe link (`owner_broadcast` only). */
  subscriber_id?: string;
```

Add a new case to the `switch (template)` block in `render()`, immediately before the
existing `case 'owner_custom_message':` (`~line 963`):

```ts
    // The owner's broadcast to the mailing list — same freeform-body shape
    // as owner_custom_message, plus a required unsubscribe link since this
    // is the one template that goes to more than one person at once.
    case 'owner_broadcast': {
      const bodyHtml = esc(p.custom_body ?? '')
        .split('\n')
        .map((paragraph) => line(paragraph))
        .join('');
      const unsubscribeUrl = p.subscriber_id ? `${SITE}/unsubscribe/${p.subscriber_id}` : null;
      const unsubscribeHtml = unsubscribeUrl
        ? small(
            `<a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">Unsubscribe</a> from these emails.`,
          )
        : '';
      return {
        html: layout(
          SALON,
          `A message from ${SALON}`,
          line(`Hello ${name},`) + bodyHtml + unsubscribeHtml,
          p,
          'You are receiving this because you subscribed to the Kokolett Beauty UK mailing list.',
        ),
        text:
          `Hello ${p.full_name ?? 'there'},\n\n${p.custom_body ?? ''}` +
          (unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : ''),
      };
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/_shared/templates.test.ts`
Expected: PASS, including every pre-existing test in the file (no regression).

- [ ] **Step 5: Type-check the whole `_shared` module**

Run: `deno check supabase/functions/_shared/templates.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/templates.ts supabase/functions/_shared/templates.test.ts
git commit -m "feat(email): add owner_broadcast template with an unsubscribe link"
```

---

## Task 4: Types and frontend services

**Files:**
- Modify: `src/types/database.types.ts` (hand-maintained, no generator — confirmed this
  session)
- Modify: `src/types/index.ts`
- Create: `src/services/draftCopyService.ts`
- Create: `src/services/broadcastService.ts`

**Interfaces:**
- Consumes: `invokeFunction<T>(name, body)` from `src/lib/supabase.ts` (existing typed
  wrapper around `supabase.functions.invoke`), `supabase.rpc(...)` from
  `src/lib/supabase.ts`.
- Produces: `draftCopy(input: DraftCopyInput): Promise<DraftCopyResult>`,
  `sendBroadcast(subject: string, body: string): Promise<{ recipientCount: number }>` —
  consumed by Tasks 6–9.

- [ ] **Step 1: Add the new action value to `database.types.ts`'s `audit_events` literal union**

The `action` field's literal union appears three times in that file (`Row`, `Insert`,
`Update`) — each currently ends with `| "customer.data_exported"`. Add
`| "broadcast.sent"` after it in all three places.

- [ ] **Step 2: Add the two new Functions entries to `database.types.ts`**

Insert immediately before line 1445 (`send_custom_email_as_owner: {`) —
`broadcast` < `custom` alphabetically:

```ts
      send_broadcast_as_owner: { Args: { p_body: string; p_subject: string }; Returns: Json }
```

Insert immediately before line 1517 (`weekly_template_status: { Args: never; Returns: Json }`,
which currently follows `system_health_summary` on line 1516):

```ts
      unsubscribe_via_link: { Args: { p_subscriber_id: string }; Returns: undefined }
```

- [ ] **Step 3: Add hand-declared types to `src/types/index.ts`**

Near `DailyCloseSummary` (the most recent jsonb-RPC-return interface added):

```ts
export type DraftKind = 'broadcast' | 'compose' | 'reply';

export interface DraftCopyInput {
  kind: DraftKind;
  roughIdea: string;
  customerName?: string;
  originalMessage?: string;
}

export interface DraftCopyResult {
  subject?: string;
  body: string;
}

/** Shape returned by `public.send_broadcast_as_owner()`. */
export interface BroadcastResult {
  recipient_count: number;
}
```

- [ ] **Step 4: Write `src/services/draftCopyService.ts`**

```ts
import { invokeFunction } from '@/lib/supabase';
import type { DraftCopyInput, DraftCopyResult } from '@/types';

/**
 * Inline AI drafting — a single request/response, not a chat. Used by the
 * "Polish with AI" button on the broadcast composer, the one-off Compose
 * modal, and the customer-profile reply panel (migration 0058, Edge
 * Function `draft-copy`).
 */
export async function draftCopy(input: DraftCopyInput): Promise<DraftCopyResult> {
  return invokeFunction<DraftCopyResult>('draft-copy', { ...input });
}
```

- [ ] **Step 5: Write `src/services/broadcastService.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { BroadcastResult } from '@/types';

/**
 * Sends a broadcast to every confirmed, not-unsubscribed mailing-list
 * subscriber — queues into the existing email_messages outbox, one row
 * per recipient (migration 0058). No preview/dry-run: the recipient count
 * shown before sending comes from `listSubscribers()` in
 * `subscriberService.ts`, filtered the same way the RPC filters server-side.
 */
export async function sendBroadcast(subject: string, body: string): Promise<BroadcastResult> {
  const { data, error } = await supabase.rpc('send_broadcast_as_owner', {
    p_subject: subject,
    p_body: body,
  });
  if (error) throw error;
  return data as unknown as BroadcastResult;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors. (No dedicated Vitest file for either service — both are
thin RPC/function wrappers with no branching logic of their own, matching this
codebase's existing convention: `paymentService.ts`, `dailyCloseService.ts`, and every
other single-call service wrapper in this repo have no test file either. The real
coverage for these two is the live RPC verification in Task 1 and the render checks in
Tasks 6–9.)

- [ ] **Step 7: Commit**

```bash
git add src/types/database.types.ts src/types/index.ts src/services/draftCopyService.ts src/services/broadcastService.ts
git commit -m "feat(types): add types and services for broadcast messaging"
```

---

## Task 5: Routing and navigation scaffolding

**Files:**
- Modify: `src/lib/routes.ts`
- Modify: `src/lib/icons.ts`
- Modify: `src/components/dashboard/DashboardLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `routes.owner.broadcasts` (`'/dashboard/broadcasts'`),
  `routes.public.unsubscribe(id)` (`` `/unsubscribe/${id}` ``), `'unsubscribe'` added to
  `RESERVED_SLUGS`, a "Broadcasts" nav entry, lazy routes for `BroadcastsPage` (protected)
  and `UnsubscribePage` (public) — consumed by Tasks 6–7.

- [ ] **Step 1: Add routes**

In `src/lib/routes.ts`, add to the `owner` block (near `templates`/`profile`):

```ts
    /** AI-drafted newsletter/ad to the mailing list (migration 0058). */
    broadcasts: '/dashboard/broadcasts',
```

Add to the `public` block:

```ts
    /** Public, no session — redeems the link in a broadcast email's footer (migration 0058). */
    unsubscribe: (subscriberId: string) => `/unsubscribe/${subscriberId}`,
```

Add `'unsubscribe'` to the `RESERVED_SLUGS` array (matching the SQL-side addition from
Task 1 — that function's own comment already says these two lists need manual sync).

- [ ] **Step 2: Add the nav icon**

In `src/lib/icons.ts`: add `Megaphone` to the `lucide-react` import list, add
`'Broadcasts'` to `NavIconLabel`, add `Broadcasts: Megaphone` to `NAV_ICONS`.

- [ ] **Step 3: Add the nav entry**

In `src/components/dashboard/DashboardLayout.tsx`, add to the existing **Communications**
group (after `Templates`):

```ts
        {
          to: routes.owner.broadcasts,
          label: 'Broadcasts',
          icon: NAV_ICONS.Broadcasts,
        },
```

- [ ] **Step 4: Wire the protected route**

In `src/App.tsx`, add a lazy import near the other dashboard pages:

```ts
const BroadcastsPage = lazy(() =>
  import('@/pages/dashboard/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })),
);
```

Add `<Route path={routes.owner.broadcasts} element={<BroadcastsPage />} />` inside the
existing shared `<ProtectedRoute>` block, next to the `templates` route (`grep -n
"routes.owner.templates" src/App.tsx` to find the exact line).

- [ ] **Step 5: Wire the public route**

Add a lazy import for `UnsubscribePage` and one `<Route path="/unsubscribe/:subscriberId" element={<UnsubscribePage />} />`
in the public routes section, near the `subscribe`/`access` routes (`grep -n
"routes.public.subscribe" src/App.tsx` to find the exact line) — **outside** the
`ProtectedRoute` block, since this page must render with no session.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no errors (the pages don't exist yet — this step will fail until Tasks 6–7
land; if executing tasks in strict order, skip this check here and run it after Task 7
instead. If executing with subagent-driven-development, note this dependency explicitly
to whichever task runs this check).

- [ ] **Step 7: Commit**

Bundle this commit with Task 6 or 7 (whichever lands first) rather than committing
routes that point at nonexistent components — `npm run build` would fail on its own
between this task and the next.

---

## Task 6: `UnsubscribePage.tsx`

**Files:**
- Create: `src/pages/UnsubscribePage.tsx`

**Interfaces:**
- Consumes: `useParams()` from `react-router-dom`, `supabase.rpc('unsubscribe_via_link', ...)`
  directly (this is the one place in the app that's simplest calling the RPC inline rather
  than via a service file — it's a single anon call with no reuse elsewhere).
- Produces: renders at `routes.public.unsubscribe(id)`.

- [ ] **Step 1: Write the page**

```tsx
import { type JSX, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Public, no session, no `DashboardLayout`. Always shows the same
 * confirmation regardless of whether the id was valid or already
 * unsubscribed — same enumeration-resistant posture as the customer
 * magic-link system (migration 0058).
 */
export function UnsubscribePage(): JSX.Element {
  const { subscriberId } = useParams<{ subscriberId: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!subscriberId) {
      setDone(true);
      return;
    }
    supabase
      .rpc('unsubscribe_via_link', { p_subscriber_id: subscriberId })
      .then(() => setDone(true))
      .catch(() => setDone(true));
  }, [subscriberId]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-2xl font-semibold text-foreground">
          {done ? "You're unsubscribed" : 'One moment…'}
        </p>
        <p className="mt-2 text-muted-foreground">
          {done
            ? "If that link was valid, you won't hear from our mailing list again."
            : ''}
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run build`
Expected: no errors (Task 5's routes now resolve to a real component; `BroadcastsPage`
from Task 7 must also exist before this passes cleanly — run this check after Task 7 if
executing strictly in order).

- [ ] **Step 3: Commit** (bundle with Task 5's routing changes if not already committed)

```bash
git add src/pages/UnsubscribePage.tsx src/lib/routes.ts src/lib/icons.ts src/components/dashboard/DashboardLayout.tsx src/App.tsx
git commit -m "feat(broadcasts): wire routes and add the public unsubscribe page"
```

---

## Task 7: `BroadcastsPage.tsx`

**Files:**
- Create: `src/pages/dashboard/BroadcastsPage.tsx`

**Interfaces:**
- Consumes: `draftCopy` (Task 4), `sendBroadcast` (Task 4), `listSubscribers` (existing,
  `src/services/subscriberService.ts`), `useToast` (existing, `src/context/ToastContext`),
  `Button`/`Card`/`ConfirmDialog`/`Field`/`Textarea`/`Input` (existing UI primitives).
- Produces: renders at `routes.owner.broadcasts`.

- [ ] **Step 1: Write the page**

```tsx
import { type JSX, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { draftCopy } from '@/services/draftCopyService';
import { sendBroadcast } from '@/services/broadcastService';
import { listSubscribers } from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/context/ToastContext';

/**
 * The owner's own words, drafted from a rough idea and reviewed before it
 * sends to every confirmed, not-unsubscribed mailing-list subscriber
 * (migration 0058) — same "AI proposes, owner confirms" principle as
 * every other AI-assisted write in this app.
 */
export function BroadcastsPage(): JSX.Element {
  const { showToast } = useToast();
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [roughIdea, setRoughIdea] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listSubscribers()
      .then((rows) => setRecipientCount(rows.length))
      .catch(() => setRecipientCount(null));
  }, []);

  const polish = (): void => {
    if (!roughIdea.trim()) return;
    setDrafting(true);
    setDraftError(null);
    draftCopy({ kind: 'broadcast', roughIdea })
      .then((result) => {
        setSubject(result.subject ?? subject);
        setBody(result.body);
      })
      .catch((e: unknown) => setDraftError(errorMessage(e)))
      .finally(() => setDrafting(false));
  };

  const send = (): void => {
    setSending(true);
    sendBroadcast(subject.trim(), body.trim())
      .then(({ recipient_count }) => {
        showToast({ message: `Sent to ${recipient_count} subscriber(s).` });
        setSubject('');
        setBody('');
        setRoughIdea('');
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }))
      .finally(() => setSending(false));
  };

  const canSend = !sending && subject.trim() !== '' && body.trim() !== '';

  return (
    <DashboardLayout
      title="Broadcasts"
      subtitle="A newsletter or ad to your mailing list — drafted with AI, reviewed by you, sent to no one else."
    >
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <Field label="What do you want to say?">
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={roughIdea}
                onChange={(e) => setRoughIdea(e.target.value)}
                placeholder="e.g. we have new availability this week for braids and locs"
              />
            )}
          </Field>
          <Button
            variant="ghost"
            size="sm"
            onClick={polish}
            disabled={drafting || !roughIdea.trim()}
          >
            {drafting ? 'Drafting…' : '✨ Polish with AI'}
          </Button>
          {draftError && <p className="mt-2 text-sm text-status-no-show">{draftError}</p>}
        </Card>

        <Card className="p-5">
          <Field label="Subject">
            {({ id }) => (
              <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
          </Field>
          <Field label="Body">
            {({ id }) => (
              <Textarea
                id={id}
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </Field>
          <p className="mb-3 text-sm text-muted-foreground">
            {recipientCount === null
              ? 'Loading recipient count…'
              : `Will send to ${recipientCount} subscriber(s).`}
          </p>
          <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            Send broadcast
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Send this broadcast?"
        message={`This sends "${subject}" to ${recipientCount ?? 0} subscriber(s) right now. There is no undo.`}
        confirmLabel={sending ? 'Sending…' : 'Send'}
        onConfirm={() => {
          setConfirmOpen(false);
          send();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </DashboardLayout>
  );
}
```

- [ ] **Step 2: Typecheck, lint, format**

Run: `npm run build && npm run lint && npm run format:check`
Expected: no errors. Fix any Prettier drift with `npx prettier --write
src/pages/dashboard/BroadcastsPage.tsx src/pages/UnsubscribePage.tsx` (and any other
touched file the formatter flags).

- [ ] **Step 3: Manual render check**

Start the preview server (`npm run build && npm run preview`, port `5082` — `strictPort`,
see `vite.config.ts`) and confirm both `/dashboard/broadcasts` and
`/unsubscribe/00000000-0000-0000-0000-000000000000` render with no console errors (a
headless check via Playwright, same lightweight pattern used throughout this project's
recent work — no assertions on the owner-only page's actual content since that needs a
real session, just confirm the bundle loads cleanly).

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/BroadcastsPage.tsx
git commit -m "feat(broadcasts): add the broadcast composer page"
```

---

## Task 8: "Polish with AI" on the one-off Compose modal

**Files:**
- Modify: `src/components/dashboard/email/ComposeContentStep.tsx`

**Interfaces:**
- Consumes: `draftCopy` (Task 4).
- Produces: no new exports — this is a UI-only addition to an existing component.

- [ ] **Step 1: Add the button and its handler**

`ComposeContentStep.tsx` already imports `useState` (line 1, alongside `useCallback`,
`useEffect`, `useRef`) — no change needed to that line. Add two new imports:

```ts
import { draftCopy } from '@/services/draftCopyService';
import { errorMessage } from '@/lib/errors';
```

Add local state near the top of the component function:

```ts
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  const polish = (): void => {
    if (!body.trim()) return;
    setPolishing(true);
    setPolishError(null);
    draftCopy({
      kind: 'compose',
      roughIdea: body,
      customerName: recipient?.full_name,
    })
      .then((result) => {
        if (result.subject) onSubjectChange(result.subject);
        onBodyChange(result.body);
      })
      .catch((e: unknown) => setPolishError(errorMessage(e)))
      .finally(() => setPolishing(false));
  };
```

Add the button just above the existing `Field label="Body"` block:

```tsx
          <div className="mb-2 flex items-center justify-between">
            <span />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={polish}
              disabled={polishing || !body.trim()}
            >
              {polishing ? 'Polishing…' : '✨ Polish with AI'}
            </Button>
          </div>
          {polishError && (
            <p className="mb-2 text-sm text-status-no-show">{polishError}</p>
          )}
```

- [ ] **Step 2: Typecheck, lint, format**

Run: `npm run build && npm run lint && npm run format:check`
Expected: no errors.

- [ ] **Step 3: Manual render check**

Open the Compose modal (Communications → Email → Compose) in the running app, type
something rough in the body, click "Polish with AI", confirm it calls `draft-copy` (check
the network tab or console — a real send would need a deployed function and an owner
session, so this may only be fully verifiable once Task 2's function is deployed and
you're signed in as the owner).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/email/ComposeContentStep.tsx
git commit -m "feat(email): add a Polish with AI button to the Compose modal"
```

---

## Task 9: Real AI drafting on the customer-profile reply panel

**Files:**
- Modify: `src/components/dashboard/assistant/CommunicationAssistancePanel.tsx`
- Delete: `src/lib/emailDrafts.ts`
- Delete: `src/lib/emailDrafts.test.ts`

**Interfaces:**
- Consumes: `draftCopy` (Task 4).
- Removes: `suggestReply`, `draftEmail`, `EmailPurpose`, `EMAIL_PURPOSE_LABELS` (the last
  three were already dead code before this task — confirmed unused anywhere in the
  codebase — this task's edit to `CommunicationAssistancePanel.tsx` removes the one live
  caller of `suggestReply`, making the whole file safe to delete outright rather than
  leave as an unused module).

- [ ] **Step 1: Confirm nothing else imports from `emailDrafts.ts`**

Run: `grep -rn "emailDrafts\|suggestReply\|draftEmail\|EmailPurpose" src --include="*.ts" --include="*.tsx"`
Expected: only `CommunicationAssistancePanel.tsx` (the file this task edits) and
`emailDrafts.ts`/`emailDrafts.test.ts` themselves. If anything else appears, stop and
re-scope this task rather than deleting a file something else still needs.

- [ ] **Step 2: Replace the drafting call in `CommunicationAssistancePanel.tsx`**

Remove the import: `import { suggestReply, type ReplyTone } from '@/lib/emailDrafts';`

Add:
```ts
import { draftCopy } from '@/services/draftCopyService';
import { errorMessage } from '@/lib/errors';

export type ReplyTone = 'friendly' | 'formal' | 'brief';
```

(`ReplyTone` moves into this file since its only other home, `emailDrafts.ts`, is being
deleted — same three values, same meaning, just no longer imported from a module that no
longer exists.)

Replace the existing synchronous effect:

```ts
  useEffect(() => {
    if (!selected) {
      setReply('');
      return;
    }
    setReply(suggestReply(selected.text, tone, selected.customerName));
    setCopied(false);
  }, [selected, tone]);
```

with an async version that adds a loading state (this becomes a real network call):

```ts
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setReply('');
      setDraftError(null);
      return;
    }
    setDrafting(true);
    setDraftError(null);
    draftCopy({
      kind: 'reply',
      roughIdea: tone,
      originalMessage: selected.text,
      customerName: selected.customerName,
    })
      .then((result) => setReply(result.body))
      .catch((e: unknown) => setDraftError(errorMessage(e)))
      .finally(() => setDrafting(false));
    setCopied(false);
  }, [selected, tone]);
```

Add a loading/error indicator near the existing `Textarea` (replace the block that
renders it):

```tsx
            {drafting ? (
              <p className="mb-4 text-sm text-muted-foreground">Drafting a reply…</p>
            ) : draftError ? (
              <p className="mb-4 text-sm text-status-no-show">{draftError}</p>
            ) : (
              <Textarea
                aria-label="Suggested reply"
                rows={5}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            )}
```

- [ ] **Step 3: Delete the dead files**

```bash
rm src/lib/emailDrafts.ts src/lib/emailDrafts.test.ts
```

- [ ] **Step 4: Typecheck, lint, format, and run the unit test suite**

Run: `npm run build && npm run lint && npm run format:check && npm test`
Expected: no errors, no failures. The unit-test count drops by whatever
`emailDrafts.test.ts` contributed — confirm the new total in the output (used later to
update `docs/KOKO_GAP.md`'s test-file count, currently documented as 21).

- [ ] **Step 5: Manual render check**

Open a customer's profile, go to the Message tab, pick a message, confirm a reply drafts
in (with a brief "Drafting a reply…" state) rather than appearing instantly, and that
switching tone re-drafts.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/assistant/CommunicationAssistancePanel.tsx
git rm src/lib/emailDrafts.ts src/lib/emailDrafts.test.ts
git commit -m "feat(assistant): replace deterministic reply templating with real AI drafting"
```

---

## Task 10: Documentation and final verification

**Files:**
- Modify: `docs/KOKO_GAP.md`
- Modify: `docs/SCHEMA.md`

- [ ] **Step 1: Full verification pass**

Run, in order:
```bash
npm run build && npm run lint && npm run format:check && npm test
deno check supabase/functions/draft-copy/index.ts supabase/functions/_shared/templates.ts
```
Expected: everything green. This repeats checks from earlier tasks deliberately — the
last confirmation that nothing later broke something earlier.

- [ ] **Step 2: Update `docs/SCHEMA.md`**

Add a row to the top per-migration table for `0058_broadcast_messaging.sql` (mirror the
existing rows' style — one line, what it added, why). No new table, no new RLS-summary
row, no new cron job — this migration only adds two functions and extends one existing
check constraint, so those three sections don't need edits.

- [ ] **Step 3: Update `docs/KOKO_GAP.md`**

This feature didn't originate from the gap matrix (it surfaced from a direct request), so
add it as a new row in whichever section fits best (§3 "Email subsystem" is the closest
existing section) rather than editing an existing row:

```
| AI-drafted broadcast messaging | Rough idea → AI draft (`draft-copy` Edge Function) → owner-reviewed subject/body → send to confirmed, not-unsubscribed mailing-list subscribers only, queued through the existing outbox. Unsubscribe link on every broadcast email (new, previously nonexistent anywhere in the app). Same drafting reused on the one-off Compose modal and the customer-profile reply panel (deterministic templating there is now gone — `emailDrafts.ts` deleted). | ✅ | `supabase/migrations/0058_broadcast_messaging.sql`, `supabase/functions/draft-copy/index.ts`, `src/pages/dashboard/BroadcastsPage.tsx`, `src/pages/UnsubscribePage.tsx` — spec: `docs/superpowers/specs/2026-08-30-ai-broadcast-messaging-design.md` | — | — | — |
```

- [ ] **Step 4: Commit the docs**

```bash
git add docs/KOKO_GAP.md docs/SCHEMA.md
git commit -m "docs: record AI-drafted broadcast messaging in KOKO_GAP.md and SCHEMA.md"
```

---

## Self-review notes (from the plan author, not a step to execute)

- **Spec coverage:** §5.1 (draft-copy) → Task 2. §5.2 (unsubscribe) → Task 1 + Task 6.
  §5.3 (send RPC) → Task 1. §5.4 (template) → Task 3. §6 (frontend table, every row) →
  Tasks 4, 5, 6, 7, 8, 9. §7 (error handling) → covered inline in Tasks 2, 6, 7. §8
  (compliance checklist) → every box has a corresponding step: audience (Task 1 step 1
  query), unsubscribe link (Task 3), idempotent/no-signal unsubscribe (Task 1 step 2),
  `draft-copy` owner check (Task 2 step 1), audit row content (Task 1 step 1/2),
  `RESERVED_SLUGS` + SQL reserved array (Task 1 step 1 + Task 5 step 1). §11's open item
  (test-send-to-self) was deliberately left out of this plan, matching the spec's own
  note that it's a sizing decision for the plan, not a blocking requirement — it is not
  included as a task; if wanted later, it is a small additive task on top of
  `BroadcastsPage.tsx`, not a rework of anything above.
- **Type consistency:** `sendBroadcast` returns `{ recipient_count: number }` (snake_case,
  matching the RPC's jsonb key) in `BroadcastResult`, and `BroadcastsPage.tsx` destructures
  `recipient_count` — consistent throughout. `draftCopy`'s `DraftCopyResult` (`subject?`,
  `body`) is used identically in Tasks 7, 8, 9.
- **No placeholders:** every step above contains real code, not a description of code.
- **Bug found and fixed during this review:** the first draft of Task 1's
  `send_broadcast_as_owner()` inserted directly into `email_messages`, leaving
  `scheduled_for` null. `queue_email()` (`0005`) always sets it to `coalesce(p_scheduled_for, now())`
  — a null value would never satisfy the drain job's `scheduled_for <= now()` filter, so
  every broadcast would have sat in the outbox forever, never sending. Fixed by looping
  over subscribers and calling `queue_email()` per recipient instead of duplicating its
  insert logic — also removes the drift risk of a second, slightly different insert path
  for the same table.
