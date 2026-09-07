import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { Card } from '@/components/ui/Card';
import { PHOTO_SCRIM } from '@/components/ui/PhotoCard';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toWhatsAppLink } from '@/lib/whatsapp';
import { submitContactMessage } from '@/services/contactService';
import { errorMessage } from '@/lib/errors';
import { buildImageKitUrl } from '@/lib/imagekit';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { CONTACT_EMAIL, buildMapUrl } from '@/lib/business';
import { publicButton, publicField } from '@/components/ui/controlClasses';

type FormState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Every real way to reach the salon, plus a message form for anything that
 * isn't a booking or an availability request (2026-08-25 rebrand). The form
 * sends straight to the owner's inbox via `submit_contact_message()`
 * (migration `0047`) — no account, no separate dashboard queue to check.
 */
export function ContactPage(): JSX.Element {
  useDocumentMeta({
    title: 'Contact',
    description:
      'Call, WhatsApp, email or message Kokolett Beauty, a women’s hair salon in Thamesmead, South East London.',
    path: routes.public.contact,
  });
  const { settings } = useBusinessSettings();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [state, setState] = useState<FormState>('idle');
  const sentRef = useRef<HTMLParagraphElement>(null);

  /* Sending replaces the whole form with the thank-you, so the element that
     had focus is removed from the document and focus falls back to <body>: a
     keyboard user is returned to the top of the page with no idea the message
     went, and a screen reader announces nothing at all. Moving focus onto the
     confirmation is what tells both that something happened. */
  useEffect(() => {
    if (state === 'sent') sentRef.current?.focus();
  }, [state]);

  const whatsappUrl = toWhatsAppLink(settings?.phone ?? null);
  const mapUrl = settings?.address_line ? buildMapUrl(settings.address_line) : null;

  /* `sameTab` marks the two channels that are not a web page. A `tel:` or
     `mailto:` opened with target="_blank" hands the OS the URL and leaves an
     empty tab behind, which on desktop is a blank window the visitor has to
     close and on iOS Safari is a dead tab in the switcher. */
  const channels = [
    settings?.phone && {
      label: 'Call',
      value: settings.phone,
      href: `tel:${settings.phone.replace(/\s/g, '')}`,
      sameTab: true,
    },
    whatsappUrl && { label: 'WhatsApp', value: 'Message us', href: whatsappUrl },
    {
      label: 'Email',
      value: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
      sameTab: true,
    },
    {
      label: 'Book online',
      value: 'See open times',
      href: routes.public.book,
      internal: true,
    },
    settings?.instagram_url && {
      label: 'Instagram',
      value: 'Follow us',
      href: settings.instagram_url,
    },
    settings?.address_line &&
      mapUrl && { label: 'Visit', value: settings.address_line, href: mapUrl },
  ].filter(Boolean) as {
    label: string;
    value: string;
    href: string;
    internal?: boolean;
    sameTab?: boolean;
  }[];

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorText(null);
    setState('sending');
    try {
      await submitContactMessage({ fullName, email, message });
      setState('sent');
      setFullName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      // `errorMessage` turns the raw Postgres error into copy. It matters
      // here for one case: a `TOO_MANY_MESSAGES` refusal must not be shown as
      // "try again", because trying again is what is being refused.
      setErrorText(errorMessage(err));
      setState('error');
    }
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-ink">
            Contact
          </p>
          <h1 className="font-serif text-3xl font-semibold text-foreground md:text-4xl">
            However you would rather reach us
          </h1>
        </div>

        <div className="mb-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => {
            const icon = (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-tint-brand text-accent-foreground">
                {channel.label === 'Call' && <PhoneIcon />}
                {channel.label === 'WhatsApp' && <WhatsAppIcon />}
                {channel.label === 'Email' && <EmailIcon />}
                {channel.label === 'Book online' && <CalendarIcon />}
                {channel.label === 'Instagram' && <InstagramIcon />}
                {channel.label === 'Visit' && <PinIcon />}
              </span>
            );
            const text = (
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {channel.label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {channel.value}
                </span>
              </span>
            );
            const className =
              'flex min-h-touch items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-brand';

            return channel.internal ? (
              <Link key={channel.label} to={channel.href} className={className}>
                {icon}
                {text}
              </Link>
            ) : (
              <a
                key={channel.label}
                href={channel.href}
                {...(channel.sameTab
                  ? {}
                  : { target: '_blank', rel: 'noopener noreferrer' })}
                className={className}
              >
                {icon}
                {text}
              </a>
            );
          })}
        </div>

        <div className="grid items-stretch gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <Card pad="roomy" className="flex flex-col">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Send a message
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For anything that is not booking a time: general questions, feedback, or a
              style you want to ask about first.
            </p>

            {state === 'sent' ? (
              <p
                ref={sentRef}
                tabIndex={-1}
                role="status"
                className="mt-6 rounded-lg bg-tint-brand p-4 text-sm text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Thank you. Your message is on its way to us, and we will reply as soon as
                the salon is open.
              </p>
            ) : (
              <form
                onSubmit={(e) => void onSubmit(e)}
                className="mt-6 flex flex-1 flex-col space-y-4"
              >
                <div>
                  <label
                    htmlFor="contact-name"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    autoComplete="name"
                    maxLength={200}
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={cn(publicField, 'h-11')}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    maxLength={320}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-input px-3.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    maxLength={4000}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={cn(publicField, 'resize-y py-2.5')}
                  />
                </div>

                {state === 'error' && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorText ??
                      'That did not send. Please try again, or call or WhatsApp us directly.'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className={cn(publicButton(), 'h-12 w-full text-base')}
                >
                  {state === 'sending' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </Card>

          <div className="flex flex-col gap-6">
            <div className="relative min-h-64 flex-1 overflow-hidden rounded-xl border border-border shadow-card">
              <img
                src={buildImageKitUrl(
                  '/kokolett/marketing/hero-golden-braids-portrait.jpg',
                  {
                    width: 900,
                    quality: 85,
                  },
                )}
                alt="A finished braided style at Kokolett Beauty UK, a women's hair salon in Thamesmead, South East London"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: '50% 25%' }}
                loading="lazy"
                decoding="async"
              />
              <div
                className="bg-grain absolute inset-0 opacity-20 mix-blend-overlay"
                aria-hidden="true"
              />
              {/* Was `bg-gradient-to-t from-black/70 ...`, which produced
                  `rgba(0,0,0,0)` at every stop: the colour scale is closed and
                  has no `black`, so the whole scrim was transparent and the
                  caption below sat directly on the photograph. Same constant
                  the gallery and services cards use. */}
              <div
                className="absolute inset-0"
                style={{ backgroundImage: PHOTO_SCRIM }}
                aria-hidden="true"
              />
              <p className="absolute bottom-4 left-4 right-4 font-serif text-lg font-semibold text-hero-fg">
                Kokolett Beauty UK, Thamesmead
              </p>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Prefer to talk it through? Call or WhatsApp and we will get back to you
                the same day the salon is open.
              </p>
              <p>
                Looking for a time instead?{' '}
                <Link
                  to={routes.public.book}
                  className="font-medium text-brand-ink underline underline-offset-4"
                >
                  Book online
                </Link>{' '}
                or{' '}
                <Link
                  to={routes.public.requestAvailability}
                  className="font-medium text-brand-ink underline underline-offset-4"
                >
                  ask for a time
                </Link>{' '}
                if nothing is currently open.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function PhoneIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function WhatsAppIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 1.7.5 3.4 1.3 4.8l-1.4 5 5.2-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.6-9.8-9.6zm5.6 13.9c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1-4.4-3.8-4.6-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.4.7-.8.9-1.1 1.3-.1.2-.3.3-.1.6.7 1.2 1.4 1.9 2.5 2.6.4.2.6.2.8-.1.2-.3.7-.9.9-1.2.2-.3.4-.2.6-.1.6.3 1.9.9 2.2 1.1.3.1.5.2.6.3.1.2.1.9-.1 1.5z" />
    </svg>
  );
}

function EmailIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 6l-10 7L2 6" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function CalendarIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function InstagramIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 0 1 18 0z"
      />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
