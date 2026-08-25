import { type JSX, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { PhotoCard } from '@/components/ui/PhotoCard';
import { useServiceMenu } from '@/hooks/useServiceMenu';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const ALL = 'all';

/**
 * A photo grid of the work, filterable by category — the highest-value page
 * for a hair salon (2026-08-25 rebrand). Sourced from `service_menu` (via
 * `useServiceMenu()`), the same data the homepage teaser and the owner's
 * dashboard preview use — not `services`, which is the single bookable
 * appointment type, not a style catalogue. A style's own `image_path`
 * renders here the moment the owner uploads one (migration `0048` exposed
 * it on the public RPC); until then it falls back to a placeholder.
 */
export function GalleryPage(): JSX.Element {
  useDocumentMeta(
    'Gallery',
    'Braids, locs, weaves, natural hair and colour: a look at the work from Kokolett Beauty, a women’s hair salon in South East London.',
  );
  const { groups, loading } = useServiceMenu();
  const [activeGroup, setActiveGroup] = useState<string>(ALL);

  const visibleGroups = useMemo(
    () => (activeGroup === ALL ? groups : groups.filter((g) => g.group_name === activeGroup)),
    [groups, activeGroup],
  );

  const items = visibleGroups.flatMap((g) =>
    g.items.map((item) => ({ ...item, group_name: g.group_name })),
  );

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
            Gallery
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            A closer look at the work
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every style is different in the chair, but here is a sense of what to expect.
          </p>
        </div>

        {groups.length > 0 && (
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveGroup(ALL)}
              className={cn(
                'min-h-touch rounded-full border px-4 text-sm font-medium',
                activeGroup === ALL
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              All
            </button>
            {groups.map((g) => (
              <button
                key={g.group_name}
                type="button"
                onClick={() => setActiveGroup(g.group_name)}
                className={cn(
                  'min-h-touch rounded-full border px-4 text-sm font-medium',
                  activeGroup === g.group_name
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {g.group_name}
              </button>
            ))}
          </div>
        )}

        {!loading && items.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Nothing here yet, so{' '}
            <Link to={routes.public.services} className="text-primary hover:underline">
              see the full menu
            </Link>{' '}
            instead.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <PhotoCard
                key={`${item.group_name}-${item.name}`}
                imagePath={item.image_path}
                placeholderTone={i}
                tag={item.group_name}
                title={item.name}
                ctaLabel="Book this"
                ctaHref={routes.public.book}
              />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Something you have in mind that is not pictured here? Ask when you book and we
          will tell you honestly whether we can do it.
        </p>
      </section>
    </SiteShell>
  );
}
