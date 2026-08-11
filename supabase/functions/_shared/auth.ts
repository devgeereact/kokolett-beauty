/**
 * Shared shared-secret guard for the cron-driven Edge Functions.
 *
 * `send-emails` and `sync-reviews` are both deployed `--no-verify-jwt`, so this
 * header is the only thing standing between the internet and, respectively, the
 * salon's mail queue and the owner's Google Places billing. Note that turning
 * JWT verification back on would not help: the anon key ships inside the browser
 * bundle and is itself a valid JWT, so anyone can present one.
 *
 * Two rules this module exists to enforce, both of which were got wrong before:
 *
 * 1. **Fail closed.** The previous guard read `if (secret && provided !== secret)`,
 *    which skipped the check entirely when `EMAIL_CRON_SECRET` was unset in the
 *    deployed function's secrets — the exact case where you are least protected.
 *    A missing secret is now a refusal, not a waiver.
 *
 * 2. **Compare in constant time.** Comparing digests rather than the raw strings
 *    means the loop always runs the same number of iterations regardless of where
 *    the first differing byte is. Realistically unexploitable across the public
 *    internet, but it costs nothing.
 */

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
}

/** Constant-time string equality, via fixed-width digests. */
async function secretsMatch(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i += 1) diff |= da[i] ^ db[i];
  return diff === 0;
}

/**
 * Returns a 403 `Response` when the caller is not the cron job, or `null` when
 * the request may proceed. A missing or empty `expectedSecret` always refuses.
 */
export async function requireCronSecret(
  req: Request,
  expectedSecret: string,
  secretName: string,
): Promise<Response | null> {
  if (!expectedSecret) {
    console.error(
      `[auth] ${secretName} is not set; refusing every request. ` +
        'Set it with `supabase secrets set` and redeploy.',
    );
    return new Response('Forbidden', { status: 403 });
  }

  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!(await secretsMatch(provided, expectedSecret))) {
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}
