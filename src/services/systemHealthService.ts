import { invokeFunction, supabase } from '@/lib/supabase';
import type { SystemHealth } from '@/types';

/**
 * Reads pg_cron's own run history plus the existing email/reviews staleness
 * signals — one RPC rather than several counts, mirroring
 * `owner_dashboard_summary()`. `system_health_summary()` is security definer
 * with an explicit `is_owner()` guard inside it.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const { data, error } = await supabase.rpc('system_health_summary');
  if (error) throw error;
  return data as unknown as SystemHealth;
}

export interface EmailAuthCheck {
  present: boolean;
}
export interface SpfCheck extends EmailAuthCheck {
  record: string | null;
}
export interface DmarcCheck extends EmailAuthCheck {
  policy: string | null;
  record: string | null;
}
export interface DkimCheck extends EmailAuthCheck {
  selector: string;
}
export interface EmailDiagnostics {
  domain: string;
  checkedAt: string;
  spf: SpfCheck;
  dmarc: DmarcCheck;
  dkim: DkimCheck;
}

/**
 * Live SPF/DKIM/DMARC status via the `email-diagnostics` Edge Function —
 * public DNS TXT lookups, no credentials, owner-gated. KOKO_GAP.md P3: the
 * owner previously had no way to self-diagnose a delivery problem short of
 * someone running `dig` on a terminal she doesn't have.
 */
export async function getEmailDiagnostics(): Promise<EmailDiagnostics> {
  return invokeFunction<EmailDiagnostics>('email-diagnostics', {});
}
