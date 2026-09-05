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
const SITE = 'https://www.kokolettbeauty.com';

// Local dev only, and the same fixed loopback list every other function in
// this directory carries. This one was the last holdout: it fell back to `*`
// when `ALLOWED_ORIGIN` was unset (a wildcard nobody chose) and had no dev
// origins at all, so "Polish with AI" was the one owner action that could not
// be exercised against a dev server — the identical bug that was found and
// fixed in `email-diagnostics`. The list cannot widen to an attacker origin.
const DEV_ORIGINS = ['http://localhost:5082', 'http://127.0.0.1:5082'];

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const configured = Deno.env.get('ALLOWED_ORIGIN') ?? SITE;
  const origin =
    requestOrigin && DEV_ORIGINS.includes(requestOrigin) ? requestOrigin : configured;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    'You draft a newsletter/ad email for Kokolett Beauty UK, a women\'s hair salon in ' +
    'Thamesmead, South East London (braids, twists, weaves, natural hair, colour, no locs; ' +
    'women\'s hair only, never nails/brows/lashes or unisex/barbering services). ' +
    'British English. Never mention or invent a price; pricing is agreed in the chair. ' +
    'Use no em dashes and no en dashes: this prompt contains none either, because a ' +
    'model copies what it is shown before it follows what it is told. ' +
    'Write a genuinely detailed, well-crafted message that reads as if the owner wrote ' +
    'it herself: specific and warm rather than generic marketing copy, with a real ' +
    'opening, a developed middle explaining what\'s on offer or new and why it matters ' +
    'to the reader, and a natural closing invitation to book or get in touch. Aim for ' +
    '3-5 well-formed paragraphs, not a single terse blurb, but every sentence should ' +
    'earn its place; don\'t pad for length. Respond with exactly two lines: the first ' +
    'starting "SUBJECT: " with a specific, inviting subject line (never generic like ' +
    '"Newsletter" or "Update"), the second starting "BODY: " (body may contain \\n for ' +
    'paragraph breaks).',
  compose:
    'You draft a one-off email from the owner of Kokolett Beauty UK (a women\'s hair ' +
    'salon) to a named customer. British English. Never mention or invent a price, and ' +
    'use no em or en dashes. ' +
    'Write a genuinely detailed, well-crafted, personal message. Address the customer ' +
    'by name naturally, and if a rough idea or their own message is given, respond to ' +
    'it specifically rather than generically. Write with warmth and enough substance to ' +
    'feel like a real, considered message rather than a one-liner, while staying ' +
    'focused, and do not pad for length. Respond with exactly two lines: "SUBJECT: " with ' +
    'a specific, relevant subject line, then "BODY: " (body may contain \\n).',
  reply:
    'You draft a short reply from the owner of Kokolett Beauty UK to a customer\'s ' +
    'message. British English. Never mention or invent a price, and use no em or en ' +
    'dashes. Respond with exactly ' +
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
  // The prompt asks the model for paragraph breaks as a literal `\n` inside
  // its one-line "BODY: " response (the whole reply is parsed line-by-line,
  // so a real newline there would break the regex above). Modern instruction
  // models comply literally — the completion contains the two characters
  // backslash+n, not an actual line break — so it has to be unescaped here,
  // once, before this reaches any consumer (the compose/broadcast/reply
  // textareas, and the `owner_broadcast`/`owner_custom_message` templates,
  // which split on a real newline to lay out paragraphs).
  const body = (bodyMatch?.[1] ?? text).trim().replace(/\\n/g, '\n');
  const subject = subjectMatch?.[1]?.trim();
  return subject ? { subject, body } : { body };
}

/** The three prompts this function knows. Anything else is a bad request. */
function isKind(value: unknown): value is Kind {
  return value === 'broadcast' || value === 'compose' || value === 'reply';
}

/**
 * Longest rough idea worth paying an LLM to read. Generous for the real case
 * (a few sentences the owner types), and a ceiling on what a compromised or
 * mistaken client can spend per call.
 */
const MAX_INPUT_CHARS = 4000;

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createRequestClient(authHeader);
    const { data: isOwner, error: ownerError } = await supabase.rpc('is_owner');
    if (ownerError || !isOwner) {
      return new Response(JSON.stringify({ error: 'NOT_AUTHORISED' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as DraftRequest;
    if (!body.roughIdea || !body.roughIdea.trim()) {
      return new Response(JSON.stringify({ error: 'roughIdea is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    /* An unrecognised `kind` used to index `SYSTEM_PROMPTS` to `undefined`,
       which OpenRouter rejects — the owner saw a 502 "unavailable right now"
       for what is a bad request. */
    if (!isKind(body.kind)) {
      return new Response(JSON.stringify({ error: 'Unknown draft kind' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (
      body.roughIdea.length > MAX_INPUT_CHARS ||
      (body.originalMessage?.length ?? 0) > MAX_INPUT_CHARS
    ) {
      return new Response(JSON.stringify({ error: 'That is too long to draft from.' }), {
        status: 413,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env('OPENROUTER_API_KEY');
    /* Every outbound call in this function tree was a bare `fetch` until
       2026-09-05. A model provider that is degraded rather than down leaves
       the owner staring at a spinner until the platform kills the isolate,
       with no error and nothing logged. 20s is generous for a single
       completion and finite, which is the point; the 502 branch below already
       handles the AbortError this raises. */
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: AbortSignal.timeout(20_000),
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
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const completion = await response.json();
    const text: string = completion.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'The drafting service returned nothing.' }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parseCompletion(text)), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[draft-copy] unhandled error', e);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
