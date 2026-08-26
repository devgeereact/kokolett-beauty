/**
 * A `wa.me` contact link built from the salon's published phone number.
 *
 * This is a plain link, not the SMS/WhatsApp *automation* `docs/PRD.md` §10
 * marks out of scope for V1 — it just opens WhatsApp with the salon's number
 * pre-filled, the same way the phone number already opens the dialler.
 */
export function toWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  // UK numbers are published in local format (`07707 906408`); wa.me needs
  // the international form without the leading trunk zero.
  const international = digits.startsWith('0') ? `44${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}
