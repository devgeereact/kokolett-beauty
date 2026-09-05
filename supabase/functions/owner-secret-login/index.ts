/**
 * Resolves a guessed URL path against the owner's real, changeable sign-in
 * slug (`staff.login_slug`, migration 0051).
 *
 * This is deliberately an Edge Function, never a client-callable RPC: the
 * browser must never fetch the real slug to compare it locally, which is
 * exactly the leak this whole feature exists to prevent. The client sends a
 * candidate path here and gets back a neutral `{ ok: boolean }` — nothing
 * else, and the same shape whether the slug was wrong, the caller's IP is
 * locked out, or something failed. `SecretGate.tsx` renders the real sign-in
 * form on `ok: true` and a generic 404 on anything else, including a
 * network failure — fail closed, never fail open.
 *
 * Lockout is keyed by hashed IP, not by the attempted slug: a dictionary
 * attack never repeats the same wrong path twice, so a per-path counter
 * would never reach the threshold. 5 failures / 15 minutes, mirroring the
 * contact form's rate limit (migration 0049) in shape if not in numbers.
 *
 * The IP comes from `clientIp()` in `_shared/auth.ts`, which reads the LAST
 * `X-Forwarded-For` entry rather than the first. This file read `[0]` until
 * 2026-09-05, and the first entry of that header is whatever the caller chose
 * to send: a fresh random value per request meant a fresh bucket per request,
 * and the lockout on the salon owner's sign-in never fired at all.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGIN.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { clientIp } from '../_shared/auth.ts';

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const fail = (): Response => Response.json({ ok: false }, { headers: CORS });

  let slug = '';
  try {
    const body = (await req.json()) as { slug?: string };
    slug = (body.slug ?? '').trim();
  } catch {
    return fail();
  }

  if (!slug) return fail();

  const ipHash = await sha256Hex(clientIp(req));

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // Checked before the slug comparison itself, so a locked-out caller learns
  // nothing new by continuing to guess — the response is identical either
  // way, but this also skips writing another attempt row while locked out.
  const { data: lockedOut } = await supabase.rpc('check_login_lockout', {
    p_ip_hash: ipHash,
  });
  if (lockedOut) return fail();

  const { data: matched } = await supabase.rpc('resolve_owner_slug', { p_slug: slug });
  if (!matched) {
    await supabase.rpc('record_secret_login_attempt', { p_ip_hash: ipHash });
    return fail();
  }

  return Response.json({ ok: true }, { headers: CORS });
});
