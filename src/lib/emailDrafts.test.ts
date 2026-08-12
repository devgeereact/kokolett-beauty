import { describe, expect, it } from 'vitest';
import { draftEmail, suggestReply } from '@/lib/emailDrafts';

const INPUT = {
  customerName: 'Koko Beauty',
  reference: 'KB-ABCDEF',
  whenLabel: 'Thursday 14 August at 10:15',
};

describe('draftEmail', () => {
  it("uses the customer's first name and includes the reference", () => {
    const draft = draftEmail(INPUT, 'running_late');
    expect(draft.body).toContain('Hi Koko,');
    expect(draft.subject).toContain('KB-ABCDEF');
  });

  it('produces a different draft per purpose', () => {
    const purposes = [
      'running_late',
      'reschedule_notice',
      'aftercare',
      'thank_you',
      'reminder',
    ] as const;
    const drafts = purposes.map((p) => draftEmail(INPUT, p));
    const uniqueBodies = new Set(drafts.map((d) => d.body));
    expect(uniqueBodies.size).toBe(purposes.length);
  });

  it('includes the given time in the reschedule notice', () => {
    const draft = draftEmail(INPUT, 'reschedule_notice');
    expect(draft.body).toContain('Thursday 14 August at 10:15');
  });
});

describe('suggestReply', () => {
  it('matches a cancellation message', () => {
    const reply = suggestReply(
      'I need to cancel my appointment please',
      'friendly',
      'Ada Lovelace',
    );
    expect(reply).toContain('Sorry to see you cancel');
    expect(reply).toContain('Hi Ada!');
  });

  it('matches a running-late message', () => {
    const reply = suggestReply('Sorry I am running late today', 'formal', 'Ada Lovelace');
    expect(reply).toContain('No problem at all');
    expect(reply).toContain('Dear Ada,');
  });

  it('falls back to a generic reply for unmatched text', () => {
    const reply = suggestReply('Just wanted to say hello!', 'brief', 'Ada');
    expect(reply).toContain('Thanks for getting in touch');
    expect(reply.startsWith('Hi') || reply.startsWith('Dear')).toBe(false);
  });

  it("applies the requested tone's sign-off", () => {
    expect(suggestReply('hello', 'friendly', 'Ada')).toContain('Speak soon!');
    expect(suggestReply('hello', 'formal', 'Ada')).toContain('Kind regards.');
    expect(suggestReply('hello', 'brief', 'Ada')).toContain('Thanks.');
  });
});
