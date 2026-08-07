/**
 * Email bodies.
 *
 * Rendered here rather than in SQL so copy changes are a deploy, not a
 * migration. The trigger supplies a template name plus a payload; this turns
 * that into subject-matched HTML and a plain-text alternative.
 *
 * Every email is sent as both. A text/plain part is not optional politeness —
 * without it, spam filters score the message worse, which for a salon whose
 * entire confirmation flow is email is a real deliverability risk.
 */

export interface TemplatePayload {
  reference?: string;
  customer_name?: string;
  customer_email?: string;
  customer_mobile?: string | null;
  customer_note?: string | null;
  service_name?: string;
  starts_at?: string;
  ends_at?: string;
  price_pence?: number;
  timezone?: string;
  approval_window_h?: number;
  cancellation_window_h?: number;
  reason?: string | null;
  google_review_url?: string | null;
  full_name?: string;
  email?: string;
  mobile?: string | null;
  notes?: string | null;
  preferred_dates?: string[];
  flexibility?: string;
  /** Injected by the sender, never stored. */
  manage_url?: string;
}

const SALON = 'Kokolett Beauty UK';
const SITE = 'https://koko.gakinz.com';

function money(pence?: number): string {
  if (typeof pence !== 'number') return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    pence / 100,
  );
}

