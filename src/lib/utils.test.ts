import { describe, expect, it } from 'vitest';
import { jsonLd } from '@/lib/utils';

describe('jsonLd', () => {
  /**
   * The `<script type="application/ld+json">` blocks on /services, /faqs and
   * /testimonials are written with `dangerouslySetInnerHTML`. `/services`
   * builds its catalogue from `service_menu` rows the owner types, so a stray
   * `</script>` in a style name would have closed the block and turned the
   * rest of the JSON into markup.
   */
  it('escapes a closing script tag so the block cannot be broken out of', () => {
    const out = jsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect((JSON.parse(out) as { name: string }).name).toBe(
      '</script><img src=x onerror=alert(1)>',
    );
  });

  it('escapes the JavaScript line terminators JSON allows raw', () => {
    const out = jsonLd({ note: 'a\u2028b\u2029c' });
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect((JSON.parse(out) as { note: string }).note).toBe('a\u2028b\u2029c');
  });

  it('leaves ordinary structured data byte-identical to JSON.stringify', () => {
    const value = { '@type': 'Service', name: 'Knotless braids', duration: 240 };
    expect(jsonLd(value)).toBe(JSON.stringify(value));
  });
});
