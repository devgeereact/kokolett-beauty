import { type JSX, useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  History,
  Mail,
  MessageSquareQuote,
  Phone,
  Plus,
  Scissors,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { formatDateLong, formatDateTime, salonInstant } from '@/lib/format';
import { suggestSlotsForRequest, type SuggestedSlot } from '@/lib/requestSlots';
import {
  PRIORITY_LABELS,
  PRIORITY_TONE,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONE,
  laneForStatus,
  priorityFromWaitingHours,
} from '@/lib/requestStatus';
import { findCustomerByEmail } from '@/services/customerService';
import type { QueuedRequest } from '@/services/requestService';

const FLEXIBILITY_LABELS: Record<string, string> = {
  any: 'Any time',
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
};

/**
 * The requests queue's decision surface — mirrors `ApprovalDetailPanel`'s
 * shape (avatar header, booking/request details, notes, history, then the
 * actions that resolve it) with requests' own vocabulary: suggested slots
 * computed from real published availability rather than a fixed deadline.
 */
export function RequestDetailPanel({
  request,
  timezone,
  busy,
  onOffer,
  onDecline,
  onSaveNote,
}: {
  request: QueuedRequest | null;
  timezone: string;
  busy: boolean;
  onOffer: (startsAtIso: string, overrideReason?: string) => void;
  onDecline: (reason: string) => void;
  onSaveNote: (note: string) => Promise<void>;
}): JSX.Element {
  const [slots, setSlots] = useState<SuggestedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotLimit, setSlotLimit] = useState(3);
  const [selectedSlot, setSelectedSlot] = useState<SuggestedSlot | null>(null);

  const [customOffer, setCustomOffer] = useState<{
    open: boolean;
    date: string;
    time: string;
  }>({
    open: false,
    date: '',
    time: '10:00',
  });
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [returning, setReturning] = useState<boolean | null>(null);

  const lane = request ? laneForStatus(request.status) : null;
  const isOpen = lane === 'new' || lane === 'awaiting_response';

  useEffect(() => {
    if (!request) {
      setReturning(null);
      return;
    }
    let cancelled = false;
    setReturning(null);
    findCustomerByEmail(request.email)
      .then((found) => {
        if (!cancelled) setReturning(found !== null);
      })
      .catch(() => {
        if (!cancelled) setReturning(null);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on id/email, not the whole `request` object, which changes
    // identity on every reload/note-save without those two fields changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, request?.email]);

  useEffect(() => {
    setSlotLimit(3);
    setSelectedSlot(null);
    setCustomOffer({ open: false, date: '', time: '10:00' });
    setDeclining(false);
    setDeclineReason('');
    setNote(request?.owner_note ?? '');
    setNoteSaved(false);
    // Deliberately keyed on `request?.id` alone, not `owner_note` too — a
    // successful save updates the parent's copy of `owner_note`, which must
    // not re-trigger this reset, or the "Saved" confirmation below would be
    // wiped the instant it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  useEffect(() => {
    if (!request || !isOpen) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    suggestSlotsForRequest(
      request.preferred_dates,
      request.flexibility,
      60,
      timezone,
      slotLimit,
    )
      .then((found) => {
        if (cancelled) return;
        setSlots(found);
        // Pre-select the top suggestion, same as the reference — one click
        // to "Offer this slot" for the common case. Only when nothing is
        // selected yet, so "View more slots" (which re-fetches with a
        // higher limit) never yanks away a slot the owner already picked.
        setSelectedSlot((prev) => prev ?? found[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, slotLimit, isOpen]);

  if (!request) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Select a request to see its details here.
        </p>
      </Card>
    );
  }

  const priority = priorityFromWaitingHours(request.waiting_hours);

  const submitCustomOffer = (): void => {
    if (!customOffer.date) return;
    const when = salonInstant(customOffer.date, customOffer.time, timezone);
    onOffer(when.toISOString());
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
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

      {(isOpen || returning !== null) && (
        <div className="flex flex-wrap items-center gap-2">
          {isOpen && (
            <Badge tone={PRIORITY_TONE[priority]} className="w-fit">
              {PRIORITY_LABELS[priority]}
            </Badge>
          )}
          {returning !== null && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="h-1 w-1 rounded-full bg-muted-foreground"
              />
              {returning ? 'Returning customer' : 'First visit'}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Request details
        </p>
        <div className="space-y-1.5 text-sm text-foreground">
          <p className="flex items-center gap-2">
            <Calendar
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            {request.preferred_dates.length > 0
              ? request.preferred_dates
                  .map((d) => formatDateLong(`${d}T00:00:00Z`))
                  .join(' – ')
              : 'Any date'}
          </p>
          <p className="flex items-center gap-2">
            <Clock
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            {FLEXIBILITY_LABELS[request.flexibility] ?? request.flexibility}
          </p>
          <p className="flex items-center gap-2">
            <Scissors
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            {request.service_name ?? 'Not sure yet'}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MessageSquareQuote
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              strokeWidth={2}
            />
            Requested: {formatDateTime(request.created_at, timezone)}
          </p>
        </div>
      </div>

      {request.notes && (
        <div className="border-t border-border pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="rounded-md bg-muted p-3 text-sm text-foreground">
            &ldquo;{request.notes}&rdquo;
          </p>
        </div>
      )}

      {isOpen && (
        <div className="border-t border-border pt-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested slots
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Real openings, matched to their preferred dates and time of day.
          </p>

          {slotsLoading && slots.length === 0 && (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          )}

          {!slotsLoading && slots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing open yet in the window they asked for.
            </p>
          )}

          {slots.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border p-2 text-left text-xs ${
                      selectedSlot?.startsAt === slot.startsAt
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <p className="font-medium text-foreground">
                      {formatDateLong(`${slot.date}T00:00:00Z`)
                        .split(' ')
                        .slice(0, 2)
                        .join(' ')}
                    </p>
                    <p className="text-muted-foreground">{slot.label}</p>
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                loading={slotsLoading}
                onClick={() => setSlotLimit((n) => n + 3)}
              >
                View more slots
              </Button>
            </>
          )}
        </div>
      )}

      {isOpen && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </p>

          {declining ? (
            <div className="space-y-2">
              <Field
                label="Reason for declining"
                hint="They are emailed this. Keep it brief and kind."
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="I'm afraid I'm fully booked that week."
                  />
                )}
              </Field>
              <Button
                variant="destructive"
                className="w-full"
                loading={busy}
                onClick={() => onDecline(declineReason)}
              >
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                Confirm decline
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setDeclining(false)}
              >
                Cancel
              </Button>
            </div>
          ) : customOffer.open ? (
            <div className="space-y-2">
              <div className="grid gap-x-3 md:grid-cols-2">
                <Field label="Date">
                  {({ id }) => (
                    <DatePicker
                      id={id}
                      value={customOffer.date}
                      onChange={(value) => setCustomOffer((o) => ({ ...o, date: value }))}
                    />
                  )}
                </Field>
                <Field label="Time">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="time"
                      value={customOffer.time}
                      onChange={(e) =>
                        setCustomOffer((o) => ({ ...o, time: e.target.value }))
                      }
                    />
                  )}
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                This books them straight in and emails a confirmation — it does not have
                to be inside your published hours.
              </p>
              <Button className="w-full" loading={busy} onClick={submitCustomOffer}>
                Book this time
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setCustomOffer((o) => ({ ...o, open: false }))}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                loading={busy}
                disabled={!selectedSlot}
                onClick={() => selectedSlot && onOffer(selectedSlot.startsAt)}
              >
                Offer this slot
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  setCustomOffer({
                    open: true,
                    date: request.preferred_dates[0] ?? '',
                    time: '10:00',
                  })
                }
              >
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                Create custom offer
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => setDeclining(true)}
              >
                Decline request
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Internal notes
        </p>
        <Textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          placeholder="Add a private note…"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
            />
            Only visible to you
          </p>
          <Button
            size="sm"
            variant="ghost"
            loading={noteSaving}
            disabled={note === (request.owner_note ?? '')}
            onClick={() => {
              setNoteSaving(true);
              onSaveNote(note)
                .then(() => setNoteSaved(true))
                .catch(() => {})
                .finally(() => setNoteSaving(false));
            }}
          >
            {noteSaved ? 'Saved' : 'Save note'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
