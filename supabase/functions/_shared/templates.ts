/**
 * Email bodies.
 *
 * Rendered here rather than in SQL so copy changes are a deploy, not a
 * migration. The trigger supplies a template name plus a payload; this turns
 * that into subject-matched HTML and a plain-text alternative.
 *
 * Design notes, because email is not the web:
 *
 *   * Tables and inline styles only. Gmail strips <style> blocks, Outlook has
 *     no flexbox or grid, and a stylesheet in <head> is thrown away by roughly
 *     half of all clients. Everything here is a table with a style attribute.
 *   * Every message is sent as HTML and plain text. A text/plain part is not
 *     optional politeness: without it, spam filters score the message worse,
 *     which for a salon whose entire confirmation flow runs on email is a real
 *     deliverability risk.
 *   * The footer carries the salon's registered details, address, phone and a
 *     line explaining why the person is receiving this. That combination is
 *     what makes a transactional email read as genuine rather than as a
 *     phishing attempt, and it is what keeps it out of the promotions tab.
 *   * No prices anywhere. What an appointment costs is agreed in the chair,
 *     because a full head of knotless braids and a trim are not the same
 *     afternoon, and a number in an email is a promise.
 */

export interface TemplatePayload {
  reference?: string;
  customer_name?: string;
  customer_email?: string;
  customer_mobile?: string | null;
  customer_note?: string | null;
  owner_note?: string | null;
  service_name?: string;
  starts_at?: string;
  ends_at?: string;
  previous_starts_at?: string;
  timezone?: string;
  approval_window_h?: number;
  cancellation_window_h?: number;
  reason?: string | null;
  google_review_url?: string | null;
  instagram_url?: string | null;
  salon_address?: string | null;
  salon_phone?: string | null;
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
const EMAIL = 'booking@koko.gakinz.com';

/* Palette lifted from docs/DESIGN.md. Hard-coded, because an email cannot read
   a CSS custom property and half of clients would drop the variable anyway. */
const INK = '#333333';
const MUTED = '#6b7280';
const LINE = '#dcdfe2';
const BRAND = '#e05d38';
const PAPER = '#e8ebed';

function when(iso?: string, timeZone = 'Europe/London'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function clock(iso?: string, timeZone = 'Europe/London'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** "Sunday, 9 August 2026 at 14:00" */
function full(iso?: string, timeZone = 'Europe/London'): string {
  if (!iso) return '';
  return `${when(iso, timeZone)} at ${clock(iso, timeZone)}`;
}

/** Escape anything that reaches HTML. Customer names and notes are untrusted. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The shell every message sits in.
 *
 * `preheader` is the grey line a mail client prints beside the subject in the
 * inbox list. Left unset, clients scrape the first words of the body, which is
 * usually "Hello Jane" and tells the reader nothing. It is hidden in the body
 * itself by the usual zero-height trick.
 */
function layout(
  heading: string,
  preheader: string,
  bodyHtml: string,
  p: TemplatePayload,
  footerReason: string,
): string {
  const contact = [
    p.salon_address ? esc(p.salon_address) : null,
    p.salon_phone
      ? `<a href="tel:${esc(String(p.salon_phone).replace(/\s/g, ''))}" style="color:${MUTED};text-decoration:none">${esc(p.salon_phone)}</a>`
      : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  const social = [
    `<a href="${SITE}" style="color:${MUTED};text-decoration:underline">Website</a>`,
    p.instagram_url
      ? `<a href="${esc(p.instagram_url)}" style="color:${MUTED};text-decoration:underline">Instagram</a>`
      : null,
    p.google_review_url
      ? `<a href="${esc(p.google_review_url)}" style="color:${MUTED};text-decoration:underline">Reviews</a>`
      : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="en-GB"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER}">
   <tr><td align="center" style="padding:24px 12px">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden">

      <!-- Masthead -->
      <tr><td style="padding:24px 32px 20px;border-bottom:1px solid ${LINE}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:${INK};letter-spacing:-0.2px">
              Kokolett <span style="color:${BRAND}">Beauty</span> UK
            </td>
            <td align="right" style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1.2px;padding-left:12px">
              Women&rsquo;s hair salon
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:700;color:${INK}">${esc(heading)}</h1>
        ${bodyHtml}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 32px;border-top:1px solid ${LINE};background:#fafbfc;font-size:12px;line-height:1.7;color:${MUTED}">
        <p style="margin:0 0 8px;font-weight:600;color:${INK};font-size:13px">${SALON}</p>
        ${contact ? `<p style="margin:0 0 4px">${contact}</p>` : ''}
        <p style="margin:0 0 10px">
          <a href="mailto:${EMAIL}" style="color:${MUTED};text-decoration:none">${EMAIL}</a>
        </p>
        <p style="margin:0 0 12px">${social}</p>
        <p style="margin:0;padding-top:10px;border-top:1px solid ${LINE};font-size:11px;color:${MUTED}">
          ${esc(footerReason)} This message was sent from ${EMAIL}. If it reached you by
          mistake, please ignore it and nothing further will happen.
        </p>
      </td></tr>

    </table>
   </td></tr>
  </table>
</body></html>`;
}

/**
 * The appointment, set out as a panel rather than a sentence.
 *
 * Date and time on separate rows and in a larger type size, because this is the
 * one thing the reader opened the email to check, often on a phone, often in a
 * hurry. The reference is last: useful, but nobody is scanning for it.
 */
function details(p: TemplatePayload, label = 'Your appointment'): string {
  if (!p.starts_at) return '';
  const tz = p.timezone ?? 'Europe/London';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border:1px solid ${LINE};border-radius:10px;border-collapse:separate">
    <tr><td style="padding:18px 20px">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:${MUTED}">${esc(label)}</p>
      <p style="margin:0 0 2px;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;color:${INK}">${esc(when(p.starts_at, tz))}</p>
      <p style="margin:0 0 14px;font-size:17px;font-weight:600;color:${BRAND}">${esc(clock(p.starts_at, tz))}${p.ends_at ? ` &ndash; ${esc(clock(p.ends_at, tz))}` : ''}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;color:${MUTED};border-top:1px solid ${LINE}">
        ${p.service_name ? `<tr><td style="padding:10px 0 0">${esc(p.service_name)}</td></tr>` : ''}
        ${p.reference ? `<tr><td style="padding:4px 0 0">Booking reference <span style="font-family:'SFMono-Regular',Consolas,monospace;color:${INK};font-weight:600">${esc(p.reference)}</span></td></tr>` : ''}
      </table>
    </td></tr>
  </table>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0">
    <tr><td style="border-radius:8px;background:${BRAND}">
      <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(label)}</a>
    </td></tr>
  </table>`;
}

function line(s: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${INK}">${s}</p>`;
}

function small(s: string): string {
  return `<p style="margin:14px 0 0;font-size:13px;line-height:1.65;color:${MUTED}">${s}</p>`;
}

/** A short, quiet aside. Used for "what to bring" style notes. */
function aside(s: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0">
    <tr><td style="padding:14px 16px;background:#f6f7f8;border-left:3px solid ${BRAND};border-radius:0 6px 6px 0;font-size:13px;line-height:1.6;color:${MUTED}">${s}</td></tr>
  </table>`;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/** The plain-text half. Same facts, no markup, safe to read aloud. */
function plainShell(body: string, p: TemplatePayload, reason: string): string {
  const tz = p.timezone ?? 'Europe/London';
  const block = [
    p.starts_at ? `When:      ${full(p.starts_at, tz)}` : '',
    p.service_name ? `What:      ${p.service_name}` : '',
    p.reference ? `Reference: ${p.reference}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const contact = [p.salon_address, p.salon_phone].filter(Boolean).join(' · ');

  return [
    body,
    block,
    p.manage_url ? `View or change your booking:\n${p.manage_url}` : '',
    '--',
    SALON,
    contact,
    `${EMAIL} · ${SITE}`,
    reason,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function render(template: string, p: TemplatePayload): RenderedEmail {
  const tz = p.timezone ?? 'Europe/London';
  const name = esc(p.customer_name ?? p.full_name ?? 'there');
  const manage = p.manage_url ? button(p.manage_url, 'View or change your booking') : '';
  const window_ = p.cancellation_window_h ?? 24;

  /** Every transactional message says why it arrived. */
  const BOOKING_REASON =
    'You are receiving this because an appointment was booked with Kokolett Beauty UK using this email address.';

  switch (template) {
    case 'booking_confirmed':
    case 'booking_approved':
      return {
        html: layout(
          'You are booked in',
          `${when(p.starts_at, tz)} at ${clock(p.starts_at, tz)}, reference ${p.reference ?? ''}`,
          line(`Hello ${name}, that is all confirmed. We are looking forward to seeing you.`) +
            details(p) +
            manage +
            aside(
              `Please arrive with your hair as it usually is unless we have agreed otherwise. If you are running late, call us on the number below rather than not turning up, and we will do what we can.`,
            ) +
            small(
              `Need to change it? You can move or cancel it yourself from the link above. Please give us at least ${esc(window_)} hours&rsquo; notice where you can, so somebody else can take the time.`,
            ),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, your appointment is confirmed.`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'booking_rescheduled':
      return {
        html: layout(
          'Your appointment has moved',
          `Now ${when(p.starts_at, tz)} at ${clock(p.starts_at, tz)}`,
          line(`Hello ${name}, that is done. Your appointment is now:`) +
            details(p, 'Your new time') +
            (p.previous_starts_at
              ? small(
                  `This replaces your booking on ${esc(full(p.previous_starts_at, tz))}, which has been released.`,
                )
              : '') +
            manage +
            small(
              `Your booking reference has changed to <strong style="color:${INK}">${esc(p.reference ?? '')}</strong>. Please quote the new one.`,
            ),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, your appointment has been moved.${
            p.previous_starts_at
              ? ` It was ${full(p.previous_starts_at, tz)}.`
              : ''
          }`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'booking_held':
      return {
        html: layout(
          'We have your booking request',
          `Held while we confirm, ${when(p.starts_at, tz)} at ${clock(p.starts_at, tz)}`,
          line(`Hello ${name}, thank you for booking with us.`) +
            line(
              `As this is your first visit, we are holding this time while we confirm it, usually within ${esc(p.approval_window_h ?? 12)} hours. Nobody else can take it in the meantime.`,
            ) +
            details(p, 'Held for you') +
            manage +
            small(
              'You will get a second email as soon as it is confirmed. There is nothing you need to do until then.',
            ),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, thank you for booking. As this is your first visit we are holding this time while we confirm it, usually within ${p.approval_window_h ?? 12} hours. Nobody else can take it in the meantime.`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'booking_declined':
      return {
        html: layout(
          'About your booking request',
          'We are not able to take that appointment',
          line(`Hello ${name},`) +
            line(
              `We are sorry, we are not able to take that appointment.${p.reason ? ` ${esc(p.reason)}` : ''}`,
            ) +
            details(p, 'The time you asked for') +
            line('Nothing has been charged and the time is back on the calendar.') +
            button(`${SITE}/book`, 'Find another time'),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, we are sorry, we are not able to take that appointment.${p.reason ? ` ${p.reason}` : ''}\n\nFind another time: ${SITE}/book`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'booking_cancelled':
      return {
        html: layout(
          'Your appointment is cancelled',
          `Cancelled: ${when(p.starts_at, tz)}`,
          line(`Hello ${name}, this appointment has been cancelled.`) +
            details(p, 'Cancelled') +
            (p.reason ? small(`Reason given: ${esc(p.reason)}`) : '') +
            line('Nothing has been charged. We would be glad to see you another time.') +
            button(`${SITE}/book`, 'Book again'),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, this appointment has been cancelled. Nothing has been charged.\n\nBook again: ${SITE}/book`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'reminder_24h':
      return {
        html: layout(
          'See you tomorrow',
          `Tomorrow at ${clock(p.starts_at, tz)}`,
          line(`Hello ${name}, a reminder that we are expecting you tomorrow.`) +
            details(p) +
            manage +
            small(
              `If tomorrow no longer works, please let us know as soon as you can so we can offer the time to somebody else.`,
            ),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, a reminder that we are expecting you tomorrow.`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'reminder_1h':
    case 'reminder_2h':
      return {
        html: layout(
          'See you in an hour',
          `Today at ${clock(p.starts_at, tz)}`,
          line(`Hello ${name}, your appointment is in about an hour.`) +
            details(p) +
            (p.salon_address
              ? aside(
                  `We are at <strong style="color:${INK}">${esc(p.salon_address)}</strong>.${p.salon_phone ? ` If you cannot find us, call ${esc(p.salon_phone)}.` : ''}`,
                )
              : '') +
            small('Running late? A quick call is all we need.'),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, your appointment is in about an hour.`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'appointment_completed':
    case 'review_request':
      return {
        html: layout(
          'Thank you for coming in',
          'Your appointment is complete',
          line(`Hello ${name}, thank you for coming in today. We hope you love it.`) +
            details(p, 'Completed') +
            (p.google_review_url
              ? line(
                  'If you have a moment, a few words on Google genuinely helps a small salon. It is the main way new customers find us.',
                ) + button(p.google_review_url, 'Leave a review')
              : '') +
            aside(
              'To keep the style looking its best, sleep on a satin or silk scarf, keep the scalp moisturised, and come back for a retouch before it starts to loosen rather than after.',
            ) +
            line('Ready for the next one?') +
            button(`${SITE}/book`, 'Book your next appointment'),
          p,
          BOOKING_REASON,
        ),
        text: plainShell(
          `Hello ${p.customer_name}, thank you for coming in today. We hope you love it.${
            p.google_review_url
              ? `\n\nIf you have a moment, a review genuinely helps a small salon:\n${p.google_review_url}`
              : ''
          }\n\nBook your next appointment: ${SITE}/book`,
          p,
          BOOKING_REASON,
        ),
      };

    case 'request_received':
      return {
        html: layout(
          'We have your enquiry',
          'We will come back to you as soon as we can',
          line(`Hello ${name}, thank you for getting in touch.`) +
            line(
              'We will look at what we can open up and come back to you as soon as we can. Requests are answered in the order they arrive.',
            ) +
            small(
              `In the meantime, times do free up when somebody cancels. It is worth checking the calendar.`,
            ) +
            button(`${SITE}/book`, 'See what is open'),
          p,
          'You are receiving this because you asked Kokolett Beauty UK for an appointment time using this email address.',
        ),
        text: plainShell(
          `Hello ${p.full_name}, thank you for getting in touch. We will look at what we can open up and come back to you as soon as we can.\n\nSee what is open: ${SITE}/book`,
          p,
          'You asked us for an appointment time.',
        ),
      };

    case 'access_link':
      return {
        html: layout(
          'Your bookings',
          'A sign-in link that works once and expires in 30 minutes',
          line('Here is your secure link. It works once and expires in 30 minutes.') +
            (p.manage_url ? button(p.manage_url, 'View my bookings') : '') +
            small(
              'If you did not ask for this, you can safely ignore it. The link only shows bookings made with this email address, and nothing happens until it is opened.',
            ),
          p,
          'You are receiving this because somebody asked to see the bookings held against this email address at Kokolett Beauty UK.',
        ),
        text: plainShell(
          `Here is your secure link. It works once and expires in 30 minutes.\n\n${p.manage_url ?? ''}\n\nIf you did not ask for this, you can safely ignore it.`,
          p,
          'Somebody asked to see the bookings held against this address.',
        ),
      };

    /* ---- Owner-facing ------------------------------------------------
       Shorter, denser, and every one links straight to the screen where
       something can be done about it. */
    case 'owner_approval_needed':
      return {
        html: layout(
          'A booking needs your approval',
          `${p.customer_name ?? ''}, first visit`,
          line(
            `<strong style="color:${INK}">${esc(p.customer_name)}</strong> (first visit) has requested an appointment. The slot is held until you decide.`,
          ) +
            details(p, 'Requested') +
            line(
              `${esc(p.customer_email)}${p.customer_mobile ? ` &nbsp;·&nbsp; ${esc(p.customer_mobile)}` : ''}`,
            ) +
            (p.customer_note ? aside(`Their note: ${esc(p.customer_note)}`) : '') +
            button(`${SITE}/dashboard/approvals`, 'Open approvals'),
          p,
          'You are receiving this as the owner of Kokolett Beauty UK.',
        ),
        text: `${p.customer_name} (first visit) has requested an appointment. The slot is held until you decide.\n\n${full(p.starts_at, tz)}\n${p.customer_email}${p.customer_mobile ? ` · ${p.customer_mobile}` : ''}\n\n${SITE}/dashboard/approvals`,
      };

    case 'owner_booking_moved':
      return {
        html: layout(
          'A booking has moved',
          `${p.customer_name ?? ''} changed their appointment`,
          line(
            `<strong style="color:${INK}">${esc(p.customer_name)}</strong> has changed their appointment. This was the old time:`,
          ) +
            details(p, 'Released') +
            line(
              `${esc(p.customer_email)}${p.customer_mobile ? ` &nbsp;·&nbsp; ${esc(p.customer_mobile)}` : ''}`,
            ) +
            line('The new one is on your calendar.') +
            button(`${SITE}/dashboard/calendar`, 'Open the calendar'),
          p,
          'You are receiving this as the owner of Kokolett Beauty UK.',
        ),
        text: `${p.customer_name} has changed their appointment.\n\nOld time: ${full(p.starts_at, tz)}\n${p.customer_email}${p.customer_mobile ? ` · ${p.customer_mobile}` : ''}\n\nThe new one is on your calendar: ${SITE}/dashboard/calendar`,
      };

    case 'owner_new_booking':
      return {
        html: layout(
          'New booking',
          `${p.customer_name ?? ''}, ${when(p.starts_at, tz)}`,
          line(`<strong style="color:${INK}">${esc(p.customer_name)}</strong> has booked in.`) +
            details(p, 'Booked') +
            line(
              `${esc(p.customer_email)}${p.customer_mobile ? ` &nbsp;·&nbsp; ${esc(p.customer_mobile)}` : ''}`,
            ) +
            (p.customer_note ? aside(`Their note: ${esc(p.customer_note)}`) : '') +
            button(`${SITE}/dashboard/calendar`, 'Open the calendar'),
          p,
          'You are receiving this as the owner of Kokolett Beauty UK.',
        ),
        text: `${p.customer_name} has booked in.\n\n${full(p.starts_at, tz)}\n${p.customer_email}${p.customer_mobile ? ` · ${p.customer_mobile}` : ''}\n\n${SITE}/dashboard/calendar`,
      };

    case 'owner_new_request':
      return {
        html: layout(
          'New enquiry',
          `${p.full_name ?? ''} could not find a slot`,
          line(
            `<strong style="color:${INK}">${esc(p.full_name)}</strong> could not find a slot and has asked for a time.`,
          ) +
            line(`${esc(p.email)}${p.mobile ? ` &nbsp;·&nbsp; ${esc(p.mobile)}` : ''}`) +
            line(
              `Prefers: ${esc((p.preferred_dates ?? []).join(', ') || 'no date given')} &nbsp;·&nbsp; ${esc(p.flexibility ?? 'any time')}`,
            ) +
            (p.notes ? aside(`Their note: ${esc(p.notes)}`) : '') +
            button(`${SITE}/dashboard/requests`, 'Open enquiries'),
          p,
          'You are receiving this as the owner of Kokolett Beauty UK.',
        ),
        text: `${p.full_name} could not find a slot and has asked for a time.\n${p.email}${p.mobile ? ` · ${p.mobile}` : ''}\nPrefers: ${(p.preferred_dates ?? []).join(', ') || 'no date given'} · ${p.flexibility ?? 'any'}\n\n${SITE}/dashboard/requests`,
      };

    default:
      return {
        html: layout(
          SALON,
          'A message from the salon',
          line('You have a message from the salon.'),
          p,
          'You are receiving this because you have booked with Kokolett Beauty UK.',
        ),
        text: `You have a message from ${SALON}.`,
      };
  }
}
