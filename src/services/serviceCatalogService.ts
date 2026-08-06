import { supabase } from '@/lib/supabase';
import type { Service, ServiceCategory, ServiceInsert, ServiceUpdate } from '@/types';

/**
 * The service catalogue. Public reads are limited by RLS to active, unarchived
 * rows; the owner sees everything.
 */

/** Active catalogue, for the marketing site and booking flow. */
export async function listActiveServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Everything the owner manages, including inactive rows.
 * Archived services stay out — they exist only to keep old appointments
 * readable, since `appointments.service_id` is `on delete restrict`.
 */
export async function listAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createService(input: ServiceInsert): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateService(id: string, patch: ServiceUpdate): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Archive rather than delete. A service with appointments against it cannot be
 * deleted (`on delete restrict`), and deleting one without would silently erase
 * what a past customer actually booked.
 */
export async function archiveService(id: string): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', id);

  if (error) throw error;
}

/** Build a URL-safe slug. Uniqueness is enforced by the database, not here. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
