import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setPhase((current) =>
        current === 'checking' ? (data.session ? 'ready' : 'invalid') : current,
      );
    });

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
