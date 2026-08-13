#!/usr/bin/env node
/**
 * Removes the @example.invalid demo subscriber rows created by
 * seed-demo-data.mjs. Subscribers are the only demo surface the owner role
 * can delete directly (appointments/availability_requests need direct DB
 * access — see the cleanup note at the top of seed-demo-data.mjs).
 *
 * Run: node --env-file=.env scripts/cleanup-demo-subscribers.mjs
 * Requires KOKO_OWNER_EMAIL and KOKO_DEV_PASSWORD in the environment.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OWNER_EMAIL = process.env.KOKO_OWNER_EMAIL;
const OWNER_PASSWORD = process.env.KOKO_DEV_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / KOKO_OWNER_EMAIL / KOKO_DEV_PASSWORD');
  process.exit(1);
}

const owner = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { error: authError } = await owner.auth.signInWithPassword({
  email: OWNER_EMAIL,
  password: OWNER_PASSWORD,
});
if (authError) {
  console.error('Owner sign-in failed:', authError.message);
  process.exit(1);
}

const { data, error } = await owner
  .from('subscribers')
  .delete()
  .ilike('email', '%@example.invalid')
  .select('email');

if (error) {
  console.error('Delete failed:', error.message);
  process.exit(1);
}

console.log(`Removed ${data?.length ?? 0} demo subscriber(s).`);
