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
