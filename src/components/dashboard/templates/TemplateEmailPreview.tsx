import type { JSX } from 'react';
import DOMPurify from 'dompurify';
import { Globe, MessageCircle, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { OWNER_NAME, SITE_ORIGIN } from '@/lib/business';

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
  staff_name: OWNER_NAME,
  reference: 'KB-Y6ZXKH',
  approval_window_h: '12',
  reason: 'The stylist is no longer available at that time',
  customer_note: 'Allergic to ammonia-based dye',
  notes: 'Flexible on time, prefers weekday mornings',
  preferred_dates: 'Sat 24 May, Sun 25 May',
  flexibility: 'Any time that week',
  google_review_url: 'https://g.page/r/example/review',
  manage_url: `${SITE_ORIGIN}/access/8f3a1c9e4b2d`,
  reset_url: `${SITE_ORIGIN}/reset-password`,
  reset_ttl_minutes: '60',
};

/**
 * Sanitised for the preview render only. `bodyHtml` comes from a
 * contentEditable `execCommand` editor the owner types into — the browser
 * happily lets `execCommand('insertHTML')` (paste) carry a `<script>` or an
 * `onerror` attribute straight through, and the one place this string is
 * rendered as HTML is the `dangerouslySetInnerHTML` preview below.
 */
function renderPreview(html: string): string {
  const withTokens = html.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => SAMPLE_VALUES[key] ?? `{{${key}}}`,
  );
  return DOMPurify.sanitize(withTokens);
}

interface TemplateEmailPreviewProps {
  subject: string;
  bodyHtml: string;
  previewMode: 'email' | 'mobile';
  onPreviewModeChange: (mode: 'email' | 'mobile') => void;
}

/**
 * How the template renders inside a real inbox, with sample data standing
 * in for `{{tokens}}`.
 *
 * Deliberately fixed hex, not theme tokens — this pane previews the actual
 * email HTML the customer's inbox renders, not this dashboard's own UI. The
 * real template (`supabase/functions/_shared/templates.ts`) hardcodes its
 * own colours (no dark-mode media query — transactional email has no
 * concept of the owner's dashboard theme), so a token-based preview would
 * silently lie about how the send looks whenever the owner is in dark
 * mode. Values below are copied from that file's own
 * PAPER/INK/MUTED/LINE/BRAND constants.
 */
export function TemplateEmailPreview({
  subject,
  bodyHtml,
  previewMode,
  onPreviewModeChange,
}: TemplateEmailPreviewProps): JSX.Element {
  return (
    <Card className="h-fit p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground">Preview</h2>
      </div>
      <Tabs
        className="mb-4"
        tabs={[
          { key: 'email' as const, label: 'Email' },
          { key: 'mobile' as const, label: 'Mobile' },
        ]}
        active={previewMode}
        onChange={onPreviewModeChange}
      />

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
          <p style={{ color: '#6b7280' }} className="text-2xs uppercase tracking-wide">
            Women&rsquo;s hair salon
          </p>
        </div>
        <div style={{ background: '#ffffff', color: '#333333' }} className="p-5 text-sm">
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
          style={{
            borderColor: '#dcdfe2',
            background: '#fafbfc',
            color: '#6b7280',
          }}
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
  );
}
