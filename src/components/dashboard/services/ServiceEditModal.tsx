import type { JSX } from 'react';
import { Scissors, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { ServiceThumb } from '@/components/dashboard/services/ServiceThumb';
import { formatDuration } from '@/lib/format';
import type { ServiceMenuItem } from '@/types';

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

export interface ServiceDraft {
  name: string;
  groupName: string;
  note: string;
  durationMin: number;
  bufferMin: number;
  imagePath: string;
  active: boolean;
}

interface ServiceEditModalProps {
  open: boolean;
  isNew: boolean;
  selected: ServiceMenuItem | null;
  draft: ServiceDraft;
  onDraftChange: (draft: ServiceDraft) => void;
  groupNames: string[];
  formError: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onRequestDelete: (item: ServiceMenuItem) => void;
}

/** Create/edit form for one service-menu item, opened from a card in `ServicesCatalogue`. */
export function ServiceEditModal({
  open,
  isNew,
  selected,
  draft,
  onDraftChange,
  groupNames,
  formError,
  saving,
  onClose,
  onSave,
  onRequestDelete,
}: ServiceEditModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={isNew ? 'New service' : 'Edit service'}
      className="max-w-modal-md"
    >
      <Card className="max-h-[85vh] overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selected ? (
              <ServiceThumb item={selected} size="lg" />
            ) : (
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-brand-ink">
                <Scissors aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </span>
            )}
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {isNew ? 'New service' : draft.name || 'Service'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <Field label="Service name">
          {({ id }) => (
            <Input
              id={id}
              value={draft.name}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            />
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
                  onChange={(e) => onDraftChange({ ...draft, groupName: e.target.value })}
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
                onChange={(e) => onDraftChange({ ...draft, groupName: e.target.value })}
              />
            </>
          )}
        </Field>

        <Field label="Description (visible to clients)">
          {({ id }) => (
            <Textarea
              id={id}
              value={draft.note}
              maxLength={300}
              onChange={(e) => onDraftChange({ ...draft, note: e.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration">
            {({ id }) => (
              <Select
                id={id}
                value={draft.durationMin}
                onChange={(e) =>
                  onDraftChange({ ...draft, durationMin: Number(e.target.value) })
                }
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
                onChange={(e) =>
                  onDraftChange({ ...draft, bufferMin: Number(e.target.value) })
                }
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

        <Field label="Image path" hint="An ImageKit path. Leave blank for none.">
          {({ id }) => (
            <Input
              id={id}
              value={draft.imagePath}
              onChange={(e) => onDraftChange({ ...draft, imagePath: e.target.value })}
            />
          )}
        </Field>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {draft.active ? 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-muted-foreground">Shown on the website</p>
          </div>
          <Switch
            checked={draft.active}
            onChange={(v) => onDraftChange({ ...draft, active: v })}
            aria-label="Service active"
          />
        </div>

        {formError && (
          <p role="alert" className="mb-3 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button loading={saving} onClick={onSave}>
            Save changes
          </Button>
          {!isNew && selected && (
            <Button variant="ghost" onClick={() => onRequestDelete(selected)}>
              Delete service
            </Button>
          )}
        </div>
      </Card>
    </Modal>
  );
}
