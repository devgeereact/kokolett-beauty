/**
 * Static business identity, in one place.
 *
 * Three stores hold business facts and each owns a different set. This module
 * owns the ones that never change without a code change: the legal name, where
 * the salon is, the site's own origin, and the contact address it publishes.
 *
 * It deliberately does NOT hold the address line, the phone number or the
 * opening hours. Those are owner-editable in `booking_settings` and must be
 * read through `useBusinessSettings`, or the dashboard would let her change
 * something the site then ignores.
 *
 * The structured data in `index.html` is a third store, hand-keyed, because a
 * crawler reads the served HTML before any of this runs. `docs/SOCIAL_PROFILE.md`
 * §2 is the full map, and `docs/GO-LIVE.md` §3 carries the sync step.
 *
 * Deno edge functions cannot import from `src/`, so `_shared/templates.ts`
 * keeps its own copy of the name, origin and email. That is the one sanctioned
 * duplicate.
 */

/** Exact legal name. Never abbreviated, never suffixed with keywords. */
export const BUSINESS_NAME = 'Kokolett Beauty UK';

/** Owner's name, as it appears to customers. */
export const OWNER_NAME = 'Christy';

/** Site origin, no trailing slash, so `${SITE_ORIGIN}/book` is always correct. */
export const SITE_ORIGIN = 'https://www.kokolettbeauty.com';

/** The one address customers write to. */
export const CONTACT_EMAIL = 'booking@kokolettbeauty.com';

/**
 * Where the salon is. SE28 8RX is Thamesmead, in the London Borough of Bexley
 * (ward Thamesmead East), which is what the verified Google profile shows.
 * Woolwich is SE18, roughly two miles west and in Greenwich: it belongs in
 * AREAS_SERVED, never here.
 *
 * Thamesmead straddles Bexley and Greenwich, so the borough is easy to get
 * wrong. The postcode's own ONS record is the authority.
 */
export const LOCALITY = 'Thamesmead';
export const REGION = 'London';
export const POSTCODE = 'SE28 8RX';
export const COUNTRY = 'United Kingdom';
export const COUNTRY_CODE = 'GB';

/** Used in titles, headings and meta descriptions. */
export const POSITIONING = `Women's hair salon in ${LOCALITY}, South East London`;

/** Nearby places clients travel from. Order matters: nearest first. */
export const AREAS_SERVED = [
  'Thamesmead',
  'Abbey Wood',
  'Belvedere',
  'Plumstead',
  'Erith',
  'Woolwich',
  'Charlton',
  'Greenwich',
  'Eltham',
] as const;

/**
 * Postcode centroid for SE28 8RX, from the Office for National Statistics via
 * api.postcodes.io. Sourced rather than guessed, and accurate to the postcode.
 * Swap for the exact pin on the Google profile if that sits somewhere
 * meaningfully different.
 */
export const GEO = { latitude: 51.512543, longitude: 0.126009 } as const;

/**
 * The service groups, matching `service_menu.group_name` in the database
 * exactly. Google and Instagram advertise these same six. If the owner renames
 * a group in the console, this list and the Google profile both need updating.
 */
export const SERVICE_GROUPS = [
  'Braids',
  'Twists',
  'Weaves, wigs and extensions',
  'Natural hair and styling',
  'Colour',
  'Treatments',
] as const;

/** Canonical Instagram profile. Trailing slash matches `booking_settings`. */
export const INSTAGRAM_URL = 'https://www.instagram.com/kokolettbeautyuk/';

/**
 * Canonical Google profile, built from the Place ID rather than a share link.
 * A `share.google` URL is a redirect and is fine to hand a customer, but it is
 * not a durable identifier and does not belong in `sameAs`.
 */
export const GOOGLE_PLACE_ID = 'ChIJxSluewCv2EcRgkwfgTqnij8';
export const GOOGLE_PROFILE_URL = `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`;

/**
 * Where to send someone to *read* the salon's reviews, built from the Place ID
 * the owner has saved.
 *
 * This is not the same URL as `booking_settings.google_review_url`, and the two
 * are not interchangeable. That one is the `g.page/r/<id>/review` link Google
 * hands you under "Give customers a link to review your business", and it opens
 * the write-a-review dialog straight away. Sending someone there from a footer
 * link labelled "reviews", or from a customer's review card, drops them into a
 * blank review form for a salon they may never have visited.
 *
 * Read surfaces use this. The write link belongs on an explicit "Leave a
 * review" action, and in the review-request email.
 */
export function buildGoogleProfileUrl(placeId: string | null | undefined): string | null {
  const id = placeId?.trim();
  return id
    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id)}`
    : null;
}

/** Schema.org node ids, so every JSON-LD block describes the same entity. */
export const SALON_SCHEMA_ID = `${SITE_ORIGIN}/#salon`;
export const WEBSITE_SCHEMA_ID = `${SITE_ORIGIN}/#website`;

/**
 * Google Maps search URL for a free-text address. Built here rather than in
 * each page, because the two callers had drifted into slightly different
 * query strings.
 */
export function buildMapUrl(addressLine: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${BUSINESS_NAME}, ${addressLine}`,
  )}`;
}
