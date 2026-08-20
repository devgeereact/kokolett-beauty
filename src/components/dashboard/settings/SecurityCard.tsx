import { type JSX, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Key, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * TOTP via Supabase Auth's native MFA API (`supabase.auth.mfa.*`) — a real
 * factor enrolled on the account, not a cosmetic toggle. "Login activity"
 * shows `user.last_sign_in_at`, the one session fact the client SDK actually
 * exposes; a full session list needs the admin API (service role), which has
 * no business being in a browser bundle.
 */
export function SecurityCard(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(false);

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

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">Security</h2>
          <p className="text-sm text-muted-foreground">Keep your account safe.</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        <button
          type="button"
          onClick={() => void navigate(routes.owner.profile)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
        >
          <Key
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Change password
            </span>
            <span className="block text-xs text-muted-foreground">
              Update your login password
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </button>

        <div className="flex items-center gap-3 px-2 py-2.5">
          <ShieldCheck
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Two-factor authentication
            </span>
            <span className="block text-xs text-muted-foreground">
              Add an extra layer of security
            </span>
          </span>
          <Switch
            checked={Boolean(factorId)}
            disabled={checking || busy}
            aria-label="Two-factor authentication"
            onChange={(next) => {
              if (next) void startEnroll();
              else void disable();
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowActivity((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
        >
          <UserRoundCheck
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Login activity
            </span>
            <span className="block text-xs text-muted-foreground">
              View recent sign-ins
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </button>
        {showActivity && (
          <p className="px-2 pb-2 pt-1 text-sm text-muted-foreground">
            {user?.last_sign_in_at
              ? `Last signed in ${formatDateTime(user.last_sign_in_at)}.`
              : 'No sign-in history available yet.'}
          </p>
        )}
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
    </Card>
  );
}
