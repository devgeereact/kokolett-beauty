/**
 * What counts as an acceptable dashboard password.
 *
 * Lives in `lib` rather than beside the reset form so the rule has one home:
 * any future "change password" screen must not be free to invent its own bar.
 *
 * The account these guard is not a sandbox. It carries a `staff` row, so
 * `is_owner()` returns true and it reads every customer's name, email, phone
 * number and appointment history — and the Supabase anon key ships inside the
 * public browser bundle, so the auth endpoint is reachable by anyone who views
 * source. A guessable password here is not a private mistake.
 *
 * Length is the bar rather than a zoo of character-class rules, because those
 * mostly produce `Password1!` and a false sense of having chosen well. The
 * blocklist covers the handful of strings people reach for when told to pick
 * something quickly.
 */

export const MIN_PASSWORD_LENGTH = 12;

const OBVIOUS =
  /^(password|passw0rd|testing|test123|welcome|letmein|qwerty|admin|kokolett|salon|booking)/i;

/** The first problem with a proposed password, or `null` when it will do. */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. Length matters more than symbols.`;
  }
  if (OBVIOUS.test(password)) {
    return 'That starts with something commonly guessed. Please choose something else.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9\W]/.test(password)) {
    return 'Mix letters with at least one number or symbol.';
  }
  // Checked last on purpose: someone who types a weak password twice should be
  // told what is actually wrong with it, not just that the two halves matched.
  if (password !== confirmation) return 'The two passwords do not match.';
  return null;
}
