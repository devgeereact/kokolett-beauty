import { useEffect } from 'react';
import { BUSINESS_NAME, SITE_ORIGIN } from '@/lib/business';

const DEFAULT_TITLE = BUSINESS_NAME;

/** Square app icon, used only as the fallback when a page names no card. */
const DEFAULT_IMAGE = `${SITE_ORIGIN}/icons/social-card.png`;

type MetaSpec = { attr: 'name' | 'property'; key: string; value: string };

function findMeta(attr: 'name' | 'property', key: string): HTMLMetaElement | null {
  return document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = findMeta(attr, key);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

const BREADCRUMB_ID = 'breadcrumb-jsonld';

/**
 * Home > This page, as JSON-LD. Google uses it to print a breadcrumb trail in
 * place of the raw URL in a result, which is both clearer and takes more of
 * the row. Only ever two levels deep, because the site is only two deep.
 */
function setBreadcrumb(name: string, url: string): void {
  let el = document.head.querySelector<HTMLScriptElement>(`script#${BREADCRUMB_ID}`);
  if (!el) {
    el = document.createElement('script');
    el.id = BREADCRUMB_ID;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name, item: url },
    ],
  });
}

function clearBreadcrumb(): void {
  document.head.querySelector(`script#${BREADCRUMB_ID}`)?.remove();
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export type DocumentMeta = {
  /** Appended with the business name unless `fullTitle` is set. */
  title: string;
  description?: string;
  /**
   * Use the title verbatim instead of suffixing the business name. For the
   * home page, whose title already carries it.
   */
  fullTitle?: boolean;
  /**
   * Path this page canonicalises to, leading slash included. Without it the
   * page inherits `index.html`'s canonical, which claims to be the home page.
   */
  path?: string;
  /** Absolute URL of the social card, if this page has its own. */
  image?: string;
  /** Keeps the page out of the index. Used by the 404. */
  noindex?: boolean;
};

/**
 * Per-page head management for a client-rendered multi-page marketing site.
 *
 * `index.html` carries site-wide defaults for the first paint before React
 * mounts. Those defaults describe the home page, so every route that does not
 * override them tells a crawler and every link preview that it *is* the home
 * page: same canonical, same Open Graph title, same card. This hook overrides
 * title, description, canonical, Open Graph, Twitter and robots per route, and
 * restores the previous values on unmount so a page that unmounts before the
 * next one mounts never leaves a stale head behind.
 *
 * Accepts a plain string for the common case, or a `DocumentMeta` object when
 * a page needs canonical, card or robots control.
 */
export function useDocumentMeta(meta: string | DocumentMeta, description?: string): void {
  const spec: DocumentMeta =
    typeof meta === 'string'
      ? { title: meta, ...(description ? { description } : {}) }
      : meta;

  const { title, fullTitle, path, image, noindex } = spec;
  const desc = spec.description;

  useEffect(() => {
    const documentTitle = fullTitle ? title : `${title}: ${BUSINESS_NAME}`;
    const canonical = path ? `${SITE_ORIGIN}${path}` : null;
    const card = image ?? DEFAULT_IMAGE;

    const previousTitle = document.title;
    const previousCanonical = document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute('href');

    const applied: MetaSpec[] = [];
    const previous = new Map<string, string | null>();

    const apply = (attr: 'name' | 'property', key: string, value: string): void => {
      previous.set(
        `${attr}:${key}`,
        findMeta(attr, key)?.getAttribute('content') ?? null,
      );
      applied.push({ attr, key, value });
      setMeta(attr, key, value);
    };

    document.title = documentTitle;

    if (desc) {
      apply('name', 'description', desc);
      apply('property', 'og:description', desc);
      apply('name', 'twitter:description', desc);
    }

    apply('property', 'og:title', documentTitle);
    apply('name', 'twitter:title', documentTitle);
    apply('name', 'twitter:card', 'summary_large_image');
    apply('property', 'og:image', card);
    apply('name', 'twitter:image', card);

    if (canonical) {
      apply('property', 'og:url', canonical);
      setCanonical(canonical);
      if (path !== '/') setBreadcrumb(title, canonical);
    }

    if (noindex) apply('name', 'robots', 'noindex, follow');

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (canonical && previousCanonical) setCanonical(previousCanonical);
      clearBreadcrumb();
      for (const { attr, key } of applied) {
        const was = previous.get(`${attr}:${key}`);
        if (was !== null && was !== undefined) setMeta(attr, key, was);
        else findMeta(attr, key)?.remove();
      }
    };
  }, [title, desc, fullTitle, path, image, noindex]);
}
