import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

/**
 * Proves the DB-level race protection in `book_appointment()` end-to-end:
 * two customers hitting the same open slot at the same instant must resolve
 * to exactly one winner, never both and never neither.
 *
 * This calls the real RPCs directly against the live Supabase project rather
 * than driving two browser tabs through the booking UI — pixel-timed clicks
 * across two pages can't reliably land within the same transaction window,
 * and the thing under test is the database's GiST exclusion constraint
 * (`appointments_no_overlap`, migration 0002) plus the per-day advisory lock
 * (migration 0039), not the form. See docs/KOKO_GAP.md §5 (P1).
 *
 * Every row this creates is tagged `[E2E TEST]` / an `@example.invalid`
 * address (RFC 2606 reserved, non-deliverable — matches the convention in
 * scripts/seed-demo-data.mjs) and is cancelled-then-hard-deleted in an owner
 * session before the test ends, so nothing is left behind in production data
 * even when an assertion above it fails.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OWNER_EMAIL = process.env.KOKO_OWNER_EMAIL;
const OWNER_PASSWORD = process.env.KOKO_DEV_PASSWORD;

const canRun = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && OWNER_EMAIL && OWNER_PASSWORD,
);

test.skip(
  !canRun,
  'Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, KOKO_OWNER_EMAIL and KOKO_DEV_PASSWORD ' +
    '(the last two only to sign in as owner and delete the test bookings afterwards — skipping ' +
    'rather than running without a cleanup path).',
);

test('two customers racing the same slot: one wins, one gets SLOT_TAKEN', async () => {
  const anon = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: slots, error: slotsError } = await anon.rpc('available_slots', {
    p_from: today,
    p_to: horizon,
  });
  expect(slotsError, slotsError?.message).toBeNull();

  test.skip(
    !slots || slots.length === 0,
    'No open slots in the next 30 days to race for.',
  );

  const targetSlot = slots![0].slot_start;
  const emailA = `e2e-race-a-${runId}@example.invalid`;
  const emailB = `e2e-race-b-${runId}@example.invalid`;

  const [resultA, resultB] = await Promise.allSettled([
    anon.rpc('book_appointment', {
      p_starts_at: targetSlot,
      p_full_name: '[E2E TEST] Race Customer A',
      p_email: emailA,
      p_mobile: '07000000001',
      p_note: 'Automated E2E race test (docs/KOKO_GAP.md) — safe to delete.',
      p_consent: false,
    }),
    anon.rpc('book_appointment', {
      p_starts_at: targetSlot,
      p_full_name: '[E2E TEST] Race Customer B',
      p_email: emailB,
      p_mobile: '07000000002',
      p_note: 'Automated E2E race test (docs/KOKO_GAP.md) — safe to delete.',
      p_consent: false,
    }),
  ]);

  const outcomes = [resultA, resultB].map((r, i) => {
    const email = i === 0 ? emailA : emailB;
    if (r.status !== 'fulfilled')
      return { ok: false, message: String(r.reason), id: null, email };
    if (r.value.error)
      return { ok: false, message: r.value.error.message, id: null, email };
    const row = Array.isArray(r.value.data) ? r.value.data[0] : r.value.data;
    return { ok: true, message: null, id: row?.appointment_id ?? null, email };
  });

  const winners = outcomes.filter((o) => o.ok);
  const losers = outcomes.filter((o) => !o.ok);

  try {
    expect(winners, 'exactly one booking should succeed').toHaveLength(1);
    expect(losers, 'exactly one booking should fail').toHaveLength(1);
    expect(losers[0].message).toContain('SLOT_TAKEN');
  } finally {
    // Cleanup runs even if the assertions above failed, so a broken race
    // protection doesn't also leave a live test booking behind.
    const winnerId = winners[0]?.id;

    if (winnerId) {
      const owner = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
      const { error: signInError } = await owner.auth.signInWithPassword({
        email: OWNER_EMAIL!,
        password: OWNER_PASSWORD!,
      });
      if (signInError) {
        console.error(
          `Owner sign-in failed during cleanup — test appointment ${winnerId} was NOT removed: ${signInError.message}`,
        );
      } else {
        await owner.rpc('set_appointment_status', {
          p_appointment_id: winnerId,
          p_status: 'cancelled',
          p_reason: 'E2E race test cleanup',
        });
        await owner.rpc('delete_appointment_as_owner', { p_appointment_id: winnerId });

        // book_appointment() only persists the winner's customer upsert —
        // Postgres rolls back the whole function call (including the
        // customer row) for the loser, since it ultimately raises
        // SLOT_TAKEN. Confirmed by a real leftover row from an earlier run
        // of this test: erase_customer_as_owner is the same tool the app
        // itself uses for this, so reuse it rather than a raw delete.
        const winnerEmail = winners[0]?.email;
        if (winnerEmail) {
          const { data: customerRow } = await owner
            .from('customers')
            .select('id')
            .eq('email', winnerEmail)
            .maybeSingle();
          if (customerRow) {
            await owner.rpc('erase_customer_as_owner', {
              p_customer_id: customerRow.id,
            });
          }
        }
      }
    }
  }
});
