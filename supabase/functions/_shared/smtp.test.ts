/**
 * The header-injection guard.
 *
 * Not theoretical: `submit_contact_message()` (migration 0047) is granted to
 * `anon` and puts the caller's own name straight into the subject line, and
 * denomailer writes a pure-ASCII subject into the DATA block unchanged. See
 * `smtp.ts` for the full path.
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { headerSafe } from './smtp.ts';

const CR = '\r';
const LF = '\n';

Deno.test('headerSafe strips CRLF so a name cannot append a header', () => {
  const injected = headerSafe(
    `Message from Ada${CR}${LF}Bcc: attacker@example.test`,
  );
  assertEquals(injected, 'Message from Ada Bcc: attacker@example.test');
  assert(!injected.includes(CR));
  assert(!injected.includes(LF));
});

Deno.test('headerSafe strips a bare CR and a bare LF', () => {
  assertEquals(headerSafe(`a${CR}b`), 'a b');
  assertEquals(headerSafe(`a${LF}b`), 'a b');
});

Deno.test('headerSafe cannot be used to end the header block', () => {
  const blank = `${CR}${LF}${CR}${LF}`;
  const injected = headerSafe(
    `Hi${blank}From: Kokolett Beauty <booking@kokolettbeauty.com>${blank}Your account is suspended.`,
  );
  assert(!/[\r\n]/.test(injected));
  assertEquals(
    injected,
    'Hi From: Kokolett Beauty <booking@kokolettbeauty.com> Your account is suspended.',
  );
});

Deno.test('headerSafe leaves an ordinary subject alone', () => {
  assertEquals(
    headerSafe('Your appointment is confirmed · KB-5VC9JN'),
    'Your appointment is confirmed · KB-5VC9JN',
  );
});

Deno.test('headerSafe keeps non-ASCII, which denomailer encodes itself', () => {
  assertEquals(headerSafe('Rendez-vous confirmé'), 'Rendez-vous confirmé');
});
