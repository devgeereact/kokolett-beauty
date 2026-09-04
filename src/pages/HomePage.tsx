import { type JSX, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { HeroCarousel, type HeroSlide } from '@/components/public/HeroCarousel';
import { Reviews } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import { PhotoCard } from '@/components/ui/PhotoCard';
import { useServiceMenu } from '@/hooks/useServiceMenu';
import { useAvailability } from '@/hooks/useAvailability';
import { useServices } from '@/hooks/useServices';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatDateLong } from '@/lib/format';
import { routes } from '@/lib/routes';
import { BUSINESS_NAME, LOCALITY, buildGoogleProfileUrl } from '@/lib/business';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

/**
 * The salon's front page.
 *
 * It answers the three questions a stranger has, in the order they ask them:
 * what do you do, when can I come in, and can I trust you — with "when can I
 * come in" surfaced right under the hero, not buried mid-scroll, because a
 * booking business lives or dies on that answer being visible immediately
 * (2026-08-25 rebrand).
 *
 * No length or price is quoted anywhere. Two hours of knotless braids and a
 * twenty minute trim are not the same appointment, and printing one number for
 * both would be a promise the salon cannot keep.
 */

/**
 * Sorted for narrative flow, not upload order: joyful opener, editorial
 * trust shot, glam close-up, then real-salon candids and craft detail.
 * `objectPosition` is tuned per photo — the hero renders wider than any
 * source photo, so the full width always shows and only vertical crop
 * (and, on narrow mobile viewports, horizontal crop) is at stake.
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    photoPath: '/kokolett/marketing/hero-hair-flip-side-profile.jpg',
    objectPosition: '35% 25%',
  },
  { photoPath: '/kokolett/marketing/hero-editorial-trio.jpg', objectPosition: '50% 30%' },
  {
    photoPath: '/kokolett/marketing/hero-golden-braids-portrait.jpg',
    objectPosition: '40% 30%',
  },
  {
    photoPath: '/kokolett/marketing/hero-braiding-event-candid.jpg',
    objectPosition: '45% 35%',
  },
  { photoPath: '/kokolett/marketing/hero-cornrow-detail.jpg', objectPosition: '65% 35%' },
  {
    photoPath: '/kokolett/marketing/hero-braiding-process-hands.jpg',
    objectPosition: '50% 30%',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Pick a time',
    body: 'The times on the booking page are the times that are genuinely free, so nothing you choose gets turned down afterwards.',
  },
  {
    step: '2',
    title: 'Say what you want doing',
    body: 'A sentence is plenty. It tells us what to prepare and roughly how long to keep aside for you.',
  },
  {
    step: '3',
    title: 'Come in',
    body: 'Your confirmation arrives by email with a link to change or cancel. You never need an account or a password.',
  },
];

export function HomePage(): JSX.Element {
  useDocumentMeta({
    title: "Kokolett Beauty UK: women's hair salon in Thamesmead, London",
    description:
      "Kokolett Beauty UK is a women's hair salon in Thamesmead, South East London. Braids, twists, weaves, natural hair and styling, colour and treatments. Book a real, free time online.",
    fullTitle: true,
    path: routes.public.home,
  });
  const location = useLocation();
  const { services } = useServices();
  const { groups: menu } = useServiceMenu();
  const { settings } = useBusinessSettings();
  const { slotsByDate, openDates, loading } = useAvailability(
    services[0]?.duration_min ?? 60,
  );

  const nextDays = openDates.slice(0, 3);
  const teaserGroups = menu.slice(0, 4);

  // The Services section only exists once the menu has loaded (and the page
  // keeps reflowing after that — e.g. the "Next available" cards from
  // `useAvailability` resolving a beat later, or the display font swapping
  // in), so a single scroll-into-view fired once on mount reliably lands
  // short: it targets whatever the layout looked like at that instant, then
  // has no way to react to what shifts under it a moment later. Poll instead:
  // wait for the section to exist, wait for whatever scroll is currently
  // animating (ours or the browser's own hash-scroll) to settle, then
  // re-correct if it didn't land at the top — arriving via the dashboard's
  // "View on website" link, opened fresh in a new tab, is exactly this case.
  useEffect(() => {
    if (location.hash !== '#services') return;

    let cancelled = false;
    let rafId = 0;
    let frame = 0;
    let corrections = 0;
    let lastScrollY = -1;
    let settledFrames = 0;

    const MAX_FRAMES = 300; // ~5s at 60fps — generous, but bounded
    const MAX_CORRECTIONS = 5;

    const stop = (): void => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };

    const tick = (): void => {
      if (cancelled) return;
      frame += 1;

      const el = document.getElementById('services');
      if (!el) {
        if (frame < MAX_FRAMES) rafId = requestAnimationFrame(tick);
        else stop();
        return;
      }

      // A scroll (ours or the browser's) is still moving — a mid-animation
      // read of the target's position is meaningless, so wait for it to stop.
      if (window.scrollY !== lastScrollY) {
        lastScrollY = window.scrollY;
        settledFrames = 0;
        if (frame < MAX_FRAMES) rafId = requestAnimationFrame(tick);
        else stop();
        return;
      }
      settledFrames += 1;
      if (settledFrames < 2) {
        if (frame < MAX_FRAMES) rafId = requestAnimationFrame(tick);
        else stop();
        return;
      }

      const top = el.getBoundingClientRect().top;
      if (Math.abs(top) > 2 && corrections < MAX_CORRECTIONS) {
        corrections += 1;
        el.scrollIntoView({ block: 'start' });
        settledFrames = 0;
        if (frame < MAX_FRAMES) rafId = requestAnimationFrame(tick);
        else stop();
        return;
      }

      stop();
    };

    rafId = requestAnimationFrame(tick);
    // Never fight a visitor who has taken over scrolling themselves.
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });

    return stop;
  }, [location.hash]);

  return (
    <SiteShell>
      {/* ---- Hero ------------------------------------------------------
          Cross-fading photo carousel (`HeroCarousel`) over the salon's own
          photography, a uniform dark scrim tuned to hold white text legible
          against any of them, trust pill above the headline, and one
          gradient word inside it — see docs/DESIGN.md §4 for the
          `text-5xl`/`text-6xl` steps this needs and `.text-hero-accent` in
          src/index.css. */}
      <HeroCarousel slides={HERO_SLIDES}>
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:px-6 md:py-20">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-hero-fg/25 bg-hero-fg/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur">
            <span aria-hidden="true" className="text-brand-soft">
              &#9733;
            </span>
            15+ years &middot; Thamesmead, SE London &middot; Google reviews
          </p>
          <p className="mb-4 font-serif text-base italic text-brand-soft">
            Women&rsquo;s hair salon in Thamesmead, South East London
          </p>
          <h1 className="font-serif text-5xl font-semibold tracking-tight md:text-6xl">
            Hair that <span className="text-hero-accent">holds</span> its shape.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-hero-fg/85">
            Braids, twists, weaves, natural hair, colour and treatments. One client at a
            time, so nothing gets rushed. Choose a time that suits you and we will do the
            rest.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={routes.public.book}
              className="inline-flex h-control-lg min-h-touch items-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Book an appointment
            </Link>
            <Link
              to={routes.public.gallery}
              className="inline-flex h-control-lg min-h-touch items-center rounded-full border border-hero-fg/50 px-6 text-base font-semibold text-hero-fg hover:bg-hero-fg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See our work
            </Link>
          </div>
          <p className="mt-5 text-sm text-hero-fg/70">
            No account needed. Change or cancel free
            {settings?.cancellation_window_h
              ? ` up to ${settings.cancellation_window_h} hours before`
              : ''}
            .
          </p>
        </div>
      </HeroCarousel>

      {/* ---- Stats bar --------------------------------------------------
          Slim on purpose: availability below still has to be the loudest
          thing on the page. Every figure is a real, honest claim — no
          invented headcounts or location counts for a single-owner salon. */}
      <div className="bg-primary py-4">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 text-center md:grid-cols-4 md:px-6">
          {[
            { value: '15+', label: 'Years experience' },
            { value: '1:1', label: 'Personalised, every visit' },
            { value: '★', label: 'Google rated' },
            { value: '0', label: 'Accounts or passwords needed' },
          ].map((stat) => (
            <div key={stat.label}>
              <dd className="font-serif text-xl font-semibold text-primary-foreground">
                {stat.value}
              </dd>
              <dt className="text-xs uppercase tracking-wide text-primary-foreground/80">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- Next available -------------------------------------------
          Directly under the hero fold, not several scrolls down: this is
          where the money comes from. */}
      {!loading && nextDays.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <h2 className="mb-2 text-center font-serif text-3xl font-semibold text-foreground">
              Next available
            </h2>
            <p className="mb-8 text-center text-muted-foreground">
              Straight from the salon diary. These times are free right now.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {nextDays.map((date) => (
                <Card key={date} className="p-5 text-center">
                  <p className="font-medium text-foreground">
                    {formatDateLong(`${date}T12:00:00Z`, 'UTC')}
                  </p>
                  <p className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {(slotsByDate[date] ?? []).slice(0, 4).map((slot) => (
                      <span
                        key={slot.startsAt}
                        className="rounded-md border border-border px-2 py-1 font-mono text-sm text-muted-foreground"
                      >
                        {slot.label}
                      </span>
                    ))}
                    {(slotsByDate[date]?.length ?? 0) > 4 && (
                      <span className="self-center text-sm text-muted-foreground">
                        +{(slotsByDate[date]?.length ?? 0) - 4} more
                      </span>
                    )}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                to={routes.public.book}
                className="inline-flex h-11 items-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground"
              >
                See all open times
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* ---- Services teaser --------------------------------------------
          The full priced-by-neither, described menu now lives on its own
          page (`/services`); this is a taste, not the whole list. */}
      {teaserGroups.length > 0 && (
        <section id="services" className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-2 text-center font-serif text-3xl font-semibold text-foreground">
            What we do
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            One appointment covers whatever you need. Tell us what you are after when you
            book and we will keep aside the right amount of time.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teaserGroups.map((group, i) => (
              <PhotoCard
                key={group.group_name}
                imagePath={group.items[0]?.image_path}
                alt={`${group.items[0]?.name ?? group.group_name} at ${BUSINESS_NAME}, a women's hair salon in ${LOCALITY}, South East London`}
                placeholderTone={i}
                title={group.group_name}
                description={group.items[0]?.name}
                ctaLabel="Book"
                ctaHref={routes.public.book}
              />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link
              to={routes.public.services}
              className="font-medium text-primary underline underline-offset-4"
            >
              See the full menu
            </Link>
            . Something you do not see there? Ask when you book and we will tell you
            honestly whether we can do it.
          </p>
        </section>
      )}

      {/* ---- How booking works --------------------------------------- */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-10 text-center font-serif text-3xl font-semibold text-foreground">
            Booking, without the phone tag
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-4 font-serif text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Reviews (renders nothing until Google has some) ---------- */}
      <Reviews
        reviewUrl={settings?.google_review_url ?? null}
        profileUrl={buildGoogleProfileUrl(settings?.google_place_id)}
      />

      {/* ---- Closing ------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
        <h2 className="font-serif text-3xl font-semibold text-foreground">
          Come and see us
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          If nothing on the calendar suits, tell us when does. We will let you know as
          soon as something opens up.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={routes.public.book}
            className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground"
          >
            Book an appointment
          </Link>
          <Link
            to={routes.public.requestAvailability}
            className="inline-flex h-12 items-center rounded-lg border border-border px-6 text-base font-semibold text-foreground hover:bg-card"
          >
            Ask for a time
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
