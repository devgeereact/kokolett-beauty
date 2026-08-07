import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { setDayAvailability, createException } from '@/services/availabilityService';
import { errorMessage } from '@/lib/errors';
import { trimSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AvailabilityException, AvailabilityRule } from '@/types';

type Mode = 'standard' | 'custom' | 'closed';

interface Window {
  starts_at: string;
  ends_at: string;
}

/**
 * Publishing one day's hours.
 *
 * This is the owner's main daily act under the current policy: whatever she
 * puts out here books instantly, with no approval step. So the editor is
 * explicit about which of three states the day is in, rather than leaving her
 * to infer it from a list of exception rows.
 *
 *   standard — follows the weekly hours
 *   custom   — exactly these windows, weekly hours ignored
 *   closed   — nothing bookable
 */
export function DayEditor({
  date,
  rules,
  exceptions,
  onSaved,
  onRemoveBreak,
}: {
  date: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  onSaved: () => void;
  onRemoveBreak: (id: string) => Promise<void>;
}): JSX.Element {
  const dayRules = rules.filter(
    (r) => r.day_of_week === new Date(`${date}T12:00:00Z`).getUTCDay() && r.is_open,
  );
  const fullClosure = exceptions.find(
    (e) => e.kind === 'closure' && e.starts_at === null,
  );
  const published = exceptions.filter((e) => e.kind === 'extra_hours');
  const breaks = exceptions.filter((e) => e.kind === 'break');

  const currentMode: Mode = !fullClosure
    ? 'standard'
    : published.length > 0
      ? 'custom'
      : 'closed';

  const [mode, setMode] = useState<Mode>(currentMode);
  const [windows, setWindows] = useState<Window[]>([]);
  const [breakWindow, setBreakWindow] = useState<Window>({
    starts_at: '12:00',
    ends_at: '13:00',
  });
  const [breakReason, setBreakReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * A stable description of what this day *is*, according to the server.
   *
   * Keying the re-seed on the date alone was wrong: the first render happens
   * before the parent's fetch resolves, so `currentMode` was computed from an
   * empty exception list and stuck on "standard" — the panel claimed a day was
   * on usual hours while it was actually on custom ones.
   *
   * Keying on the exception array itself is also wrong: it is rebuilt on every
   * parent render, which would wipe the form mid-edit. A signature is the
   * middle ground — it changes when the day genuinely changes, and not
   * otherwise.
   */
  const signature = [
    date,
    fullClosure ? 'closed' : 'open',
    published
      .map((e) => `${trimSeconds(e.starts_at ?? '')}-${trimSeconds(e.ends_at ?? '')}`)
      .sort()
      .join(','),
    dayRules
      .map((r) => `${trimSeconds(r.opens_at)}-${trimSeconds(r.closes_at)}`)
      .join(','),
  ].join('|');

  useEffect(() => {
    setMode(currentMode);
    setWindows(
      currentMode === 'custom'
        ? published.map((e) => ({
            starts_at: trimSeconds(e.starts_at ?? ''),
            ends_at: trimSeconds(e.ends_at ?? ''),
          }))
        : dayRules.map((r) => ({
            starts_at: trimSeconds(r.opens_at),
            ends_at: trimSeconds(r.closes_at),
          })),
    );
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const save = async (nextMode: Mode): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      if (nextMode === 'standard') {
        await setDayAvailability(date, null);
      } else if (nextMode === 'closed') {
        await setDayAvailability(date, []);
      } else {
        const cleaned = windows.filter((w) => w.starts_at && w.ends_at);
        if (cleaned.length === 0) {
          setError('Add at least one time window, or close the day instead.');
          return;
        }
        if (cleaned.some((w) => w.ends_at <= w.starts_at)) {
          setError('Each window must end after it starts.');
          return;
        }
        await setDayAvailability(date, cleaned);
      }
      setMode(nextMode);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addBreak = async (): Promise<void> => {
    if (breakWindow.ends_at <= breakWindow.starts_at) {
      setError('The blocked time must end after it starts.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createException({
        kind: 'break',
        on_date: date,
        starts_at: breakWindow.starts_at,
        ends_at: breakWindow.ends_at,
        reason: breakReason.trim() || 'Blocked',
      });
      setBreakReason('');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Mode; label: string; hint: string }[] = [
    { key: 'standard', label: 'Usual hours', hint: 'Follows your weekly pattern' },
    { key: 'custom', label: 'Specific hours', hint: 'Only the times you set below' },
    { key: 'closed', label: 'Closed', hint: 'Nothing bookable this day' },
  ];

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-foreground">
        Availability for this day
      </h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Whatever you publish here can be booked instantly — no approval needed.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMode(tab.key)}
            aria-pressed={mode === tab.key}
            className={cn(
              'rounded-md px-2 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === tab.key
                ? 'bg-card text-foreground shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {tabs.find((t) => t.key === mode)?.hint}
        {mode === currentMode && ' · currently in force'}
      </p>

      {mode === 'standard' && (
        <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {dayRules.length === 0
            ? 'Your weekly pattern has this day closed. Choose “Specific hours” to open it just this once.'
            : `Open ${dayRules
                .map((r) => `${trimSeconds(r.opens_at)}–${trimSeconds(r.closes_at)}`)
                .join(', ')} as usual.`}
        </p>
      )}

      {mode === 'custom' && (
        <div className="mb-4 space-y-2">
          {windows.map((w, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`Window ${index + 1} start`}
                value={w.starts_at}
                onChange={(e) =>
                  setWindows(
                    windows.map((x, i) =>
                      i === index ? { ...x, starts_at: e.target.value } : x,
                    ),
                  )
                }
              />
              <span className="text-muted-foreground" aria-hidden="true">
                –
              </span>
              <Input
                type="time"
                aria-label={`Window ${index + 1} end`}
                value={w.ends_at}
                onChange={(e) =>
                  setWindows(
                    windows.map((x, i) =>
                      i === index ? { ...x, ends_at: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label={`Remove window ${index + 1}`}
                className="shrink-0 px-2 text-sm text-destructive underline underline-offset-2"
                onClick={() => setWindows(windows.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setWindows([
                ...windows,
                windows.length === 0
                  ? { starts_at: '09:00', ends_at: '17:00' }
                  : { starts_at: '18:00', ends_at: '20:00' },
              ])
            }
          >
            Add another window
          </Button>
        </div>
      )}

      {mode === 'closed' && (
        <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Nothing can be booked. Anyone who wanted this day can still send a request,
          which lands in your enquiries.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button className="w-full" loading={saving} onClick={() => void save(mode)}>
        {mode === 'standard'
          ? 'Use my usual hours'
          : mode === 'closed'
            ? 'Close this day'
            : 'Publish these hours'}
      </Button>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="mb-1 text-sm font-medium text-foreground">Block out time</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Stays out of the booking calendar even inside your published hours — a school
          run, a delivery, lunch.
        </p>

        {breaks.length > 0 && (
          <ul className="mb-3 space-y-1 text-sm">
            {breaks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="text-foreground">
                  {trimSeconds(b.starts_at ?? '')}–{trimSeconds(b.ends_at ?? '')}
                  {b.reason ? ` · ${b.reason}` : ''}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-destructive underline underline-offset-2"
                  onClick={() => void onRemoveBreak(b.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-2 flex items-center gap-2">
          <Input
            type="time"
            aria-label="Blocked from"
            value={breakWindow.starts_at}
            onChange={(e) =>
              setBreakWindow({ ...breakWindow, starts_at: e.target.value })
            }
          />
          <span className="text-muted-foreground" aria-hidden="true">
            –
          </span>
          <Input
            type="time"
            aria-label="Blocked to"
            value={breakWindow.ends_at}
            onChange={(e) => setBreakWindow({ ...breakWindow, ends_at: e.target.value })}
          />
        </div>
        <Input
          aria-label="What for"
          placeholder="What for? (optional)"
          className="mb-2"
          value={breakReason}
          onChange={(e) => setBreakReason(e.target.value)}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          loading={saving}
          onClick={() => void addBreak()}
        >
          Block this time
        </Button>
      </div>
    </Card>
  );
}
