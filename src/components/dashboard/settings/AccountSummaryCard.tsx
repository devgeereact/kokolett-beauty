import { type JSX, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Mail, Pencil, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getProfile } from '@/services/profileService';
import { formatDateLong } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { Profile } from '@/types';

/** Read-only summary of the signed-in owner — editing happens on the existing ProfilePage. */
export function AccountSummaryCard(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { settings } = useBusinessSettings();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">Account</h2>
          <p className="text-sm text-muted-foreground">Your profile and login details.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate(routes.owner.profile)}
        >
          <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Edit profile
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={profile?.full_name ?? user?.email ?? '?'} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-semibold text-foreground">
            {profile?.full_name ?? 'Owner'}
          </p>
          <p className="text-sm text-primary">Owner</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        {user?.email && (
          <div className="flex items-center gap-2">
            <Mail
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <dd className="truncate text-foreground">{user.email}</dd>
          </div>
        )}
        {settings?.phone && (
          <div className="flex items-center gap-2">
            <Phone
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <dd className="text-foreground">{settings.phone}</dd>
          </div>
        )}
        {user?.created_at && (
          <div className="flex items-center gap-2">
            <Calendar
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <dd className="text-foreground">
              Member since {formatDateLong(user.created_at)}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
