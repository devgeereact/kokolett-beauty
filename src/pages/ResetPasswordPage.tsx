import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { readAuthLink } from '@/lib/authLink';
import { routes } from '@/lib/routes';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/password';
import { reportError } from '@/lib/sentry';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';

/**
 * Where a password-recovery email lands.
 *
 * Supabase puts the recovery token in the URL fragment. The client library
 * reads it on load and emits a `PASSWORD_RECOVERY` event, which gives a session
 * that can do exactly one useful thing: change this account's password. There
 * is no separate token to hold, and nothing here reads the fragment directly.
 *
 * Three states, and the middle one is the one that is easy to get wrong:
 * waiting for the library to process the fragment. Rendering "this link is not
 * valid" during that window would tell the owner her link is broken a moment
 * before it turns out to be fine.
 */
type Phase = 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Take the credential out of the address bar once it has been exchanged for a
 * session. It is single-use and already spent by this point, but it has no
 * business sitting in history, or in the `Referer` of anything this page loads.
 */
function scrubUrl(): void {
  window.history.replaceState({}, '', window.location.pathname);
}

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // The library may already have processed the fragment before this mounts,
    // so check for a session as well as listening for the event. Relying on the
    // event alone leaves the page stuck on "checking" when it fires first.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setPhase('ready');
    });

    /**
     * Read the credential out of the URL ourselves, in both shapes.
     *
     * This page used to wait for the client library to do it and treated "no
     * session yet" as a dead link — which made every recovery link fail, for a
     * reason no amount of resending could fix. The client is configured
     * `flowType: 'pkce'`, but `owner-password-reset` mints its link with
     * `auth.admin.generateLink`, and an admin-generated link is implicit-flow:
     * GoTrue verifies the token and redirects here with the session in the URL
     * *fragment*. A PKCE client will not touch that fragment — it is looking
     * for a `?code=` it can trade using a verifier this browser never stored,
     * because the flow began on a server. So the token was spent, a session was
     * genuinely issued, and this page said "no longer valid" anyway.
     *
     * `token_hash` is tried first because it is the shape that does not care
     * which flow the client is in, and is what the function now sends.
     */
    const consumeCredentialFromUrl = async (): Promise<void> => {
      const credential = readAuthLink(window.location.search, window.location.hash);

      if (credential?.kind === 'error') {
        if (active) setPhase('invalid');
        return;
      }

      // Only a recovery credential belongs on this page. `readAuthLink` has
      // already narrowed `type` to a known literal, so an invented one never
      // reaches `verifyOtp`.
      if (credential?.kind === 'token_hash' && credential.type === 'recovery') {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: credential.tokenHash,
          type: 'recovery',
        });
        if (!active) return;
        setPhase(otpError ? 'invalid' : 'ready');
        scrubUrl();
        return;
      }

      if (credential?.kind === 'session') {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: credential.accessToken,
          refresh_token: credential.refreshToken,
        });
        if (!active) return;
        setPhase(sessionError ? 'invalid' : 'ready');
        scrubUrl();
        return;
      }

      // Nothing in the URL: either the library already consumed it, or this is
      // a bare visit to /reset-password.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setPhase((current) =>
        current === 'checking' ? (data.session ? 'ready' : 'invalid') : current,
      );
    };

    void consumeCredentialFromUrl();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPhase('done');
    } catch (e) {
      reportError(e, { where: 'ResetPasswordPage.updateUser' });
      setError(
        'Could not set that password. The link may have expired — ask for a new one.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-1 font-serif text-2xl font-semibold text-foreground">
          {phase === 'done' ? 'Password changed' : 'Choose a new password'}
        </h1>

        {phase === 'invalid' && (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              This link is no longer valid. Recovery links work once and expire after an
              hour, so this one has probably already been used.
            </p>
            <Button size="lg" onClick={() => void navigate(routes.auth.login)}>
              Back to sign in
            </Button>
          </>
        )}

        {phase === 'done' && (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              You are signed in on this device. Use the new password next time.
            </p>
            <Button size="lg" onClick={() => void navigate(routes.owner.dashboard)}>
              Go to the dashboard
            </Button>
          </>
        )}

        {phase === 'ready' && (
          <form onSubmit={(e) => void submit(e)} noValidate>
            <p className="mb-6 text-sm text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will remember
              beats a short jumble you will not.
            </p>

            <Field label="New password" required>
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            <Field label="Repeat it" required error={error}>
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              )}
            </Field>

            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
