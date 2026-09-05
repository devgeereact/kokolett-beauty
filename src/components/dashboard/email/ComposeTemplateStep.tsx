import { type JSX, useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import type { TemplateUsage } from '@/services/emailService';
import { TEMPLATE_CATALOG } from '@/lib/templateCatalog';
import { cn } from '@/lib/utils';
import { CardTitle } from '@/components/ui/Card';
import { toolbarControl } from '@/components/ui/controlClasses';

/**
 * Compose step 1 — pick a starting point. Lists the same fixed template
 * catalogue `TemplatesPage` shows (this app has no separate "marketing
 * template" concept, just the eighteen transactional ones), so a one-off
 * message can borrow an existing template's wording rather than starting
 * from nothing. "Start with a blank message" skips this entirely.
 */
export function ComposeTemplateStep({
  usage,
  usageError,
  onSelect,
  onClose,
}: {
  usage: Map<string, TemplateUsage> | null;
  usageError: string | null;
  onSelect: (key: string | null) => void;
  onClose: () => void;
}): JSX.Element {
  const [search, setSearch] = useState('');

  // Auth-token and owner-internal templates (magic links, password resets,
  // owner-only booking notifications) never belong in a message to an
  // arbitrary recipient — excluded here regardless of search.
  const composable = useMemo(
    () => TEMPLATE_CATALOG.filter((t) => t.composable !== false),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return composable;
    return composable.filter(
      (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [composable, search]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <CardTitle>Compose</CardTitle>
          <p className="text-sm text-muted-foreground">
            Start from a template, or write from scratch.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'mb-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
          <PenLine aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground">
            Start with a blank message
          </span>
          <span className="block text-xs text-muted-foreground">
            Write the subject and body yourself.
          </span>
        </span>
      </button>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        className={cn(toolbarControl, 'mb-3 w-full')}
      />

      {usageError && (
        <p className="mb-3 text-sm text-status-no-show">
          Couldn&rsquo;t load template usage. You can still pick one. {usageError}
        </p>
      )}

      {!usage && !usageError ? (
        <LoadingState label="Loading templates…" />
      ) : (
        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
          {filtered.map((t) => {
            const u = usage?.get(t.key);
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => onSelect(t.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors',
                    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
                    <t.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {t.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u
                        ? `Used ${u.count} time${u.count === 1 ? '' : 's'}`
                        : 'Not sent yet'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
