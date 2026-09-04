import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from '@/lib/business';
import { routes } from '@/lib/routes';

/**
 * The sitemap, robots.txt and the route map are three hand-maintained lists
 * that have to agree. Nothing compared them until this file: adding a public
 * page and forgetting the sitemap means Google may never find it, and adding a
 * private one and forgetting robots.txt means Google finds it and should not.
 */

const publicDir = resolve(__dirname, '../../public');
const sitemap = readFileSync(resolve(publicDir, 'sitemap.xml'), 'utf8');
const robots = readFileSync(resolve(publicDir, 'robots.txt'), 'utf8');

/** Paths in the sitemap, origin stripped. */
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1]!.replace(SITE_ORIGIN, ''),
);

/** Static, indexable public paths declared in the route map. */
const indexable: string[] = Object.values(routes.public).filter(
  (r) => typeof r === 'string',
);

/** Paths that must never be indexed. */
const private_ = [
  '/dashboard',
  '/my',
  '/access',
  '/login',
  '/reset-password',
  '/unsubscribe',
];

describe('sitemap and robots.txt agree with the route map', () => {
  it('lists every indexable public route', () => {
    const missing = indexable.filter((path) => !listed.includes(path || '/'));
    expect(missing, `not in sitemap.xml: ${missing.join(', ')}`).toEqual([]);
  });

  it('lists nothing that is not a route', () => {
    const stray = listed.filter((path) => !indexable.includes(path || '/'));
    expect(stray, `in sitemap.xml but not routed: ${stray.join(', ')}`).toEqual([]);
  });

  it('lists no private path', () => {
    /* Boundary-aware: a bare `startsWith` makes `/access` swallow the public
       `/accessibility`, which is also why robots.txt disallows `/access/`
       with the slash rather than the bare prefix. */
    for (const path of private_) {
      const clash = listed.some((l) => l === path || l.startsWith(`${path}/`));
      expect(clash, `${path} appears in sitemap.xml`).toBe(false);
    }
  });

  it('disallows every private path in robots.txt', () => {
    for (const path of private_) {
      expect(robots, `robots.txt does not disallow ${path}`).toContain(
        `Disallow: ${path}`,
      );
    }
  });

  it('points at the sitemap on the canonical host', () => {
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it('uses the canonical www origin for every entry', () => {
    // The apex 301s to www. A sitemap listing the apex would hand Google a
    // redirect for every page it crawls.
    for (const loc of [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)) {
      expect(loc.startsWith(SITE_ORIGIN)).toBe(true);
    }
  });
});
