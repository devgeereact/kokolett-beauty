import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Scissors, Search, Timer, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  updateMenuItem,
} from '@/services/serviceMenuService';
import { formatDuration } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { ServiceMenuItem } from '@/types';

type Lane = 'all' | 'active' | 'archived';

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

interface Draft {
  name: string;
  groupName: string;
  note: string;
  durationMin: number;
  bufferMin: number;
  imagePath: string;
  active: boolean;
}

function draftFromItem(s: ServiceMenuItem): Draft {
  return {
    name: s.name,
    groupName: s.group_name,
    note: s.note ?? '',
    durationMin: s.duration_min,
    bufferMin: s.buffer_min,
    imagePath: s.image_path ?? '',
    active: s.active,
  };
}

const NEW_DRAFT: Draft = {
  name: '',
  groupName: '',
  note: '',
  durationMin: 45,
  bufferMin: 10,
  imagePath: '',
  active: true,
};

/**
 * The one Services screen (`docs/design/service.png`) — no second "style
 * menu" tab. `service_menu` is the single source for both this table and
 * the public site's "What we do" section (`fetchPublicMenu`); this is just
 * that same real data (49 styles today) shown the way the reference wants
 * it, with duration/buffer/image now real columns (migration 0031) instead
 * of only existing on the one bookable `services` row.
 */
export function ServicesCatalogue(): JSX.Element {
  const { showToast } = useToast();
  const [items, setItems] = useState<ServiceMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceMenuItem | null>(null);

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

  const groupNames = useMemo(
    () => [...new Set(items.map((i) => i.group_name))].sort(),
    [items],
  );

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (lane === 'active' && !s.active) return false;
      if (lane === 'archived' && s.active) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.note ?? '').toLowerCase().includes(q);
    });
  }, [items, lane, search]);

  useEffect(() => {
    setPage(1);
  }, [lane, search]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((s) => s.active).length,
      archived: items.filter((s) => !s.active).length,
    }),
    [items],
  );

  const selected = selectedId === 'new' ? null : items.find((s) => s.id === selectedId) ?? null;

  const select = (s: ServiceMenuItem): void => {
    setSelectedId(s.id);
    setDraft(draftFromItem(s));
    setFormError(null);
  };

  const startNew = (): void => {
    setSelectedId('new');
    setDraft(NEW_DRAFT);
    setFormError(null);
  };

  const save = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setFormError('Give the service a name.');
      return;
    }
    if (!draft.groupName.trim()) {
      setFormError('Give it a category.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const patch = {
        name: draft.name.trim(),
        groupName: draft.groupName.trim(),
        note: draft.note.trim() || null,
        durationMin: draft.durationMin,
        bufferMin: draft.bufferMin,
        imagePath: draft.imagePath.trim() || null,
        active: draft.active,
      };
      if (selectedId === 'new') {
        const last = Math.max(0, ...items.filter((i) => i.group_name === patch.groupName).map((i) => i.sort_order));
        const created = await createMenuItem({ ...patch, sortOrder: last + 1 });
        await load();
        setSelectedId(created.id);
      } else if (selected) {
        await updateMenuItem(selected.id, patch);
        await load();
      }
      showToast({ message: 'Service saved.' });
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (item: ServiceMenuItem): Promise<void> => {
    try {
      await deleteMenuItem(item.id);
      showToast({ message: `${item.name} removed.` });
      if (selectedId === item.id) setSelectedId(null);
      await load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  if (loading) return <LoadingState label="Loading services…" />;
  if (error) return <ErrorState error={error} onRetry={() => void load()} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 border-b border-border">
          {(['all', 'active', 'archived'] as Lane[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLane(l)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium capitalize',
                lane === l
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {l === 'all' ? 'All services' : l}
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  lane === l ? 'bg-tint-primary text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {counts[l]}
              </span>
            </button>
          ))}
        </div>
        <Button size="sm" onClick={startNew}>
          Add new service
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services…"
          className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filtered.length === 0 && selectedId !== 'new' ? (
        <EmptyState
          title="No services here"
          description="Add your first service to get started."
          action={
            <Button size="sm" onClick={startNew}>
              Add new service
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((s) => (
              <Card
                key={s.id}
                onClick={() => select(s)}
                className="cursor-pointer p-4 transition-colors hover:border-foreground/20"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <Avatar name={s.name} size="md" />
                  <Badge tone={s.active ? 'completed' : 'neutral'}>{s.active ? 'Active' : 'Archived'}</Badge>
                </div>
                <p className="mb-1 truncate font-display text-sm font-semibold text-foreground">{s.name}</p>
                <div className="mb-2">
                  <Badge tone="cancelled">{s.group_name}</Badge>
                </div>
                {s.note && <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{s.note}</p>}
                <div className="flex items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                    {formatDuration(s.duration_min)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                    {s.buffer_min}m buffer
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} itemLabel="services" />
        </>
      )}

      <Modal
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        ariaLabel={selectedId === 'new' ? 'New service' : 'Edit service'}
        className="max-w-xl"
      >
        <Card className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-tint-primary text-primary">
                <Scissors aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </span>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {selectedId === 'new' ? 'New service' : draft.name || 'Service'}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelectedId(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <Field label="Service name">
            {({ id }) => (
              <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            )}
          </Field>

          <Field label="Category" hint="Pick an existing one or type a new one.">
            {({ id }) => (
              <>
                {groupNames.length > 0 && (
                  <Select
                    id={id}
                    className="mb-2"
                    value={groupNames.includes(draft.groupName) ? draft.groupName : ''}
                    onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                  >
                    <option value="">New category…</option>
                    {groupNames.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  aria-label="Category name"
                  placeholder="e.g. Braids"
                  value={draft.groupName}
                  onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                />
              </>
            )}
          </Field>

          <Field label="Description (visible to clients)">
            {({ id }) => (
              <Textarea id={id} value={draft.note} maxLength={300} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration">
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.durationMin}
                  onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Buffer time">
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.bufferMin}
                  onChange={(e) => setDraft({ ...draft, bufferMin: Number(e.target.value) })}
                >
                  {BUFFER_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? 'None' : `${m}m`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Image path" hint="An ImageKit path — leave blank for none.">
            {({ id }) => (
              <Input id={id} value={draft.imagePath} onChange={(e) => setDraft({ ...draft, imagePath: e.target.value })} />
            )}
          </Field>

          <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{draft.active ? 'Active' : 'Inactive'}</p>
              <p className="text-xs text-muted-foreground">Shown on the website</p>
            </div>
            <Switch checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} aria-label="Service active" />
          </div>

          {formError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button loading={saving} onClick={() => void save()}>
              Save changes
            </Button>
            {selectedId !== 'new' && selected && (
              <Button variant="ghost" onClick={() => setPendingDelete(selected)}>
                Delete service
              </Button>
            )}
          </div>
        </Card>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : ''}
        message="This takes it off the website. To keep it but hide it temporarily, switch it to Inactive instead."
        tone="destructive"
        confirmLabel="Delete"
        onConfirm={() => {
          if (!pendingDelete) return;
          const item = pendingDelete;
          setPendingDelete(null);
          void doDelete(item);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
