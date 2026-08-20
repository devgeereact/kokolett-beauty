import type { JSX } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

/**
 * One button, light and dark.
 *
 * The starting point is the operating system, so a phone that goes dark in the
 * evening takes the dashboard with it. Pressing this pins the opposite of
 * whatever is currently on screen; the small "Auto" control beside it hands
 * control back to the system.
 *
 * The label always names what pressing it will do, not what is on screen. A
 * button that reads "Dark" while the screen is dark is a coin toss.
 */
export function ThemeToggle({ className }: { className?: string }): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => setTheme(next)}
        title={`Switch to ${next} mode`}
        aria-label={`Switch to ${next} mode`}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {resolvedTheme === 'dark' ? (
          // Sun: pressing it goes to light.
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
            </g>
          </svg>
        ) : (
          // Moon: pressing it goes to dark.
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20.7 14.6A8.5 8.5 0 019.4 3.3a8.5 8.5 0 1011.3 11.3z"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        title="Follow the system theme"
        className={cn(
          'h-9 rounded-lg px-2 text-xs font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          theme === 'system'
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={theme === 'system'}
      >
        Auto
      </button>
    </div>
  );
}
