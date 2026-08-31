import { describe, expect, it } from 'vitest';
import { redactAccessToken, redactDeep } from '@/lib/redact';

/**
 * A customer's magic link is a bearer credential living in the URL path — if
 * it reaches Sentry, anyone with dashboard access can read that customer's
 * booking history and cancel their appointments for the 30 minutes the link
 * is valid. This is the only thing standing between that leak and every
 * `browserTracingIntegration`/`replayIntegration` event this app sends.
 */

describe('redactAccessToken', () => {
  it('masks the token in an /access/<token> path', () => {
    expect(redactAccessToken('https://kokolettbeauty.com/access/abc123')).toBe(
      'https://kokolettbeauty.com/access/[redacted]',
    );
  });

  it('stops the token at a query string or hash, not swallowing them', () => {
    expect(redactAccessToken('https://x.com/access/tok123?foo=bar')).toBe(
      'https://x.com/access/[redacted]?foo=bar',
    );
    expect(redactAccessToken('https://x.com/access/tok123#section')).toBe(
      'https://x.com/access/[redacted]#section',
    );
  });

  it('redacts every occurrence, not just the first', () => {
    expect(
      redactAccessToken(
        'referrer=https://x.com/access/tok1 -> https://x.com/access/tok2',
      ),
    ).toBe('referrer=https://x.com/access/[redacted] -> https://x.com/access/[redacted]');
  });

  it('matches the /access/ segment regardless of case', () => {
    expect(redactAccessToken('https://x.com/ACCESS/tok123')).toBe(
      'https://x.com/access/[redacted]',
    );
  });

  it('leaves a string with no access token untouched', () => {
    expect(redactAccessToken('https://kokolettbeauty.com/book')).toBe(
      'https://kokolettbeauty.com/book',
    );
    expect(redactAccessToken('')).toBe('');
  });

  it('does not touch a bare token with no /access/ prefix', () => {
    expect(redactAccessToken('tok123')).toBe('tok123');
  });
});

describe('redactDeep', () => {
  it('redacts a plain string', () => {
    expect(redactDeep('https://x.com/access/tok123')).toBe(
      'https://x.com/access/[redacted]',
    );
  });

  it('redacts strings nested inside an object, preserving other keys', () => {
    const input = {
      url: 'https://x.com/access/tok123',
      method: 'GET',
      count: 3,
    };
    expect(redactDeep(input)).toEqual({
      url: 'https://x.com/access/[redacted]',
      method: 'GET',
      count: 3,
    });
  });

  it('redacts strings nested inside an array', () => {
    const input = ['https://x.com/access/tok1', 'https://x.com/access/tok2'];
    expect(redactDeep(input)).toEqual([
      'https://x.com/access/[redacted]',
      'https://x.com/access/[redacted]',
    ]);
  });

  it('redacts arbitrarily deep nesting, e.g. a Sentry breadcrumb payload', () => {
    const input = {
      breadcrumbs: [
        { data: { url: 'https://x.com/access/tok123', status: 200 } },
        { data: { url: 'https://x.com/book', status: 200 } },
      ],
    };
    expect(redactDeep(input)).toEqual({
      breadcrumbs: [
        { data: { url: 'https://x.com/access/[redacted]', status: 200 } },
        { data: { url: 'https://x.com/book', status: 200 } },
      ],
    });
  });

  it('passes through non-string primitives and null unchanged', () => {
    expect(redactDeep(42)).toBe(42);
    expect(redactDeep(true)).toBe(true);
    expect(redactDeep(null)).toBe(null);
    expect(redactDeep(undefined)).toBe(undefined);
  });
});
