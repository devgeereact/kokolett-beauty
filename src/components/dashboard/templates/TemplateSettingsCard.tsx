import type { JSX } from 'react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';

interface TemplateSettingsCardProps {
  active: boolean;
  onActiveChange: (value: boolean) => void;
  allowEdit: boolean;
  onAllowEditChange: (value: boolean) => void;
  includeInAutomation: boolean;
  onIncludeInAutomationChange: (value: boolean) => void;
}

/** The three on/off switches an email template carries alongside its content. */
export function TemplateSettingsCard({
  active,
  onActiveChange,
  allowEdit,
  onAllowEditChange,
  includeInAutomation,
  onIncludeInAutomationChange,
}: TemplateSettingsCardProps): JSX.Element {
  const rows = [
    {
      key: 'active',
      label: 'Active',
      desc: 'This template is active and can be used.',
      value: active,
      set: onActiveChange,
    },
    {
      key: 'allowEdit',
      label: 'Allow editing before sending',
      desc: 'Allow team members to edit content before sending.',
      value: allowEdit,
      set: onAllowEditChange,
    },
    {
      key: 'automation',
      label: 'Include in automation',
      desc: 'Use this template in automated messages.',
      value: includeInAutomation,
      set: onIncludeInAutomationChange,
    },
  ];

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
        Template settings
      </h2>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.desc}</p>
            </div>
            <Switch checked={row.value} onChange={row.set} aria-label={row.label} />
          </div>
        ))}
      </div>
    </Card>
  );
}
