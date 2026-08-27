/**
 * Mints a short-lived ImageKit signed upload token for the owner's dashboard
 * "About photo" uploader.
 *
 * Why an Edge Function and not a direct client upload: ImageKit's upload API
 * needs a signature computed with the **private** key, which must never
 * reach the browser. This function holds `IMAGEKIT_PRIVATE_KEY` as a
 * Supabase secret, computes the signature, and hands back only the
 * short-lived `token`/`expire`/`signature` triple plus the public key —
 * the browser then uploads the file bytes straight to ImageKit itself, so
 * this function never sees or proxies the image.
 *
 * `verify_jwt = true` gets the caller past Supabase's gateway with *some*
 * valid session, but that alone doesn't prove staff membership — this
 * function also checks `is_owner()` under the caller's own forwarded
 * Authorization header before minting anything, the same pattern
 * `ai-assistant-chat` uses for its own owner-only reads.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, IMAGEKIT_PRIVATE_KEY, ALLOWED_ORIGIN.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://www.kokolettbeauty.com';
/** Short-lived on purpose — this token is only ever used once, seconds after being minted. */
const TOKEN_TTL_SECONDS = 300;

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

function createRequestClient(authHeader: string) {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
}

async function hmacSha1Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

  const supabase = createRequestClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const { data: isOwner } = await supabase.rpc('is_owner');
  if (!isOwner) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  const privateKey = env('IMAGEKIT_PRIVATE_KEY');
  const publicKey = env('IMAGEKIT_PUBLIC_KEY');
  if (!privateKey || !publicKey) {
    console.error('[owner-photo-upload] ImageKit keys are not configured.');
    return Response.json({ error: 'Photo upload is not configured yet.' }, { status: 503, headers: CORS });
  }

  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const signature = await hmacSha1Hex(privateKey, token + expire);

  return Response.json(
    {
      token,
      expire,
      signature,
      publicKey,
      // Fixed folder + base name; ImageKit's `useUniqueFileName` appends a
      // random suffix so re-uploads never collide with or overwrite a
      // previous version, which would otherwise leave a stale image cached
      // at the same URL.
      folder: '/kokolett/marketing',
      fileName: 'about-christy-portrait',
    },
    { headers: CORS },
  );
});
