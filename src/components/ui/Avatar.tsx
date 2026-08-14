import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

// Every avatar in the reference is a rounded-square photo tile — none are
// circular, at any size.
const SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-14 w-14 rounded-xl',
} as const;

const ICON_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
} as const;

/** Chart tokens give five tinted grounds — reused here purely for visual variety, not data meaning. */
const TILES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

/** Same customer always lands on the same tile colour. */
function tileIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % TILES.length;
  return hash;
}

/**
 * No customer photo exists anywhere in the schema — ImageKit stores service
 * media, not client portraits. This renders a stock-style placeholder tile
 * (silhouette on a tinted ground), matching the reference designs' photo
 * avatars without fabricating anyone's likeness.
 */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}): JSX.Element {
  const cleaned = name.replace(/^\[[^\]]*\]\s*/, '').trim() || '?';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden text-white',
        SIZES[size],
        TILES[tileIndex(cleaned)],
        className,
      )}
    >
      <UserRound aria-hidden="true" className={ICON_SIZES[size]} strokeWidth={2} />
    </span>
  );
}
