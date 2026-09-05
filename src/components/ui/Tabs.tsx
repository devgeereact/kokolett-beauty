import { useId, useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * KOKO_GAP.md P3: the underline tab bar — active tab gets a coloured
 * bottom border, the rest sit muted — was hand-rolled independently in
 * `CustomerDetailPanel.tsx` and `TemplateEditorPage.tsx`, identical markup
 * copied rather than shared. One generic component, keyed by whatever
 * string/union type the caller already uses for its own tab state.
 *
 * The ARIA contract is now actually implemented (2026-09-05). It carried
 * `role="tablist"`/`role="tab"` with none of what those roles promise: every
 * tab was in the Tab order, arrow keys did nothing, and no tab pointed at a
 * panel. A screen-reader user was told "tab 2 of 4" and then found the
 * keyboard behaved like a row of buttons. What is here now is the standard
 * pattern:
 *
 *  - **Roving tab stop.** Only the selected tab is tabbable, so Tab moves
 *    past the whole bar into the panel rather than through every tab.
 *  - **Arrow / Home / End** move between tabs, wrapping at the ends.
 *  - **Automatic activation** — moving focus selects. Correct here because
 *    every consumer switches between data it has already fetched; a tab that
 *    triggers a load would want manual activation (Enter/Space) instead, and
 *    would need this component to grow an option rather than to be copied.
 *  - **`aria-controls`** pointing at the panel, which `TabPanel` renders with
 *    the matching id.
 */
export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
}

/** Shared id shape, so a tab and its panel agree without either being told. */
function tabId(base: string, key: string): string {
  return `${base}-tab-${key}`;
}

function panelId(base: string, key: string): string {
  return `${base}-panel-${key}`;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  /** Names the group for assistive tech — "Customer details", "Preview". */
  label,
  /**
   * Ties tabs to panels. Pass the same value to `TabPanel`; omit it and the
   * tabs simply carry no `aria-controls`, which is the honest thing to do
   * when the caller renders no panel element.
   */
  idBase,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
  label?: string;
  idBase?: string;
}): JSX.Element {
  const generatedBase = useId();
  const base = idBase ?? generatedBase;
  const listRef = useRef<HTMLDivElement>(null);

  const move = (delta: number): void => {
    const index = tabs.findIndex((t) => t.key === active);
    if (index === -1) return;
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.key);
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(tabId(base, next.key))}`)
      ?.focus();
  };

  const jump = (to: 'first' | 'last'): void => {
    const next = to === 'first' ? tabs[0] : tabs[tabs.length - 1];
    if (!next) return;
    onChange(next.key);
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(tabId(base, next.key))}`)
      ?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        jump('first');
        break;
      case 'End':
        e.preventDefault();
        jump('last');
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex gap-1 border-b border-border', className)}
    >
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <button
            key={t.key}
            id={tabId(base, t.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={idBase ? panelId(base, t.key) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex min-h-touch items-center border-b-2 px-3 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'border-primary text-brand-ink'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The panel half of the pair. Focusable (`tabIndex={0}`) so that Tab out of
 * the tab bar lands on the content it just selected, which is what makes the
 * roving tab stop above worth having.
 */
export function TabPanel({
  idBase,
  tabKey,
  className,
  children,
}: {
  idBase: string;
  tabKey: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      role="tabpanel"
      id={panelId(idBase, tabKey)}
      aria-labelledby={`${idBase}-tab-${tabKey}`}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}
