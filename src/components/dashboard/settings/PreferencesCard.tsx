import { type JSX, useState } from 'react';
import { Clock, Globe, SunMoon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { useTheme } from '@/context/ThemeContext';
import {
  getTimeFormatPreference,
  setTimeFormatPreference,
  type TimeFormatPreference,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const DATE_FORMAT_KEY = 'kokolett-date-format';
type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

function readDateFormat(): DateFormat {
  const stored = window.localStorage.getItem(DATE_FORMAT_KEY);
  return stored === 'MM/DD/YYYY' || stored === 'YYYY-MM-DD' ? stored : 'DD/MM/YYYY';
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap rounded-lg border border-border p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Theme/time-format/date-format save the instant they change — no Save
 * button needed. Language is not yet wired to anything, so it stays
 * disabled rather than pretending to work.
 */
export function PreferencesCard(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const [timeFormat, setTimeFormatState] = useState<TimeFormatPreference>(
    getTimeFormatPreference,
  );
  const [dateFormat, setDateFormat] = useState<DateFormat>(readDateFormat);

  const onTimeFormat = (pref: TimeFormatPreference): void => {
    setTimeFormatPreference(pref);
    setTimeFormatState(pref);
  };

  const onDateFormat = (value: DateFormat): void => {
    window.localStorage.setItem(DATE_FORMAT_KEY, value);
    setDateFormat(value);
  };

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Preferences
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose how Kokolett works for you.
      </p>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <SunMoon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">Choose light or dark mode</p>
            </div>
          </div>
          <Segmented
            ariaLabel="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Auto' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Globe
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <div>
              <p className="text-sm font-medium text-foreground">Language</p>
              <p className="text-xs text-muted-foreground">Set your preferred language</p>
            </div>
          </div>
          <Select className="w-36 shrink-0" value="en-GB" disabled aria-label="Language">
            <option value="en-GB">English (UK)</option>
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-3">
            <Clock
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <div>
              <p className="text-sm font-medium text-foreground">Time format</p>
              <p className="text-xs text-muted-foreground">Choose 12h or 24h</p>
            </div>
          </div>
          <Segmented
            ariaLabel="Time format"
            value={timeFormat}
            onChange={onTimeFormat}
            options={[
              { value: '24h', label: '24-hour' },
              { value: '12h', label: '12-hour' },
            ]}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center gap-3">
            <Clock
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <div>
              <p className="text-sm font-medium text-foreground">Date format</p>
              <p className="text-xs text-muted-foreground">Select your date format</p>
            </div>
          </div>
          <Segmented
            ariaLabel="Date format"
            value={dateFormat}
            onChange={onDateFormat}
            options={[
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
