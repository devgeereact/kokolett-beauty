import { useEffect } from 'react';

const DEFAULT_TITLE = 'Kokolett Beauty UK';

function setMeta(
  name: string,
  content: string,
  attr: 'name' | 'property' = 'name',
): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Per-page `<title>` and meta description, now that the marketing site is
 * genuinely multi-page (2026-08 rebrand). `index.html` still carries the
 * site-wide defaults for the very first paint before React mounts; this
 * only overrides them once a route knows its own title.
 *
 * Restores the previous title on unmount so navigating between pages never
 * leaves a stale one if a page unmounts before the next sets its own.
 */
export function useDocumentMeta(title: string, description?: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title}: Kokolett Beauty UK`;

    const previousDescription = document.head
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.getAttribute('content');

    if (description) setMeta('description', description);

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (description && previousDescription) setMeta('description', previousDescription);
    };
  }, [title, description]);
}
