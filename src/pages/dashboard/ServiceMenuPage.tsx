import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  updateMenuItem,
} from '@/services/serviceMenuService';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { ServiceMenuItem } from '@/types';

/**
 * The menu of styles, as shown on the home page.
 *
 * This is not the appointment type. Nothing here has a length or a price, and
 * nothing here can be booked on its own: the salon sells time, and what gets
 * done in that time is agreed in the chair. The list exists so a visitor can
 * see whether the salon does the thing they came looking for.
 *
 * Switching a style off keeps it here but takes it off the website, which is
 * the right move for something seasonal. Deleting is for a style the salon has
 * genuinely stopped offering; nothing references these rows, so nothing breaks.
 */

interface Draft {
  groupName: string;
  name: string;
  note: string;
}

const EMPTY: Draft = { groupName: '', name: '', note: '' };

export function ServiceMenuPage(): JSX.Element {
  const [items, setItems] = useState<ServiceMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await listMenuItems());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ServiceMenuItem[]>();
    for (const item of items) {
      const list = map.get(item.group_name);
      if (list) list.push(item);
      else map.set(item.group_name, [item]);
    }
    return [...map.entries()];
  }, [items]);

  const groupNames = useMemo(
    () => [...new Set(items.map((i) => i.group_name))].sort(),
    [items],
  );

  const liveCount = items.filter((i) => i.active).length;

  const add = async (): Promise<void> => {
    if (!draft.name.trim()) return setFormError('Give the style a name.');
    if (!draft.groupName.trim()) return setFormError('Choose or name a group.');

    setBusy(true);
    setFormError(null);
    try {
      // New styles land at the end of their group rather than the top: the
      // owner ordered these once and should not have to re-order on every add.
      const last = Math.max(
        0,
        ...items
          .filter((i) => i.group_name === draft.groupName.trim())
          .map((i) => i.sort_order),
      );
      await createMenuItem({
        groupName: draft.groupName,
        name: draft.name,
        note: draft.note,
        sortOrder: last + 1,
      });
      setDraft({ ...EMPTY, groupName: draft.groupName });
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ServiceMenuItem): Promise<void> => {
    try {
      await updateMenuItem(item.id, { active: !item.active });
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const saveEdit = async (id: string): Promise<void> => {
    if (!editDraft.name.trim() || !editDraft.groupName.trim()) return;
    try {
      await updateMenuItem(id, {
        groupName: editDraft.groupName,
        name: editDraft.name,
        note: editDraft.note,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const remove = async (item: ServiceMenuItem): Promise<void> => {
    if (
      !window.confirm(
        `Delete "${item.name}" from the menu? To take it off the website temporarily, switch it off instead.`,
      )
    ) {
      return;
    }
    try {
      await deleteMenuItem(item.id);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  return (
    <DashboardLayout
      title="Services"
      subtitle={`${liveCount} of ${items.length} showing on the website`}
      actions={
        <>
          <a
            href={`${routes.public.home}#services`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            View on website
          </a>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {loading && <LoadingState label="Loading the menu…" />}
          {error && <ErrorState error={error} onRetry={() => void load()} />}
          {!loading && !error && items.length === 0 && (
            <EmptyState
              title="The menu is empty"
              description="Add your first style on the right. Nothing shows in the Services section of your website until there is at least one."
            />
          )}

          <div className="space-y-6">
            {groups.map(([groupName, rows]) => (
              <Card key={groupName} className="p-5">
                <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                  {groupName}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {rows.filter((r) => r.active).length} showing
                  </span>
                </h2>

                <ul className="divide-y divide-border">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="-mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                    >
                      {editingId === item.id ? (
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Input
                            aria-label="Style name"
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, name: e.target.value })
                            }
                          />
                          <Input
                            aria-label="Note"
                            placeholder="Optional note, e.g. allow a full day"
                            value={editDraft.note}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, note: e.target.value })
                            }
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void saveEdit(item.id)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'truncate font-medium',
                                item.active
                                  ? 'text-foreground'
                                  : 'text-muted-foreground line-through',
                              )}
                            >
                              {item.name}
                            </p>
                            {item.note && (
                              <p className="truncate text-xs text-muted-foreground">
                                {item.note}
                              </p>
                            )}
                          </div>

                          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={item.active}
                              onChange={() => void toggle(item)}
                            />
                            {item.active ? 'On the website' : 'Hidden'}
                          </label>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditDraft({
                                groupName: item.group_name,
                                name: item.name,
                                note: item.note ?? '',
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void remove(item)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
            Add a style
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This appears in the Services section of your website. It does not create a
            separate appointment, and it never carries a price.
          </p>

          <Field label="Group" hint="Pick an existing group or type a new one.">
            {({ id, describedBy }) => (
              <>
                {groupNames.length > 0 && (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    className="mb-2"
                    value={groupNames.includes(draft.groupName) ? draft.groupName : ''}
                    onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                  >
                    <option value="">New group…</option>
                    {groupNames.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  aria-label="Group name"
                  placeholder="e.g. Braids"
                  value={draft.groupName}
                  onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                />
              </>
            )}
          </Field>

          <Field label="Style">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                placeholder="e.g. Knotless braids"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            )}
          </Field>

          <Field
            label="Note"
            hint="Optional. Something a customer needs to know before booking, such as bringing their own hair."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                placeholder="Allow a full day"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            )}
          </Field>

          {formError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {formError}
            </p>
          )}

          <Button className="w-full" loading={busy} onClick={() => void add()}>
            Add to the menu
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
