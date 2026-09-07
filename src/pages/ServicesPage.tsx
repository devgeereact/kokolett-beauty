import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { useServiceMenu } from '@/hooks/useServiceMenu';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatDuration } from '@/lib/format';
import { cn, jsonLd } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { SALON_SCHEMA_ID } from '@/lib/business';
import { publicButton } from '@/components/ui/controlClasses';

/**
 * The full live service menu — duration only, never a price (2026-08-25
 * rebrand). Sourced from `service_menu` (via `useServiceMenu()`), the same
 * data the homepage teaser and gallery use. What an appointment costs is
 * agreed in the chair (`docs/PRD.md` §7): a full head of knotless braids and
 * a trim are not the same afternoon, and a number on a marketing page would
 * be a promise the salon cannot keep.
 */
export function ServicesPage(): JSX.Element {
  useDocumentMeta({
    title: 'Services',
    description:
      'Braids, twists, weaves, natural hair and styling, colour and treatments at Kokolett Beauty in Thamesmead, South East London. See the full menu and book online.',
    path: routes.public.services,
  });
  const { groups, loading } = useServiceMenu();

  /* Built from the live `service_menu` rather than hand-written, so the
     structured data cannot drift from what the owner has in the console.
     Attached to the salon's own `@id` from index.html, so Google reads it as
     this salon's catalogue and not a second business. */
  const catalogueJsonLd =
    groups.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'HairSalon',
          '@id': SALON_SCHEMA_ID,
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: "Women's hair services",
            itemListElement: groups.map((group) => ({
              '@type': 'OfferCatalog',
              name: group.group_name,
              itemListElement: group.items.map((item) => ({
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  name: item.name,
                  serviceType: group.group_name,
                  provider: { '@id': SALON_SCHEMA_ID },
                  ...(item.note ? { description: item.note } : {}),
                },
              })),
            })),
          },
        }
      : null;

  return (
    <SiteShell>
      {catalogueJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(catalogueJsonLd) }}
        />
      )}

      <section className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-ink">
            Services
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            One appointment, whatever you need
          </h1>
          <p className="mt-3 text-muted-foreground">
            Tell us what you are after when you book and we will keep aside the right
            amount of time. There is no fixed price list: what a style costs is agreed in
            the chair.
          </p>
        </div>

        {!loading && groups.length === 0 && (
          <p className="text-center text-muted-foreground">
            The menu is being updated. Ask when you book and we will tell you what we can
            do.
          </p>
        )}

        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.group_name}>
              <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">
                {group.group_name}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <Card
                    pad="compact"
                    key={item.name}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.note && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                      )}
                    </div>
                    <span className="font-mono shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      &sim;{formatDuration(item.duration_min)}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={routes.public.book}
            className={cn(publicButton(), 'h-12 px-8 text-base')}
          >
            Book an appointment
          </Link>
          <Link
            to={routes.public.gallery}
            className="inline-flex h-12 items-center rounded-lg border border-border px-6 text-base font-semibold text-foreground hover:bg-muted"
          >
            See the work
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
