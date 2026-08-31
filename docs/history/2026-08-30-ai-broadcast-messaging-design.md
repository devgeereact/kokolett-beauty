# AI-Drafted Broadcast Messaging — Design Spec

**Date:** 2026-08-30
**Status:** Approved design, awaiting spec sign-off before implementation planning.

## 1. Context

`docs/KOKO_GAP.md` doesn't currently list this — it surfaced from a direct request while
closing out the P2 backlog: "we use AI to draft messages and ads and newsletters to all
customers." Verifying that claim against the codebase found three separate, smaller
things, none of which is what was described:

1. **`ai-assistant-chat`'s `propose_email` tool** — real LLM drafting, but only reachable
   by asking the conversational chat, one customer at a time. No dedicated "compose with
   AI" button anywhere.
2. **`ComposeEmailModal`** — the actual send path (`sendCustomEmailAsOwner` → `email_messages`
   → drain queue), but starting content comes from a past template, never AI-drafted.
3. **`CommunicationAssistancePanel`** (the "reply to a customer's note" panel on their
   profile) — **not AI at all**. `suggestReply()` in `src/lib/emailDrafts.ts` is
   deterministic, tone-keyed string templating. Sending happens via a `mailto:` link,
   entirely outside this app's own email system.

There is **no bulk-send mechanism of any kind** — `sendCustomEmailAsOwner` is explicitly
one-off, and the `subscribers` mailing list (populated via the `/subscribe` page) has no
send path attached to it. This spec builds that, properly, from nothing.

## 2. Goals

- A genuine AI-drafted broadcast (newsletter/ad) to the mailing list, reviewed and
  edited by the owner before it sends.
- Real AI drafting (not templating) available as a "polish this" button in three places:
  the new broadcast composer, the existing one-off Compose modal, and the customer-profile
  reply panel.
- Lawful marketing: every broadcast carries a working one-click unsubscribe link.
- Reuse existing infrastructure wherever it already fits — the outbox/drain queue for
  sending, `audit_events` for logging, the same AI governance principle already in force
  everywhere else in this app (AI drafts, owner reviews, owner explicitly sends — never
  autonomous).

## 3. Non-goals (explicitly out of scope for this spec)

