import type { JSX } from 'react';
import { Calendar, Check, Mail, X } from 'lucide-react';
import type { Proposal } from '@/services/aiChatService';
import type { ProposalStatus } from '@/hooks/useAssistantConversations';
import { formatDateTime } from '@/lib/format';

interface AssistantProposalCardProps {
  proposal: Proposal;
  status: ProposalStatus;
  error?: string;
  timezone: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * A proposed booking or email, shown as a reviewable card the owner must
 * explicitly act on — this is the one boundary in the whole chat where a
 * click turns into a real write (`createAppointmentAsOwner` /
 * `sendCustomEmailAsOwner`, called from here under her own session, never
 * from the edge function itself).
 */
export function AssistantProposalCard({
  proposal,
  status,
  error,
  timezone,
  onConfirm,
  onDismiss,
}: AssistantProposalCardProps): JSX.Element {
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-status-completed bg-tint-completed px-3 py-2 text-xs font-medium text-status-completed">
        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {proposal.type === 'booking' ? 'Booked.' : 'Sent.'}
      </div>
    );
  }

  if (status === 'dismissed') {
    return (
      <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        Dismissed.
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {proposal.type === 'booking' ? (
          <Calendar aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Mail aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {proposal.type === 'booking' ? 'Proposed booking' : 'Proposed email'}
      </div>

      {proposal.type === 'booking' ? (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-right font-medium text-foreground">
              {proposal.full_name}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">When</dt>
            <dd className="text-right font-medium text-foreground">
              {formatDateTime(proposal.starts_at, timezone)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Contact</dt>
            <dd className="truncate text-right text-foreground">
              {proposal.email}
              {proposal.mobile ? ` · ${proposal.mobile}` : ''}
            </dd>
          </div>
          {proposal.note && (
            <div className="pt-1 text-xs text-muted-foreground">
              Note: {proposal.note}
            </div>
          )}
        </dl>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className="truncate text-foreground">
            <span className="text-muted-foreground">To </span>
            {proposal.customer_name} &lt;{proposal.customer_email}&gt;
          </p>
          <p className="font-medium text-foreground">{proposal.subject}</p>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {proposal.body}
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:brightness-110"
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          {proposal.type === 'booking' ? 'Confirm booking' : 'Confirm & send'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          Dismiss
        </button>
      </div>
    </div>
  );
}
