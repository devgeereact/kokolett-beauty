import { supabase } from '@/lib/supabase';
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
