import { useEffect, useRef, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/types';

interface UseRealtimeAppointments {
  connected: boolean;
  lastEventAt: Date | null;
}

type ChangeKind = 'insert' | 'update' | 'delete';

/**
 * Supabase Realtime on `appointments`, so a booking taken while the owner is
 * looking at the calendar appears without a refresh.
 *
 * The callback is held in a ref rather than listed as an effect dependency:
 * callers pass an inline arrow, and depending on it would tear down and rebuild
 * the websocket subscription on every render.
 *
 * Note this subscribes to the base table, not `appointments_detailed` — Postgres
 * change streams come from replication, and views do not replicate. The payload
 * is therefore un-joined, and consumers refetch to get customer and service names.
 */
export function useRealtimeAppointments(
  onChange: (appointment: Appointment, kind: ChangeKind) => void,
): UseRealtimeAppointments {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          const kind = payload.eventType.toLowerCase() as ChangeKind;
          const row = (kind === 'delete' ? payload.old : payload.new) as Appointment;
          setLastEventAt(new Date());
          handler.current(row, kind);
        },
      )
      .subscribe((status) => {
        setConnected(status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { connected, lastEventAt };
}
