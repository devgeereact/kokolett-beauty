import { type JSX, useEffect, useState } from 'react';
import { Key, Link2, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/password';
import { getOwnLoginSlug, setOwnLoginSlug } from '@/services/ownerLoginService';
import { NavTile } from '@/components/dashboard/settings/BusinessSettingsNavCard';

/**
 * TOTP via Supabase Auth's native MFA API (`supabase.auth.mfa.*`) — a real
 * factor enrolled on the account, not a cosmetic toggle. "Login activity"
 * shows `user.last_sign_in_at`, the one session fact the client SDK actually
 * exposes; a full session list needs the admin API (service role), which has
 * no business being in a browser bundle.
 *
 * A section within `BusinessAndOwnerCard`, not its own `Card` — every tile
 * here opens a popup rather than editing inline, and the parent supplies the
 * surrounding border/padding.
 */
export function AccountSecuritySection(): JSX.Element {
  const { user } = useSupabaseAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const [slug, setSlug] = useState<string | null>(null);
  const [slugLoading, setSlugLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const refreshFactors = async (): Promise<void> => {
    setChecking(true);
    try {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) throw err;
      const verified = data?.totp.find((f) => f.status === 'verified');
      setFactorId(verified?.id ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refreshFactors();
  }, []);

  useEffect(() => {
    void (async () => {
      setSlugLoading(true);
      try {
        setSlug(await getOwnLoginSlug());
      } catch {
        // Swallowed deliberately, not surfaced as the shared `error` banner —
        // that banner covers the whole card, and a failed slug fetch (e.g.
        // migration 0051 not deployed yet) shouldn't read as "your 2FA/login
        // activity is broken" too. The row below just shows its own fallback.
        setSlug(null);
      } finally {
        setSlugLoading(false);
      }
    })();
  }, []);

  const startEditSlug = (): void => {
    setSlugDraft(slug ?? '');
    setSlugError(null);
    setEditingSlug(true);
  };

  const saveSlug = async (): Promise<void> => {
    setSlugSaving(true);
    setSlugError(null);
    try {
      const next = slugDraft.trim().toLowerCase();
      await setOwnLoginSlug(next);
      setSlug(next);
      setEditingSlug(false);
    } catch (e) {
      setSlugError(errorMessage(e));
    } finally {
      setSlugSaving(false);
    }
  };

  const startEnroll = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (err) throw err;
      setPendingFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setEnrolling(true);
    } catch (e) {
      // A real, specific Supabase Auth config gap, not an app bug: TOTP is
      // off at the project level (supabase/config.toml [auth.mfa.totp]).
      // Worth naming exactly rather than falling back to a generic message
      // an owner (or the next person debugging this) can't act on.
      const code = (e as { code?: string }).code;
      setError(
        code === 'mfa_totp_enroll_not_enabled'
          ? 'Two-factor authentication is not turned on for this project yet. Enable it in the Supabase Dashboard under Authentication → Sign-in methods → Multi-factor authentication, then try again.'
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyEnroll = async (): Promise<void> => {
    if (!pendingFactorId) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: code.trim(),
      });
      if (err) throw err;
      setEnrolling(false);
      setQrSvg(null);
      setPendingFactorId(null);
      setCode('');
      await refreshFactors();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (): Promise<void> => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
      if (err) throw err;
      setFactorId(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = (): void => {
    setEnrolling(false);
    setQrSvg(null);
    setPendingFactorId(null);
    setCode('');
    setError(null);
  };

  const startChangePassword = (): void => {
    setPassword('');
    setConfirmation('');
    setPasswordError(null);
    setChangingPassword(true);
  };

  const savePassword = async (): Promise<void> => {
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setPasswordError(problem);
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setChangingPassword(false);
    } catch (e) {
      setPasswordError(errorMessage(e));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Account &amp; Security
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Protect your account and manage sign-in access.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NavTile
          icon={Key}
          label="Change password"
          desc="Update your login password"
          onClick={startChangePassword}
        />
        <NavTile
          icon={ShieldCheck}
          label="Two-factor authentication"
          desc={
            checking
              ? 'Checking…'
              : factorId
                ? 'Enabled'
                : 'Add an extra layer of security'
          }
          onClick={() => {
            if (checking || busy) return;
            if (factorId) setConfirmingDisable(true);
            else void startEnroll();
          }}
        />
        <NavTile
          icon={Link2}
          label="Sign-in link"
          desc={slugLoading ? 'Loading…' : slug ? `/${slug}` : 'Not set up yet'}
          onClick={startEditSlug}
        />
        <NavTile
          icon={UserRoundCheck}
          label="Login activity"
          desc="View recent sign-ins"
          onClick={() => setActivityOpen(true)}
        />
      </div>

      {error && !enrolling && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Modal
        open={enrolling}
        onClose={cancelEnroll}
        ariaLabel="Set up two-factor authentication"
      >
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Set up two-factor authentication
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Scan this with an authenticator app (Google Authenticator, 1Password, Authy),
            then enter the 6-digit code it shows.
          </p>
          {/* Supabase-generated inline SVG QR code, not user input. */}
          {qrSvg && (
            <div
              className="mb-4 flex justify-center rounded-lg border border-border bg-card p-4"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
          <Field label="6-digit code">
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" loading={busy} onClick={() => void verifyEnroll()}>
              Verify and enable
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEnroll}>
              Cancel
            </Button>
          </div>
        </Card>
      </Modal>

      <ConfirmDialog
        open={confirmingDisable}
        title="Turn off two-factor authentication?"
        message="Your account will only need a password to sign in from then on."
        tone="destructive"
        confirmLabel="Turn off"
        onConfirm={() => {
          setConfirmingDisable(false);
          void disable();
        }}
        onCancel={() => setConfirmingDisable(false)}
      />

      <Modal
        open={editingSlug}
        onClose={() => setEditingSlug(false)}
        ariaLabel="Change your sign-in link"
      >
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Change your sign-in link
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This is the only way into your dashboard, and it isn&rsquo;t linked anywhere
            on the website. Changing it stops the old link from working immediately, so
            save the new one somewhere safe before you close this.
          </p>
          <Field
            label="Sign-in link"
            hint="Lowercase letters, numbers and hyphens, 8 to 40 characters. Longer is better: this is the only thing standing between a stranger and the sign-in form."
          >
            {({ id }) => (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">
                  {window.location.origin}/
                </span>
                <Input
                  id={id}
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value)}
                  placeholder="christy"
                />
              </div>
            )}
          </Field>
          {slugError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {slugError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" loading={slugSaving} onClick={() => void saveSlug()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      </Modal>

      <Modal
        open={changingPassword}
        onClose={() => setChangingPassword(false)}
        ariaLabel="Change password"
      >
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Change password
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will remember
            beats a short jumble you will not.
          </p>
          <Field label="New password">
            {({ id }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field label="Repeat it" className="mb-0">
            {({ id }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            )}
          </Field>
          {passwordError && (
            <p role="alert" className="mt-3 mb-3 text-sm font-medium text-destructive">
              {passwordError}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              loading={passwordSaving}
              onClick={() => void savePassword()}
            >
              Update password
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChangingPassword(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      </Modal>

      <Modal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        ariaLabel="Login activity"
      >
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
            Login activity
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {user?.last_sign_in_at
              ? `Last signed in ${formatDateTime(user.last_sign_in_at)}.`
              : 'No sign-in history available yet.'}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setActivityOpen(false)}>
            Close
          </Button>
        </Card>
      </Modal>
    </div>
  );
}
