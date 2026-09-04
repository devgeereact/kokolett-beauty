import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useConsent } from '@/hooks/useConsent';
import { routes } from '@/lib/routes';

/**
 * The consent control for the one optional thing this site stores.
 *
 * Design constraints that are not cosmetic:
 *
 *  - Accept and Reject are the same component, same size, same order weight.
 *    A filled "Accept" beside a grey text "Reject" makes refusing harder than
 *    agreeing, which is the dark pattern the ICO calls out by name.
 *  - Nothing is preselected and closing it is not an option, because silence
 *    is not consent. There is no dismiss X: the two buttons are the only ways
 *    out, and both are a real recorded decision.
 *  - It does not trap focus or cover the page. A visitor who ignores it can
 *    still read everything and book, they simply get no optional storage.
 *  - `role="region"` with a label, not a modal dialog. It is an interruption,
 *    not a barrier, and a screen reader user can reach it by landmark.
 */
export function ConsentBanner(): JSX.Element | null {
  const { decided, accept, reject } = useConsent();

  if (decided) return null;

  return (
    <div
      role="region"
      aria-label="Cookies and storage"
      className="fixed inset-x-0 bottom-0 z-toast border-t border-border bg-card p-4 shadow-modal md:p-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Can we count how booking goes?</p>
          <p className="mt-1">
            The salon would like to keep one random number in your browser, so she can see
            how many people reach the booking page and how many finish. No name, no email
            address, no IP address, and it goes when you close the tab.{' '}
            <Link
              to={routes.public.cookies}
              className="underline underline-offset-4 hover:text-foreground"
            >
              What we store
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          {/* Both `secondary`, deliberately. One click each, side by side, same
              size and same colour: refusing must not be a duller button beside
              a brand-coloured one, which is the exact styling the ICO calls a
              nudge. The brand colour stays on Book, where it belongs. */}
          <Button type="button" variant="secondary" size="lg" onClick={reject}>
            No thanks
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={accept}>
            Yes, that is fine
          </Button>
        </div>
      </div>
    </div>
  );
}
