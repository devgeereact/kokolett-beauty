import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional Tailwind classes, resolving conflicts
 * (e.g. `cn('p-2', condition && 'p-4')` → `p-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Serialise a structured-data object for a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes nothing HTML cares about, so a `</script>` inside
 * any string value closes the block early and the rest of the JSON becomes
 * markup. Three pages inject a catalogue, an FAQ list and a rating this way,
 * and the catalogue's values come from `service_menu` rows the owner types
 * herself, so the string is not a constant. The CSP would refuse to run an
 * injected `<script>` (script-src is 'self' plus one hash), which is why this
 * is hardening rather than a live hole, but relying on a header to contain a
 * markup bug is the wrong order of defences.
 *
 * Escaping `<` covers `</script`, `<!--` and `<script` in one rule; the two
 * line separators are escaped because they are valid in JSON but terminate a
 * JavaScript string, which matters if a consumer ever `eval`s the block.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
