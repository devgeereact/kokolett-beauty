import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  createException,
  createRule,
  deleteException,
  deleteRule,
  listRules,
  listUpcomingExceptions,
  updateRule,
} from '@/services/availabilityService';
import { errorMessage } from '@/lib/errors';
import { DAYS_OF_WEEK, formatDateLong, toSalonDate, trimSeconds } from '@/lib/format';
import type { AvailabilityException, AvailabilityRule, ExceptionKind } from '@/types';

const KIND_LABELS: Record<ExceptionKind, string> = {
  closure: 'Closed',
  extra_hours: 'Extra hours',
  break: 'Break',
};

/**
 * Opening hours: standing weekly rules, plus dated exceptions.
 *
 * A day with no rule is closed — that is how the schema expresses it, and
 * `book_appointment()` rejects any slot without a matching open rule. So
 * "remove" here genuinely closes the day rather than leaving a hidden window.
 */
export function AvailabilityPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  const [newRule, setNewRule] = useState({ day: '2', opens: '09:00', closes: '18:00' });
  const [newException, setNewException] = useState({
    kind: 'closure' as ExceptionKind,
    date: toSalonDate(new Date(), timezone),
    starts: '',
    ends: '',
    reason: '',
  });

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const today = toSalonDate(new Date(), timezone);
      const [r, e] = await Promise.all([listRules(), listUpcomingExceptions(today)]);
      setRules(r);
      setExceptions(e);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRule = async (): Promise<void> => {
    if (newRule.closes <= newRule.opens) {
      window.alert('Closing time must be after opening time.');
      return;
    }
    setSaving(true);
    try {
      await createRule({
        day_of_week: Number(newRule.day),
        opens_at: newRule.opens,
        closes_at: newRule.closes,
        is_open: true,
      });
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: AvailabilityRule): Promise<void> => {
    try {
      await updateRule(rule.id, { is_open: !rule.is_open });
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const removeRule = async (rule: AvailabilityRule): Promise<void> => {
    if (!window.confirm('Remove this opening window?')) return;
    try {
      await deleteRule(rule.id);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const addException = async (): Promise<void> => {
    const needsTimes = newException.kind !== 'closure';
    if (needsTimes && (!newException.starts || !newException.ends)) {
      window.alert('Give a start and end time for a break or extra hours.');
      return;
    }
    setSaving(true);
    try {
      await createException({
        kind: newException.kind,
        on_date: newException.date,
        starts_at: newException.starts || null,
        ends_at: newException.ends || null,
        reason: newException.reason.trim() || null,
      });
      setNewException({ ...newException, starts: '', ends: '', reason: '' });
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeException = async (id: string): Promise<void> => {
    try {
      await deleteException(id);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Opening hours">
        <LoadingState label="Loading opening hours…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Opening hours"
      subtitle="Standing weekly hours, and one-off changes"
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            Weekly hours
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            A day with no window is closed. Nothing can be booked outside these times.
          </p>

          <ul className="mb-5 space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayRules = rules.filter((r) => r.day_of_week === day.index);
              return (
                <li
                  key={day.index}
                  className="flex flex-wrap items-center gap-2 border-b border-border pb-2 last:border-0"
                >
                  <span className="w-24 shrink-0 text-sm font-medium text-foreground">
                    {day.name}
                  </span>
                  {dayRules.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  ) : (
                    <span className="flex flex-wrap gap-2">
                      {dayRules.map((rule) => (
                        <span
                          key={rule.id}
                          className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-sm"
                        >
                          <span
                            className={
                              rule.is_open
                                ? 'text-foreground'
                                : 'text-muted-foreground line-through'
                            }
                          >
                            {trimSeconds(rule.opens_at)}–{trimSeconds(rule.closes_at)}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-2"
                            onClick={() => void toggleRule(rule)}
                          >
                            {rule.is_open ? 'Suspend' : 'Resume'}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-destructive underline underline-offset-2"
                            onClick={() => void removeRule(rule)}
                          >
                            Remove
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="grid gap-x-3 border-t border-border pt-4 sm:grid-cols-3">
            <Field label="Day">
              {({ id }) => (
                <Select
                  id={id}
                  value={newRule.day}
                  onChange={(e) => setNewRule({ ...newRule, day: e.target.value })}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Opens">
              {({ id }) => (
                <Input
                  id={id}
                  type="time"
                  value={newRule.opens}
                  onChange={(e) => setNewRule({ ...newRule, opens: e.target.value })}
                />
              )}
            </Field>
            <Field label="Closes">
              {({ id }) => (
                <Input
                  id={id}
                  type="time"
                  value={newRule.closes}
                  onChange={(e) => setNewRule({ ...newRule, closes: e.target.value })}
                />
              )}
            </Field>
          </div>
          <Button size="sm" loading={saving} onClick={() => void addRule()}>
            Add window
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            One-off changes
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Holidays, a late start, or an evening opened specially. These override the
            weekly hours.
          </p>

          {exceptions.length === 0 ? (
            <p className="mb-5 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing scheduled.
            </p>
          ) : (
            <ul className="mb-5 space-y-2">
              {exceptions.map((exception) => (
                <li
                  key={exception.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {KIND_LABELS[exception.kind]} ·{' '}
                      {formatDateLong(`${exception.on_date}T12:00:00Z`, timezone)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exception.starts_at
                        ? `${trimSeconds(exception.starts_at)}–${trimSeconds(exception.ends_at ?? '')}`
                        : 'All day'}
                      {exception.reason ? ` · ${exception.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive underline underline-offset-2"
                    onClick={() => void removeException(exception.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-x-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Type">
              {({ id }) => (
                <Select
                  id={id}
                  value={newException.kind}
                  onChange={(e) =>
                    setNewException({
                      ...newException,
                      kind: e.target.value as ExceptionKind,
                    })
                  }
                >
                  <option value="closure">Closed</option>
                  <option value="break">Break</option>
                  <option value="extra_hours">Extra hours</option>
                </Select>
              )}
            </Field>
            <Field label="Date">
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={newException.date}
                  onChange={(e) =>
                    setNewException({ ...newException, date: e.target.value })
                  }
                />
              )}
            </Field>
            <Field
              label="From"
              hint={
                newException.kind === 'closure'
                  ? 'Leave blank to close all day.'
                  : undefined
              }
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="time"
                  aria-describedby={describedBy}
                  value={newException.starts}
                  onChange={(e) =>
                    setNewException({ ...newException, starts: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label="To">
              {({ id }) => (
                <Input
                  id={id}
                  type="time"
                  value={newException.ends}
                  onChange={(e) =>
                    setNewException({ ...newException, ends: e.target.value })
                  }
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note">
                {({ id }) => (
                  <Input
                    id={id}
                    value={newException.reason}
                    onChange={(e) =>
                      setNewException({ ...newException, reason: e.target.value })
                    }
                    placeholder="Bank holiday"
                  />
                )}
              </Field>
            </div>
          </div>
          <Button size="sm" loading={saving} onClick={() => void addException()}>
            Add change
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
