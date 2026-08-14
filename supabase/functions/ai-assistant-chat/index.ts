/**
 * The owner's AI assistant chat (`docs/design/ai.png`).
 *
 * Advisory only, by construction rather than by prompt instruction alone:
 * every tool exposed to the model is a read, never a write. The model can
 * describe what it would do ("I could offer Tuesday 2pm to this request"),
 * but nothing it calls actually books, cancels, or edits anything — the
 * owner still has to go press the real button on the real screen.
 *
 * No service-role key here. The incoming request's own Authorization header
 * is forwarded to a Supabase client, so every read goes through the same
 * `is_owner()` RLS every other owner screen relies on — this function has
 * no more access than the person asking it questions already has.
 *
 * Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_ORIGIN.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://www.kokolettbeauty.com';
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 3;

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

const CORS = {
  'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN', SITE),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are Kokolett Beauty UK's advisory AI assistant, built into the owner's dashboard.

Kokolett Beauty is a single-owner women's hair salon in London (cuts, colouring, styling, treatments — no nails, brows, lashes, or unisex services). The owner's name is Koko. Money is always GBP, written as £, values arrive from tools as integer pence — divide by 100 before showing a customer-facing figure. Dates and times you receive are already in Europe/London. Copy is British English.

You are advisory only. You can read business data through the tools below and you can draft content (social posts, emails, replies) as plain text for the owner to review — but you never claim to have booked, cancelled, sent, or changed anything, because you cannot. If asked to do something that would require a write, explain what you'd do and point at the real screen that does it (e.g. "approve it from the Approvals queue").

Keep responses concise and scannable — short paragraphs, a table or list when the data is tabular, no filler.`;

const TOOLS = [
  {
    name: 'get_top_customers',
    description: "The salon's top customers ranked by completed visits, with total spend and last visit date.",
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many to return, default 5' } },
    },
  },
  {
    name: 'get_revenue_summary',
    description: 'Revenue, appointment count and new-customer count for the trailing N days, compared to the N days before that.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Window size in days, default 28' } },
    },
  },
  {
    name: 'get_todays_schedule',
    description: "Today's appointments in order, with customer name, service, time and status.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pending_queues',
    description: 'How many first-time bookings are awaiting approval and how many availability requests are waiting for an answer.',
    input_schema: { type: 'object', properties: {} },
  },
] as const;

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

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[ai-assistant-chat] ANTHROPIC_API_KEY is not set; refusing every request.');
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

  // Anthropic's message list, grown across tool-use rounds.
  // deno-lint-ignore no-explicit-any
  const anthropicMessages: any[] = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    let finalText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error('[ai-assistant-chat] Anthropic error', response.status, detail);
        return Response.json({ error: 'The assistant is unavailable right now.' }, { status: 502, headers: CORS });
      }

      // deno-lint-ignore no-explicit-any
      const payload: any = await response.json();
      const toolUses = (payload.content ?? []).filter((b: { type: string }) => b.type === 'tool_use');
      const textBlocks = (payload.content ?? []).filter((b: { type: string }) => b.type === 'text');
      finalText = textBlocks.map((b: { text: string }) => b.text).join('\n');

      if (payload.stop_reason !== 'tool_use' || toolUses.length === 0) {
        break;
      }

      anthropicMessages.push({ role: 'assistant', content: payload.content });

      const toolResults = await Promise.all(
        toolUses.map(async (t: { id: string; name: string; input: Record<string, unknown> }) => {
          try {
            const result = await runTool(supabase, t.name, t.input ?? {});
            return { type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(result) };
          } catch (e) {
            return {
              type: 'tool_result',
              tool_use_id: t.id,
              content: `Error: ${e instanceof Error ? e.message : String(e)}`,
              is_error: true,
            };
          }
        }),
      );
      anthropicMessages.push({ role: 'user', content: toolResults });
    }

    return Response.json({ reply: finalText || "I couldn't put together an answer for that — try rephrasing?" }, { headers: CORS });
  } catch (e) {
    console.error('[ai-assistant-chat] unhandled error', e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500, headers: CORS });
  }
});
