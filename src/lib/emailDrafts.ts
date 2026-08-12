/**
 * Text generation behind the AI Assistant's email-drafting and
 * customer-communication modules.
 *
 * Deterministic string templates and keyword matching, not a model call —
 * this app has no LLM API wired in. Every draft is a starting point the
 * owner reads, edits if she wants, and sends herself (via `mailto:`, the
 * same pattern `CustomersPage`'s "Email everyone" already uses); nothing
 * here sends anything on its own.
 */

export type EmailPurpose =
  'running_late' | 'reschedule_notice' | 'aftercare' | 'thank_you' | 'reminder';

export const EMAIL_PURPOSE_LABELS: Record<EmailPurpose, string> = {
  running_late: 'Running late',
  reschedule_notice: 'Reschedule notice',
  aftercare: 'Aftercare',
  thank_you: 'Thank you',
  reminder: 'Friendly reminder',
};

export interface EmailDraftInput {
  customerName: string;
  reference: string;
  /** e.g. "Thursday 14 August at 10:15" — already salon-local, already formatted. */
  whenLabel: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

const FIRST_NAME = (fullName: string): string =>
  fullName.trim().split(/\s+/)[0] ?? fullName;

/** A starting draft for one of the four common owner-to-customer moments. */
export function draftEmail(input: EmailDraftInput, purpose: EmailPurpose): EmailDraft {
  const first = FIRST_NAME(input.customerName);

  switch (purpose) {
    case 'running_late':
      return {
        subject: `Running a little behind — ${input.reference}`,
        body: `Hi ${first},\n\nJust a quick note to say I'm running a little behind today. Your appointment (${input.whenLabel}) will still happen, just later than planned — I'll message again once I have a firmer time.\n\nSorry for the wait, and see you soon.`,
      };
    case 'reschedule_notice':
      return {
        subject: `Your appointment has moved — ${input.reference}`,
        body: `Hi ${first},\n\nI've had to move your appointment. It's now ${input.whenLabel} — let me know if that no longer works and I'll find you another time.\n\nSorry for the short notice.`,
      };
    case 'aftercare':
      return {
        subject: `Aftercare — ${input.reference}`,
        body: `Hi ${first},\n\nLovely seeing you today. A couple of things to keep it looking its best: keep it dry for the first 48 hours, and use a silk or satin scarf/pillowcase at night.\n\nGive me a shout if you have any questions before your next visit.`,
      };
    case 'thank_you':
      return {
        subject: `Thank you — ${input.reference}`,
        body: `Hi ${first},\n\nThank you for coming in — it's always lovely to see you. If you have a moment, a review helps other people find the salon, and it means a lot to me personally.\n\nSee you next time.`,
      };
    case 'reminder':
      return {
        subject: `See you soon — ${input.reference}`,
        body: `Hi ${first},\n\nJust a friendly reminder about your appointment ${input.whenLabel}. Let me know if anything's changed and you need to move it.\n\nLooking forward to seeing you.`,
      };
  }
}

export type ReplyTone = 'friendly' | 'formal' | 'brief';

const GREETINGS: Record<ReplyTone, (name: string) => string> = {
  friendly: (name) => `Hi ${name}! `,
  formal: (name) => `Dear ${name}, `,
  brief: () => '',
};

const SIGN_OFFS: Record<ReplyTone, string> = {
  friendly: 'Speak soon!',
  formal: 'Kind regards.',
  brief: 'Thanks.',
};

interface ReplyRule {
  test: RegExp;
  body: string;
}

/**
 * Body copy keyed by what the message actually asks about, checked in
 * order — the first match wins. Deliberately narrow: a wrong guess reads
 * worse than the generic fallback, which is always safe to send.
 */
const REPLY_RULES: ReplyRule[] = [
  {
    test: /\b(cancel|cancelling|cancelled)\b/i,
    body: "Sorry to see you cancel — I've noted it and the slot is now free for someone else. Let me know if you'd like to rebook for another time.",
  },
  {
    test: /\b(late|running behind|delay(ed)?)\b/i,
    body: "No problem at all — thanks for the heads up. I'll see you when you arrive, just come straight in.",
  },
  {
    test: /\b(allerg|sensitive|reaction)\b/i,
    body: "Thanks for flagging that — I've noted it against your file so it's front of mind for your appointment. Let me know if there's anything else I should be aware of.",
  },
  {
    test: /\b(price|cost|how much)\b/i,
    body: "Good question — pricing is agreed together in the chair once I know exactly what you're after, so it depends a bit on the style. Happy to talk it through when you come in.",
  },
  {
    test: /\b(reschedul|move|change.*(time|date|appointment))\b/i,
    body: 'Of course — let me know a few times that might suit and I’ll find you a slot.',
  },
];

const FALLBACK_BODY =
  'Thanks for getting in touch — I’ve read your message and will get back to you properly shortly.';

/** A suggested reply built from keyword matching against the message text. */
export function suggestReply(
  messageText: string,
  tone: ReplyTone,
  customerName: string,
): string {
  const first = FIRST_NAME(customerName);
  const rule = REPLY_RULES.find((r) => r.test.test(messageText));
  const body = rule?.body ?? FALLBACK_BODY;
  return `${GREETINGS[tone](first)}${body} ${SIGN_OFFS[tone]}`.trim();
}
