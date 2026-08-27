import type { JSX } from 'react';
import { Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/**
 * Honest empty state: this is a single-owner instance with no subscription
 * billing (the Stripe/payment layer in `docs/planning` is for the Standard
 * Stack's *future* multi-tenant product, not something wired into this
 * salon's own dashboard). Showing a fake plan/invoice list here would be
 * exactly the kind of fabricated data this rebuild has avoided everywhere
 * else.
 */
export function BillingCard(): JSX.Element {
  return (
    <Card className="flex h-full flex-col p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">Billing</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Subscription and payment details.
      </p>
      <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
        <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Receipt aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-foreground">No billing information</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This dashboard is currently provided without a subscription or invoice to
          manage.
        </p>
      </div>
    </Card>
  );
}
