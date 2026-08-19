import { CreditCard } from 'lucide-react';
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
    <Card className="max-w-xl p-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
          <CreditCard aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Subscription and payment details.
          </p>
        </div>
      </div>
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        This dashboard is your own — there's no subscription or invoice to manage. Nothing
        to show here.
      </p>
    </Card>
  );
}
