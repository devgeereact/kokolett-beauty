/**
 * Renders a real `email_messages` row for the Communications › Email detail
 * pane, using the exact same `render()` as `send-emails` (including any
 * active, automation-enabled `email_templates` override), so the preview
 * the owner sees is what actually went out — not a re-implementation that
 * can drift from it.
 *
 * No service-role key: the incoming request's own Authorization header is
 * forwarded, so both the `email_messages` row and any `email_templates`
 * override are read under the caller's own `is_owner()` RLS. There is
 * nothing here a browser session couldn't already read directly.
 *
 * `manage_url` / `reset_url` are scrubbed from the payload once a message
 * sends (`send-emails`), so a sent row from before that changed, or one
 * whose payload never carried anything else, renders with `available: false`
 * rather than a template with blank fields pretending to be the real thing.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { render, type TemplateOverride, type TemplatePayload } from '../_shared/templates.ts';

const SITE = 'https://www.kokolettbeauty.com';
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

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
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

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const id = body.id;
  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
  }

  const { data: message, error: messageError } = await supabase
    .from('email_messages')
    .select('template, subject, payload')
    .eq('id', id)
    .maybeSingle();

  if (messageError) {
    return Response.json({ error: messageError.message }, { status: 500, headers: CORS });
  }
  if (!message) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const payload = (message.payload ?? {}) as TemplatePayload;
  if (Object.keys(payload).length === 0) {
    return Response.json(
      {
        available: false,
        reason:
          'This message was sent before the outbox started keeping its contents, so there is nothing left to render. Anything sent from now on will show here.',
      },
      { headers: CORS },
    );
  }

  let override: TemplateOverride | undefined;
  const { data: templateRow } = await supabase
    .from('email_templates')
    .select('subject, html_body, active, include_in_automation')
    .eq('key', message.template)
    .maybeSingle();
  if (templateRow?.active && templateRow.include_in_automation) {
    override = { subject: templateRow.subject, html_body: templateRow.html_body };
  }

  const rendered = render(message.template, payload, override);

  return Response.json(
    {
      available: true,
      subject: rendered.subject ?? message.subject,
      html: rendered.html,
      text: rendered.text,
    },
    { headers: CORS },
  );
});
