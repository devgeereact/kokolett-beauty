/**
 * Tests for the email renderer.
 *
 * This module is 806 lines that decide what every customer of the salon
 * actually receives, and it had no tests at all. It is Deno, so it is outside
 * `npm test`; these run under `deno test` in the same CI step that typechecks
 * the Edge Functions.
 *
 * The cases here are the ones that were nearly shipped broken, not a sweep for
 * coverage: the seeded-override regression, the details lost from the
 * plain-text part, and the two escaping holes CodeQL and review turned up.
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { render, type TemplatePayload } from './templates.ts';

const base: TemplatePayload = {
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.test',
  starts_at: '2026-08-22T08:00:00Z',
  ends_at: '2026-08-22T09:00:00Z',
  service_name: 'Hair appointment',
  reference: 'KB-5VC9JN',
  manage_url: 'https://www.kokolettbeauty.com/access/deadbeef',
  timezone: 'Europe/London',
  salon_address: 'Redbourne Dr, London SE28 8RX',
  salon_phone: '07707 906408',
  cancellation_window_h: 24,
};

Deno.test(
  'booking_confirmed renders the designed copy when no override is enabled',
  () => {
    const out = render('booking_confirmed', base);

    assertStringIncludes(out.html, 'Booking reference');
    assertStringIncludes(out.html, '/access/deadbeef');
    assertStringIncludes(out.html, 'looking forward to seeing you');
    assertStringIncludes(out.html, 'Redbourne Dr');
  },
);

Deno.test('the plain-text part carries when, what and the reference', () => {
  // Losing these was the regression: an owner-edited template used to drop the
  // structured block, leaving the two-hour reminder as one sentence with no
  // date, service or reference. A thin text/plain part is also a spam signal.
  const out = render('booking_confirmed', base);

  assertStringIncludes(out.text, '22 August 2026');
  assertStringIncludes(out.text, 'Hair appointment');
  assertStringIncludes(out.text, 'KB-5VC9JN');
  assertStringIncludes(out.text, '/access/deadbeef');
});

Deno.test('an owner override substitutes tokens and keeps the shell', () => {
  const out = render('booking_confirmed', base, {
    subject: 'See you on {{appointment_date}}, {{customer_name}}',
    html_body: '<p>Hi {{customer_name}}, you are booked for {{appointment_time}}.</p>',
  });

  assertEquals(out.subject, 'See you on Saturday, 22 August 2026, Ada Lovelace');
  assertStringIncludes(out.html, 'you are booked for 09:00');
  assertStringIncludes(out.html, 'Kokolett');
  assertStringIncludes(out.html, '/access/deadbeef');
  // The override must not cost the customer the details either.
  assertStringIncludes(out.text, 'Reference: KB-5VC9JN');
});

Deno.test('a customer name cannot break out of a single-quoted attribute', () => {
  // Reachable: a name reaches the database from the anonymous booking form,
  // which only requires two words of three characters. The owner's template
  // body is arbitrary HTML, and a single-quoted attribute is exactly what a
  // WYSIWYG or a paste produces.
  const out = render(
    'booking_confirmed',
    { ...base, customer_name: "Ada' onmouseover='alert(1)" },
    { subject: 'Hello', html_body: `<a href="#" title='{{customer_name}}'>book</a>` },
  );

  const attribute = out.html.match(/title='([^']*)'/);
  assert(attribute !== null, 'the title attribute should still be present');
  assert(
    !attribute[1].includes("'"),
    'a bare quote inside the value would end the attribute early and start a new one',
  );
  // The payload is allowed to survive, but only as inert text.
  assertStringIncludes(out.html, 'Ada&#39; onmouseover=&#39;alert(1)');
});

Deno.test('nested tags cannot smuggle markup into the plain-text part', () => {
  // A single strip pass turns `<scr<script>ipt>` into a working `<script>`.
  const out = render('booking_confirmed', base, {
    subject: 'Hello',
    html_body: '<p>Hi</p><scr<script>ipt>alert(1)</scr</script>ipt>',
  });

  assert(!/<script/i.test(out.text), 'no tag should survive the strip');
  assert(!out.text.includes('<'), 'no angle bracket should survive at all');
});

Deno.test(
  'the footer links WhatsApp, Instagram and Google reviews when set, in both parts',
  () => {
    const out = render('booking_confirmed', {
      ...base,
      instagram_url: 'https://instagram.com/kokolettbeauty',
      google_review_url: 'https://g.page/r/example/review',
    });

    // salon_phone in `base` is '07707 906408' — a UK local number, so the
    // wa.me link drops the trunk zero and prefixes the country code.
    assertStringIncludes(out.html, 'href="https://wa.me/447707906408"');
    assertStringIncludes(out.html, '>WhatsApp<');
    assertStringIncludes(out.html, 'href="https://instagram.com/kokolettbeauty"');
    assertStringIncludes(out.html, 'href="https://g.page/r/example/review"');

    assertStringIncludes(out.text, 'WhatsApp: https://wa.me/447707906408');
    assertStringIncludes(out.text, 'Instagram: https://instagram.com/kokolettbeauty');
    assertStringIncludes(out.text, 'Reviews: https://g.page/r/example/review');
  },
);

Deno.test('no salon_phone means no WhatsApp link, without breaking the footer', () => {
  const out = render('booking_confirmed', { ...base, salon_phone: null });

  assert(!out.html.includes('wa.me'), 'no phone means no WhatsApp link can be built');
  assert(!out.text.includes('WhatsApp:'));
});

Deno.test(
  'the 2-hour reminder says 2 hours, not "an hour" copied from the 1-hour reminder',
  () => {
    const twoHour = render('reminder_2h', base);
    const oneHour = render('reminder_1h', base);

    assertStringIncludes(twoHour.html, 'in about 2 hours');
    assertStringIncludes(twoHour.text, 'in about 2 hours');
    assert(!twoHour.html.includes('in about an hour'));

    assertStringIncludes(oneHour.html, 'in about an hour');
    assertStringIncludes(oneHour.text, 'in about an hour');
  },
);
