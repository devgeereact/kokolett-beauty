import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ConflictDetectionPanel } from '@/components/dashboard/assistant/ConflictDetectionPanel';
import { RescheduleSuggestionsPanel } from '@/components/dashboard/assistant/RescheduleSuggestionsPanel';
import { EmailDraftingPanel } from '@/components/dashboard/assistant/EmailDraftingPanel';
import { CommunicationAssistancePanel } from '@/components/dashboard/assistant/CommunicationAssistancePanel';
import { BusinessAnalyticsPanel } from '@/components/dashboard/assistant/BusinessAnalyticsPanel';
import { TrendAnalysisPanel } from '@/components/dashboard/assistant/TrendAnalysisPanel';
import { RepeatCustomerInsightsPanel } from '@/components/dashboard/assistant/RepeatCustomerInsightsPanel';
import { CancellationForecastingPanel } from '@/components/dashboard/assistant/CancellationForecastingPanel';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { cn } from '@/lib/utils';

const MODULES = [
  { key: 'conflicts', label: 'Schedule conflicts' },
  { key: 'reschedule', label: 'Reschedule suggestions' },
  { key: 'email', label: 'Email drafting' },
  { key: 'messages', label: 'Customer messages' },
  { key: 'analytics', label: 'Business analytics' },
  { key: 'trends', label: 'Appointment trends' },
  { key: 'repeat', label: 'Repeat customers' },
  { key: 'risk', label: 'Cancellation risk' },
] as const;

type ModuleKey = (typeof MODULES)[number]['key'];

/**
 * Eight advisory modules over data the dashboard already has. None of them
 * mutate anything on their own — each ends in a real action (reschedule,
 * send, mark complete) that goes through the same service functions the
 * rest of the dashboard uses, and a person has to click it.
 */
export function AssistantPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [module, setModule] = useState<ModuleKey>('conflicts');

  return (
    <DashboardLayout
      title="AI Assistant"
      subtitle="Advisory only — nothing here acts on its own"
    >
      <div
        role="tablist"
        aria-label="Assistant modules"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        {MODULES.map((m) => (
          <button
            key={m.key}
            role="tab"
            type="button"
            aria-selected={module === m.key}
            onClick={() => setModule(m.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              module === m.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {module === 'conflicts' && <ConflictDetectionPanel timezone={timezone} />}
      {module === 'reschedule' && <RescheduleSuggestionsPanel timezone={timezone} />}
      {module === 'email' && <EmailDraftingPanel timezone={timezone} />}
      {module === 'messages' && <CommunicationAssistancePanel timezone={timezone} />}
      {module === 'analytics' && <BusinessAnalyticsPanel timezone={timezone} />}
      {module === 'trends' && <TrendAnalysisPanel timezone={timezone} />}
      {module === 'repeat' && <RepeatCustomerInsightsPanel timezone={timezone} />}
      {module === 'risk' && <CancellationForecastingPanel timezone={timezone} />}
    </DashboardLayout>
  );
}
