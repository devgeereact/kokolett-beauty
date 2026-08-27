import { supabase } from '@/lib/supabase';

/** The owner's current secret sign-in slug (`staff.login_slug`, migration 0051). */
export async function getOwnLoginSlug(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_own_login_slug');
  if (error) throw error;
  return data;
}

/**
 * Changes the sign-in slug. Takes effect immediately — the old link stops
 * resolving the moment this returns, no deploy or cache-clear needed.
 */
export async function setOwnLoginSlug(slug: string): Promise<void> {
  const { error } = await supabase.rpc('set_owner_login_slug', { p_slug: slug });
  if (error) throw error;
}
