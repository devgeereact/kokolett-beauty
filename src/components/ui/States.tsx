import type { JSX, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * Loading, empty and error states.
 *
 * Every screen specifies all three (docs/PRD.md). They live together here so a
 * new page cannot quietly ship with only the happy path.
 */

export function Spinner({ className }: { className?: string }): JSX.Element {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary',
        className,
      )}
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-14 text-center">
      <p className="font-serif text-lg font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error | string;
  onRetry?: () => void;
}): JSX.Element {
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-10 text-center"
    >
      <p className="font-serif text-lg font-semibold text-foreground">
        That didn&rsquo;t load
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
