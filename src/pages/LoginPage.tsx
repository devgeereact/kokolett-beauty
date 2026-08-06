import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { routes } from '@/lib/routes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';

/**
 * Owner sign-in.
 *
 * Magic link is the intended route — the salon has one administrator and no
 * password worth managing. Password sign-in stays available because magic links
 * depend on email delivery, and an owner locked out on a Saturday morning by an
 * SMTP problem is a worse failure than a password field.
 *
 * Customers never come here. They are not `auth.users` at all; they arrive via
 * a single-use token on `/access/:token`.
 */
type Mode = 'link' | 'password';

export function LoginPage(): JSX.Element {
  const { user, loading } = useSupabaseAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? routes.owner.dashboard} replace />;
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
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
        if (linkError) throw linkError;
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
      setError(
        e instanceof Error
          ? e.message
          : 'Could not sign you in. Please check the address and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-foreground">
          Kokolett Beauty
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to manage your bookings.
        </p>

        {sent ? (
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
              <Field label="Password" required>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
            )}

            {error && (
              <p role="alert" className="mb-4 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={busy}>
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
                : 'Email me a link instead'}
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
