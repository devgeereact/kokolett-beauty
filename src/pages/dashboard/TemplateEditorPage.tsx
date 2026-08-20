import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Globe,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageCircle,
  Share2,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { getEmailTemplate, updateEmailTemplate } from '@/services/emailService';
import { templateMeta } from '@/lib/templateCatalog';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { EmailTemplateRow } from '@/types';

const CATEGORIES = [
  'Booking',
  'Reminders',
  'Reviews',
  'Availability requests',
  'Account access',
  'Owner notifications',
];

/** Sample values so the preview shows real-looking copy instead of literal `{{tokens}}` — one per token `buildTokens` in `_shared/templates.ts` can produce. */
const SAMPLE_VALUES: Record<string, string> = {
  customer_name: 'Sarah Johnson',
  full_name: 'Sarah Johnson',
  customer_email: 'sarah.johnson@example.com',
  email: 'sarah.johnson@example.com',
  customer_mobile: '07700 900123',
  mobile: '07700 900123',
  appointment_date: 'Saturday, 24 May 2026',
  appointment_time: '10:00',
  previous_appointment_date: 'Tuesday, 20 May 2026',
  previous_appointment_time: '14:00',
  service_name: 'Balayage',
  location: 'Kokolett Beauty UK',
  staff_name: 'Koko Lett',
  reference: 'KB-Y6ZXKH',
  approval_window_h: '12',
  reason: 'The stylist is no longer available at that time',
  customer_note: 'Allergic to ammonia-based dye',
  notes: 'Flexible on time, prefers weekday mornings',
  preferred_dates: 'Sat 24 May, Sun 25 May',
  flexibility: 'Any time that week',
  google_review_url: 'https://g.page/r/example/review',
  manage_url: 'https://www.kokolettbeauty.com/access/8f3a1c9e4b2d',
  reset_url: 'https://www.kokolettbeauty.com/reset-password',
  reset_ttl_minutes: '60',
};

function renderPreview(html: string): string {
  return html.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => SAMPLE_VALUES[key] ?? `{{${key}}}`,
  );
}

function execCmd(command: string, value?: string): void {
  document.execCommand(command, false, value);
}

/**
 * Length of the copy the customer will actually read, with the markup taken
 * out.
 *
 * Parsed rather than regex-stripped. `replace(/<[^>]+>/g, '')` looks like it
 * removes tags and does not: one pass over `<scr<script>ipt>` leaves a working
 * `<script>` behind, which is what CodeQL flags as incomplete multi-character
 * sanitization. Nothing was exploitable here, because the result was only ever
 * measured and never rendered, but a string that looks sanitised is exactly the
 * kind of thing somebody later reaches for in a context where it matters.
 *
 * Parsing is also simply more accurate: `&amp;` counts as one character rather
 * than five, and an attribute value no longer leaks into the total.
 */
function textLength(html: string): number {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '')
    .length;
}

/**
 * The owner's overlay on a real outbox template (`email_templates`). Saving
 * here is what `send-emails` reads at send time once Active and Include in
 * automation are both on — see `emailService.getEmailTemplate`'s comment.
 */
