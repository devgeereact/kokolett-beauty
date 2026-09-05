import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { buildImageKitUrl } from '@/lib/imagekit';
import { routes } from '@/lib/routes';
import { publicButton } from '@/components/ui/controlClasses';
import { cn } from '@/lib/utils';

/** Shown until the owner uploads her own photo from Settings. */
const FALLBACK_PHOTO_PATH = '/kokolett/marketing/about-christy-portrait.jpg';

/**
 * Christy's story — the copy is sourced from the owner directly and kept in
 * code since it changes rarely and belongs under version control like the
 * rest of the site's copy (2026-08-25 rebrand). The portrait itself is
 * owner-editable (`booking_settings.about_photo_path`, Settings → About photo).
 */
export function AboutPage(): JSX.Element {
  useDocumentMeta({
    title: 'About',
    description:
      'Meet Christy, the stylist behind Kokolett Beauty: over 15 years doing hair in Thamesmead, South East London.',
    path: routes.public.about,
  });
  const { settings } = useBusinessSettings();

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,340px)_1fr] md:items-start md:gap-14">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl border border-border shadow-card md:mx-0">
            <img
              src={buildImageKitUrl(settings?.about_photo_path ?? FALLBACK_PHOTO_PATH, {
                width: 680,
                quality: 85,
              })}
              alt="A portrait representing the warmth of a Kokolett Beauty appointment"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <p className="absolute bottom-4 left-4 rounded-lg bg-card px-3.5 py-2.5 text-sm text-foreground shadow-popover">
              <strong className="block font-serif text-base">15+ years</strong>
              doing hair in Thamesmead
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-ink">
              Meet Christy
            </p>
            <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
              The heart behind Kokolett Beauty
            </h1>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Christy has been doing hair for more than{' '}
                <strong className="text-foreground">fifteen years</strong>, and works out
                of Thamesmead in South East London. She started Kokolett Beauty because
                she likes the work, and because she would rather take one client at a time
                and get the finish right than rush three.
              </p>
              <p>
                She trained in <strong className="text-foreground">Nigeria</strong> and
                brought that training with her. What people tend to mention afterwards is
                not the technique, though. It is that an appointment feels less like a
                salon slot and more like catching up with someone who wants to know how
                your week has gone.
              </p>
              <p>
                Every client is different, so every appointment starts the same way:
                Christy listens first. What you want, what has grown out, what you are
                getting ready for. Then she gets to work.
              </p>
              <p>
                Fifteen years in, she still holds the same view:{' '}
                <strong className="text-foreground">
                  when you look good, you feel good.
                </strong>{' '}
                That is why she takes the time.
              </p>
              <p>First appointment or fiftieth, she will be glad to see you.</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={routes.public.book}
                className={cn(publicButton(), 'h-12 px-8 text-base')}
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
