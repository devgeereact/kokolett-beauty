import { type JSX, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Reviews } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/hooks/useServices';
import { useServiceMenu } from '@/hooks/useServiceMenu';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatDateLong } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * The salon's front page.
 *
 * It answers the three questions a stranger has, in the order they ask them:
 * what do you do, when can I come in, and can I trust you.
 *
 * No length or price is quoted anywhere. Two hours of knotless braids and a
 * twenty minute trim are not the same appointment, and printing one number for
 * both would be a promise the salon cannot keep.
 */

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
  const location = useLocation();
  const { services } = useServices();
  const { groups: menu } = useServiceMenu();
  const { settings } = useBusinessSettings();
  const { slotsByDate, openDates, loading } = useAvailability(
    services[0]?.duration_min ?? 60,
  );

  const nextDays = openDates.slice(0, 3);

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
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6 md:py-28">
        <p className="mb-5 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Women&rsquo;s hair salon, South East London
        </p>
        <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
          Hair that feels like <span className="text-primary">you</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Braids, locs, weaves, natural hair and colour, done with time and care. Choose a
          time that suits you and we will do the rest.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={routes.public.book}
            className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Book an appointment
          </Link>
          <Link
            to={routes.customer.home}
            className="inline-flex h-12 items-center rounded-lg border border-border px-6 text-base font-semibold text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage a booking
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          No account needed. Change or cancel free
          {settings?.cancellation_window_h
            ? ` up to ${settings.cancellation_window_h} hours before`
            : ''}
          .
        </p>
      </section>

      {/* ---- Next available ------------------------------------------ */}
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

      {/* ---- Services -------------------------------------------------
          Straight from the salon's own menu, which she edits in the
          dashboard. Nothing renders until there is something to show. */}
      {menu.length > 0 && (
        <section id="services" className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-2 text-center font-serif text-3xl font-semibold text-foreground">
            What we do
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            One appointment covers whatever you need. Tell us what you are after when you
            book and we will keep aside the right amount of time, because a full head of
            knotless braids and a trim are not the same afternoon.
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menu.map((group) => (
              <Card key={group.group_name} className="p-0">
                {/* Collapsed by default: a category name answers "do you do
                    this at all", the item list only matters once someone
                    actually cares — six categories × up to a dozen items
                    each was a very long, low-signal scroll before this,
                    worst on mobile where it dominated the whole page. */}
                <details className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-serif text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                    {group.group_name}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <ul className="mt-3 space-y-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                        <span>
                          {item.name}
                          {item.note && (
                            <span className="block text-xs text-muted-foreground">
                              {item.note}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Something you do not see here? Ask when you book and we will tell you honestly
            whether we can do it.
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
      <Reviews reviewUrl={settings?.google_review_url ?? null} />

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
