import { type JSX, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';

/**
 * A link the owner is meant to paste somewhere else.
 *
 * Shown in full rather than behind a "copy" icon alone: these go into an
 * Instagram bio or a WhatsApp message, and the owner needs to be able to read
 * one back to a customer over the phone. Copy falls back to selecting the text
 * when the clipboard API is unavailable, which is what happens on an insecure
 * origin or an older mobile browser.
 */
export function ShareLink({
  icon: Icon,
  label,
  hint,
  url,
}: {
  icon?: LucideIcon;
  label: string;
  hint: string;
  url: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  // The Clipboard API path is the norm and gets a Toast; `window.prompt` is
  // kept only as the fallback for contexts where that API genuinely is not
  // available (an insecure origin, or an older mobile browser) — it is not a
  // confirmation, so it does not go through `ConfirmDialog`.
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast({ message: 'Link copied.' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div className="mb-4 flex gap-3">
      {Icon && (
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
          <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
          >
            {url}
          </a>
          <Button size="sm" variant="ghost" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-control-sm items-center justify-center rounded-sm bg-primary px-3 text-sm font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