- Changing how the reply panel **sends** — it stays `mailto:` (user's call). Only its
  drafting engine changes.
- A/B testing, scheduling, or analytics on broadcasts (open, click tracking) — this is a
  compose-and-send tool, not a campaign platform.
- Segmenting the audience beyond "the mailing list" — no tags, no cohorts. One list, one
  send.
- Any change to `ai-assistant-chat`'s existing tools or governance.

## 4. Decisions already made (confirmed with the owner)

- **Audience:** `subscribers` where `confirmed = true` and `unsubscribed_at is null`.
  Not `customers.marketing_consent`, not "all customers."
- **Reply-panel sending:** stays `mailto:`. Only the drafting behind it changes.
- **Drafting mechanism:** a new, dedicated Edge Function, not an extension of the chat
  (see §5.1 for why).

## 5. Architecture

### 5.1 `draft-copy` Edge Function (new)

A single-completion text generator — no tool-calling loop, no business-data reads. Takes
rough input, returns polished copy.

**Why not extend `ai-assistant-chat`:** that function's tool-calling loop exists to let
the model read business data and *propose* a mutation; a "polish this text" button needs
an inline, single-request/response call next to a textarea, not a conversational round
trip through the chat UI. A second function is a cleaner boundary than overloading the
chat's tool set with something that isn't a proposal and doesn't read anything.

**Why not call OpenRouter from the browser:** would expose `OPENROUTER_API_KEY` client-side
— never done anywhere else in this app, not started here.

**Auth:** same pattern as `ai-assistant-chat`'s `createRequestClient(authHeader)` — a
Supabase client built from the caller's own `Authorization` header (no service-role key).
Explicitly calls `supabase.rpc('is_owner')` and rejects with 403 if false, before making
any OpenRouter call (this function makes no other database read, so there's no RLS to
lean on the way the chat's read tools do — the check has to be explicit).

**Request:**
```ts
{
  kind: 'broadcast' | 'compose' | 'reply';
  roughIdea: string;           // the owner's messy input, or the text to rewrite
  customerName?: string;       // 'compose' and 'reply'
  originalMessage?: string;    // 'reply' — the customer's note being replied to
}
```

**Response:** `{ subject?: string; body: string }` (`subject` only for `broadcast`/`compose`).

**System prompt, per `kind`:** British English, no pricing anywhere (money constraint —
`docs/RULES.md` §9.1/§9.6), women's-hair-salon scope only, no upselling services this
salon doesn't offer. `broadcast` asks for a subject + a warm, brief newsletter/ad body.
`compose` asks for a subject + body addressed to one named customer. `reply` asks for a
short reply body only, in a tone derived from `roughIdea` (friendly/formal/brief — the
tone buttons become the prompt input instead of a template selector).

**Secrets:** `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGIN` —
identical to `ai-assistant-chat`, no new secret to provision.

### 5.2 Unsubscribe link (new, no new table)

Simplification from the first verbal pass of this design: rather than a hashed-token
table mirroring `customer_access_tokens`, the subscriber's own `id` (already an
unguessable random UUID) **is** the link token. Reasoning: the worst outcome of someone
else knowing or guessing a subscriber's id is that they get unsubscribed from marketing —
a low-harm, fully reversible (they can resubscribe) action, unlike the magic-link system
that guards actual personal data and appointment access. A dedicated hashed-token table
buys nothing proportionate to the added migration/complexity here. YAGNI.

- **Route:** `/unsubscribe/:subscriberId` (public, no session).
- **Page:** `src/pages/UnsubscribePage.tsx` — calls the RPC on mount, always shows a
  generic confirmation ("You've been unsubscribed" / "If that link was valid, you won't
  hear from us again") regardless of whether the id existed or was already unsubscribed —
  same enumeration-resistant posture as the customer magic-link system.
- **RPC:** `unsubscribe_via_link(p_subscriber_id uuid) returns void` — security definer,
  granted to `anon` (this is the one RPC in this feature that must be anon-callable — the
  visitor clicking the link has no session at all). Idempotent:
  `update subscribers set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = p_subscriber_id`
  — no error, no row-existence signal either way.
- **Routing housekeeping:** `unsubscribe` must be added to `RESERVED_SLUGS` in
  `src/lib/routes.ts` **and** to `set_owner_login_slug()`'s reserved-word array
  (`0051_secret_owner_login.sql`) — that function's own comment already flags this as a
  manual step whenever a new top-level public route is added. Missing this would let the
  owner accidentally set her secret sign-in slug to `unsubscribe`, breaking the new route.

### 5.3 Sending a broadcast (new RPC, no new sending pathway)

`send_broadcast_as_owner(p_subject text, p_body text) returns jsonb` — `is_owner()`-gated,
security definer.

```sql
insert into public.email_messages (template, to_email, subject, customer_id, payload)
select 'owner_broadcast', s.email, p_subject, null,
       jsonb_build_object('full_name', s.full_name, 'custom_body', p_body, 'subscriber_id', s.id)
from public.subscribers s
where s.confirmed and s.unsubscribed_at is null;
```

Returns `{ recipient_count: <rows inserted> }`. No new sending pathway — this queues into
the existing `email_messages` outbox exactly like every other message, so the existing
5-minute drain job, retry/backoff, and dead-letter behaviour all apply unchanged. A
broadcast to 200 subscribers becomes 200 outbox rows, not one SMTP burst.

Logged via the existing `log_audit_event()`: a new `broadcast.sent` value in
`audit_events.action`'s check constraint (same mechanism used for `day.closed` and
`customer.data_exported`). The audit row records the subject and recipient count —
**never** the recipient list or the body — same "log that it happened, not a copy of the
data" principle as erasure and export.

### 5.4 Template rendering (`supabase/functions/_shared/templates.ts`)

New `owner_broadcast` case, alongside the existing `owner_custom_message`. Reuses the
existing masthead/footer shell (`renderOverride` / the shared footer builder), with two
differences from `owner_custom_message`'s footer:
- The compliance line changes from "you received this because the salon sent you a
  message directly" to "you're receiving this because you subscribed to Kokolett Beauty's
  mailing list."
- An unsubscribe link is appended: `${APP_URL}/unsubscribe/${payload.subscriber_id}`,
  built at render time from the `subscriber_id` carried in the row's `payload` — same
  "injected by the sender, computed at render time, not stored as a full URL" convention
  this file already uses for `manage_url`/`reset_url`.

`supabase/functions/_shared/templates.test.ts` gets a new test case for this template,
following the existing per-template test pattern in that file.

## 6. Frontend

| File | Change |
|---|---|
| `src/services/draftCopyService.ts` (new) | `draftCopy(input)` — calls `invokeFunction('draft-copy', input)` (the existing typed wrapper in `src/lib/supabase.ts`). |
| `src/services/broadcastService.ts` (new) | `sendBroadcast(subject, body): Promise<{ recipientCount: number }>` — calls the RPC. |
| `src/services/subscriberService.ts` | No change — `listSubscribers()` already returns confirmed, non-unsubscribed rows; reused client-side to show a live "N subscribers will receive this" count before sending. |
| `src/pages/dashboard/BroadcastsPage.tsx` (new) | Rough-idea textarea → "Polish with AI" (`draftCopy({kind:'broadcast', roughIdea})`) → editable subject/body → recipient count → "Send broadcast" behind a `ConfirmDialog` (irreversible at scale, unlike a single email). |
| `src/pages/UnsubscribePage.tsx` (new) | Public, no `DashboardLayout`. |
| `src/lib/routes.ts` | `owner.broadcasts: '/dashboard/broadcasts'`; `public.unsubscribe: (id) => \`/unsubscribe/${id}\``; add `'unsubscribe'` to `RESERVED_SLUGS`. |
| `src/App.tsx` | New lazy route for `BroadcastsPage` (owner, protected); new eager or lazy route for `UnsubscribePage` (public, outside the `ProtectedRoute` block). |
| `src/lib/icons.ts` / `DashboardLayout.tsx` | New nav entry under the existing **Communications** group (alongside Notifications/Email/Templates) — "Broadcasts". |
| `src/components/dashboard/email/ComposeEmailModal.tsx` (+ `ComposeContentStep.tsx`) | Add the same "Polish with AI" button next to the body field: `draftCopy({kind:'compose', roughIdea: body, customerName: recipient?.full_name})`, replaces subject/body with the result. |
| `src/components/dashboard/assistant/CommunicationAssistancePanel.tsx` | Replace the synchronous `suggestReply()` call with an async `draftCopy({kind:'reply', roughIdea: tone, originalMessage: selected.text, customerName: selected.customerName})` — needs a loading state added (this becomes a network call). Tone buttons stay, now as prompt input rather than a template key. `suggestReply()`/`emailDrafts.ts` become dead code once this lands — remove them, not just stop calling them. |

## 7. Error handling

- `draft-copy`: non-owner → 403, no OpenRouter call made. OpenRouter failure → typed
  error surfaced to the button's caller, existing draft in the textarea is left
  untouched (never cleared on failure).
- `send_broadcast_as_owner`: `NOT_AUTHORISED` (42501) for non-owner, matching every other
  owner RPC. Zero recipients is not an error — it returns `recipient_count: 0`, and the
  UI should say so plainly rather than silently no-op.
- `unsubscribe_via_link`: never errors on a bad or already-used id — always renders the
  same confirmation.

## 8. Security & compliance checklist

- [ ] Broadcast audience is exactly `subscribers` confirmed + not unsubscribed — never
      `customers`.
- [ ] Every `owner_broadcast` email renders a working unsubscribe link.
- [ ] `unsubscribe_via_link` is idempotent and reveals nothing about id validity.
- [ ] `draft-copy` rejects non-owner callers before any OpenRouter call.
- [ ] `audit_events` rows for `broadcast.sent` carry no recipient list or body.
- [ ] `unsubscribe` added to both `RESERVED_SLUGS` (TS) and `set_owner_login_slug()`'s
      reserved array (SQL).

## 9. Testing plan

- Unit tests: `draftCopyService`, `broadcastService`, the `templates.ts` new case
  (`templates.test.ts`).
- Live verification (house method, rolled-back transaction first): `send_broadcast_as_owner`
  against real subscriber rows if any exist, or a seeded throwaway row inside the same
  rolled-back transaction if not; `unsubscribe_via_link` idempotency; non-owner denial for
  both new RPCs.
- Manual/Playwright render check: `/dashboard/broadcasts`, `/unsubscribe/<a-real-id>` (in a
  disposable, rolled-back way — don't actually unsubscribe a real person to test this).
- `deno check` on the Edge Function changes (CI's existing gate for `supabase/functions`).

## 10. Migration

One new migration, provisional name `00NN_broadcast_messaging.sql` (renumber to the
actual next free number at implementation time — `0057` was the last one this session).
Contains: `send_broadcast_as_owner()`, `unsubscribe_via_link()`, the `audit_events.action`
check-constraint extension (`+ 'broadcast.sent'`), and the `set_owner_login_slug()`
reserved-word addition. No new table.

## 11. Open items for the implementation plan (not blocking spec approval)

- Exact copy for the `owner_broadcast` footer's compliance line and unsubscribe link
  styling — a wording/design detail, not an architectural one.
- Whether `BroadcastsPage` needs a "test send to myself" step before the real send (the
  original transformation brief's own "Test Email" idea, §11/§42 of `docs/GPT.md`) — worth
  considering given this is the first send mechanism in the app that reaches more than one
  person at once, but deliberately left for the implementation plan to size rather than
  gold-plating the spec.
