import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AREAS_SERVED,
  BUSINESS_NAME,
  CONTACT_EMAIL,
  GEO,
  GOOGLE_PROFILE_URL,
  INSTAGRAM_URL,
  LOCALITY,
  OWNER_NAME,
  POSTCODE,
  REGION,
  SALON_SCHEMA_ID,
  SERVICE_GROUPS,
  SITE_ORIGIN,
  WEBSITE_SCHEMA_ID,
} from '@/lib/business';

/**
 * `index.html` hand-keys the whole business identity a second time, because a
 * crawler reads the served HTML before any JavaScript runs and so the entity
 * cannot come from `business.ts` at runtime. That duplication is deliberate and
 * documented (`docs/SOCIAL_PROFILE.md` §2), but until this file existed nothing
 * detected the two drifting apart: `business.ts` could say Thamesmead while the
 * JSON-LD still said Woolwich, and every check would stay green.
 *
 * This is the check. When it fails, one of the two is wrong; decide which and
 * fix that one, rather than editing the assertion.
 */

interface Salon {
  '@type': string;
  '@id': string;
  name: string;
  url: string;
  email: string;
  address: {
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo: { latitude: number; longitude: number };
  founder: { name: string };
  sameAs: string[];
  areaServed: { name: string }[];
}

function graph(): { salon: Salon; website: { '@id': string; url: string } } {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!block?.[1]) throw new Error('index.html has no JSON-LD block');
  const parsed = JSON.parse(block[1]) as {
    '@graph': ({ '@type': string } & Record<string, unknown>)[];
  };
  const salon = parsed['@graph'].find((n) => n['@type'] === 'HairSalon');
  const website = parsed['@graph'].find((n) => n['@type'] === 'WebSite');
  if (!salon || !website) throw new Error('JSON-LD is missing HairSalon or WebSite');
  return {
    salon: salon as unknown as Salon,
    website: website as unknown as { '@id': string; url: string },
  };
}

describe("index.html's structured data agrees with src/lib/business.ts", () => {
  const { salon, website } = graph();

  it('is a HairSalon, never a BeautySalon', () => {
    // The word "Beauty" in the name is branding, not scope.
    expect(salon['@type']).toBe('HairSalon');
  });

  it('uses the shared node ids, so every block describes one entity', () => {
    expect(salon['@id']).toBe(SALON_SCHEMA_ID);
    expect(website['@id']).toBe(WEBSITE_SCHEMA_ID);
  });

  it('names the business and the owner identically', () => {
    expect(salon.name).toBe(BUSINESS_NAME);
    expect(salon.founder.name).toBe(OWNER_NAME);
  });

  it('agrees on the origin and the contact address', () => {
    expect(salon.url).toBe(SITE_ORIGIN);
    expect(website.url).toBe(SITE_ORIGIN);
    expect(salon.email).toBe(CONTACT_EMAIL);
  });

  it('agrees on where the salon is', () => {
    expect(salon.address.addressLocality).toBe(LOCALITY);
    expect(salon.address.addressRegion).toBe(REGION);
    expect(salon.address.postalCode).toBe(POSTCODE);
    expect(salon.address.addressCountry).toBe('GB');
  });

  it('agrees on the coordinate', () => {
    expect(salon.geo.latitude).toBe(GEO.latitude);
    expect(salon.geo.longitude).toBe(GEO.longitude);
  });

  it('agrees on every area served, in the same order', () => {
    expect(salon.areaServed.map((a) => a.name)).toEqual([...AREAS_SERVED]);
  });

  it('claims the same social profiles', () => {
    expect(salon.sameAs).toContain(INSTAGRAM_URL);
    expect(salon.sameAs).toContain(GOOGLE_PROFILE_URL);
  });

  it('advertises no service the salon does not offer', () => {
    const json = JSON.stringify(salon);
    expect(json).not.toMatch(/(^|[^a-z])locs?([^a-z]|$)/i);
  });

  it('describes the salon using only real service groups', () => {
    // The description is prose, so this checks the groups are represented
    // rather than matching it word for word.
    const description = JSON.stringify(salon).toLowerCase();
    for (const group of SERVICE_GROUPS) {
      const head = group.split(/[,\s]/)[0]!.toLowerCase();
      expect(description).toContain(head);
    }
  });
});
