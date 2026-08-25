import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { useServiceMenu } from '@/hooks/useServiceMenu';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatDuration } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * The full live service menu — duration only, never a price (2026-08-25
 * rebrand). Sourced from `service_menu` (via `useServiceMenu()`), the same
 * data the homepage teaser and gallery use. What an appointment costs is
 * agreed in the chair (`docs/PRD.md` §7): a full head of knotless braids and
 * a trim are not the same afternoon, and a number on a marketing page would
 * be a promise the salon cannot keep.
 */
export function ServicesPage(): JSX.Element {
  useDocumentMeta(
    'Services',
    'Braids, locs, weaves, natural hair and colour at Kokolett Beauty, a women’s hair salon in South East London. See the full menu and book online.',
  );
  const { groups, loading } = useServiceMenu();

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
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
                  <Card key={item.name} className="flex items-start justify-between gap-4 p-4">
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

        <p className="mt-10 text-center">
          <Link
            to={routes.public.book}
            className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground"
          >
            Book an appointment
          </Link>
        </p>
      </section>
    </SiteShell>
  );
}
