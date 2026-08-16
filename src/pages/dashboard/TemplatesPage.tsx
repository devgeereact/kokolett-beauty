import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { getTemplateUsage, type TemplateUsage } from '@/services/emailService';
import { TEMPLATE_CATALOG, templateMeta, type TemplateCategory } from '@/lib/templateCatalog';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type Lane = 'all' | TemplateCategory;
const LANES: Lane[] = ['all', 'Booking', 'Reminders', 'Reviews', 'Availability requests', 'Account access', 'Owner notifications'];

/**
 * The template catalogue (`docs/design/templetes.png`), restyled onto what
 * this system actually has: a fixed, hard-coded set of transactional email
 * templates (`supabase/functions/_shared/templates.ts`) — read-only, no
 * SMS (no SMS provider exists), no create/edit, no per-plan quota. Preview
 * and usage come from real rows in `email_messages`, not fabricated copy.
 */
export function TemplatesPage(): JSX.Element {
  const navigate = useNavigate();
  const { timezone } = useBusinessSettings();
  const [usage, setUsage] = useState<Map<string, TemplateUsage> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = (): void => {
    setError(null);
    getTemplateUsage()
      .then(setUsage)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATE_CATALOG.filter((t) => {
      if (lane !== 'all' && t.category !== lane) return false;
      if (!q) return true;
      return t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [lane, search]);

  const laneCounts = useMemo(() => {
    const counts: Record<Lane, number> = {
      all: TEMPLATE_CATALOG.length,
      Booking: 0,
      Reminders: 0,
      Reviews: 0,
      'Availability requests': 0,
      'Account access': 0,
      'Owner notifications': 0,
    };
    for (const t of TEMPLATE_CATALOG) counts[t.category] += 1;
    return counts;
  }, []);

  const selected = selectedKey ? templateMeta(selectedKey) : null;
  const selectedUsage = selectedKey ? usage?.get(selectedKey) : null;

  if (error) {
    return (
      <DashboardLayout title="Templates">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  if (selected) {
    const example = selectedUsage?.example;
    const payload = (example?.payload as Record<string, unknown> | undefined) ?? {};
    return (
      <DashboardLayout title="Templates" subtitle="The wording behind every automated message.">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedKey(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            Back to templates
          </button>
          <Button size="sm" onClick={() => void navigate(routes.owner.templateEditor(selected.key))}>
            <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            Edit template
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="h-fit p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
                <selected.icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="font-serif text-lg font-semibold text-foreground">{selected.label}</h2>
                <Badge tone="primary">Email</Badge>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{selected.description}</p>
            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="text-foreground">{selected.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Used</dt>
                <dd className="text-foreground">{selectedUsage?.count ?? 0} times</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last sent</dt>
                <dd className="text-foreground">
                  {selectedUsage?.lastSentAt ? formatRelative(selectedUsage.lastSentAt) : 'Never'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h3 className="mb-4 font-serif text-base font-semibold text-foreground">
              {example ? 'Most recent example' : 'Preview'}
            </h3>
            {!example ? (
              <p className="text-sm text-muted-foreground">
                This template hasn't sent yet, so there's no real example to show.
              </p>
            ) : (
              <div className="rounded-lg border border-border p-4">
                <p className="mb-1 text-sm">
                  <span className="font-medium text-foreground">Subject:</span>{' '}
                  <span className="text-foreground">{example.subject}</span>
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  To {example.to_email} · {formatDateTime(example.sent_at ?? example.created_at, timezone)}
                </p>
                {Object.keys(payload).length > 0 && (
                  <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
                    {Object.entries(payload)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
                          <dd className="truncate text-right text-foreground">{String(value)}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Templates" subtitle="The wording behind every automated message.">
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
        {LANES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLane(l)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium',
              lane === l
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {l === 'all' ? 'All templates' : l}
            <span
              className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                lane === l ? 'bg-tint-brand text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {laneCounts[l]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="h-11 w-full rounded-sm border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {!usage ? (
        <LoadingState label="Loading template usage…" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const u = usage.get(t.key);
            return (
              <Card
                key={t.key}
                className="cursor-pointer p-5 transition-colors hover:border-foreground/20"
                onClick={() => setSelectedKey(t.key)}
              >
                <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-tint-brand text-primary">
                  <t.icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mb-1 font-serif text-base font-semibold text-foreground">{t.label}</h3>
                <p className="mb-3 text-sm text-muted-foreground">{t.description}</p>
                <div className="mb-3">
                  <Badge tone="primary">Email</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {u ? `Used ${u.count} time${u.count === 1 ? '' : 's'}` : 'Not sent yet'}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
