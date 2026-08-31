/**
 * KOKO_GAP.md P3: "Email diagnostics (SPF/DKIM/DMARC/SMTP status screen)...
 * owner can't self-diagnose a delivery problem from the dashboard." The
 * actual DNS records are healthy (per ~/.claude/CLAUDE.md's ops notes) —
 * this just surfaces them in-app, live, rather than requiring `dig` on a
 * terminal only the developer has.
 *
 * No credentials of any kind: SPF/DMARC/DKIM are public DNS TXT records,
 * read via Cloudflare's DNS-over-HTTPS resolver (a public, unauthenticated
 * endpoint). This deliberately does not touch the cPanel API — that would
 * need a new stored credential for a screen that only ever reads three
 * public records, which is a real infrastructure decision, not a gap-fill.
 *
 * Owner-only. Same pattern as draft-copy: explicit is_owner() RPC check
 * before doing anything, since this makes no other database query for RLS
 * to gate.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const DOMAIN = 'kokolettbeauty.com';
const DKIM_SELECTOR = 'default';
const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const SITE = 'https://www.kokolettbeauty.com';
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

interface DohAnswer {
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

/** Every TXT record for `name`, quotes stripped. `[]` on any failure — never throws. */
async function lookupTxt(name: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as DohResponse;
    if (body.Status !== 0 || !body.Answer) return [];
    return body.Answer.map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, ''));
  } catch {
    return [];
  }
}

interface SpfResult {
  present: boolean;
  record: string | null;
}

interface DmarcResult {
  present: boolean;
  policy: string | null;
  record: string | null;
}

interface DkimResult {
  present: boolean;
  selector: string;
}

async function checkSpf(): Promise<SpfResult> {
  const records = await lookupTxt(DOMAIN);
  const record = records.find((r) => r.startsWith('v=spf1')) ?? null;
  return { present: record !== null, record };
}

async function checkDmarc(): Promise<DmarcResult> {
  const records = await lookupTxt(`_dmarc.${DOMAIN}`);
  const record = records.find((r) => r.startsWith('v=DMARC1')) ?? null;
  const policyMatch = record?.match(/(?:^|;)\s*p=([a-z]+)/);
  return { present: record !== null, policy: policyMatch?.[1] ?? null, record };
}

async function checkDkim(): Promise<DkimResult> {
  const records = await lookupTxt(`${DKIM_SELECTOR}._domainkey.${DOMAIN}`);
  const present = records.some((r) => r.startsWith('v=DKIM1'));
  return { present, selector: DKIM_SELECTOR };
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

  const { data: isOwner, error: ownerError } = await supabase.rpc('is_owner');
  if (ownerError || !isOwner) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const [spf, dmarc, dkim] = await Promise.all([checkSpf(), checkDmarc(), checkDkim()]);

  return Response.json({ domain: DOMAIN, checkedAt: new Date().toISOString(), spf, dmarc, dkim }, {
    headers: CORS,
  });
});
