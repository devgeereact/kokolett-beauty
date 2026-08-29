import { supabase } from '@/lib/supabase';
import type { AuditEvent } from '@/types';

export type { AuditEvent };

/**
 * Every audited action, newest first. Read-only — there is no write path
 * from the client for this table (migration 0052): writes only happen
 * inside `log_audit_event()`, called from a handful of owner RPCs.
 */
export async function listAuditEvents(): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
