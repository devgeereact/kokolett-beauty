import { useEffect } from 'react';
import { BUSINESS_NAME, SITE_ORIGIN } from '@/lib/business';

const DEFAULT_TITLE = BUSINESS_NAME;

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

/**
 * Which mounted instance currently owns the document head.
 *
 * Cleanup restores whatever was there before, which is right when a page is the
 * last one to have written. It is wrong when a newer page has already taken
 * over: React can mount the next route before unmounting the previous one, and
 * StrictMode double-invokes effects, so the older cleanup would run last and
 * put the previous page's title, canonical and card back over the current
 * page's. The result is a page silently claiming to be its predecessor, which
 * is the exact bug this hook exists to prevent.
 *
 * Each effect run claims the next number and only restores if it still holds it.
 */
let headOwner = 0;

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

function removeCanonical(): void {
  document.head.querySelector('link[rel="canonical"]')?.remove();
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
    const myClaim = ++headOwner;
    const documentTitle = fullTitle ? title : `${title}: ${BUSINESS_NAME}`;
    const canonical = path ? `${SITE_ORIGIN}${path}` : null;

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

    /* Only override the card when a page brings its own. index.html ships the
       site card together with its `og:image:width`, `og:image:height` and
       `og:image:alt`; overriding just the URL would leave those three
       describing a different image. A page that does pass one drops them,
       because this hook cannot know the new file's dimensions. */
    if (image) {
      apply('property', 'og:image', image);
      apply('name', 'twitter:image', image);
      for (const key of ['og:image:width', 'og:image:height', 'og:image:alt']) {
        findMeta('property', key)?.remove();
      }
    }

    /* Every write below is unconditional, and that is deliberate. When a newer
       page claims the head, the older page's cleanup is skipped entirely (see
       `headOwner`), so anything the newer page merely *declines* to set would
       survive from the older one: a `noindex` outliving the 404 that set it, or
       `Home > Services` breadcrumbs on the home page. Writing the full set every
       time makes the newer page's state complete. */
    apply('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');

    if (canonical) {
      apply('property', 'og:url', canonical);
      setCanonical(canonical);
    }

    if (canonical && path !== '/') setBreadcrumb(title, canonical);
    else clearBreadcrumb();

    /* A `noindex` page must not canonicalise anywhere. index.html's canonical
       points at the home page, so leaving it in place on the 404 tells Google
       that a mistyped URL *is* the home page while also telling it not to index
       that page: contradictory signals on the same URL, and the `noindex` can be
       attributed to the canonical target. The SPA rewrite answers every unknown
       path with 200, so this is reachable from any broken link. */
    if (noindex && !canonical) removeCanonical();

    return () => {
      // A newer page owns the head. Leave it alone.
      if (headOwner !== myClaim) return;

      document.title = previousTitle || DEFAULT_TITLE;
      if (previousCanonical) setCanonical(previousCanonical);
      else removeCanonical();
      clearBreadcrumb();
      for (const { attr, key } of applied) {
        const was = previous.get(`${attr}:${key}`);
        if (was !== null && was !== undefined) setMeta(attr, key, was);
        else findMeta(attr, key)?.remove();
      }
    };
  }, [title, desc, fullTitle, path, image, noindex]);
}
