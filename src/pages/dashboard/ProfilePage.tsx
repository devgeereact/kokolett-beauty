import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LoadingState } from '@/components/ui/States';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getProfile, updateProfile } from '@/services/profileService';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/password';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { reportError } from '@/lib/sentry';
import type { Profile } from '@/types';

/** Who's signed in, how the dashboard looks, and how to change the password. */
export function ProfilePage(): JSX.Element {
  const { user } = useSupabaseAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => {
        setProfile(p);
        setFullName(p?.full_name ?? '');
      })
      .catch((e: unknown) => reportError(e, { where: 'ProfilePage.getProfile' }));
  }, [user]);

  const saveName = async (): Promise<void> => {
    if (!user) return;
    setSavingName(true);
    setNameError(null);
    try {
      const updated = await updateProfile(user.id, {
        full_name: fullName.trim() || null,
      });
      setProfile(updated);
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 3000);
    } catch (e) {
      setNameError(errorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setPasswordError(problem);
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 3000);
    } catch (e) {
      setPasswordError(errorMessage(e));
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout title="Profile">
        <LoadingState />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Profile" subtitle="Your identity and how the dashboard looks">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Identity
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{user.email}</p>

          <Field label="Name" hint="Shown nowhere a customer sees. This is for you.">
            {({ id }) => (
              <Input
                id={id}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
          </Field>
          {nameError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {nameError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              loading={savingName}
              disabled={fullName === (profile?.full_name ?? '')}
              onClick={() => void saveName()}
            >
              Save name
            </Button>
            {nameSaved && (
              <span role="status" className="text-sm text-status-completed">
                Saved.
              </span>
            )}
          </div>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Appearance
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The dashboard follows your system by default. Pick light or dark to override
            it on this device.
          </p>
          <ThemeToggle />
        </Card>

        <Card className="h-fit p-5 lg:col-span-2">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Change password
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will remember
            beats a short jumble you will not.
          </p>

          <form onSubmit={(e) => void changePassword(e)} noValidate className="max-w-sm">
            <Field label="New password" required>
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Field label="Repeat it" required error={passwordError}>
              {({ controlProps }) => (
                <Input
                  {...controlProps}
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" loading={savingPassword}>
                Update password
              </Button>
              {passwordSaved && (
                <span role="status" className="text-sm text-status-completed">
                  Changed.
                </span>
              )}
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
