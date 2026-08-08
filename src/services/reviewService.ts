import { supabase } from '@/lib/supabase';

/**
 * Google reviews, read from the cache an Edge Function keeps warm.
 *
 * Nothing here talks to Google. The Places key is billable and would be
 * readable in the bundle, and a salon's reviews change a few times a month —
 * fetching per page view would pay for the same paragraphs thousands of times.
 */

export interface PublicReview {
  author_name: string;
  profile_photo_url: string | null;
  author_url: string | null;
  rating: number;
  body: string | null;
  relative_time: string | null;
  published_at: string | null;
}

export interface ReviewsSnapshot {
  rating: number | null;
  rating_count: number | null;
  /** When the cache was last refreshed — null if it never has been. */
  fetched_at: string | null;
  reviews: PublicReview[];
}

export async function fetchReviews(limit = 6): Promise<ReviewsSnapshot> {
  const { data, error } = await supabase.rpc('public_reviews', { p_limit: limit });
  if (error) throw error;

  const snapshot = data as unknown as ReviewsSnapshot | null;
  return snapshot ?? { rating: null, rating_count: null, fetched_at: null, reviews: [] };
}
