import { type JSX } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONE } from '@/lib/requestStatus';
import type { QueuedRequest } from '@/services/requestService';

/**
 * Who the enquiry is from, and where the request currently stands.
 *
 * Split out of `RequestDetailPanel` when that file crossed the 500-line limit
 * in `CLAUDE.md`. It is the natural seam: everything here is read-only
 * identity, while the rest of the panel is the offer and decline machinery
 * with its own state. Both contact rows are real links, because a phone number
 * the owner cannot tap is a phone number she has to retype.
 */
export function RequestContactHeader({
  request,
}: {
  request: QueuedRequest;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={request.full_name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-serif text-base font-semibold text-foreground">
            {request.full_name}
          </p>
          <Badge tone={REQUEST_STATUS_TONE[request.status]}>
            {REQUEST_STATUS_LABELS[request.status]}
          </Badge>
        </div>
        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
            <a
              href={`mailto:${request.email}`}
              className="truncate text-foreground hover:underline hover:underline-offset-4"
            >
              {request.email}
            </a>
          </p>
          {request.mobile && (
            <p className="flex items-center gap-2">
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              <a
                href={`tel:${request.mobile.replace(/\s/g, '')}`}
                className="truncate text-foreground hover:underline hover:underline-offset-4"
              >
                {request.mobile}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
