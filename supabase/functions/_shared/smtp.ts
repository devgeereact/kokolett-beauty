/**
 * SMTP header hygiene.
 *
 * denomailer 1.6.0 writes the subject into the DATA block verbatim:
 * `config/mail/mod.ts` runs it through `quotedPrintableEncodeInline`, which
 * returns pure-ASCII input **unchanged**, and `client/basic/connection.ts`
 * then does `write(args.join(' ') + '\r\n')`. A CR or LF inside the value
 * therefore ends the `Subject:` header early, and everything after it is
 * parsed as further headers, or, after a blank line, as the message body.
 *
 * That value is not always ours. `submit_contact_message()` (migration 0047)
 * is granted to `anon` and builds the subject as
 * `'Message from ' || v_full_name`, validating only that the name is
 * non-empty and at most 200 characters. So a stranger posting a name
 * containing a CRLF could append arbitrary headers to, and rewrite the body
 * of, a message the salon's own authenticated, DKIM-signed relay then
 * delivers to the owner's inbox. The same shape reaches every other subject
 * built from a customer-supplied name ("New booking: <name>").
 *
 * Stripping here rather than in Postgres is deliberate: this is the one place
 * a string becomes an SMTP header, so it also covers the owner-edited
 * template subjects (`email_templates.subject`) that never pass through
 * `queue_email()` at all. Validating at the RPCs as well would be belt and
 * braces; validating *only* there would leave the override path open.
 */

/**
 * Anything that could break out of a header value: CR, LF, NUL and the rest
 * of the C0 range (a bare CR is enough on some relays), plus DEL.
 */
// Escaped rather than written as literal bytes, so the range is visible in a
// diff and cannot be lost to a copy-paste.
// deno-lint-ignore no-control-regex
const HEADER_BREAKERS = /[\u0000-\u001f\u007f]+/g;

/**
 * Collapse header-breaking characters into a single space.
 *
 * The runs are collapsed and the result trimmed so a stripped injection does
 * not leave a ragged subject line behind.
 */
export function headerSafe(value: string): string {
  return value.replace(HEADER_BREAKERS, ' ').replace(/\s{2,}/g, ' ').trim();
}
