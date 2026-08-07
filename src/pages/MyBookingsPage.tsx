import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useCustomerSession } from '@/hooks/useCustomerSession';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';
import { formatDateLong, formatMoney, formatTime } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * The customer's own bookings, reached by magic link.
 *
 * Two entry points share this page: `/access/:token` redeems a link, and `/my`
 * uses whatever session is already stored. Anyone with neither is offered a
 * fresh link.
 */
export function MyBookingsPage(): JSX.Element {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { settings, timezone } = useBusinessSettings();
  const {
    customer,
    appointments,
    loading,
    error,
    exchangeToken,
    requestLink,
    cancel,
    refresh,
    signOut,
  } = useCustomerSession();

  const [redeeming, setRedeeming] = useState(Boolean(token));
  const [redeemFailed, setRedeemFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void exchangeToken(token).then((ok) => {
      if (!active) return;
      setRedeeming(false);
      setRedeemFailed(!ok);
      // Get the token out of the address bar either way: a single-use link in
      // browser history is a link someone else can find, and a used one only
      // produces a confusing error on refresh.
      if (ok) navigate(routes.customer.home, { replace: true });
    });
    return () => {
      active = false;
    };
  }, [token, exchangeToken, navigate]);

  const hasSession = appointments.length > 0 || customer !== null;

  if (redeeming) {
    return (
      <SiteShell>
        <LoadingState label="Signing you in…" />
      </SiteShell>
    );
  }

  /* ---- No session: offer a link ------------------------------------- */
  if (!hasSession && !loading) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <Card className="p-6">
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Your bookings
            </h1>

            {redeemFailed && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-border bg-muted p-3 text-sm"
              >
                That link has already been used or has expired. Links work once and last
                30 minutes — here is how to get another.
              </p>
            )}

            {linkSent ? (
              <div
                role="status"
                className="mt-4 rounded-md border border-border bg-muted p-4"
              >
                <p className="font-medium text-foreground">Check your email</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If <span className="font-medium">{email}</span> has booked with us, a
                  link is on its way. It works once and expires in 30 minutes.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">
                  No password needed. Tell us the email you booked with and we will send a
                  secure link.
                </p>
                <Field label="Email address" required>
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                </Field>
                <Button
                  className="w-full"
                  onClick={() => {
                    void requestLink(email).then(() => setLinkSent(true));
                  }}
                >
                  Email me a link
                </Button>
              </>
            )}

            <p className="mt-6 text-center text-sm">
              <Link
                to={routes.public.book}
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Book a new appointment
              </Link>
            </p>
          </Card>
        </div>
      </SiteShell>
    );
  }

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) =>
      new Date(a.starts_at).getTime() >= now &&
      ['pending_approval', 'confirmed', 'checked_in', 'in_service'].includes(a.status),
  );
  const past = appointments.filter((a) => !upcoming.includes(a));

  const doCancel = async (id: string): Promise<void> => {
    if (!window.confirm('Cancel this appointment?')) return;
    setCancelling(id);
    try {
      await cancel(id);
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Your bookings
            </h1>
            {customer && (
              <p className="mt-1 text-muted-foreground">{customer.full_name}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>

        {loading && <LoadingState />}
        {error && !loading && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {errorMessage(error)}
          </p>
        )}

        {!loading && appointments.length === 0 && (
          <EmptyState
            title="Nothing booked yet"
            description="When you book, it will show up here."
            action={
              <Link
                to={routes.public.book}
                className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
              >
                Book an appointment
              </Link>
            }
          />
        )}

        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
              Coming up
            </h2>
            <div className="space-y-3">
              {upcoming.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{a.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateLong(a.starts_at, timezone)} at{' '}
                        {formatTime(a.starts_at, timezone)}
                      </p>
                    </div>
                    <StatusChip status={a.status} />
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatMoney(a.price_pence)} ·{' '}
                    <span className="font-mono">{a.reference}</span>
                  </p>

                  {a.status === 'pending_approval' && (
                    <p className="mt-2 rounded-md bg-muted p-2 text-sm text-muted-foreground">
                      Your slot is held while the salon confirms.
                    </p>
                  )}

                  {['pending_approval', 'confirmed'].includes(a.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      loading={cancelling === a.id}
                      onClick={() => void doCancel(a.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </Card>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Please give at least {settings?.cancellation_window_h ?? 24} hours&rsquo;
              notice where you can. Later cancellations are still accepted, but the salon
              is told.
            </p>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
              Previously
            </h2>
            <div className="space-y-2">
              {past.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
                >
                  <span className="text-foreground">
                    {formatDateLong(a.starts_at, timezone)} · {a.service_name}
                  </span>
                  <StatusChip status={a.status} />
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center">
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </p>
      </div>
    </SiteShell>
  );
}
