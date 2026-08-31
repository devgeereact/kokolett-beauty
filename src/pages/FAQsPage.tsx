import { type JSX } from 'react';
import { SiteShell } from '@/components/public/SiteShell';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';

interface Faq {
  question: string;
  answer: string;
}

/**
 * Before-you-book questions, feeding `FAQPage` structured data
 * (`src/pages/FAQsPage.tsx` renders the JSON-LD itself, since this is the
 * only page that owns this content — 2026-08-25 rebrand).
 */
export function FAQsPage(): JSX.Element {
  useDocumentMeta({
    title: 'FAQs',
    description:
      'Common questions about booking, cancelling and what to expect at Kokolett Beauty, a women’s hair salon in Thamesmead, South East London.',
    path: routes.public.faqs,
  });
  const { settings } = useBusinessSettings();

  const faqs: Faq[] = [
    {
      question: 'Do I need to pay online or leave a deposit?',
      answer:
        "No. There's no fixed price list: what a style costs is agreed in the chair, and you pay at the salon.",
    },
    {
      question: 'Can I change or cancel my appointment?',
      answer: `Yes, free of charge${
        settings?.cancellation_window_h
          ? ` up to ${settings.cancellation_window_h} hours before`
          : ''
      }. No account or password needed, just the link in your confirmation email.`,
    },
    {
      question: 'What if nothing is showing as available?',
      answer:
        'Send an availability request with your preferred dates and times. Requests are offered slots first-come, first-served as they open up.',
    },
    {
      question: 'Do I need to create an account?',
      answer:
        'No. You are identified by your email address. A magic link in every email lets you manage your booking without a password.',
    },
    {
      question: 'Do you do all hair types?',
      answer:
        'Kokolett Beauty specialises in braids, twists, weaves, natural hair and colour. We do not do locs. Not sure if we cover what you need? Ask when you book.',
    },
    {
      question: 'How do I get in touch if I have a question first?',
      answer:
        'Call, WhatsApp or email: see the Contact page for every way to reach us, or send a message straight from the site.',
    },
  ];

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        // FAQPage schema — this is the only page describing this content,
        // so the structured data lives beside it rather than in index.html.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }),
        }}
      />

      <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
            FAQs
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            Before you book
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-border bg-card px-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {faq.question}
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
