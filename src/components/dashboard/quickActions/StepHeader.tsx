import type { JSX } from 'react';
import { Button } from '@/components/ui/Button';

/** Shared header for the three search steps: a way back without losing the
 * "onClose fully closes" contract the two booking steps use instead. */
export function StepHeader({
  title,
  description,
  onBack,
  onClose,
}: {
  title: string;
  description: string;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to quick actions
        </button>
        <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
