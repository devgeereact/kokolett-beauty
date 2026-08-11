import { describe, expect, it } from 'vitest';
import { redactAccessToken } from '@/lib/sentry';

/**
 * A customer's magic link is a bearer credential that lives in the URL path
 * until the page has redeemed it. Sentry's tracing and replay integrations
 * record URLs, and they start before that happens, so without scrubbing a live
 * link reaches Sentry and anyone with access can read that customer's bookings
 * and cancel them for the 30 minutes it stays valid.
 */
describe('magic-link redaction', () => {
  it('removes the token from a bare path', () => {
    expect(redactAccessToken('/access/abc123def456')).toBe('/access/[redacted]');
  });

  it('removes it from a full URL, keeping the rest intact', () => {
    expect(redactAccessToken('https://www.kokolettbeauty.com/access/deadbeef')).toBe(
      'https://www.kokolettbeauty.com/access/[redacted]',
    );
  });

  it('stops at a query string or fragment rather than eating them', () => {
    expect(redactAccessToken('/access/tok?from=email')).toBe(
      '/access/[redacted]?from=email',
    );
    expect(redactAccessToken('/access/tok#top')).toBe('/access/[redacted]#top');
  });

  it('redacts every occurrence, not just the first', () => {
    expect(redactAccessToken('/access/one and /access/two')).toBe(
      '/access/[redacted] and /access/[redacted]',
    );
  });

  it('leaves unrelated paths alone', () => {
    expect(redactAccessToken('/my-bookings')).toBe('/my-bookings');
    expect(redactAccessToken('/dashboard/appointments')).toBe('/dashboard/appointments');
    // No token to hide, so nothing should change.
    expect(redactAccessToken('/access')).toBe('/access');
  });
});
