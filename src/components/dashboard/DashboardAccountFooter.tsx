import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

interface DashboardAccountFooterProps {
  rail: boolean;
  ownerName: string | null;
  userEmail: string | null | undefined;
  onNavigate: () => void;
  onSignOut: () => void;
}

/**
 * The signed-in address and the way out.
 *
 * Rendered in the mobile drawer as well as the desktop sidebar. It used to
 * live only inside the `hidden md:flex` sidebar, so below that breakpoint —
 * which includes a phone — there was no way to sign out at all.
 *
 * Profile (avatar, name, business address/phone/email, theme) and the
 * public-site link all live one click away on Settings/Profile now — the
 * full-width rendering stays a single "Sign out" button, pinned below the
 * scrollable nav list rather than growing with it.
 */
export function DashboardAccountFooter({
  rail,
  ownerName,
  userEmail,
  onNavigate,
  onSignOut,
}: DashboardAccountFooterProps): JSX.Element {
  if (!rail) {
    return (
      <Button variant="ghost" size="sm" className="w-full" onClick={onSignOut}>
        Sign out
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 px-1">
      <Link
        to={routes.owner.profile}
        onClick={onNavigate}
        title={ownerName ?? userEmail ?? 'Owner'}
      >
        <Avatar name={ownerName ?? userEmail ?? '?'} size="sm" />
      </Link>
      <button
        type="button"
        title="Sign out"
        onClick={onSignOut}
        className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4 rotate-180" strokeWidth={2} />
      </button>
    </div>
  );
}
