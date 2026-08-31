import type { JSX, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * KOKO_GAP.md P3: the underline tab bar — active tab gets a coloured
 * bottom border, the rest sit muted — was hand-rolled independently in
 * `CustomerDetailPanel.tsx` and `TemplateEditorPage.tsx`, identical markup
 * copied rather than shared. One generic component, keyed by whatever
 * string/union type the caller already uses for its own tab state.
 */
export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex gap-1 border-b border-border', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium',
            active === t.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
