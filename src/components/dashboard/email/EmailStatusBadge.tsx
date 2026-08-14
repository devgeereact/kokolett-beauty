import { Badge } from '@/components/ui/Badge';
import type { Tone } from '@/lib/tone';
import type { EmailMessage } from '@/types';

const STATUS_TONE: Record<EmailMessage['status'], Tone> = {
  queued: 'pending',
  sending: 'in_service',
  sent: 'completed',
  failed: 'cancelled',
  bounced: 'cancelled',
};

const STATUS_LABEL: Record<EmailMessage['status'], string> = {
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  bounced: 'Bounced',
};

export function EmailStatusBadge({ status }: { status: EmailMessage['status'] }): JSX.Element {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
