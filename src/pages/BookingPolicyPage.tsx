import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalHeading as H2 } from '@/components/public/LegalPage';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';

/**
 * How booking actually works, including the two rules that are the salon's
 * rather than the software's: the patch test before colour, and what happens
 * after repeated missed appointments.
 *
 * The cancellation window and lead time are read from settings rather than
 * repeated as numbers that will drift the moment the owner changes them.
 */
export function BookingPolicyPage(): JSX.Element {
  const { settings } = useBusinessSettings();
  const window = settings?.cancellation_window_h ?? 24;
  const lead = settings?.lead_time_min ?? 120;

  return (
    <LegalPage
      title="Booking policy"
      updated="September 2026"
      description="How booking, patch tests, rescheduling, cancellation and missed appointments work at Kokolett Beauty UK."
      path={routes.public.bookingPolicy}
    >
      <H2>Booking</H2>
      <p>
        Every time shown on the booking page is genuinely free, the salon publishes the
        times she can work, and a time disappears the moment somebody takes it. Your
        booking is confirmed straight away; there is nothing to wait for.
      </p>
      <p>
        Appointments cannot be booked less than{' '}
        {lead >= 60 ? `${Math.round(lead / 60)} hours` : `${lead} minutes`} in advance, so
        the salon has notice to prepare.
      </p>

      <H2>Colour needs a patch test first</H2>
      <p>
        Hair colour can cause an allergic reaction, occasionally a serious one, and a
        reaction can appear in somebody who has had colour before with no trouble at all.
        So the salon carries out a patch test <strong>48 hours before</strong> any colour
        appointment. It takes a couple of minutes and it is not optional.
      </p>
      <p>
        If you have never had colour here, please get in touch before you book so the
        patch test can be arranged in time. If the 48 hours cannot be made to work, the
        colour appointment will have to move. This is a safety rule, not paperwork.
      </p>
      <p>
        Tell the salon about any allergy, any reaction you have had before, and anything
        happening with your scalp. She keeps a private note of it so it is not forgotten
        next time.
      </p>

      <H2>Changing or cancelling</H2>
      <p>
        You can change or cancel your own appointment at any time from the link in your
        confirmation email, or from{' '}
        <Link
          to={routes.customer.home}
          className="underline underline-offset-4 hover:text-foreground"
        >
          My bookings
        </Link>
        . No phone call, no waiting for a reply, and there is never a charge for
        cancelling.
      </p>
      <p>
        Please give at least <strong>{window} hours&rsquo; notice</strong> where you can.
        Later changes are still accepted, we would much rather know than have you not turn
        up, but the salon is told, because a short-notice gap is difficult to fill.
      </p>
      <p>
        When you move an appointment you keep the original until you have chosen a new
        time. If somebody takes the new time first, nothing is lost and your existing
        booking stands.
      </p>

      <H2>Missed appointments</H2>
      <p>
        Nothing is charged if you do not turn up. The salon is one person and one chair,
        though, so a missed appointment is an hour or more that nobody else could have. If
        it keeps happening, the salon may ask you to book by phone instead of online, so
        she can talk it through with you first.
      </p>

      <H2>If you cannot find a time</H2>
      <p>
        Tell us when suits using{' '}
        <Link
          to={routes.public.requestAvailability}
          className="underline underline-offset-4 hover:text-foreground"
        >
          ask for a time
        </Link>
        . Requests are answered in the order they arrive, so if somebody cancels, the
        person who asked first is offered the slot.
      </p>

      <H2>Running late</H2>
      <p>
        Please call if you are delayed. Appointments are one after another, so a late
        start may mean a shorter appointment or having to rebook.
      </p>

      <H2>Payment</H2>
      <p>
        Nothing is taken online and no deposit is required. Payment is settled in the
        salon.
      </p>
      <p>
        Where a price is shown it is a guide. The final price depends on what your hair
        actually needs, and it is agreed with you before any work starts.
      </p>

      <H2>If something goes wrong</H2>
      <p>
        Tell the salon as soon as you can, ideally before you leave, so it can be put
        right. The{' '}
        <Link
          to={routes.public.complaints}
          className="underline underline-offset-4 hover:text-foreground"
        >
          complaints
        </Link>{' '}
        page explains what happens next and what to do if you are still unhappy.
      </p>
    </LegalPage>
  );
}
