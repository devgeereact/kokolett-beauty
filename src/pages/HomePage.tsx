import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/hooks/useServices';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatDateLong, formatDuration, formatMoney } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * The salon's front page.
 *
 * It leads with the next few open times rather than a menu of services. There
 * is one appointment type, so the only question a customer has is "when can I
 * come in?" — and answering it on the front page removes a whole click.
 */
export function HomePage(): JSX.Element {
  const { services } = useServices();
  const { timezone } = useBusinessSettings();
  const appointment = services[0];
  const { slotsByDate, openDates, loading } = useAvailability(
    appointment?.duration_min ?? 60,
  );

  const nextDays = openDates.slice(0, 3);

  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="mb-4 inline-block rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
          Women&rsquo;s hair salon
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-6xl">
          Hair that feels like <span className="text-primary">you</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Cutting, colouring, styling and treatments. Pick a time that suits you and tell
          us what you are after — no account, no password.
        </p>
        <Link
          to={routes.public.book}
          className="mt-8 inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Book an appointment
        </Link>
      </section>

      {!loading && nextDays.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <h2 className="mb-6 text-center font-display text-2xl font-semibold text-foreground">
              Next available
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {nextDays.map((date) => (
                <Card key={date} className="p-4 text-center">
                  <p className="font-medium text-foreground">
                    {formatDateLong(`${date}T12:00:00Z`, 'UTC')}
                  </p>
                  <p className="mt-2 font-mono text-sm text-muted-foreground">
                    {(slotsByDate[date] ?? [])
                      .slice(0, 3)
                      .map((s) => s.label)
                      .join(' · ')}
                    {(slotsByDate[date]?.length ?? 0) > 3 &&
                      ` +${(slotsByDate[date]?.length ?? 0) - 3}`}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-6 text-center">
              <Link
                to={routes.public.book}
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                See all open times
              </Link>
            </p>
          </div>
        </section>
      )}

      {appointment && (
        <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
          <h2 className="mb-3 font-display text-2xl font-semibold text-foreground">
            {appointment.name}
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {appointment.description ??
              'One appointment for any hair service — tell us what you are after when you book.'}
          </p>
          <p className="mt-4 text-foreground">
            {formatDuration(appointment.duration_min)}
            {appointment.price_pence > 0
              ? ` · ${formatMoney(appointment.price_pence)}`
              : ' · price agreed in the salon'}
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            All times shown in {timezone}.
          </p>
        </section>
      )}
    </SiteShell>
  );
}
