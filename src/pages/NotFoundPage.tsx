import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Button } from '@/components/ui/Button';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { routes } from '@/lib/routes';

/**
 * Where a mistyped, retired or mis-shared link lands.
 *
 * Wrapped in `SiteShell` (2026-09-03) so it carries the same header, nav and
 * footer as every other page. It used to be a bare centred block with one
 * "Back home" button: a dead end that threw away the visitor who had already
 * bothered to click something, and gave a crawler following a broken inbound
 * link nothing to crawl on to. The three links below are the three things
 * somebody who lands here actually wanted.
 *
 * It also renders for a signed-out hit on a dashboard route
 * (`ProtectedRoute`), which is deliberate: the owner's sign-in form lives
 * only behind her own secret slug, and this page must not hint that
 * `/dashboard` is a real destination. That is why the wording stays generic
 * and identical to what a stranger sees.
 */
export function NotFoundPage(): JSX.Element {
  /* `noindex` so a mistyped or retired URL never enters the index as a real
     page. `follow` is kept: the links out of it are still worth crawling. */
  useDocumentMeta({ title: 'Page not found', noindex: true });

  return (
    <SiteShell>
      <section className="mx-auto max-w-xl px-4 py-20 text-center md:px-6">
        {/* Decoration. The numeral carried the whole page before, as a <p>, so
            this screen had no h1 at all and a screen reader announced it as
            "404 This page doesn't exist" with no document heading to land on. */}
        {/* `text-7xl` was silently dead: the fontSize scale in
            tailwind.config.ts REPLACES Tailwind's default rather than
            extending it, and it stops at `6xl`, so this numeral rendered at
            the inherited 16px. At that size the brand accent also fell under
            the 4.5:1 AA threshold. `text-6xl` is the real top of the scale
            and puts it back into large-text territory. */}
        <p aria-hidden="true" className="font-serif text-6xl font-extrabold text-brand">
          404
        </p>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-foreground">
          We could not find that page
        </h1>
        <p className="mt-3 text-muted-foreground">
          The link may be out of date, or the address may have a typo in it. Everything
          below still works.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to={routes.public.book}>
            <Button size="lg">Book an appointment</Button>
          </Link>
          <Link to={routes.public.home}>
            <Button size="lg" variant="ghost">
              Back to the salon
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Or go to{' '}
          <Link
            to={routes.public.services}
            className="text-foreground underline underline-offset-4"
          >
            services
          </Link>
          ,{' '}
          <Link
            to={routes.public.gallery}
            className="text-foreground underline underline-offset-4"
          >
            the gallery
          </Link>{' '}
          or{' '}
          <Link
            to={routes.public.contact}
            className="text-foreground underline underline-offset-4"
          >
            contact us
          </Link>
          .
        </p>
      </section>
    </SiteShell>
  );
}
