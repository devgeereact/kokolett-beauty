import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/hooks/useServices';
import { formatDuration, formatMoney, trimSeconds } from '@/lib/format';
import { DAYS_OF_WEEK } from '@/lib/format';
import { routes } from '@/lib/routes';
import { useEffect, useState } from 'react';
import { listRules } from '@/services/availabilityService';
import type { AvailabilityRule } from '@/types';

/**
 * The salon's front page. Editorial: one clear action, generous space, and the
 * two facts a customer actually needs — what it costs and when you are open.
 */
export function HomePage(): JSX.Element {
  const { services } = useServices();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);

  useEffect(() => {
    void listRules()
      .then(setRules)
      .catch(() => setRules([]));
  }, []);

  const featured = services.slice(0, 3);

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
          Cutting, colouring, styling and treatments — booked online in under two minutes.
          No account, no password.
        </p>
        <Link
          to={routes.public.book}
          className="mt-8 inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Book an appointment
        </Link>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <h2 className="mb-6 text-center font-display text-2xl font-semibold text-foreground">
            Popular
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {featured.map((service) => (
              <Card key={service.id} className="flex flex-col p-5">
                <p className="font-display text-lg font-semibold text-foreground">
                  {service.name}
                </p>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {service.description ?? formatDuration(service.duration_min)}
                </p>
                <p className="mt-3 font-medium text-foreground">
                  {formatMoney(service.price_pence)}
                </p>
                <Link
                  to={routes.public.bookService(service.slug)}
                  className="mt-3 inline-flex h-11 items-center justify-center rounded-lg border border-border font-semibold text-foreground hover:bg-muted"
                >
                  Book
                </Link>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center">
            <Link
              to={routes.public.services}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              See the full menu
            </Link>
          </p>
        </section>
      )}

      {rules.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <h2 className="mb-6 font-display text-2xl font-semibold text-foreground">
              Opening hours
            </h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              {DAYS_OF_WEEK.map((day) => {
                const open = rules.filter(
                  (r) => r.day_of_week === day.index && r.is_open,
                );
                return (
                  <div
                    key={day.index}
                    className="flex justify-between border-b border-border py-2"
                  >
                    <dt className="text-foreground">{day.name}</dt>
                    <dd className="text-muted-foreground">
                      {open.length === 0
                        ? 'Closed'
                        : open
                            .map(
                              (r) =>
                                `${trimSeconds(r.opens_at)}–${trimSeconds(r.closes_at)}`,
                            )
                            .join(', ')}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-6 text-sm text-muted-foreground">
              Holidays and one-off changes are reflected in the booking calendar, so the
              times you see when booking are always the real ones.
            </p>
          </div>
        </section>
      )}
    </SiteShell>
  );
}
