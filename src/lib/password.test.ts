import { describe, expect, it } from 'vitest';
import { passwordProblem } from '@/lib/password';

/**
 * This account is not a sandbox: it has a `staff` row, so `is_owner()` returns
 * true and it reads every customer's name, email, phone number and appointment
 * history. The Supabase anon key ships inside the public browser bundle, so the
 * auth endpoint is reachable by anyone. A guessable password here is not a
 * private mistake, which is why the rules are enforced rather than suggested.
 */
describe('password rules', () => {
  it('accepts a long passphrase', () => {
    expect(
      passwordProblem('correct horse battery 7', 'correct horse battery 7'),
    ).toBeNull();
  });

  it('rejects anything short, however clever', () => {
    expect(passwordProblem('aB3$xY', 'aB3$xY')).toMatch(/at least 12/);
    // Eleven characters: still short.
    expect(passwordProblem('aB3$xY7!qZm', 'aB3$xY7!qZm')).toMatch(/at least 12/);
  });

  it('rejects the strings people actually reach for under time pressure', () => {
    for (const guess of [
      'Testing123.!!',
      'Password123456',
      'welcome123456',
      'letmein12345678',
      'qwerty123456789',
      'kokolett2026!!',
      'admin123456789',
    ]) {
      expect(passwordProblem(guess, guess), guess).not.toBeNull();
    }
  });

  it('requires more than one character class', () => {
    expect(passwordProblem('abcdefghijklmno', 'abcdefghijklmno')).toMatch(
      /number or symbol/,
    );
    expect(passwordProblem('123456789012345', '123456789012345')).toMatch(/Mix letters/);
  });

  it('catches a mistyped confirmation', () => {
    expect(passwordProblem('a-good-long-one-9', 'a-good-long-one-8')).toMatch(
      /do not match/,
    );
  });

  it('checks strength before it checks the match', () => {
    // Otherwise someone typing a weak password twice is told only that it
    // matched, and learns about the real problem one round trip later.
    expect(passwordProblem('short', 'different')).toMatch(/at least 12/);
  });
});
