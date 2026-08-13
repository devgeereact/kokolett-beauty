#!/usr/bin/env node
/**
 * Seeds visually-representative demo content into the live Supabase project
 * for local UI testing. Everything it creates is tagged so it can be found
 * and removed later:
 *   - names are prefixed "[DEMO] "
 *   - emails are on the RFC 2606 reserved, non-deliverable `example.invalid`
 *     domain, so any transactional email attempt simply fails to send
 *
 * Run: node --env-file=.env scripts/seed-demo-data.mjs
 * Requires KOKO_OWNER_EMAIL and KOKO_DEV_PASSWORD in the environment (an
 * owner-role account's login).
 *
 * Cleanup: appointments and availability_requests have no client-side
 * delete path (owner RLS grants status transitions, not DELETE — booking
 * history is intentionally append-only from the app's perspective).
 * Subscribers do allow owner delete. So:
 *   - `node --env-file=.env scripts/cleanup-demo-subscribers.mjs` removes
 *     the demo subscriber rows.
 *   - Everything else needs direct DB access. Run against the live DB in a
 *     transaction you can roll back if anything looks wrong, then commit:
 *
 *   begin;
 *   delete from public.availability_requests where email ilike '%@example.invalid';
 *   delete from public.appointments where customer_id in
 *     (select id from public.customers where email ilike '%@example.invalid');
 *   delete from public.customers where email ilike '%@example.invalid';
 *   commit;
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DEV_EMAIL = process.env.KOKO_OWNER_EMAIL;
const DEV_PASSWORD = process.env.KOKO_DEV_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (run with --env-file=.env)');
  process.exit(1);
}
if (!DEV_EMAIL || !DEV_PASSWORD) {
  console.error('Missing KOKO_OWNER_EMAIL / KOKO_DEV_PASSWORD in environment');
  process.exit(1);
}

const owner = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { error: authError } = await owner.auth.signInWithPassword({
  email: DEV_EMAIL,
  password: DEV_PASSWORD,
});
if (authError) {
  console.error('Owner sign-in failed:', authError.message);
  process.exit(1);
}

const manifest = { appointments: [], requests: [], subscribers: [] };
const fail = [];

function at(daysFromToday, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function bookOwner(label, { startsAt, fullName, email, mobile, note, durationMin }) {
  const { data, error } = await owner.rpc('create_appointment_as_owner', {
    p_starts_at: startsAt.toISOString(),
    p_full_name: fullName,
    p_email: email,
    p_mobile: mobile,
    p_note: note,
    p_duration_min: durationMin ?? null,
  });
  if (error) {
    fail.push(`${label}: ${error.message}`);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  manifest.appointments.push({ label, reference: row.reference, id: row.appointment_id });
  return row.appointment_id;
}

async function transition(label, id, status, reason) {
  if (!id) return;
  const { error } = await owner.rpc('set_appointment_status', {
    p_appointment_id: id,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) fail.push(`${label} -> ${status}: ${error.message}`);
}

// --- Today: a spread across the day, covering every live status ---
const todayCheckedIn = await bookOwner('today/checked-in', {
  startsAt: at(0, 9, 0),
  fullName: '[DEMO] Amara Bello',
  email: 'demo.amara@example.invalid',
  mobile: '07700 900111',
  note: 'Retouch and restyle.',
});
await transition('today/checked-in', todayCheckedIn, 'checked_in');

const todayInService = await bookOwner('today/in-service', {
  startsAt: at(0, 10, 30),
  fullName: '[DEMO] Priya Nandakumar',
  email: 'demo.priya@example.invalid',
  mobile: '07700 900112',
  note: 'Knotless braids, full head.',
  durationMin: 240,
});
await transition('today/in-service', todayInService, 'checked_in');
await transition('today/in-service', todayInService, 'in_service');

await bookOwner('today/confirmed-2', {
  startsAt: at(0, 16, 30),
  fullName: '[DEMO] Tola Adeyemi',
  email: 'demo.tola@example.invalid',
  mobile: '07700 900115',
});

// Real bookings already occupy parts of "today", and the in-service demo
// above blocks a 240min+buffer window from 10:30 — no_show/cancelled/
// completed don't need to be dated today, so each gets its own day to
// avoid SLOT_TAKEN entirely rather than guessing at a free gap.
const historyCompleted2 = await bookOwner('history/completed-2', {
  startsAt: at(-1, 10, 0),
  fullName: '[DEMO] Grace Okafor',
  email: 'demo.grace@example.invalid',
  mobile: '07700 900113',
  note: 'Wash and blow-dry.',
  durationMin: 60,
});
await transition('history/completed-2', historyCompleted2, 'completed');

await bookOwner('future/confirmed', {
  startsAt: at(1, 10, 0),
  fullName: '[DEMO] Sade Williams',
  email: 'demo.sade@example.invalid',
  mobile: '07700 900114',
  note: 'Silk press.',
});

const historyNoShow = await bookOwner('history/no-show', {
  startsAt: at(-2, 10, 0),
  fullName: '[DEMO] Funmi Ade',
  email: 'demo.funmi@example.invalid',
  mobile: '07700 900116',
});
await transition('history/no-show', historyNoShow, 'no_show');

const historyCancelled = await bookOwner('history/cancelled', {
  startsAt: at(-3, 10, 0),
  fullName: '[DEMO] Ngozi Eze',
  email: 'demo.ngozi@example.invalid',
  mobile: '07700 900117',
});
await transition('history/cancelled', historyCancelled, 'cancelled', 'Customer rang to cancel.');

// --- A returning customer: one completed visit in the past, one upcoming ---
const pastVisit = await bookOwner('history/past-completed', {
  startsAt: at(-14, 10, 0),
  fullName: '[DEMO] Bianca Chukwu',
  email: 'demo.bianca@example.invalid',
  mobile: '07700 900118',
  note: 'First visit — colour consultation.',
});
await transition('history/past-completed', pastVisit, 'completed');

const returningId = await bookOwner('history/returning-upcoming', {
  startsAt: at(3, 11, 0),
  fullName: '[DEMO] Bianca Chukwu',
  email: 'demo.bianca@example.invalid',
  mobile: '07700 900118',
  note: 'Follow-up colour touch-up.',
});
if (returningId) {
  const { error } = await owner
    .from('appointments')
    .update({
      owner_note: '[DEMO] Uses a warm copper tone. Allergic to ammonia-based dye, use ammonia-free.',
    })
    .eq('id', returningId);
  if (error) fail.push(`owner note: ${error.message}`);
}

// --- A few days out, for Calendar/Bookings variety ---
await bookOwner('future/day-2', {
  startsAt: at(2, 9, 30),
  fullName: '[DEMO] Kemi Alabi',
  email: 'demo.kemi@example.invalid',
  mobile: '07700 900119',
});
await bookOwner('future/day-5', {
  startsAt: at(5, 15, 0),
  fullName: '[DEMO] Ijeoma Nwosu',
  email: 'demo.ijeoma@example.invalid',
  mobile: '07700 900120',
  note: 'Locs retwist.',
  durationMin: 180,
});

// --- Requests queue (anon insert, mirrors the public "no availability" form) ---
async function submitRequest(label, input) {
  const { error } = await anon.from('availability_requests').insert({
    full_name: input.fullName,
    email: input.email,
    mobile: input.mobile,
    preferred_dates: input.preferredDates,
    preferred_times: input.preferredTimes,
    flexibility: input.flexibility,
    notes: input.notes,
    status: 'new',
  });
  if (error) {
    fail.push(`${label}: ${error.message}`);
    return;
  }
  manifest.requests.push(label);
}

const inTenDays = at(10, 0, 0).toISOString().slice(0, 10);
const inTwelveDays = at(12, 0, 0).toISOString().slice(0, 10);
await submitRequest('request-1', {
  fullName: '[DEMO] Adaeze Okonkwo',
  email: 'demo.adaeze@example.invalid',
  mobile: '07700 900121',
  preferredDates: [inTenDays, inTwelveDays],
  preferredTimes: 'Afternoons',
  flexibility: 'afternoon',
  notes: '[DEMO] First-time, wants a consultation before colour.',
});

const inThreeWeeks = at(21, 0, 0).toISOString().slice(0, 10);
await submitRequest('request-2', {
  fullName: '[DEMO] Yetunde Bakare',
  email: 'demo.yetunde@example.invalid',
  mobile: '07700 900122',
  preferredDates: [inThreeWeeks],
  preferredTimes: 'Any time',
  flexibility: 'any',
  notes: '[DEMO] Flexible on date, wants a full day booked for braids.',
});

// --- Subscribers, for Growth ---
async function subscribe(label, email, fullName) {
  const { error } = await anon.rpc('subscribe_to_updates', {
    p_email: email,
    p_full_name: fullName,
    p_source: 'website',
  });
  if (error) {
    fail.push(`${label}: ${error.message}`);
    return;
  }
  manifest.subscribers.push(email);
}
await subscribe('subscriber-1', 'demo.subscriber1@example.invalid', '[DEMO] Chiamaka Obi');
await subscribe('subscriber-2', 'demo.subscriber2@example.invalid', '[DEMO] Folake Adisa');

console.log(JSON.stringify(manifest, null, 2));
if (fail.length) {
  console.error('\nFailures:');
  for (const f of fail) console.error(' -', f);
  process.exit(fail.length === manifest.appointments.length ? 1 : 0);
}
console.log('\nDone. Everything created is tagged "[DEMO] " in the name and @example.invalid in the email.');
