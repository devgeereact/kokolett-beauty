import {
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  PoundSterling,
  Star,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityKind } from '@/lib/insights';
import type { Tone } from '@/lib/tone';

export type NotificationCategory = 'booking' | 'payment' | 'review' | 'customer' | 'system';

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  booking: 'Bookings & appointments',
  payment: 'Payments',
  review: 'Reviews',
  customer: 'Customers',
  system: 'System & updates',
};

export type NotificationEventKind = ActivityKind | 'request' | 'payment' | 'review' | 'new_customer' | 'system';

const KIND_META: Record<NotificationEventKind, { icon: LucideIcon; tone: Tone; category: NotificationCategory; title: string }> = {
  created: { icon: Calendar, tone: 'primary', category: 'booking', title: 'New booking received' },
  rescheduled: { icon: CalendarClock, tone: 'pending', category: 'booking', title: 'Booking rescheduled' },
  cancelled: { icon: XCircle, tone: 'neutral', category: 'booking', title: 'Booking cancelled' },
  rejected: { icon: XCircle, tone: 'cancelled', category: 'booking', title: 'Booking declined' },
  completed: { icon: CheckCircle2, tone: 'completed', category: 'booking', title: 'Appointment completed' },
  no_show: { icon: XCircle, tone: 'cancelled', category: 'booking', title: 'Marked as a no-show' },
  request: { icon: CalendarClock, tone: 'in_service', category: 'booking', title: 'Availability request' },
  payment: { icon: PoundSterling, tone: 'in_service', category: 'payment', title: 'Payment received' },
  review: { icon: Star, tone: 'pending', category: 'review', title: 'New review received' },
  new_customer: { icon: UserPlus, tone: 'in_service', category: 'customer', title: 'New customer registered' },
  system: { icon: Bell, tone: 'neutral', category: 'system', title: 'System update' },
};

export function metaFor(kind: NotificationEventKind): (typeof KIND_META)[NotificationEventKind] {
  return KIND_META[kind] ?? KIND_META.system;
}
