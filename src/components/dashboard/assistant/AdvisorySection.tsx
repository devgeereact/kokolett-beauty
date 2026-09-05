import { type JSX, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

/**
 * A collapsed-by-default home for one of the eight advisory modules that
 * used to live on their own "Advisory tools" tab (`docs/design/ai.png` has
 * no such tab — the AI Assistant screen is chat-only). Each module is real,
 * already-working analysis, so it moved to the page it's actually about
 * rather than being deleted; collapsed by default so it doesn't compete
 * with that page's own pixel-matched layout.
 */
export function AdvisorySection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Card pad="standard" className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
            <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <CardTitle size="compact">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>
      {open && <div className="mt-4 border-t border-border pt-4">{children}</div>}
    </Card>
  );
}
