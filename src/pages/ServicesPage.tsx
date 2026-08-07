import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useServices } from '@/hooks/useServices';
import { formatDuration, formatMoney } from '@/lib/format';
import { routes } from '@/lib/routes';

/** The public menu, grouped by category. */
export function ServicesPage(): JSX.Element {
  const { services, categories, loading, error } = useServices();

  const uncategorised = services.filter((s) => s.category_id === null);
  const grouped = categories
    .map((category) => ({
      category,
      items: services.filter((s) => s.category_id === category.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-foreground">Services</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Women&rsquo;s hair — cutting, colouring, styling and treatments.
        </p>

        {loading && <LoadingState label="Loading the menu…" />}
        {error && <ErrorState error={error} />}

        {!loading && !error && services.length === 0 && (
          <EmptyState
            title="The menu is on its way"
            description="Prices and services are being finalised. Get in touch and the salon will look after you in the meantime."
            action={
              <a
                className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
                href="mailto:booking@koko.gakinz.com"
              >
                Email the salon
              </a>
            }
          />
        )}

        <div className="space-y-10">
          {[
            ...grouped,
            ...(uncategorised.length > 0
              ? [
                  {
                    category: { id: 'none', name: 'More', slug: 'more' },
                    items: uncategorised,
                  },
                ]
              : []),
          ].map((group) => (
            <section key={group.category.id}>
              <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                {group.category.name}
              </h2>
              <div className="space-y-3">
                {group.items.map((service) => (
                  <Card key={service.id} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display text-lg font-semibold text-foreground">
                        {service.name}
                      </p>
                      <p className="font-medium text-foreground">
                        {formatMoney(service.price_pence)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDuration(service.duration_min)}
                      {service.description ? ` · ${service.description}` : ''}
                    </p>
                    <Link
                      to={routes.public.bookService(service.slug)}
                      className="mt-3 inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Book {service.name}
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
