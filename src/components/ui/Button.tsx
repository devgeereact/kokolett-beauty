import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Hover uses `brightness`, not an opacity modifier. The palette resolves to
 * `var(--token)` values (docs/DESIGN.md §8), and Tailwind cannot compute
 * `bg-primary/90` against a var — the class silently produces nothing.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-110',
  secondary: 'bg-secondary text-secondary-foreground hover:brightness-95',
  ghost: 'bg-transparent text-foreground border border-border hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
};

// Control heights (docs/DESIGN.md §10): sm/md sit below the 44px touch
// minimum by design — dense owner tables on a pointer device, never the
// customer booking path. `lg` is the one size that meets it.
const SIZES: Record<Size, string> = {
  sm: 'h-control-sm px-3 text-sm',
  md: 'h-control px-5 text-base',
  lg: 'h-control-lg px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-semibold',
        'transition-[filter,background-color,transform] duration-150 ease-out active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
