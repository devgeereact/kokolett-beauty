import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Reviews } from '@/components/public/Reviews';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/hooks/useServices';
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

/**
 * What the salon offers.
 *
 * A working list for an African hair salon, grouped the way a client thinks
 * about it. The owner should strike anything she does not do: a service listed
 * here that she has to turn down at the door costs more goodwill than it wins.
 */
const SERVICES: { group: string; items: string[] }[] = [
  {
    group: 'Braids',
    items: [
      'Knotless braids',
      'Box braids',
      'Cornrows',
      'Feed-in braids',
      'Ghana braids',
      'Fulani braids',
      'Lemonade braids',
      'Stitch braids',
      'Tribal braids',
      'Micro braids',
      'Kids braids',
    ],
  },
  {
    group: 'Twists and locs',
    items: [
      'Senegalese twists',
      'Passion twists',
      'Spring twists',
      'Marley twists',
      'Two strand twists',
      'Faux locs',
      'Butterfly locs',
      'Soft locs',
      'Starter locs',
      'Loc retwist and styling',
    ],
  },
  {
    group: 'Weaves, wigs and extensions',
    items: [
      'Sew-in weave',
      'Closure and frontal install',
      'Quick weave',
      'Crochet braids',
      'Wig install',
      'Wig customising and revamp',
      'Tape-in extensions',
      'Micro-link extensions',
      'Take-down and detangle',
    ],
  },
  {
    group: 'Natural hair and styling',
    items: [
      'Wash and go',
      'Silk press',
      'Blow dry and style',
      'Twist-out and braid-out',
      'Cut, trim and shaping',
      'Big chop and transitioning',
      'Bridal and occasion styling',
      'Relaxer and texturiser',
    ],
  },
  {
    group: 'Colour',
    items: [
      'Full colour',
      'Root touch-up',
      'Highlights and lowlights',
      'Bleaching and lifting',
      'Toning and glossing',
    ],
  },
  {
    group: 'Treatments',
    items: [
      'Deep conditioning',
      'Protein and bond repair',
      'Scalp treatment',
      'Steam treatment',
      'Hot oil treatment',
      'Trim and split-end care',
    ],
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
  const { services } = useServices();
  const { settings } = useBusinessSettings();
  const { slotsByDate, openDates, loading } = useAvailability(
    services[0]?.duration_min ?? 60,
  );

  const nextDays = openDates.slice(0, 3);

  return (
    <SiteShell>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="mb-5 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Women&rsquo;s hair salon, South East London
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
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
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="mb-2 text-center font-display text-3xl font-semibold text-foreground">
              Next available
            </h2>
            <p className="mb-8 text-center text-muted-foreground">
              Straight from the salon diary. These times are free right now.
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

      {/* ---- Services ------------------------------------------------- */}
      <section id="services" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="mb-2 text-center font-display text-3xl font-semibold text-foreground">
          What we do
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
          One appointment covers whatever you need. Tell us what you are after when you
          book and we will keep aside the right amount of time, because a full head of
          knotless braids and a trim are not the same afternoon.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((group) => (
            <Card key={group.group} className="p-5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {group.group}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Something you do not see here? Ask when you book and we will tell you honestly
          whether we can do it.
        </p>
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

      {/* ---- Closing ------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold text-foreground">
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
