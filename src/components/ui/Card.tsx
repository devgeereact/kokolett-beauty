import { forwardRef, type HTMLAttributes, type JSX, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'subtle' | 'accent' | 'photo';

/**
 * How much room the card gives its content. A named role rather than a
 * `p-*` class at each call site, because "which number does this card use?"
 * was previously answered independently at 119 call sites and drifted into
 * four different answers for the same kind of card (docs/DESIGN.md §16.1).
 *
 * `none` is for a card that owns its own internal padding — a table, a
 * divided list, a chat panel with its own composer footer.
 */
export type CardPad = 'none' | 'record' | 'compact' | 'standard' | 'roomy';

const PADS: Record<CardPad, string> = {
  none: '',
  record: 'p-3',
  compact: 'p-4',
  standard: 'p-5',
  roomy: 'p-6',
};

const VARIANTS: Record<CardVariant, string> = {
  default: 'border border-border bg-card text-card-foreground shadow-card',
  subtle: 'border border-transparent bg-muted text-foreground',
  accent: 'border border-border bg-tint-brand text-foreground',
  /** Marketing-only image card — see `PhotoCard`, which composes this
      variant with the photo/scrim/content layers. */
  photo: 'relative overflow-hidden border border-border shadow-card',
};

/**
 * Surface container — see docs/DESIGN.md for the token system. `default`
 * carries the card elevation tier (`shadow-card`) plus the border; `subtle`
 * and `accent` are flat fills for a card that should read as a nested
 * region rather than a floating one.
 *
 * `pad` defaults to `none` so a card that genuinely lays out its own
 * interior (`PhotoCard`, a table frame, the assistant's chat panel) does not
 * have to opt out of a padding it never wanted.
 */
export const Card = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; pad?: CardPad }
>(({ className, variant = 'default', pad = 'none', ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-xl', VARIANTS[variant], PADS[pad], className)}
    {...props}
  />
));
Card.displayName = 'Card';

/**
 * Card title typography, as two named roles rather than a size picked per
 * card (docs/DESIGN.md §16.2):
 *
 * - `standard` (18px) — the card is the page's primary working surface, a
 *   multi-field form, or a dialog.
 * - `compact` (16px) — a dense overview, chart or support card.
 *
 * The heading LEVEL is a separate decision from the size and stays with the
 * caller via `as`: a compact card nested under an `<h2>` still needs an
 * `<h3>`, and it must not change size to say so.
 */
export type CardTitleSize = 'standard' | 'compact';

const TITLE_SIZES: Record<CardTitleSize, string> = {
  standard: 'text-lg',
  compact: 'text-base',
};

export function CardTitle({
  as: Tag = 'h2',
  size = 'standard',
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: CardTitleSize;
}): JSX.Element {
  return (
    <Tag
      className={cn(
        'font-serif font-semibold text-foreground',
        TITLE_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/**
 * The title / supporting-copy / trailing-action block that opens most cards.
 *
 * It exists for the spacing, not the markup. Written by hand, the gap under
 * the title was `mb-1`, the gap under the description `mb-3` or `mb-4`, and a
 * title with no description carried `mb-2.5`, `mb-3`, `mb-4` or nothing at
 * all depending on the file. One component means a row of cards agrees on
 * where its first line of content starts, which is what the eye actually
 * reads across a grid.
 *
 * `size` drives both the title size and the gap below the block, so a dense
 * overview card stays dense: `compact` closes at 12px, `standard` at 16px.
 */
export function CardHeading({
  title,
  description,
  actions,
  as,
  size = 'standard',
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing control — a "View all" link, a period switch, a menu. */
  actions?: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: CardTitleSize;
  className?: string;
  /** Set when something else needs to point at the title, e.g. `aria-labelledby`. */
  id?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        /* `gap-2`: 8px is the local control gap the rest of the system uses
           inside a row (docs/DESIGN.md §16.4), and the trailing action sits
           beside the title in columns as narrow as 200px. It does not always
           fit even at 8px — the assistant's "Quick actions" heading wraps to
           two lines beside its "New chat" link in a 200px column — and that
           is the intended outcome: the heading wraps, the action keeps its
           size, and neither is clipped (§16.11). */
        'flex items-start justify-between gap-2',
        size === 'compact' ? 'mb-3' : 'mb-4',
        className,
      )}
    >
      <div className="min-w-0">
        <CardTitle as={as} size={size} id={id}>
          {title}
        </CardTitle>
        {description !== undefined && description !== null && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The bordered header / body pair, for the one card shape that genuinely has
 * a divider: a card whose body is a list or table with its own edges, so the
 * title needs its own padded band above it. Most cards do not, and a divider
 * must not be pushed into them — `CardHeading` inside a padded `Card` is the
 * default composition.
 */
export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('border-b border-border px-5 py-4', className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
