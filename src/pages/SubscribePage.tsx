import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { subscribeToUpdates } from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';

/**
 * The mailing list.
 *
 * A separate page rather than a footer box, because this link is meant to be
 * pasted somewhere: an Instagram bio, a story, the back of a card. It has to
 * stand on its own when somebody arrives on it cold.
 *
 * The RPC behind this never reports whether an address was already on the list.
 * Saying "you are already subscribed" to an anonymous caller turns the form
 * into a way of testing whether any given address is a customer here.
 */
export function SubscribePage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (): Promise<void> => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Please give a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await subscribeToUpdates(email, fullName);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        {done ? (
          <Card className="p-6 text-center">
            <h1 className="font-display text-2xl font-semibold text-foreground">
              You are on the list
            </h1>
            <p className="mt-2 text-muted-foreground">
              We will email you when there is something worth knowing about. Not often,
              and never to anyone else.
            </p>
            <Link
              to={routes.public.book}
              className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground"
            >
              Book an appointment
            </Link>
          </Card>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Keep in touch
            </h1>
            <p className="mb-8 mt-2 text-muted-foreground">
              New times opening up, the odd offer, and the occasional bit of aftercare
              advice. A few emails a year, not a few a week.
            </p>

            <Card className="p-6">
              <Field label="Your name" hint="Optional, but it makes the emails less odd.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                )}
              </Field>

              <Field label="Email" required>
                {({ controlProps }) => (
                  <Input
                    {...controlProps}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>

              {error && (
                <p role="alert" className="mb-4 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}

              <Button
                size="lg"
                className="w-full"
                loading={busy}
                onClick={() => void submit()}
              >
                Sign me up
              </Button>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                We keep your name and email and nothing else. Unsubscribe by replying to
                any message. See our{' '}
                <Link
                  to={routes.public.privacy}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  privacy notice
                </Link>
                .
              </p>
            </Card>
          </>
        )}
      </div>
    </SiteShell>
  );
}
