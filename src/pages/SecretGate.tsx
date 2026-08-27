import { type JSX, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { invokeFunction } from '@/lib/supabase';
import { RESERVED_SLUGS } from '@/lib/routes';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Mounted at `/:maybeSecretSlug` — every single-segment path that isn't a
 * real route falls through to here. Resolves the segment against the
 * owner's real, changeable sign-in slug (`owner-secret-login` Edge
 * Function, migration 0051) and renders the real sign-in form only on a
 * match. Anything else — wrong slug, locked out, network failure — renders
 * the same generic 404 a stranger gets anywhere else on the site: no
 * distinguishable state, no hint a login system exists at all.
 *
 * Fails closed: a network error must never render the sign-in form.
 */
export function SecretGate(): JSX.Element {
  const { maybeSecretSlug } = useParams<{ maybeSecretSlug: string }>();
  const [state, setState] = useState<'checking' | 'match' | 'no-match'>('checking');

  useEffect(() => {
    let active = true;

    // Reserved words (real routes, obvious guesses) can never be the real
    // slug — skip the round trip and go straight to the 404 they'd get
    // anyway, rather than spending a request confirming the obvious.
    if (
      !maybeSecretSlug ||
      (RESERVED_SLUGS as readonly string[]).includes(maybeSecretSlug)
    ) {
      setState('no-match');
      return;
    }

    void (async () => {
      try {
        const result = await invokeFunction<{ ok: boolean }>('owner-secret-login', {
          slug: maybeSecretSlug,
        });
        if (active) setState(result.ok ? 'match' : 'no-match');
      } catch {
        // Fail closed: a function/network error is not a login.
        if (active) setState('no-match');
      }
    })();

    return () => {
      active = false;
    };
  }, [maybeSecretSlug]);

  if (state === 'match') return <LoginPage />;
  if (state === 'no-match') return <NotFoundPage />;

  // While checking: a blank, background-matched screen — no spinner, no
  // text, and deliberately not the 404 either. A visible "checking…"
  // affordance would signal something is happening here that isn't
  // happening on a truly dead path; briefly showing the 404 itself would
  // flash the wrong content at the owner on every legitimate sign-in.
  return <div className="min-h-screen bg-background" />;
}
