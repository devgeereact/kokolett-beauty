import { useState } from 'react';
import { Button } from '@/components/ui/Button';

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
  label,
  hint,
  url,
}: {
  label: string;
  hint: string;
  url: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground">
          {url}
        </code>
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open
        </a>
      </div>
    </div>
  );
}
