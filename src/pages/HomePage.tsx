import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Reviews } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/hooks/useServices';
import { useAvailability } from '@/hooks/useAvailability';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatDateLong, formatDuration } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * The salon's front page.
 *
 * It answers, in order, the three questions a stranger actually has: what is
 * this, when can I come in, and can I trust you. So it leads with the salon,
 * then shows real open times, then real reviews — rather than a carousel and a
 * paragraph about passion.
 *
 * There are no invented testimonials, no stock statistics and no service menu
 * with made-up prices. Everything on this page is either a fact from the
 * database or a sentence about the salon that is true.
 */

const WHAT_WE_DO = [
  {
    title: 'Cutting',
    body: 'Restyles, trims and shaping, cut dry or wet depending on what your hair needs.',
  },
  {
    title: 'Colouring',
    body: 'Full colour, roots, highlights and toning, with a patch test where it is needed.',
  },
  {
    title: 'Styling',
    body: 'Blow dries, silk presses and finishing for an occasion or a normal Tuesday.',
  },
  {
    title: 'Treatments',
    body: 'Conditioning and repair for hair that needs bringing back to itself.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Pick a time',
    body: 'Only times that are genuinely free are shown, so nothing you choose gets refused later.',
  },
  {
    step: '2',
    title: 'Tell us what you are after',
    body: 'A sentence is plenty. It tells the salon what to prepare before you arrive.',
  },
  {
    step: '3',
    title: 'That is it',
    body: 'No account, no password. Your confirmation and a link to change it arrive by email.',
  },
];

export function HomePage(): JSX.Element {
  const { services } = useServices();
  const { settings } = useBusinessSettings();
  const appointment = services[0];
  const { slotsByDate, openDates, loading } = useAvailability(
    appointment?.duration_min ?? 60,
  );

  const nextDays = openDates.slice(0, 3);

  return (
    <SiteShell>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="mb-5 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Women&rsquo;s hair salon · United Kingdom
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          Hair that feels like <span className="text-primary">you</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Cutting, colouring, styling and treatments — unhurried, and done properly. Book
          the time that suits you in under two minutes.
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
          No account needed · Free to cancel or change
          {settings?.cancellation_window_h
            ? ` up to ${settings.cancellation_window_h} hours before`
            : ''}
        </p>
      </section>

      {/* ---- Next available ------------------------------------------ */}
      {!loading && nextDays.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="mb-2 text-center font-display text-3xl font-semibold text-foreground">
              Next available
            </h2>
            <p className="mb-8 text-center text-muted-foreground">
              Live from the salon diary — these are free right now.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
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

      {/* ---- What we do ---------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="mb-2 text-center font-display text-3xl font-semibold text-foreground">
          What we do
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
          One appointment covers whatever you need doing
          {appointment
            ? `, and takes about ${formatDuration(appointment.duration_min)}`
            : ''}
          . Tell us what you have in mind when you book.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHAT_WE_DO.map((item) => (
            <Card key={item.title} className="p-5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---- How booking works --------------------------------------- */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="mb-10 text-center font-display text-3xl font-semibold text-foreground">
            Booking, without the phone tag
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
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

      {/* ---- Closing call to action ---------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          If you cannot see a time that works, say when suits and the salon will come back
          to you as soon as something frees up.
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