export function TemplateEditorPage(): JSX.Element {
  const { key = '' } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = templateMeta(key);

  const [row, setRow] = useState<EmailTemplateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'email' | 'mobile'>('email');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [includeInAutomation, setIncludeInAutomation] = useState(true);
  const [bodyHtml, setBodyHtml] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const insertVarTarget = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    setLoading(true);
    getEmailTemplate(key)
      .then((data) => {
        setRow(data);
        if (data) {
          setSubject(data.subject);
          setCategory(data.category);
          setActive(data.active);
          setAllowEdit(data.allow_edit_before_sending);
          setIncludeInAutomation(data.include_in_automation);
          setBodyHtml(data.html_body);
        }
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
    // Only sync on initial load — after that the contentEditable div owns its own DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const charCount = useMemo(() => textLength(bodyHtml), [bodyHtml]);

  const insertVariable = (name: string): void => {
    const token = `{{${name}}}`;
    if (insertVarTarget.current === 'subject') {
      setSubject((s) => `${s}${token}`);
    } else {
      editorRef.current?.focus();
      document.execCommand('insertText', false, token);
      setBodyHtml(editorRef.current?.innerHTML ?? bodyHtml);
    }
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      const html = editorRef.current?.innerHTML ?? bodyHtml;
      const updated = await updateEmailTemplate(key, {
        subject,
        category,
        active,
        allow_edit_before_sending: allowEdit,
        include_in_automation: includeInAutomation,
        html_body: html,
      });
      setRow(updated);
      setBodyHtml(html);
      showToast({ message: 'Template saved.' });
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Templates">
        <LoadingState label="Loading template…" />
      </DashboardLayout>
    );
  }
  if (error || !row || !meta) {
    return (
      <DashboardLayout title="Templates">
        <ErrorState
          error={error ?? new Error('Template not found')}
          onRetry={() => void navigate(routes.owner.templates)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Edit Email Template"
      subtitle="Create and customise your email template."
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewMode((m) => (m === 'email' ? 'mobile' : 'email'))}
          >
            Preview template
          </Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            Save template
          </Button>
        </>
      }
    >
      <button
        type="button"
        onClick={() => void navigate(routes.owner.templates)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        Back to templates
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <Field label="Template name" className="mb-0 flex-1 min-w-[12rem]">
                {({ id }) => <Input id={id} value={meta.label} disabled />}
              </Field>
              <Field label="Category" className="mb-0 w-48">
                {({ id }) => (
                  <Select
                    id={id}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Badge tone="primary">Email</Badge>
            </div>

            <Field label="Email subject">
              {({ id }) => (
                <div className="flex gap-2">
                  <Input
                    id={id}
                    className="flex-1"
                    value={subject}
                    onFocus={() => {
                      insertVarTarget.current = 'subject';
                    }}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}
            </Field>

            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Template content
              </label>
              <Select
                aria-label="Insert variable"
                className="h-9 w-44 py-1 text-xs"
                value=""
                onFocus={() => {
                  insertVarTarget.current = 'body';
                }}
                onChange={(e) => {
                  if (e.target.value) insertVariable(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">{'{{}} Insert variable'}</option>
                {meta.variables.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-md border border-border">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
                <select
                  aria-label="Paragraph style"
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => {
                    execCmd('formatBlock', e.target.value);
                    e.target.value = 'p';
                  }}
                  defaultValue="p"
                  className="h-8 rounded-md border border-transparent bg-transparent px-2 text-xs text-foreground hover:bg-muted focus-visible:outline-none"
                >
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                <span className="mx-1 h-5 w-px bg-border" />
                {[
                  { icon: Bold, cmd: 'bold' },
                  { icon: Italic, cmd: 'italic' },
                  { icon: Underline, cmd: 'underline' },
                  { icon: Strikethrough, cmd: 'strikeThrough' },
                ].map((b) => (
                  <button
                    key={b.cmd}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execCmd(b.cmd)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                  >
                    <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                {[
                  { icon: List, cmd: 'insertUnorderedList' },
                  { icon: ListOrdered, cmd: 'insertOrderedList' },
                ].map((b) => (
                  <button
                    key={b.cmd}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execCmd(b.cmd)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                  >
                    <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                {[
                  { icon: AlignLeft, cmd: 'justifyLeft' },
                  { icon: AlignCenter, cmd: 'justifyCenter' },
                  { icon: AlignRight, cmd: 'justifyRight' },
                ].map((b) => (
                  <button
                    key={b.cmd}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execCmd(b.cmd)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                  >
                    <b.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const url = window.prompt('Link URL');
                    if (url) execCmd('createLink', url);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
                >
                  <LinkIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled
                  title="Image upload isn't wired up yet"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-50"
                >
                  <ImageIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
                className="min-h-[280px] max-w-none p-4 text-sm text-foreground focus-visible:outline-none [&_p]:mb-3 [&_a]:text-primary [&_a]:underline"
              />

              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>div &gt; p</span>
                <span>Characters: {charCount}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
              Template settings
            </h2>
            <div className="space-y-4">
              {[
                {
                  key: 'active' as const,
                  label: 'Active',
                  desc: 'This template is active and can be used.',
                  value: active,
                  set: setActive,
                },
                {
                  key: 'allowEdit' as const,
                  label: 'Allow editing before sending',
                  desc: 'Allow team members to edit content before sending.',
                  value: allowEdit,
                  set: setAllowEdit,
                },
                {
                  key: 'automation' as const,
                  label: 'Include in automation',
                  desc: 'Use this template in automated messages.',
                  value: includeInAutomation,
                  set: setIncludeInAutomation,
                },
              ].map((row2) => (
                <div key={row2.key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row2.label}</p>
                    <p className="text-xs text-muted-foreground">{row2.desc}</p>
                  </div>
                  <Switch
                    checked={row2.value}
                    onChange={row2.set}
                    aria-label={row2.label}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-base font-semibold text-foreground">
              Preview
            </h2>
          </div>
          <div className="mb-4 flex gap-1 border-b border-border">
            {(['email', 'mobile'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreviewMode(m)}
                className={cn(
                  'border-b-2 px-3 py-2 text-sm font-medium capitalize',
                  previewMode === m
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/*
            Deliberately fixed hex, not theme tokens — this pane previews
            the actual email HTML the customer's inbox renders, not this
            dashboard's own UI. The real template
            (`supabase/functions/_shared/templates.ts`) hardcodes its own
            colours (no dark-mode media query — transactional email has no
            concept of the owner's dashboard theme), so a token-based
            preview would silently lie about how the send looks whenever
            the owner is in dark mode. Values below are copied from that
            file's own PAPER/INK/MUTED/LINE/BRAND constants.
          */}
          <div
            style={{ background: '#e8ebed', borderColor: '#dcdfe2' }}
            className={cn(
              'overflow-hidden rounded-lg border',
              previewMode === 'mobile' && 'mx-auto max-w-[320px]',
            )}
          >
            <div
              style={{ background: '#ffffff', borderColor: '#dcdfe2' }}
              className="flex items-center justify-between border-b px-6 py-5"
            >
              <p style={{ color: '#333333' }} className="font-serif text-lg font-bold">
                Kokolett <span style={{ color: '#e05d38' }}>Beauty</span> UK
              </p>
              <p
                style={{ color: '#6b7280' }}
                className="text-2xs uppercase tracking-wide"
              >
                Women&rsquo;s hair salon
              </p>
            </div>
            <div
              style={{ background: '#ffffff', color: '#333333' }}
              className="p-5 text-sm"
            >
              <p className="mb-3 font-serif text-base font-semibold">
                {renderPreview(subject)}
              </p>
              <div
                style={{ color: '#333333' }}
                className="[&_a]:underline [&_a]:[color:#e05d38] [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml) }}
              />
            </div>
            <div
              style={{ borderColor: '#dcdfe2', background: '#fafbfc', color: '#6b7280' }}
              className="space-y-3 border-t p-4 text-center"
            >
              <div className="flex justify-center gap-3">
                {[MessageCircle, Globe, Share2].map((Icon, i) => (
                  <span
                    key={i}
                    style={{ background: '#ffffff', color: '#333333' }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                ))}
              </div>
              <span className="block text-xs">
                © {new Date().getFullYear()} Kokolett Beauty UK. All rights reserved.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
