import { forwardRef, type HTMLAttributes, type JSX } from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'subtle' | 'accent' | 'photo';

const VARIANTS: Record<CardVariant, string> = {
  default: 'border border-border bg-card text-card-foreground shadow-card',
  subtle: 'border border-transparent bg-muted text-foreground',
  accent: 'border border-border bg-tint-brand text-foreground',
  /** Marketing-only image card — see `PhotoCard`, which composes this
      variant with the photo/scrim/content layers. */
  photo: 'relative overflow-hidden border border-border shadow-card',
};

/**
 * Surface container — docs/design/new-design-guideline.png §09. `default`
 * carries the card elevation tier (`shadow-card`) plus the border; `subtle`
 * and `accent` are flat fills for a card that should read as a nested
 * region rather than a floating one.
 */
export const Card = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }
>(({ className, variant = 'default', ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl', VARIANTS[variant], className)} {...props} />
));
Card.displayName = 'Card';

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('border-b border-border px-5 py-4', className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return <h2 className={cn('font-serif text-lg font-semibold', className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
