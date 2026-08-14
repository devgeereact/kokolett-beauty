import { supabase } from '@/lib/supabase';
import type { ServiceMenuGroup, ServiceMenuItem } from '@/types';

/**
 * The menu of styles shown on the home page.
 *
 * Not to be confused with `serviceCatalogService`, which owns the single
 * bookable appointment type. Nothing here is bookable on its own: the salon
 * sells time, and the style is agreed in the chair. This list exists so a
 * visitor can see whether the salon does the thing they want.
 */

/** Public read: grouped, ordered, active rows only, in one call. */
export async function fetchPublicMenu(): Promise<ServiceMenuGroup[]> {
  const { data, error } = await supabase.rpc('public_service_menu');
  if (error) throw error;
  return (data ?? []) as unknown as ServiceMenuGroup[];
}

/** Owner read: everything, including the rows she has switched off. */
export async function listMenuItems(): Promise<ServiceMenuItem[]> {
  const { data, error } = await supabase
    .from('service_menu')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface MenuItemInput {
  groupName: string;
  name: string;
  note?: string | null;
  sortOrder?: number;
  active?: boolean;
  durationMin?: number;
  bufferMin?: number;
  imagePath?: string | null;
}

export async function createMenuItem(input: MenuItemInput): Promise<ServiceMenuItem> {
  const { data, error } = await supabase
    .from('service_menu')
    .insert({
      group_name: input.groupName.trim(),
      name: input.name.trim(),
      note: input.note?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      active: input.active ?? true,
      duration_min: input.durationMin ?? 45,
      buffer_min: input.bufferMin ?? 10,
      image_path: input.imagePath?.trim() || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateMenuItem(
  id: string,
  patch: Partial<MenuItemInput>,
): Promise<ServiceMenuItem> {
  const { data, error } = await supabase
    .from('service_menu')
    .update({
      ...(patch.groupName !== undefined && { group_name: patch.groupName.trim() }),
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.note !== undefined && { note: patch.note?.trim() || null }),
      ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
      ...(patch.active !== undefined && { active: patch.active }),
      ...(patch.durationMin !== undefined && { duration_min: patch.durationMin }),
      ...(patch.bufferMin !== undefined && { buffer_min: patch.bufferMin }),
      ...(patch.imagePath !== undefined && { image_path: patch.imagePath?.trim() || null }),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * A real delete, unlike services.
 *
 * Nothing references a menu row: no appointment records which style was booked,
 * because the appointment is an hour of the owner's time. Removing a style the
 * salon has stopped offering leaves no orphan and no history to protect.
 */
export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('service_menu').delete().eq('id', id);
  if (error) throw error;
}
