/**
 * The owner's AI assistant chat (`docs/design/ai.png`).
 *
 * Two kinds of tools, and the model has no way to blur the line between
 * them:
 *   - Read tools (`get_*`) run here, immediately, and their result is fed
 *     straight back into the conversation.
 *   - Action tools (`propose_*`) never run here at all. Calling one ends
 *     the turn: its raw arguments are handed back to the client as a
 *     `proposal`, which `AssistantChatTab` renders as a card the owner must
 *     explicitly confirm. That confirm click is what calls
 *     `createAppointmentAsOwner` / `sendCustomEmailAsOwner` — from the
 *     browser, under her own session — never from in here. So even with
 *     write capability, this function itself still only ever reads; it
 *     just also gets to *suggest* a write for a human to actually make.
 *
 * No service-role key here. The incoming request's own Authorization header
 * is forwarded to a Supabase client, so every read goes through the same
 * `is_owner()` RLS every other owner screen relies on — this function has
 * no more access than the person asking it questions already has.
 *
 * Secrets: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_ORIGIN.
 *
 * Model calls go through OpenRouter (OpenAI-compatible Chat Completions),
 * not Anthropic directly — chosen for its per-token cost, not for any
 * Claude-specific behaviour, so the request/response shapes below are
 * OpenAI's (system prompt as the first message, `tools[].function`,
 * `choices[0].message.tool_calls`), not Anthropic's Messages API shapes.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://www.kokolettbeauty.com';
const OPENROUTER_MODEL = 'openai/gpt-5-nano';
const MAX_TOOL_ROUNDS = 3;

// Local dev only — `ALLOWED_ORIGIN` is a single production value
// (docs/DEPLOYMENT.md), so without this the browser's own preflight check
// blocks every request from `npm run dev` before it reaches this function.
const DEV_ORIGINS = ['http://localhost:5082', 'http://127.0.0.1:5082'];

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const configured = env('ALLOWED_ORIGIN', SITE);
  const origin =
    requestOrigin && DEV_ORIGINS.includes(requestOrigin) ? requestOrigin : configured;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are Kokolett Beauty UK's advisory AI assistant, built into the owner's dashboard.

Kokolett Beauty is a single-owner women's hair salon in London (braids, locs, weaves, natural hair, colour and treatments — no nails, brows, lashes, or unisex services). The owner's name is Koko. Contact email is booking@kokolettbeauty.com. Money is always GBP, written as £, values arrive from tools as integer pence — divide by 100 before showing a customer-facing figure. Dates and times you receive are already in Europe/London. Copy is British English.

You can read business data through the get_* tools, and you can propose two real actions: booking an appointment (propose_booking) and sending a one-off email to a customer (propose_email). Calling either shows the owner a card with exactly what you've filled in — she has to press Confirm herself before anything actually happens. Nothing you do executes on its own, so never say "booked" or "sent" — say "I've set that up for you to confirm" and let the card speak for the rest. For anything else that would require a write (cancelling, rescheduling, approving a request), you still don't have a tool for it — explain what you'd do and point at the real screen (e.g. "approve it from the Approvals queue").

WRITE ACTIONS — only propose one when the owner has actually asked for it or clearly agreed to it in this conversation; don't book or draft an email on a hunch. Never invent a customer's name, email, or phone number — if you don't have all of them, ask before calling propose_booking or propose_email. For a booking, only use a time the owner has actually stated or clearly confirmed is free (check get_todays_schedule for same-day bookings) — the real overlap check still runs when she confirms, so a bad guess fails safely, but a good guess saves her a correction. Call at most one propose_* per reply, and don't call a get_* tool in the same turn as a propose_* — gather what you need first, propose second.

CONTENT GROUNDING — before drafting any social post, caption, email, or business description, call get_business_profile and write from its real service names, address, opening hours and Instagram handle. Never fall back to generic filler ("a wide range of services", "a vibrant salon") when a real detail is one tool call away — if the owner's request doesn't give you enough to be specific (which service, which client detail, any offer), ask one short question instead of guessing.

WRITING STYLE — for every reply, but hold drafted content to this strictly:
- Write like a person talking to a client, not a marketing template. No em dashes. No "vibrant / stunning / must-visit / nestled in the heart of" style promotional language. No "not just X, it's Y" constructions. No padding things into groups of three just to sound thorough.
- Warm and calm, like a considerate hairdresser, not a hype account.
- Keep responses concise and scannable — short paragraphs, a table or list when the data is tabular, no filler, no "Let me know if you'd like me to expand on that" sign-offs.

SOCIAL MEDIA POSTS — give exactly one ready-to-post version by default, formatted so it can be copied straight into Instagram: the caption, then a blank line, then hashtags on their own line, nothing else inside that block. Don't present multiple lettered/numbered options or mix tailoring tips into the caption itself. If it's worth offering a variant or asking what to tailor it to, say that in one short line after the copy-paste block, clearly separate from it.`;

// OpenAI function-calling shape: {type: "function", function: {name, description, parameters}} —
// Anthropic's flatter {name, description, input_schema} doesn't apply here.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_top_customers',
      description: "The salon's top customers ranked by completed visits, with total spend and last visit date.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many to return, default 5' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_summary',
      description: 'Revenue, appointment count and new-customer count for the trailing N days, compared to the N days before that.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Window size in days, default 28' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_todays_schedule',
      description: "Today's appointments in order, with customer name, service, time and status.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_queues',
      description: 'How many first-time bookings are awaiting approval and how many availability requests are waiting for an answer.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_profile',
      description: "The salon's real identity — business name, address, phone, Instagram handle, opening hours, and the current style menu (grouped by category, e.g. Braids, Twists and locs, Colour). Call this before drafting any social media post, caption, email, or business description so it's grounded in what the salon actually offers, not generic placeholders.",
      parameters: { type: 'object', properties: {} },
    },
  },
  // Action tools — never executed here. Calling one ends the turn and hands
  // its arguments to the client as a proposal; see the file-level comment.
  {
    type: 'function',
    function: {
      name: 'propose_booking',
      description: 'Propose booking an appointment for a customer. Shows the owner a card with these exact details to confirm — does not book anything itself. Requires a real name, email and a specific start time; never guess or invent any of them.',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: "The customer's full name" },
          email: { type: 'string', description: "The customer's email address" },
          mobile: { type: 'string', description: "The customer's mobile number, if given" },
          starts_at: { type: 'string', description: 'ISO 8601 UTC timestamp for the appointment start' },
          duration_min: { type: 'number', description: 'Length in minutes, if different from the salon default' },
          note: { type: 'string', description: 'A short note for the owner about this booking' },
        },
        required: ['full_name', 'email', 'starts_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_email',
      description: "Propose a one-off email to an existing customer. Shows the owner a card with the exact subject and body to review and send — does not send anything itself. Requires the customer's real email address.",
      parameters: {
        type: 'object',
        properties: {
          customer_email: { type: 'string', description: "The customer's email address" },
          customer_name: { type: 'string', description: "The customer's name, for the greeting" },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body, in your own words — plain text, no signature needed' },
        },
        required: ['customer_email', 'customer_name', 'subject', 'body'],
      },
    },
  },
] as const;

const ACTION_TOOL_NAMES = new Set(['propose_booking', 'propose_email']);

async function runTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (name === 'get_top_customers') {
    const limit = typeof input.limit === 'number' ? input.limit : 5;
    const { data, error } = await supabase
      .from('appointments_detailed')
      .select('customer_id, customer_name, price_pence, starts_at, status')
      .eq('status', 'completed')
      .order('starts_at', { ascending: false })
      .limit(2000);
    if (error) throw error;
    const byCustomer = new Map<string, { name: string; spend: number; visits: number; last: string }>();
    for (const row of data ?? []) {
      const r = row as { customer_id: string; customer_name: string; price_pence: number; starts_at: string };
      const bucket = byCustomer.get(r.customer_id) ?? { name: r.customer_name, spend: 0, visits: 0, last: r.starts_at };
      bucket.spend += r.price_pence;
      bucket.visits += 1;
      if (r.starts_at > bucket.last) bucket.last = r.starts_at;
      byCustomer.set(r.customer_id, bucket);
    }
    return [...byCustomer.values()]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, limit)
      .map((c) => ({ name: c.name, total_spend_pence: c.spend, visits: c.visits, last_visit: c.last }));
  }

  if (name === 'get_revenue_summary') {
    const days = typeof input.days === 'number' ? input.days : 28;
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    const prevFrom = new Date(now.getTime() - days * 2 * 86_400_000);
    const { data, error } = await supabase
      .from('appointments_detailed')
      .select('price_pence, starts_at, status, customer_id')
      .gte('starts_at', prevFrom.toISOString())
      .lt('starts_at', now.toISOString());
    if (error) throw error;
    const rows = (data ?? []) as { price_pence: number; starts_at: string; status: string }[];
    const current = rows.filter((r) => r.starts_at >= from.toISOString());
    const previous = rows.filter((r) => r.starts_at < from.toISOString());
    const sum = (rs: typeof rows): number => rs.filter((r) => r.status === 'completed').reduce((s, r) => s + r.price_pence, 0);
    return {
      window_days: days,
      current_revenue_pence: sum(current),
      previous_revenue_pence: sum(previous),
      current_appointments: current.filter((r) => r.status !== 'rescheduled' && r.status !== 'rejected').length,
      previous_appointments: previous.filter((r) => r.status !== 'rescheduled' && r.status !== 'rejected').length,
    };
  }

  if (name === 'get_todays_schedule') {
    const { data: summary, error: summaryError } = await supabase.rpc('owner_dashboard_summary');
    if (summaryError) throw summaryError;
    const today = (summary as { today: string }).today;
    const { data, error } = await supabase
      .from('appointments_detailed')
      .select('customer_name, service_name, starts_at, status')
      .gte('starts_at', `${today}T00:00:00Z`)
      .lt('starts_at', `${today}T23:59:59Z`)
      .in('status', ['pending_approval', 'confirmed', 'checked_in', 'in_service', 'completed'])
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  if (name === 'get_pending_queues') {
    const { data, error } = await supabase.rpc('owner_dashboard_summary');
    if (error) throw error;
    const summary = data as { pending_approval_count?: number; new_request_count?: number } | null;
    return {
      pending_approvals: summary?.pending_approval_count ?? 0,
      pending_requests: summary?.new_request_count ?? 0,
    };
  }

  if (name === 'get_business_profile') {
    const { data: settings, error: settingsError } = await supabase
      .from('booking_settings')
      .select('business_name, address_line, phone, instagram_url')
      .eq('id', true)
      .maybeSingle();
    if (settingsError) throw settingsError;

    // Post-0011, availability is "a day is a list of start times", not an
    // open/close range — `weekly_template` is the current generator (see
    // OpeningHoursSummaryCard, which derives the same first-to-last-start
    // approximation from this exact query). There is no `availability_rules`
    // table any more; it was dropped in that migration.
    const { data: template, error: templateError } = await supabase
      .from('weekly_template')
      .select('day_of_week, starts_at')
      .order('day_of_week', { ascending: true })
      .order('starts_at', { ascending: true });
    if (templateError) throw templateError;

    // The bookable `services` row is a single generic "Hair Appointment"
    // (also an 0011 change — every appointment is the same length, and the
    // actual style is agreed in the chair). The real "what we do" catalogue
    // — the one the public site's own "What we do" section reads — is
    // `service_menu` via this RPC: grouped, ordered, active styles only.
    const { data: menu, error: menuError } = await supabase.rpc('public_service_menu');
    if (menuError) throw menuError;

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const settingsRow = settings as {
      business_name: string | null;
      address_line: string | null;
      phone: string | null;
      instagram_url: string | null;
    } | null;

    const byDay = new Map<number, string[]>();
    for (const row of (template ?? []) as { day_of_week: number; starts_at: string }[]) {
      const list = byDay.get(row.day_of_week) ?? [];
      list.push(row.starts_at.slice(0, 5));
      byDay.set(row.day_of_week, list);
    }
    const opening_hours = [...Array(7).keys()].map((day_of_week) => {
      const times = byDay.get(day_of_week) ?? [];
      return {
        day: DAY_NAMES[day_of_week],
        is_open: times.length > 0,
        first_appointment: times[0] ?? null,
        last_appointment: times.at(-1) ?? null,
      };
    });

    return {
      business_name: settingsRow?.business_name ?? 'Kokolett Beauty UK',
      address: settingsRow?.address_line ?? null,
      phone: settingsRow?.phone ?? null,
      instagram: settingsRow?.instagram_url ?? null,
      contact_email: 'booking@kokolettbeauty.com',
      opening_hours,
      style_menu: (menu ?? []) as { group_name: string; items: { name: string; note: string | null }[] }[],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('[ai-assistant-chat] OPENROUTER_API_KEY is not set; refusing every request.');
    return Response.json({ error: 'Assistant is not configured yet.' }, { status: 503, headers: CORS });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: 'messages is required' }, { status: 400, headers: CORS });
  }

  // OpenAI-style message list — system prompt as the first message, grown
  // across tool-call rounds with assistant/tool turns (not Anthropic's
  // separate `system` field + `tool_result` content blocks).
  // deno-lint-ignore no-explicit-any
  const openaiMessages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    let finalText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          // OpenRouter attribution headers (optional, shown on their
          // dashboard) — harmless to omit but cheap to include.
          'http-referer': SITE,
          'x-title': 'Kokolett Beauty AI assistant',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          // gpt-5-nano has *mandatory* reasoning (OpenRouter's model card:
          // reasoning.mandatory=true, default_effort="medium") — those
          // tokens come out of max_tokens before any visible reply, so a
          // low budget can be spent entirely on reasoning and return empty
          // content. "low" effort + more headroom fixes that; this is a
          // quick-turnaround chat assistant, not a deep-reasoning task.
          reasoning_effort: 'low',
          max_tokens: 2048,
          tools: TOOLS,
          messages: openaiMessages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error('[ai-assistant-chat] OpenRouter error', response.status, detail);
        return Response.json({ error: 'The assistant is unavailable right now.' }, { status: 502, headers: CORS });
      }

      // deno-lint-ignore no-explicit-any
      const payload: any = await response.json();
      const message = payload.choices?.[0]?.message ?? {};
      const toolCalls: { id: string; function: { name: string; arguments: string } }[] =
        message.tool_calls ?? [];
      finalText = message.content ?? '';

      if (payload.choices?.[0]?.finish_reason !== 'tool_calls' || toolCalls.length === 0) {
        break;
      }

      // An action tool ends the turn immediately — its arguments become the
      // proposal, nothing runs, and any other tool calls this round (there
      // shouldn't be any, per the system prompt) are simply dropped.
      const actionCall = toolCalls.find((t) => ACTION_TOOL_NAMES.has(t.function.name));
      if (actionCall) {
        let args: Record<string, unknown> = {};
        try {
          args = actionCall.function.arguments ? JSON.parse(actionCall.function.arguments) : {};
        } catch {
          return Response.json(
            { error: "I couldn't put that proposal together — try asking again." },
            { status: 502, headers: CORS },
          );
        }
        const proposal =
          actionCall.function.name === 'propose_booking'
            ? { type: 'booking', ...args }
            : { type: 'email', ...args };
        return Response.json(
          {
            reply: finalText || "Here's what I've got ready for you to confirm:",
            proposal,
          },
          { headers: CORS },
        );
      }

      openaiMessages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls });

      const toolResults = await Promise.all(
        toolCalls.map(async (t) => {
          try {
            const args = t.function.arguments ? JSON.parse(t.function.arguments) : {};
            const result = await runTool(supabase, t.function.name, args);
            return { role: 'tool' as const, tool_call_id: t.id, content: JSON.stringify(result) };
          } catch (e) {
            return {
              role: 'tool' as const,
              tool_call_id: t.id,
              content: `Error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
            };
          }
        }),
      );
      openaiMessages.push(...toolResults);
    }

    return Response.json({ reply: finalText || "I couldn't put together an answer for that — try rephrasing?" }, { headers: CORS });
  } catch (e) {
    console.error('[ai-assistant-chat] unhandled error', e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500, headers: CORS });
  }
});