function when(iso?: string, timeZone = 'Europe/London'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Escape anything that reaches HTML. Customer names and notes are untrusted. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#e8ebed;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#333">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px;border-bottom:1px solid #dcdfe2">
      <span style="font-size:18px;font-weight:600">Kokolett <span style="color:#e05d38">Beauty</span> UK</span>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${esc(heading)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:20px 28px;border-top:1px solid #dcdfe2;font-size:13px;color:#6b7280">
      ${SALON} · Women's hair salon<br>
      <a href="mailto:booking@koko.gakinz.com" style="color:#6b7280">booking@koko.gakinz.com</a> ·
      <a href="${SITE}" style="color:#6b7280">${SITE.replace('https://', '')}</a>
    </td></tr>
  </table>
</body></html>`;
}

function details(p: TemplatePayload): string {
  const rows: [string, string][] = [
    ['Service', p.service_name ?? ''],
    ['When', when(p.starts_at, p.timezone)],
    ['Price', money(p.price_pence)],
    ['Reference', p.reference ?? ''],
  ].filter(([, v]) => v !== '') as [string, string][];

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;font-size:15px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 0;color:#6b7280">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:500">${esc(v)}</td></tr>`,
      )
      .join('')}
  </table>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${esc(url)}" style="display:inline-block;background:#e05d38;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function render(template: string, p: TemplatePayload): RenderedEmail {
  const line = (s: string): string => `<p style="margin:0 0 12px;line-height:1.6">${s}</p>`;
  const manage = p.manage_url
    ? button(p.manage_url, 'View or change your booking')
    : '';
  const manageText = p.manage_url
    ? `\n\nView or change your booking: ${p.manage_url}`
    : '';

  const plain = (body: string): string =>
    `${body}\n\n${p.service_name ? `Service: ${p.service_name}\n` : ''}${
      p.starts_at ? `When: ${when(p.starts_at, p.timezone)}\n` : ''
    }${p.price_pence ? `Price: ${money(p.price_pence)}\n` : ''}${
      p.reference ? `Reference: ${p.reference}\n` : ''
    }${manageText}\n\n${SALON} · booking@koko.gakinz.com`;

  switch (template) {
    case 'booking_confirmed':
    case 'booking_approved':
      return {
        html: layout(
          'You are booked in',
          line(`Hello ${esc(p.customer_name)}, your appointment is confirmed.`) +
            details(p) +
            manage +
            line(
              `Need to change it? Please give us at least ${esc(p.cancellation_window_h ?? 24)} hours' notice where you can.`,
            ),
        ),
        text: plain(
          `Hello ${p.customer_name}, your appointment is confirmed.`,
        ),
      };

    case 'booking_held':
      return {
        html: layout(
          'We have your booking request',
          line(`Hello ${esc(p.customer_name)}, thank you for booking with us.`) +
            line(
              `As this is your first visit, we are holding your slot while we confirm — usually within ${esc(p.approval_window_h ?? 12)} hours. Nobody else can take it in the meantime.`,
            ) +
            details(p) +
            manage,
        ),
        text: plain(
          `Hello ${p.customer_name}, thank you for booking. As this is your first visit we are holding your slot while we confirm — usually within ${p.approval_window_h ?? 12} hours.`,
        ),
      };

    case 'booking_declined':
      return {
        html: layout(
          'About your booking request',
          line(`Hello ${esc(p.customer_name)},`) +
            line(
              `We are very sorry — we are not able to take that appointment.${p.reason ? ` ${esc(p.reason)}` : ''}`,
            ) +
            details(p) +
            button(`${SITE}/book`, 'Find another time'),
        ),
        text: plain(
          `Hello ${p.customer_name}, we are sorry — we are not able to take that appointment.${p.reason ? ` ${p.reason}` : ''} Find another time: ${SITE}/book`,
        ),
      };

    case 'booking_cancelled':
      return {
        html: layout(
          'Your appointment is cancelled',
          line(`Hello ${esc(p.customer_name)}, this appointment has been cancelled.`) +
            details(p) +
            button(`${SITE}/book`, 'Book again'),
        ),
        text: plain(`Hello ${p.customer_name}, this appointment has been cancelled.`),
      };

    case 'reminder_24h':
      return {
        html: layout(
          'See you tomorrow',
          line(`Hello ${esc(p.customer_name)}, a reminder about your appointment.`) +
            details(p) +
            manage,
        ),
        text: plain(`Hello ${p.customer_name}, a reminder about your appointment tomorrow.`),
      };

    case 'reminder_2h':
      return {
        html: layout(
          'See you shortly',
          line(`Hello ${esc(p.customer_name)}, your appointment is in about two hours.`) +
            details(p),
        ),
        text: plain(`Hello ${p.customer_name}, your appointment is in about two hours.`),
      };

    case 'review_request':
      return {
        html: layout(
          'How did we do?',
          line(`Hello ${esc(p.customer_name)}, thank you for coming in.`) +
            line('If you have a moment, a short review genuinely helps a small salon.') +
            (p.google_review_url ? button(p.google_review_url, 'Leave a review') : ''),
        ),
        text: `Hello ${p.customer_name}, thank you for coming in. If you have a moment, a review helps a small salon enormously.${
          p.google_review_url ? `\n\n${p.google_review_url}` : ''
        }\n\n${SALON}`,
      };

    case 'request_received':
      return {
        html: layout(
          'We have your enquiry',
          line(`Hello ${esc(p.full_name)}, thank you for getting in touch.`) +
            line(
              'We will look at what we can open up and come back to you as soon as we can.',
            ),
        ),
        text: `Hello ${p.full_name}, thank you for getting in touch. We will look at what we can open up and come back to you as soon as we can.\n\n${SALON}`,
      };

    case 'access_link':
      return {
        html: layout(
          'Your bookings',
          line('Here is your secure link. It works once and expires in 30 minutes.') +
            (p.manage_url ? button(p.manage_url, 'View my bookings') : '') +
            line('If you did not ask for this, you can safely ignore it.'),
        ),
        text: `Here is your secure link. It works once and expires in 30 minutes.\n\n${p.manage_url}\n\nIf you did not ask for this, you can safely ignore it.\n\n${SALON}`,
      };

    /* ---- Owner-facing ---------------------------------------------- */
    case 'owner_approval_needed':
      return {
        html: layout(
          'A booking needs your approval',
          line(
            `${esc(p.customer_name)} (first visit) has requested an appointment. The slot is held until you decide.`,
          ) +
            details(p) +
            line(
              `${esc(p.customer_email)}${p.customer_mobile ? ` · ${esc(p.customer_mobile)}` : ''}`,
            ) +
            (p.customer_note ? line(`Note: ${esc(p.customer_note)}`) : '') +
            button(`${SITE}/dashboard/approvals`, 'Open approvals'),
        ),
        text: `${p.customer_name} (first visit) has requested an appointment. The slot is held until you decide.\n\n${when(p.starts_at, p.timezone)} · ${p.service_name}\n${p.customer_email}${p.customer_mobile ? ` · ${p.customer_mobile}` : ''}\n\n${SITE}/dashboard/approvals`,
      };

    case 'owner_new_booking':
      return {
        html: layout(
          'New booking',
          line(`${esc(p.customer_name)} has booked in.`) +
            details(p) +
            button(`${SITE}/dashboard/calendar`, 'Open the calendar'),
        ),
        text: `${p.customer_name} has booked in.\n\n${when(p.starts_at, p.timezone)} · ${p.service_name}\n\n${SITE}/dashboard/calendar`,
      };

    case 'owner_new_request':
      return {
        html: layout(
          'New enquiry',
          line(`${esc(p.full_name)} could not find a slot and has asked for a time.`) +
            line(`${esc(p.email)}${p.mobile ? ` · ${esc(p.mobile)}` : ''}`) +
            line(
              `Prefers: ${esc((p.preferred_dates ?? []).join(', ') || 'no date given')} · ${esc(p.flexibility ?? 'any')}`,
            ) +
            (p.notes ? line(`Note: ${esc(p.notes)}`) : '') +
            button(`${SITE}/dashboard/requests`, 'Open enquiries'),
        ),
        text: `${p.full_name} could not find a slot and has asked for a time.\n${p.email}${p.mobile ? ` · ${p.mobile}` : ''}\nPrefers: ${(p.preferred_dates ?? []).join(', ') || 'no date given'} · ${p.flexibility ?? 'any'}\n\n${SITE}/dashboard/requests`,
      };

    default:
      return {
        html: layout('Kokolett Beauty UK', line('You have a message from the salon.')),
        text: `You have a message from ${SALON}.`,
      };
  }
}
