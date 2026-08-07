/**
 * Display formatting for money, time and duration.
 *
 * Two rules this module exists to enforce:
 *   - Money is integer pence everywhere in the codebase. It becomes a decimal
 *     string only here, at the last moment before a human reads it.
 *   - Timestamps are UTC in storage and rendered in the salon's timezone, never
 *     the browser's. A customer booking from abroad, or an owner on holiday,
 *     must still see salon time — otherwise "10:00" means two different things.
 */

/** Fallback only. Real value comes from `booking_settings.timezone`. */
export const DEFAULT_TIMEZONE = 'Europe/London';
export const LOCALE = 'en-GB';

/** 1500 → "£15.00" */
export function formatMoney(pence: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

/** "15.00" or "15" → 1500. Returns null when the input is not a valid amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '').trim();
  if (cleaned === '' || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 90 → "1h 30m"; 45 → "45m"; 120 → "2h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmt(
  iso: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
}

/** "10:15" in salon time. */
export function formatTime(iso: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return fmt(iso, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "Thu 6 Aug" in salon time. */
export function formatDateShort(iso: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return fmt(iso, timeZone, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Thursday 6 August 2026" in salon time. */
export function formatDateLong(iso: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return fmt(iso, timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "Thu 6 Aug, 10:15" in salon time. */
export function formatDateTime(iso: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return `${formatDateShort(iso, timeZone)}, ${formatTime(iso, timeZone)}`;
}

/**
 * "in 3 hours" / "2 days ago". Used for approval deadlines, where the absolute
 * time matters less than how much rope is left.
 */
export function formatRelative(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'now';
}

/**
 * The salon-local calendar date of a UTC instant, as `yyyy-mm-dd`.
 * `en-CA` is used because it is the one common locale whose short date format
 * is already ISO order — cheaper and less error-prone than reassembling parts.
 */
export function toSalonDate(iso: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Offset of `timeZone` from UTC, in milliseconds, at a given instant.
 * Positive east of Greenwich. Derived by asking Intl what the wall clock reads
 * there and comparing — which is the only way to get this right across DST
 * without pulling in a date library.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    // Intl can emit hour 24 for midnight under hour12: false.
    get('hour') % 24,
    get('minute'),
    get('second'),
  );

  return asIfUtc - at.getTime();
}

/**
 * The UTC instants bounding one salon-local day.
 *
 * `new Date('2026-08-06T00:00:00')` parses in the *browser's* zone, so an owner
 * on holiday abroad — or a CI box on UTC in winter — would silently query the
 * wrong day. This anchors to the salon's wall clock instead.
 *
 * @param date  Salon-local calendar date as `yyyy-mm-dd`.
 */
export function salonDayRange(
  date: string,
  timeZone = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  const naiveUtc = new Date(`${date}T00:00:00Z`);
  // Offset is evaluated at the naive instant, then re-checked at the corrected
  // one so a day that begins across a DST boundary still lands on midnight.
  const firstPass = new Date(naiveUtc.getTime() - zoneOffsetMs(naiveUtc, timeZone));
  const start = new Date(naiveUtc.getTime() - zoneOffsetMs(firstPass, timeZone));

  const naiveNextUtc = new Date(naiveUtc.getTime() + 86_400_000);
  const nextFirstPass = new Date(
    naiveNextUtc.getTime() - zoneOffsetMs(naiveNextUtc, timeZone),
  );
  const end = new Date(naiveNextUtc.getTime() - zoneOffsetMs(nextFirstPass, timeZone));

  return { start, end };
}

/**
 * The UTC instant of a salon-local wall-clock time.
 *
 * `new Date('2026-08-07T10:00')` parses in the *browser's* zone, so an owner
 * abroad would book the appointment an hour or more out from what she typed.
 *
 * @param date `yyyy-mm-dd`, @param time `HH:MM`, both salon-local.
 */
export function salonInstant(
  date: string,
  time: string,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const naiveUtc = new Date(`${date}T${time}:00Z`);
  const firstPass = new Date(naiveUtc.getTime() - zoneOffsetMs(naiveUtc, timeZone));
  return new Date(naiveUtc.getTime() - zoneOffsetMs(firstPass, timeZone));
}

/** Today's salon-local day boundaries, as UTC instants. */
export function salonToday(timeZone = DEFAULT_TIMEZONE): {
  date: string;
  start: Date;
  end: Date;
} {
  const date = toSalonDate(new Date(), timeZone);
  return { date, ...salonDayRange(date, timeZone) };
}

/** Add whole days to a `yyyy-mm-dd` string, staying in calendar space. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "09:00:00" → "09:00". Postgres `time` columns carry seconds we never show. */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** 0 = Sunday, matching Postgres `extract(dow …)` and `availability_rules`. */
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? '—';
}

export const DAYS_OF_WEEK = DAY_NAMES.map((name, index) => ({ index, name }));
