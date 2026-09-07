import { type JSX, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TemplateHistoryPanel } from '@/components/dashboard/templates/TemplateHistoryPanel';
import { TemplateContentCard } from '@/components/dashboard/templates/TemplateContentCard';
import { TemplateEmailPreview } from '@/components/dashboard/templates/TemplateEmailPreview';
import { TemplateSettingsCard } from '@/components/dashboard/templates/TemplateSettingsCard';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { getEmailTemplate, updateEmailTemplate } from '@/services/emailService';
import { templateMeta } from '@/lib/templateCatalog';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import type { EmailTemplateRow } from '@/types';

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
  const [historyVersion, setHistoryVersion] = useState(0);
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
      setHistoryVersion((v) => v + 1);
      showToast({ message: 'Template saved.' });
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleReverted = (updated: EmailTemplateRow): void => {
    setRow(updated);
    setSubject(updated.subject);
    setBodyHtml(updated.html_body);
    if (editorRef.current) editorRef.current.innerHTML = updated.html_body;
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
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        Back to templates
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TemplateContentCard
            templateLabel={meta.label}
            category={category}
            onCategoryChange={setCategory}
            subject={subject}
            onSubjectChange={setSubject}
            variables={meta.variables}
            bodyHtml={bodyHtml}
            onBodyChange={setBodyHtml}
            editorRef={editorRef}
          />

          <TemplateSettingsCard
            active={active}
            onActiveChange={setActive}
            allowEdit={allowEdit}
            onAllowEditChange={setAllowEdit}
            includeInAutomation={includeInAutomation}
            onIncludeInAutomationChange={setIncludeInAutomation}
          />
        </div>

        <div className="space-y-6">
          <TemplateEmailPreview
            subject={subject}
            bodyHtml={bodyHtml}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
          />

          <TemplateHistoryPanel
            templateKey={key}
            currentSubject={subject}
            currentBodyHtml={bodyHtml}
            onReverted={handleReverted}
            refreshToken={historyVersion}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
