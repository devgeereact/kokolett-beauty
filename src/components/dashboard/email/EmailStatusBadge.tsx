import type { JSX } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { Tone } from '@/lib/tone';
import type { EmailMessage } from '@/types';

const STATUS_TONE: Record<EmailMessage['status'], Tone> = {
  queued: 'pending',
  sending: 'in_service',
  sent: 'completed',
  /* Neutral, not a failure tone. A withdrawn reminder is the system working. */
  cancelled: 'pending',
  failed: 'cancelled',
  bounced: 'cancelled',
};

const STATUS_LABEL: Record<EmailMessage['status'], string> = {
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  /* "Withdrawn" rather than "Cancelled": the appointment was cancelled, and
     labelling the message the same way reads as a second cancellation. */
  cancelled: 'Withdrawn',
  failed: 'Failed',
  bounced: 'Bounced',
};

export function EmailStatusBadge({
  status,
}: {
  status: EmailMessage['status'];
}): JSX.Element {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
