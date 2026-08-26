import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Fires `onChange` whenever a row in `table` changes, so a page a visitor
 * already has open reflects what the owner just published in the dashboard
 * without a reload — same `postgres_changes` pattern as the owner's live
 * calendar (`useRealtimeAppointments`), just without needing the row payload:
 * every caller here reads through an existing RLS-scoped list endpoint, so
 * the simplest correct thing on any change is "go fetch that list again".
 *
 * `weekly_template` and `availability_slots` both already carry a public
 * `SELECT` policy (`docs/SCHEMA.md` §3), so an anonymous visitor's
 * subscription authorises the same way their initial fetch did.
 */
export function useRealtimeTable(table: string, onChange: () => void): void {
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`public-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        handler.current();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table]);
}
