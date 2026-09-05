import { useState, type FormEvent, type JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/sentry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';

/**
 * Owner sign-in.
 *
 * Email + password is the default route — it's the faster, more familiar
 * flow and doesn't depend on mail delivery. Magic link stays one tap away as
 * a secondary path for exactly the moment a password is no use: the owner
 * can't remember it. The separate "Forgotten your password?" action beneath
 * the password field is a third, distinct path — it emails a reset link
 * rather than signing her straight in.
 *
 * Customers never come here. They are not `auth.users` at all; they arrive via
 * a single-use token on `/access/:token`.
 */
type Mode = 'link' | 'password';

export function LoginPage(): JSX.Element {
  const { user, loading } = useSupabaseAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? routes.owner.dashboard} replace />;
  }

  /**
   * Ask for a recovery link.
   *
   * Goes through our own Edge Function rather than
   * `supabase.auth.resetPasswordForEmail()`, so the mail leaves the salon's
   * outbox — DKIM-signed, from the address the owner recognises — instead of
   * Supabase's shared sender, which is rate limited and has none of this
   * domain's reputation. Same neutral confirmation either way, so this cannot
   * be used to discover which addresses are staff.
   */
  const requestReset = async (): Promise<void> => {
    const address = email.trim();
    if (!address) {
      setError('Enter your email address first, then ask for a reset link.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${env.supabaseUrl}/functions/v1/owner-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.supabaseAnonKey}`,
          apikey: env.supabaseAnonKey,
        },
        body: JSON.stringify({ email: address }),
      });
      if (!res.ok) {
        reportError(new Error(`owner-password-reset responded ${res.status}`), {
          status: res.status,
        });
      }
    } catch (e) {
      reportError(e, { where: 'LoginPage.requestReset' });
    } finally {
      setBusy(false);
      // Shown whatever happened, for the same reason the magic-link path is.
      setResetSent(true);
    }
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    // The form carries `noValidate` (custom error styling below, not the
    // browser's), so an empty required field would otherwise sail straight
    // into a Supabase call instead of stopping here.
    if (!email.trim()) {
      setError('Enter your email address to continue.');
      return;
    }
    if (mode === 'password' && !password) {
      setError('Enter your password to continue.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (mode === 'link') {
        const { error: linkError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            // Never create an account from this form. The owner is provisioned
            // deliberately; a self-serve signup here would let anyone who knows
            // the URL create an auth user.
            shouldCreateUser: false,
            emailRedirectTo: `${env.appUrl || window.location.origin}${routes.owner.dashboard}`,
          },
        });
        // Deliberately not thrown. With `shouldCreateUser: false`, GoTrue
        // answers an unregistered address with "Signups not allowed for otp",
        // and rendering that verbatim turned this form into an enumeration
        // oracle for exactly the fact the success card is careful not to state.
        // The confirmation below says "*if* that address is registered", so it
        // is shown either way and the failure goes to Sentry instead.
        if (linkError) {
          reportError(linkError, { where: 'LoginPage.signInWithOtp' });
        }
        setSent(true);
      } else {
        const { error: pwError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (pwError) throw pwError;
        // The auth listener in AuthProvider picks this up and the redirect above fires.
      }
    } catch (e) {
      // A fixed message. The password path is the only one that reaches here
      // now, and naming which half was wrong tells an attacker which addresses
      // exist.
      reportError(e, { where: 'LoginPage.submit', mode });
      setError('Could not sign you in. Please check the details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen-app place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-1 font-serif text-2xl font-semibold text-foreground">
          Kokolett Beauty
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to manage your bookings.
        </p>

        {resetSent ? (
          <div role="status" className="rounded-md border border-border bg-muted p-4">
            <p className="font-medium text-foreground">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              If <span className="font-medium">{email}</span> can sign in, a link to set a
              new password is on its way. It works once and expires in an hour.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setResetSent(false);
                setError(null);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : sent ? (
          <div role="status" className="rounded-md border border-border bg-muted p-4">
            <p className="font-medium text-foreground">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              If <span className="font-medium">{email}</span> is registered, a sign-in
              link is on its way. It expires in 30 minutes and works once.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              Use a different address
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate>
            <Field label="Email address" required>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              )}
            </Field>

            {mode === 'password' && (
              <>
                <Field label="Password" required>
                  {({ controlProps }) => (
                    <Input
                      {...controlProps}
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                </Field>

                {/* Forgetting the password is exactly when the dashboard is
                    unreachable, so the way out has to live on this screen
                    rather than behind a Supabase login the owner also cannot
                    reach. */}
                <button
                  type="button"
                  className="mb-4 -mt-2 text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void requestReset()}
                  disabled={busy}
                >
                  Forgotten your password?
                </button>
              </>
            )}

            {error && (
              <p role="alert" className="mb-4 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'link' ? 'Email me a sign-in link' : 'Sign in'}
            </Button>

            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setMode(mode === 'link' ? 'password' : 'link');
                setError(null);
              }}
            >
              {mode === 'link'
                ? 'Sign in with a password instead'
                : "Can't remember your password? Email me a sign-in link instead"}
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
