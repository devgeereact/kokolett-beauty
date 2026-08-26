import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { buildImageKitUrl } from '@/lib/imagekit';
import { routes } from '@/lib/routes';

/**
 * Christy's story — sourced from the owner directly, kept in code rather
 * than a CMS field since it changes rarely and belongs under version
 * control like the rest of the site's copy (2026-08-25 rebrand).
 */
export function AboutPage(): JSX.Element {
  useDocumentMeta(
    'About',
    'Meet Christy, the stylist behind Kokolett Beauty: 15+ years doing hair in Woolwich, South East London.',
  );

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,340px)_1fr] md:items-start md:gap-14">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl border border-border shadow-card md:mx-0">
            <img
              src={buildImageKitUrl('/kokolett/marketing/about-christy-portrait.jpg', {
                width: 680,
                quality: 85,
              })}
              alt="A portrait representing the warmth of a Kokolett Beauty appointment"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <p className="absolute bottom-4 left-4 rounded-lg bg-card px-3.5 py-2.5 text-sm text-foreground shadow-popover">
              <strong className="block font-serif text-base">15+ years</strong>
              doing hair in Woolwich
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
              Meet Christy
            </p>
            <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
              The heart behind Kokolett Beauty
            </h1>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Christy has been doing hair for more than{' '}
                <strong className="text-foreground">fifteen years</strong>, right here in
                Woolwich. She started Kokolett Beauty because she loves this work: helping
                women walk out feeling like the best version of themselves.
              </p>
              <p>
                Originally from <strong className="text-foreground">Nigeria</strong>, she
                brought her training and her eye for detail with her, and a way of putting
                people at ease the moment they sit down. Ask anyone who has been in her
                chair and they will tell you the same thing: it does not feel like a salon
                appointment, it feels like catching up with someone who actually cares how
                your hair, and your week, is going.
              </p>
              <p>
                Every client is different, so every appointment starts the same way:
                Christy listens first. What you want, what has grown out, what you are
                getting ready for. Then she gets to work.
              </p>
              <p>
                Fifteen years in, her philosophy has not changed:{' '}
                <strong className="text-foreground">
                  when you look good, you feel good.
                </strong>{' '}
                That is the whole point of coming in.
              </p>
              <p>
                Whether you have been coming for years or you are booking your first
                appointment, she is looking forward to having you in the chair.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={routes.public.book}
                className="inline-flex h-12 min-h-touch items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground"
              >
                Book with Christy
              </Link>
              <Link
                to={routes.public.gallery}
                className="inline-flex h-12 min-h-touch items-center rounded-lg border border-border px-6 text-base font-semibold text-foreground hover:bg-muted"
              >
                See the work
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
