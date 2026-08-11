/**
 * The owner's calendar subscription.
 *
 * Serves the salon diary as iCalendar (RFC 5545) so Apple Calendar, Google
 * Calendar or Outlook can subscribe to it and show bookings beside everything
 * else in the owner's week.
 *
 * Authentication is the URL. Calendar clients fetch a subscription anonymously
 * and cannot send an Authorization header, so the token travels as a query
 * parameter and is checked by `calendar_feed_events`, which is service-role
 * only. Deployed with --no-verify-jwt for the same reason: a calendar app has
 * no Supabase key to present.
 *
 * On "realtime": no calendar client streams. They poll, and how often is the
 * client's decision, not ours. Apple Calendar can be set to every five minutes
 * and honours the refresh hints below. Google Calendar ignores them and refetches
 * on its own schedule, historically several hours and occasionally up to a day.
 * The hints are still sent because the clients that respect them are the ones
 * the owner will actually use on her phone.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://www.kokolettbeauty.com';

interface FeedEvent {
  id: string;
  reference: string;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  customer_mobile: string | null;
  customer_note: string | null;
  owner_note: string | null;
  first_visit: boolean;
}

/** RFC 5545 escaping for TEXT values. Backslash first, or it doubles the rest. */
function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 20260815T100000Z */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Fold to 75 octets, as the spec requires.
 *
 * Counted in bytes rather than characters: a customer called Zoë pushes the
 * line over the limit one character earlier than its length suggests, and
 * Outlook is the client that notices.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let width = 0;

  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    // Continuation lines start with a space, which costs one of the 75.
    if (width + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      width = 0;
    }
    current += char;
    width += size;
  }
  if (current) out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

/** Calendar status for one of ours. Anything live reads as busy. */
function icalStatus(status: string): string {
  if (status === 'cancelled' || status === 'no_show') return 'CANCELLED';
  if (status === 'pending_approval') return 'TENTATIVE';
  return 'CONFIRMED';
}

function buildCalendar(events: FeedEvent[], address: string | null): string {
  const now = stamp(new Date().toISOString());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kokolett Beauty UK//Salon diary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kokolett Beauty UK',
    'X-WR-CALDESC:Appointments booked at Kokolett Beauty UK',
    'X-WR-TIMEZONE:Europe/London',
    // Both spellings: the standard property and the one Apple reads.
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const e of events) {
    const cancelled = icalStatus(e.status) === 'CANCELLED';
    const title = cancelled
      ? `Cancelled: ${e.customer_name}`
      : e.status === 'pending_approval'
        ? `Awaiting approval: ${e.customer_name}`
        : e.first_visit
          ? `${e.customer_name} (first visit)`
          : e.customer_name;

    const description = [
      `Reference: ${e.reference}`,
      `Email: ${e.customer_email}`,
      e.customer_mobile ? `Mobile: ${e.customer_mobile}` : '',
      e.customer_note ? `\nThey said: ${e.customer_note}` : '',
      e.owner_note ? `\nYour note: ${e.owner_note}` : '',
      `\nOpen the dashboard: ${SITE}/dashboard/appointments`,
    ]
      .filter(Boolean)
      .join('\n');

    lines.push(
      'BEGIN:VEVENT',
      // Stable per appointment, so an update replaces rather than duplicates.
      `UID:${e.id}@kokolettbeauty.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(e.ends_at)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(description)}`,
      ...(address ? [`LOCATION:${esc(address)}`] : []),
      `STATUS:${icalStatus(e.status)}`,
      `TRANSP:${cancelled ? 'TRANSPARENT' : 'OPAQUE'}`,
      `URL:${SITE}/dashboard/appointments`,
      `LAST-MODIFIED:${stamp(e.updated_at ?? e.created_at)}`,
      // Bumped when the row changes, so clients accept the newer copy.
      `SEQUENCE:${Math.floor(new Date(e.updated_at ?? e.created_at).getTime() / 1000)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  // Accept the token as ?token= or as the last path segment, because some
  // calendar clients mangle query strings on a webcal:// URL.
  const token =
    url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';

  if (!token || token === 'calendar-feed') {
    return new Response('Missing token', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin.rpc('calendar_feed_events', { p_token: token });

  if (error) {
    // A bad token and a broken query must look the same from outside; the
    // difference is a signal worth having if you are guessing.
    console.error('calendar-feed rejected:', error.message);
    return new Response('Not authorised', { status: 401 });
  }

  const { data: settings } = await admin
    .from('booking_settings')
    .select('address_line')
    .limit(1)
    .maybeSingle();

  const body = buildCalendar(
    (data ?? []) as FeedEvent[],
    settings?.address_line ?? null,
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kokolett-beauty.ics"',
      // Never let a proxy hold a stale diary.
      'Cache-Control': 'no-cache, max-age=0',
    },
  });
});
