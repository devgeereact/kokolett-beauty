/**
 * Pulls Google reviews into the cache the marketing site reads.
 *
 * Runs on a schedule, never from the browser. The Places key is billable, and a
 * key shipped to a browser is a public key however it is restricted. A salon's
 * reviews also change a few times a month, so refetching per page view would be
 * paying Google repeatedly for the same handful of paragraphs.
 *
 * Uses **Places API (New)** — `places.googleapis.com/v1/places/{id}` — not the
 * legacy `maps.googleapis.com/maps/api/place/details/json`. Google froze the
 * legacy API in March 2025 and it is unavailable in new Cloud projects, which
 * is exactly what the salon would be creating. Writing this against the legacy
 * endpoint would have produced a REQUEST_DENIED that looked like a key problem.
 *
 * Secrets:
 *   GOOGLE_PLACES_API_KEY   — a Places API (New) key, unrestricted by referrer
 *                             (this is a server-side call, so a referrer
 *                             restriction would block it)
 *   REVIEWS_CRON_SECRET     — shared secret so only the scheduler can trigger it
 *
 * That second secret is not ceremony. This function is deployed
 * `--no-verify-jwt`, and until it was added the handler took no request argument
 * at all, so there was nothing to check: anyone who found the URL could POST to
 * it in a loop, and every request spent the owner's money on a billable Places
 * call. Turning JWT verification on would not have closed it either — the anon
 * key ships in the browser bundle and is a valid JWT.
 *
 * The Place ID comes from `booking_settings.google_place_id`, so it can be
 * changed from the dashboard without a deploy.
 *
 * Google returns at most five reviews and chooses which. There is no API that
 * returns all of them; anything claiming otherwise is scraping, which breaks
 * Google's terms and stops working without warning.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireCronSecret } from '../_shared/auth.ts';

/**
 * How many reviews a healthy response carries. Google's documented maximum,
 * and the number this salon's profile has returned on every run. Anything
 * short of it is treated as a partial answer rather than as a deletion
 * instruction: see the prune below.
 */
const EXPECTED_REVIEWS = 5;

interface NewReview {
  name?: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string; languageCode?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  publishTime?: string;
  googleMapsUri?: string;
}

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

/** Stable id per review so a refresh updates rather than duplicates. */
async function reviewId(placeId: string, r: NewReview): Promise<string> {
  const seed =
    r.name ??
    `${placeId}|${r.authorAttribution?.displayName ?? ''}|${r.publishTime ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  const refusal = await requireCronSecret(
    req,
    env('REVIEWS_CRON_SECRET'),
    'REVIEWS_CRON_SECRET',
  );
  if (refusal) return refusal;

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const note = async (message: string | null): Promise<void> => {
    await supabase
      .from('google_place_snapshot')
      .update({ last_error: message, fetched_at: new Date().toISOString() })
      .eq('id', true);
  };

  const key = env('GOOGLE_PLACES_API_KEY');
  if (!key) {
    await note('GOOGLE_PLACES_API_KEY is not set');
    return Response.json({ error: 'No Places API key configured' }, { status: 503 });
  }

  const { data: settings } = await supabase
    .from('booking_settings')
    .select('google_place_id')
    .eq('id', true)
    .maybeSingle();

  const placeId = settings?.google_place_id?.trim();
  if (!placeId) {
    await note('No google_place_id set in booking settings');
    return Response.json({ error: 'No Place ID configured' }, { status: 503 });
  }

  let payload: {
    rating?: number;
    userRatingCount?: number;
    reviews?: NewReview[];
    error?: { message?: string; status?: string };
  };

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      /* Cron-driven, so nobody is watching it hang; the catch below records
         the abort in `last_error` where the System Health page can show it. */
      signal: AbortSignal.timeout(15_000),
      headers: {
        'X-Goog-Api-Key': key,
        // Field mask is mandatory in the new API; asking for everything is
        // both slower and billed at a higher tier.
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
        'Accept-Language': 'en-GB',
      },
    });
    payload = await res.json();

    if (!res.ok) {
      const message = payload?.error?.message ?? `HTTP ${res.status}`;
      await note(message.slice(0, 300));
      return Response.json({ error: message }, { status: 502 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await note(`Places request failed: ${message.slice(0, 200)}`);
    return Response.json({ error: message }, { status: 502 });
  }

  const reviews = payload.reviews ?? [];
  const now = new Date().toISOString();

  const rows = await Promise.all(
    reviews.map(async (r) => ({
      id: await reviewId(placeId, r),
      author_name: r.authorAttribution?.displayName ?? 'A Google user',
      author_url: r.authorAttribution?.uri ?? null,
      profile_photo_url: r.authorAttribution?.photoUri ?? null,
      rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))),
      body: (r.originalText?.text ?? r.text?.text ?? '').trim() || null,
      relative_time: r.relativePublishTimeDescription ?? null,
      published_at: r.publishTime ?? null,
      fetched_at: now,
    })),
  );

  if (rows.length > 0) {
    const { error } = await supabase.from('google_reviews').upsert(rows, { onConflict: 'id' });
    if (error) {
      await note(`Could not store reviews: ${error.message.slice(0, 200)}`);
      return Response.json({ error: error.message }, { status: 500 });
    }

    /* Drop anything Google no longer returns, so a review the author deleted
       does not live on the salon's front page forever.

       Only on a FULL response. The Places API returns at most five reviews and
       chooses which, and the `rows.length > 0` guard above covers the empty
       response but not the partial one: a run that came back with one review
       deleted the other four, and nothing could bring them back because the
       API is the only source. It was invisible too, since the call succeeded
       and `last_error` is cleared on this path. The home page and
       /testimonials would simply have had most of their social proof
       disappear between two hourly runs. */
    if (rows.length >= EXPECTED_REVIEWS) {
      await supabase
        .from('google_reviews')
        .delete()
        .not('id', 'in', `(${rows.map((r) => `"${r.id}"`).join(',')})`);
    } else {
      await note(
        `Google returned ${rows.length} review(s), fewer than the ${EXPECTED_REVIEWS} it normally does. ` +
          'Stored them and left the existing ones alone rather than deleting reviews that may still exist.',
      );
    }
  }

  await supabase
    .from('google_place_snapshot')
    .update({
      rating: payload.rating ?? null,
      rating_count: payload.userRatingCount ?? null,
      fetched_at: now,
      last_error: null,
    })
    .eq('id', true);

  return Response.json({
    rating: payload.rating ?? null,
    rating_count: payload.userRatingCount ?? null,
    stored: rows.length,
  });
});
