import type { JSX, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { routes } from '@/lib/routes';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

/**
 * The shared frame for every legal page.
 *
 * Extracted from `PolicyPages.tsx` when the set grew from three pages to six:
 * one file holding six components would have broken both the 500-line limit
 * and the one-component-per-file rule in `docs/RULES.md`. The markup is
 * unchanged, so the three original pages render exactly as before.
 */
export function LegalPage({
  title,
  updated,
  description,
  path,
  children,
}: {
  title: string;
  updated: string;
  description: string;
  path: string;
  children: ReactNode;
}): JSX.Element {
  /* All the legal pages set their head here rather than each doing it
     separately. Without it they inherit index.html's canonical and claim to
     be the home page. */
  useDocumentMeta({ title, description, path });

  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-14 md:px-6">
        <h1 className="font-serif text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-sm">
          <Link
            to={routes.public.home}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to the salon
          </Link>
        </p>
      </article>
    </SiteShell>
  );
}

/** Section heading, sized to sit under the page's single `h1`. */
export function LegalHeading({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="font-serif text-lg font-semibold text-foreground">{children}</h2>;
}

/**
 * Inline link inside legal prose. Every one of these was hand-repeated before
 * the split; a shared component keeps the underline and focus treatment the
 * same on all six pages.
 */
export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): JSX.Element {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="underline underline-offset-4 hover:text-foreground"
    >
      {children}
    </a>
  );
}
