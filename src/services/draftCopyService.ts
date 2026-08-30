import { invokeFunction } from '@/lib/supabase';
import type { DraftCopyInput, DraftCopyResult } from '@/types';

/**
 * Inline AI drafting — a single request/response, not a chat. Used by the
 * "Polish with AI" button on the broadcast composer, the one-off Compose
 * modal, and the customer-profile reply panel (migration 0058, Edge
 * Function `draft-copy`).
 */
export async function draftCopy(input: DraftCopyInput): Promise<DraftCopyResult> {
  return invokeFunction<DraftCopyResult>('draft-copy', { ...input });
}
