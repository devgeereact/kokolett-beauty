import { describe, expect, it } from 'vitest';
import {
  AREAS_SERVED,
  BUSINESS_NAME,
  CONTACT_EMAIL,
  GEO,
  LOCALITY,
  SERVICE_GROUPS,
  SITE_ORIGIN,
  buildGoogleProfileUrl,
  buildMapUrl,
} from '@/lib/business';

/**
 * These are the facts every surface reads from, so the tests are about the
 * invariants that keep the surfaces agreeing rather than about behaviour.
 */
describe('business identity', () => {
  it('has no trailing slash on the origin, so `${SITE_ORIGIN}/book` is well formed', () => {
    expect(SITE_ORIGIN.endsWith('/')).toBe(false);
    expect(`${SITE_ORIGIN}/book`).toBe('https://www.kokolettbeauty.com/book');
  });

  it('names the salon exactly, with no keywords appended', () => {
    // A keyword-stuffed name is grounds for Google suspension.
    expect(BUSINESS_NAME).toBe('Kokolett Beauty UK');
  });

  it('uses the singular booking address', () => {
    expect(CONTACT_EMAIL).toBe('booking@kokolettbeauty.com');
  });

  it('lists the locality first among the areas served', () => {
    // Nearest first: the list is pasted into Google in this order.
    expect(AREAS_SERVED[0]).toBe(LOCALITY);
  });

  it('does not name Woolwich as the locality', () => {
    // SE28 8RX is Thamesmead. Woolwich is SE18 and belongs in AREAS_SERVED only.
    expect(LOCALITY).toBe('Thamesmead');
    expect(AREAS_SERVED).toContain('Woolwich');
  });

  it('offers no locs', () => {
    // Retired by migration 0066. Twists are a different service and stay.
    expect(SERVICE_GROUPS.some((g) => /loc/i.test(g))).toBe(false);
    expect(SERVICE_GROUPS).toContain('Twists');
  });

  it('places the salon in south east London', () => {
    // Guards a transposed or sign-flipped coordinate, which would put the
    // salon in the wrong country without anything else failing.
    expect(GEO.latitude).toBeGreaterThan(51.4);
    expect(GEO.latitude).toBeLessThan(51.6);
    expect(GEO.longitude).toBeGreaterThan(0);
    expect(GEO.longitude).toBeLessThan(0.3);
  });
});

describe('buildGoogleProfileUrl', () => {
  it('builds a stable profile URL from a Place ID', () => {
    expect(buildGoogleProfileUrl('ChIJxSluewCv2EcRgkwfgTqnij8')).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJxSluewCv2EcRgkwfgTqnij8',
    );
  });

  it('returns null when the owner has not saved a Place ID', () => {
    // Callers fall back to the review link, so null has to be distinguishable.
    expect(buildGoogleProfileUrl(null)).toBeNull();
    expect(buildGoogleProfileUrl(undefined)).toBeNull();
    expect(buildGoogleProfileUrl('')).toBeNull();
    expect(buildGoogleProfileUrl('   ')).toBeNull();
  });

  it('trims a pasted Place ID', () => {
    expect(buildGoogleProfileUrl('  ChIJabc  ')).toContain('place_id:ChIJabc');
  });

  it('escapes a Place ID so it cannot break out of the query string', () => {
    expect(buildGoogleProfileUrl('a&b=c')).toBe(
      'https://www.google.com/maps/place/?q=place_id:a%26b%3Dc',
    );
  });
});

describe('buildMapUrl', () => {
  it('prefixes the business name so the pin resolves to the salon', () => {
    expect(buildMapUrl('Redbourne Dr, London SE28 8RX')).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('Kokolett Beauty UK, Redbourne Dr, London SE28 8RX'),
    );
  });

  it('encodes an address containing an ampersand', () => {
    expect(buildMapUrl('A & B Road')).not.toContain(' & ');
  });
});
