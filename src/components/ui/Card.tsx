import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Surface container. One shadow only — depth comes from the card/ground
 * contrast rather than stacked shadows (docs/DESIGN.md §5).
 */
export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-card',
        className,
      )}
      {...props}
    />
  );
}

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
  return (
    <h2 className={cn('font-display text-lg font-semibold', className)} {...props} />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
