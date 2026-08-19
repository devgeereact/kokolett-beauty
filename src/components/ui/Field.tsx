import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * Every control gets a real `<label>` wired by id, and errors are announced via
 * `aria-live` and linked with `aria-describedby` — never signalled by a red
 * border alone (docs/DESIGN.md §7).
 */

// Error is driven by `aria-invalid` (already wired through `Field`'s
// `controlProps`) rather than a separate style prop, so a field never
// signals its state by border colour alone without also carrying the
// ARIA/text pairing Field renders below (docs/DESIGN.md §7) — this is
// purely the visual half of that pairing.
const CONTROL = cn(
  // 8px radius — docs/DESIGN.md §5 ("Inputs: 8px"), same tier as Button.
  'w-full rounded-sm border border-border bg-input px-3 py-2.5 text-foreground',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
);

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /**
   * The render prop hands the control everything it needs to describe itself.
   *
   * `required` is passed down as `aria-required` because the asterisk beside the
   * label is `aria-hidden`, and it was the *only* signal: a screen-reader user
   * was never told a field was mandatory and found out at submit. `invalid`
   * comes with it so the control carries `aria-invalid` whenever the field is
   * rendering an error, rather than each caller remembering to.
   */
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    required: boolean;
    invalid: boolean;
    /** Spread onto the control to get all four at once. */
    controlProps: {
      id: string;
      'aria-describedby': string | undefined;
      'aria-required': true | undefined;
      'aria-invalid': true | undefined;
    };
  }) => ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldShellProps): JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        describedBy,
        required: Boolean(required),
        invalid: Boolean(error),
        controlProps: {
          id,
          'aria-describedby': describedBy,
          'aria-required': required ? true : undefined,
          'aria-invalid': error ? true : undefined,
        },
      })}

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-xs font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(CONTROL, className)} {...props} />
  ),
);
Input.displayName = 'Input';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(CONTROL, 'appearance-none pr-8', className)}
      {...props}
    />
  ),
);
Select.displayName = 'Select';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={3}
      className={cn(CONTROL, 'resize-y', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

/** Checkbox with its label, sized to the 44px touch target on mobile. */
export function Checkbox({
  label,
  className,
  ...props
}: InputProps & { label: string }): JSX.Element {
  const id = useId();
  return (
    <div className={cn('mb-4 flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
    </div>
  );
}
