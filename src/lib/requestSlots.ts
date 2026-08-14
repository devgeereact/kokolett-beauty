import { listDaySlots, type OwnerDaySlot } from '@/services/availabilityService';
import { addDays, formatTime, salonToday } from '@/lib/format';

export interface SuggestedSlot {
  date: string;
  /** ISO instant of the first open slot on that date, already duration-aware. */
  startsAt: string;
  endsAt: string;
  label: string;
}

function localTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Does an open slot fall within the requester's stated time-of-day preference? */
function matchesFlexibility(localTime: string, flexibility: string): boolean {
  const minutes = localTimeToMinutes(localTime);
  if (flexibility === 'morning') return minutes < 12 * 60;
  if (flexibility === 'afternoon') return minutes >= 12 * 60 && minutes < 17 * 60;
  if (flexibility === 'evening') return minutes >= 17 * 60;
  return true;
}

/**
 * Real availability, not a fabricated grid — for each candidate date this
 * reads the salon's actually-published, actually-open slots
 * (`owner_day_slots`, the same source Calendar and the booking flow use) and
 * returns the first one that is not booked, not in the past, and matches the
 * requester's time-of-day preference.
 *
 * Candidate dates are the request's `preferred_dates` when given; an "any
 * date" request instead scans the next 14 days from today, since there is
 * nothing else to narrow the search by.
 */
export async function suggestSlotsForRequest(
  preferredDates: string[],
  flexibility: string,
  durationMin: number,
  timezone: string,
  maxSuggestions = 3,
): Promise<SuggestedSlot[]> {
  const today = salonToday(timezone).date;
  const candidates =
    preferredDates.length > 0
      ? preferredDates
      : Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const suggestions: SuggestedSlot[] = [];

  for (const date of candidates) {
    if (suggestions.length >= maxSuggestions) break;
    if (date < today) continue;

    let slots: OwnerDaySlot[];
    try {
      slots = await listDaySlots(date);
    } catch {
      continue;
    }

    const open = slots.find(
      (s) => !s.is_booked && !s.is_past && matchesFlexibility(s.local_time, flexibility),
    );
    if (!open) continue;

    const startsAt = new Date(open.starts_at);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    suggestions.push({
      date,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      label: `${formatTime(startsAt, timezone)} – ${formatTime(endsAt, timezone)}`,
    });
  }

  return suggestions;
}
