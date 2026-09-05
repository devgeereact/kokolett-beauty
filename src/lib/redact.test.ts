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

/**
 * The owner's own credentials, which the original pattern did not touch.
 * `/access/` covered the customer magic link and nothing else, so a recovery
 * link and an implicit-flow fragment both reached Sentry intact.
 */
describe('redactAccessToken: owner credentials', () => {
  it('redacts the recovery token_hash in a reset-password URL', () => {
    expect(
      redactAccessToken(
        'https://www.kokolettbeauty.com/reset-password?token_hash=pkce_abc123DEF&type=recovery',
      ),
    ).toBe(
      'https://www.kokolettbeauty.com/reset-password?token_hash=[redacted]&type=recovery',
    );
  });

  it('redacts an implicit-flow access and refresh token in a fragment', () => {
    expect(
      redactAccessToken(
        'https://www.kokolettbeauty.com/#access_token=eyJhbGciOi.zzz&refresh_token=r-1234&type=recovery',
      ),
    ).toBe(
      'https://www.kokolettbeauty.com/#access_token=[redacted]&refresh_token=[redacted]&type=recovery',
    );
  });

  it('redacts a PKCE code', () => {
    expect(redactAccessToken('/reset-password?code=abc-def-123')).toBe(
      '/reset-password?code=[redacted]',
    );
  });

  it('redacts a credential inside prose, not only inside a URL', () => {
    expect(
      redactAccessToken('Navigated to /reset-password?token_hash=secret while offline'),
    ).toBe('Navigated to /reset-password?token_hash=[redacted] while offline');
  });

  it('leaves an ordinary query string alone', () => {
    expect(redactAccessToken('/dashboard/inbox?tab=requests&page=2')).toBe(
      '/dashboard/inbox?tab=requests&page=2',
    );
  });

  it('redacts both a magic link and a recovery token in one string', () => {
    expect(
      redactAccessToken('from /access/tok123 to /reset-password?token_hash=zzz'),
    ).toBe('from /access/[redacted] to /reset-password?token_hash=[redacted]');
  });
});
