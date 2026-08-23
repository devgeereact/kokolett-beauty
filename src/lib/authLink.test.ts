import { describe, expect, it } from 'vitest';
import { readAuthLink } from '@/lib/authLink';

/**
 * This parser is the boundary where an attacker-controlled URL stops being
 * attacker-controlled. It does not decide whether a credential is valid —
 * GoTrue does — but it decides what gets forwarded to `verifyOtp` and which of
 * two internal routes the app takes, so an unrecognised `type` must never
 * survive it.
 */
describe('readAuthLink', () => {
  it('reads a token_hash link and keeps its type', () => {
    expect(readAuthLink('?token_hash=abc&type=recovery', '')).toEqual({
      kind: 'token_hash',
      tokenHash: 'abc',
      type: 'recovery',
    });
  });

  it('reads an implicit fragment, which is what admin-generated links produce', () => {
    expect(readAuthLink('', '#access_token=at&refresh_token=rt&type=magiclink')).toEqual({
      kind: 'session',
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'magiclink',
    });
  });

  it('refuses a token_hash whose type is not one this app issues', () => {
    // The danger is not the bogus value itself — GoTrue would reject it — but
    // forwarding an arbitrary string into a sensitive call and routing on it.
    expect(readAuthLink('?token_hash=abc&type=../../admin', '')).toBeNull();
    expect(readAuthLink('?token_hash=abc&type=signup', '')).toBeNull();
    expect(readAuthLink('?token_hash=abc', '')).toBeNull();
  });

  it('treats a fragment session with no type as an ordinary sign-in, never recovery', () => {
    const result = readAuthLink('', '#access_token=at&refresh_token=rt');
    expect(result).toMatchObject({ kind: 'session', type: 'magiclink' });
  });

  it('reports an error link before looking for a credential', () => {
    expect(readAuthLink('?error=access_denied', '')).toEqual({ kind: 'error' });
    expect(readAuthLink('', '#error=expired&access_token=at&refresh_token=rt')).toEqual({
      kind: 'error',
    });
  });

  it('finds nothing in an ordinary URL', () => {
    expect(readAuthLink('', '')).toBeNull();
    expect(readAuthLink('?tab=approvals', '#section=two')).toBeNull();
  });

  it('ignores a half-present fragment session', () => {
    expect(readAuthLink('', '#access_token=at')).toBeNull();
    expect(readAuthLink('', '#refresh_token=rt')).toBeNull();
  });
});
