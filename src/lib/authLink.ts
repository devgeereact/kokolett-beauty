/**
 * Reading an auth credential out of a URL, safely.
 *
 * Both entry points that do this — `AuthLinkHandler` and `ResetPasswordPage` —
 * branch on values an attacker fully controls, because the URL is the delivery
 * mechanism for the credential. CodeQL flags that shape (`js/user-controlled-
 * bypass`) and it is right to: the danger is not the branch itself but what a
 * caller might do with the untrusted `type` afterwards, such as passing it
 * straight into `verifyOtp` or using it to pick a redirect target.
 *
 * Nothing here decides whether a credential is *valid* — GoTrue does that, and
 * an invented `type` simply fails verification. What this does is make the
 * untrusted value stop being untrusted at the boundary: `type` is narrowed to a
 * closed set of literals, and anything else is discarded rather than forwarded.
 */

/** The `type` values GoTrue issues for the links this app sends. */
const RECOGNISED_TYPES = ['recovery', 'magiclink', 'email', 'invite'] as const;

export type AuthLinkType = (typeof RECOGNISED_TYPES)[number];

/** A credential found in the URL, with `type` already narrowed. */
export type AuthLinkCredential =
  | { kind: 'token_hash'; tokenHash: string; type: AuthLinkType }
  | { kind: 'session'; accessToken: string; refreshToken: string; type: AuthLinkType }
  | { kind: 'error' }
  | null;

function narrowType(raw: string | null): AuthLinkType | null {
  return RECOGNISED_TYPES.find((known) => known === raw) ?? null;
}

/**
 * Pull a credential out of `search`/`hash`, or return null when there is none.
 *
 * Takes the two strings rather than reading `window` so it can be tested, and
 * so a caller cannot accidentally read a different URL than the one it checked.
 */
export function readAuthLink(search: string, hash: string): AuthLinkCredential {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));

  // GoTrue reports a refused or expired link this way rather than by omitting
  // the token, so it has to be checked before looking for one.
  if (query.get('error') ?? fragment.get('error')) return { kind: 'error' };

  // Default to `magiclink` only where a token is genuinely present: it is the
  // least-privileged of the four, and a link with no type at all is one this
  // app did not send.
  const type = narrowType(query.get('type') ?? fragment.get('type'));

  const tokenHash = query.get('token_hash');
  if (tokenHash && type) return { kind: 'token_hash', tokenHash, type };

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    return {
      kind: 'session',
      accessToken,
      refreshToken,
      // A fragment session carries its type alongside the tokens; absent one,
      // treat it as an ordinary sign-in rather than a password recovery.
      type: type ?? 'magiclink',
    };
  }

  return null;
}
