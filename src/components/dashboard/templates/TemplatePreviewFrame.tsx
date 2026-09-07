import { type JSX, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { EmailPreview } from '@/services/emailService';
import { cn } from '@/lib/utils';

type Viewport = 'desktop' | 'mobile';

const VIEWPORTS: { key: Viewport; label: string; icon: typeof Monitor }[] = [
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
];

/**
 * Renders the exact HTML a customer receives — via the `render-email-preview`
 * Edge Function, which shares `_shared/templates.ts` with `send-emails` — in
 * a sandboxed iframe, with a desktop/mobile viewport toggle. The email markup
 * is table-based with inline styles, so it renders sensibly at either width
 * with no further adjustment.
 */
export function TemplatePreviewFrame({
  preview,
  loading,
  error,
}: {
  preview: EmailPreview | null;
  loading: boolean;
  error: string | null;
}): JSX.Element {
  const [viewport, setViewport] = useState<Viewport>('desktop');

  if (loading) {
    return <p className="text-sm text-muted-foreground">Rendering…</p>;
  }

  if (error) {
    return <p className="text-sm text-status-no-show">{error}</p>;
  }

  if (!preview || !preview.available) {
    return (
      <p className="text-sm text-muted-foreground">
        {preview?.reason ??
          'This message was sent before the outbox started keeping its contents, so there is nothing left to render.'}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 rounded-lg bg-muted p-1">
        {VIEWPORTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setViewport(v.key)}
            aria-pressed={viewport === v.key}
            /* `shadow-card`, not `shadow-sm`: the boxShadow scale is closed
               (none, card, popover, modal) and `shadow-sm` emitted nothing,
               so the selected segment had no lift at all. */
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewport === v.key
                ? 'bg-card text-brand-ink shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <v.icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {v.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'overflow-x-auto',
          viewport === 'mobile' && 'flex justify-center bg-muted p-4',
        )}
      >
        <iframe
          title="Email preview"
          srcDoc={preview.html}
          sandbox=""
          className={cn(
            'h-[480px] rounded-lg border border-border bg-card',
            viewport === 'mobile' ? 'w-[375px] shrink-0' : 'w-full',
          )}
        />
      </div>
    </div>
  );
}
