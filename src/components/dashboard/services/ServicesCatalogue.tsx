import {
  forwardRef,
  type JSX,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Clock, Search, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import {
  ServiceEditModal,
  type ServiceDraft,
} from '@/components/dashboard/services/ServiceEditModal';
import { ServiceThumb } from '@/components/dashboard/services/ServiceThumb';
import { useToast } from '@/context/ToastContext';
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  updateMenuItem,
} from '@/services/serviceMenuService';
import { formatDuration } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { toneForCategory } from '@/lib/serviceCategoryTone';
import { cn } from '@/lib/utils';
import type { ServiceMenuItem } from '@/types';

type Lane = 'all' | 'active' | 'archived';

function draftFromItem(s: ServiceMenuItem): ServiceDraft {
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

const NEW_DRAFT: ServiceDraft = {
  name: '',
  groupName: '',
  note: '',
  durationMin: 45,
  bufferMin: 10,
  imagePath: '',
  active: true,
};

export interface ServicesCatalogueHandle {
  openNew: () => void;
}

/**
 * The one Services screen (`docs/design/service.png`) — no second "style
 * menu" tab, and cards instead of the reference's table (owner request,
 * matching the same list→cards change made on Customers). `service_menu` is
 * the single source for both this grid and the public site's "What we do"
 * section (`fetchPublicMenu`); this is just that same real data (49 styles
 * today) shown the way the reference wants it, with duration/buffer/image
 * now real columns (migration 0031) instead of only existing on the one
 * bookable `services` row.
 *
 * Forwards a ref so `ServiceMenuPage` can put "Add new service" in the
 * shared header actions bar (matching every other finished screen) instead
 * of this component owning that button itself.
 */
export const ServicesCatalogue = forwardRef<ServicesCatalogueHandle>(
  function ServicesCatalogue(_props, ref): JSX.Element {
    const { showToast } = useToast();
    const [items, setItems] = useState<ServiceMenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lane, setLane] = useState<Lane>('all');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<ServiceDraft>(NEW_DRAFT);
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
    // 18, not a round 16 or 20: the grid is 1/2/3 columns (mobile/tablet/
    // desktop), and 18 is the smallest count divisible by all three, so the
    // last row is never ragged at any breakpoint.
    const PAGE_SIZE = 18;

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      return items.filter((s) => {
        if (lane === 'active' && !s.active) return false;
        if (lane === 'archived' && s.active) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) || (s.note ?? '').toLowerCase().includes(q)
        );
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

    const selected =
      selectedId === 'new' ? null : (items.find((s) => s.id === selectedId) ?? null);

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

    useImperativeHandle(ref, () => ({ openNew: startNew }), []);

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
          const last = Math.max(
            0,
            ...items
              .filter((i) => i.group_name === patch.groupName)
              .map((i) => i.sort_order),
          );
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-1">
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
                    lane === l
                      ? 'bg-tint-brand text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {counts[l]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative mb-3 w-full max-w-xs md:mb-0 md:w-64">
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
              className="h-9 w-full rounded-sm border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
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
            {/* Same width/height/per-row density as the Customers grid
              (grid-cols-1/2/3, p-3 card, three-row layout: header, a
              divider stat row, a badge row) — not a smaller, denser variant
              of the same idea. */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((s) => (
                <Card
                  key={s.id}
                  onClick={() => select(s)}
                  className="flex cursor-pointer flex-col gap-1.5 p-3 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start gap-3">
                    <ServiceThumb item={s} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base font-semibold text-foreground">
                        {s.name}
                      </p>
                      {s.note && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {s.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="flex items-center gap-1 font-medium text-foreground">
                        <Clock
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={2}
                        />
                        {formatDuration(s.duration_min)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Buffer</p>
                      <p className="flex items-center gap-1 font-medium text-foreground">
                        <Timer
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={2}
                        />
                        {s.buffer_min === 0 ? 'None' : `${s.buffer_min}m`}
                      </p>
                    </div>
                    <Badge tone={s.active ? 'completed' : 'neutral'}>
                      {s.active ? 'Active' : 'Archived'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={toneForCategory(s.group_name)}>{s.group_name}</Badge>
                  </div>
                </Card>
              ))}
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filtered.length}
              onPageChange={setPage}
              itemLabel="services"
            />
          </>
        )}

        <ServiceEditModal
          open={selectedId !== null}
          isNew={selectedId === 'new'}
          selected={selected}
          draft={draft}
          onDraftChange={setDraft}
          groupNames={groupNames}
          formError={formError}
          saving={saving}
          onClose={() => setSelectedId(null)}
          onSave={() => void save()}
          onRequestDelete={setPendingDelete}
        />

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
  },
);
