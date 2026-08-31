import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

/**
 * This hook is the only thing standing between a client-rendered SPA and every
 * page claiming to be the home page. Until 2026-08-31 it set title and
 * description only, so eight routes shared `index.html`'s canonical and Open
 * Graph URL. The tests below are mostly about the restore path, because a hook
 * that leaves a stale head behind reintroduces exactly that bug one navigation
 * later.
 */

function meta(attr: 'name' | 'property', key: string): string | null {
  return (
    document.head
      .querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
      ?.getAttribute('content') ?? null
  );
}

function canonical(): string | null {
  return (
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute('href') ?? null
  );
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('useDocumentMeta', () => {
  it('suffixes the business name onto a page title', () => {
    renderHook(() => useDocumentMeta('Services'));
    expect(document.title).toBe('Services: Kokolett Beauty UK');
  });

  it('uses the title verbatim when fullTitle is set', () => {
    // The home page's own title already carries the business name.
    renderHook(() =>
      useDocumentMeta({ title: 'Kokolett Beauty UK: hair salon', fullTitle: true }),
    );
    expect(document.title).toBe('Kokolett Beauty UK: hair salon');
  });

  it('still accepts the plain (title, description) call', () => {
    // Six pages used this shape before the object form existed.
    renderHook(() => useDocumentMeta('About', 'Meet Christy.'));
    expect(document.title).toBe('About: Kokolett Beauty UK');
    expect(meta('name', 'description')).toBe('Meet Christy.');
  });

  it('sets a page-specific canonical and og:url from the path', () => {
    renderHook(() => useDocumentMeta({ title: 'Services', path: '/services' }));
    expect(canonical()).toBe('https://www.kokolettbeauty.com/services');
    expect(meta('property', 'og:url')).toBe('https://www.kokolettbeauty.com/services');
  });

  it('mirrors the description into Open Graph and Twitter', () => {
    renderHook(() => useDocumentMeta({ title: 'Contact', description: 'Call us.' }));
    expect(meta('name', 'description')).toBe('Call us.');
    expect(meta('property', 'og:description')).toBe('Call us.');
    expect(meta('name', 'twitter:description')).toBe('Call us.');
  });

  it('asks for a large card', () => {
    renderHook(() => useDocumentMeta({ title: 'Gallery' }));
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('leaves the site card alone unless a page brings its own', () => {
    // index.html ships og:image with matching width/height/alt. Overriding just
    // the URL would leave those three describing a different image.
    const img = document.createElement('meta');
    img.setAttribute('property', 'og:image');
    img.setAttribute('content', 'https://www.kokolettbeauty.com/icons/social-card.png');
    document.head.appendChild(img);

    renderHook(() => useDocumentMeta({ title: 'Gallery' }));
    expect(meta('property', 'og:image')).toContain('social-card.png');
  });

  it('drops the declared dimensions when a page brings its own card', () => {
    for (const [key, value] of [
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', 'The site card'],
    ]) {
      const el = document.createElement('meta');
      el.setAttribute('property', key!);
      el.setAttribute('content', value!);
      document.head.appendChild(el);
    }

    renderHook(() =>
      useDocumentMeta({ title: 'Gallery', image: 'https://example.test/other.png' }),
    );
    expect(meta('property', 'og:image')).toBe('https://example.test/other.png');
    expect(document.head.querySelector('meta[property="og:image:width"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:image:alt"]')).toBeNull();
  });

  it('states robots explicitly on every page, not only the hidden ones', () => {
    // Written unconditionally so a newer page always overwrites an older one's
    // value. A conditional write let a 404's noindex outlive the 404.
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'Found' }));
    expect(meta('name', 'robots')).toBe('index, follow');
    unmount();

    renderHook(() => useDocumentMeta({ title: 'Page not found', noindex: true }));
    expect(meta('name', 'robots')).toBe('noindex, follow');
  });

  it('does not let a 404 canonicalise to the home page', () => {
    // The SPA rewrite answers every unknown path with 200, so a mistyped URL
    // renders the 404. Leaving index.html's canonical in place would tell
    // Google that URL *is* the home page while also saying do not index it.
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://www.kokolettbeauty.com/');
    document.head.appendChild(link);

    renderHook(() => useDocumentMeta({ title: 'Page not found', noindex: true }));
    expect(canonical()).toBeNull();
  });

  it('does not leave a 404 noindex on the next page', () => {
    // The overlap ordering: the next route mounts before the 404 unmounts, so
    // the 404's cleanup is skipped. Its robots value must already be gone.
    const notFound = renderHook(() =>
      useDocumentMeta({ title: 'Page not found', noindex: true }),
    );
    const home = renderHook(() =>
      useDocumentMeta({ title: 'Home', path: '/', fullTitle: true }),
    );
    notFound.unmount();

    expect(meta('name', 'robots')).toBe('index, follow');
    home.unmount();
  });

  it('does not leave a subpage breadcrumb on the home page', () => {
    const services = renderHook(() =>
      useDocumentMeta({ title: 'Services', path: '/services' }),
    );
    const home = renderHook(() => useDocumentMeta({ title: 'Home', path: '/' }));
    services.unmount();

    expect(document.head.querySelector('script#breadcrumb-jsonld')).toBeNull();
    home.unmount();
  });

  it('emits a two-level breadcrumb for a subpage', () => {
    renderHook(() => useDocumentMeta({ title: 'Services', path: '/services' }));
    const el = document.head.querySelector('script#breadcrumb-jsonld');
    const crumbs = JSON.parse(el?.textContent ?? '{}') as {
      '@type': string;
      itemListElement: { name: string; item: string }[];
    };
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Home', 'Services']);
    expect(crumbs.itemListElement[1]?.item).toBe(
      'https://www.kokolettbeauty.com/services',
    );
  });

  it('emits no breadcrumb on the home page', () => {
    // "Home > Home" is noise, and Google ignores a single-item trail anyway.
    renderHook(() => useDocumentMeta({ title: 'Home', path: '/' }));
    expect(document.head.querySelector('script#breadcrumb-jsonld')).toBeNull();
  });

  it('restores the previous title and canonical on unmount', () => {
    document.title = 'Kokolett Beauty UK';
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://www.kokolettbeauty.com/');
    document.head.appendChild(link);

    const { unmount } = renderHook(() =>
      useDocumentMeta({ title: 'Services', path: '/services' }),
    );
    expect(canonical()).toBe('https://www.kokolettbeauty.com/services');

    unmount();
    expect(document.title).toBe('Kokolett Beauty UK');
    expect(canonical()).toBe('https://www.kokolettbeauty.com/');
  });

  it('removes tags it created rather than leaving them stale', () => {
    // index.html ships no og:title, so a page that sets one must clean it up.
    // Leaving it behind would caption the next page with the previous one.
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'Services' }));
    expect(meta('property', 'og:title')).toBe('Services: Kokolett Beauty UK');

    unmount();
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
  });

  it('removes the breadcrumb on unmount', () => {
    const { unmount } = renderHook(() =>
      useDocumentMeta({ title: 'Services', path: '/services' }),
    );
    unmount();
    expect(document.head.querySelector('script#breadcrumb-jsonld')).toBeNull();
  });

  it('restores a tag that index.html already provided', () => {
    const el = document.createElement('meta');
    el.setAttribute('name', 'description');
    el.setAttribute('content', 'Site-wide default.');
    document.head.appendChild(el);

    const { unmount } = renderHook(() =>
      useDocumentMeta({ title: 'About', description: 'Page specific.' }),
    );
    expect(meta('name', 'description')).toBe('Page specific.');

    unmount();
    expect(meta('name', 'description')).toBe('Site-wide default.');
  });

  it('leaves one page in charge when another unmounts after it mounted', () => {
    // React Router can mount the next route before unmounting the last one.
    // The newer page must win, and the older page's cleanup must not undo it.
    const first = renderHook(() => useDocumentMeta({ title: 'About', path: '/about' }));
    const second = renderHook(() =>
      useDocumentMeta({ title: 'Services', path: '/services' }),
    );

    first.unmount();

    expect(document.title).toBe('Services: Kokolett Beauty UK');
    expect(canonical()).toBe('https://www.kokolettbeauty.com/services');

    second.unmount();
  });
});
