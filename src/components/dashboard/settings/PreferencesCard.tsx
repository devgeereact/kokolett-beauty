import { type JSX, useState } from 'react';
import { Clock, Globe, Moon, SlidersHorizontal, Sun, SunMoon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { useTheme } from '@/context/ThemeContext';
import {
  getTimeFormatPreference,
  setTimeFormatPreference,
  type TimeFormatPreference,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ThemeMode } from '@/types';

const DATE_FORMAT_KEY = 'kokolett-date-format';
type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

function readDateFormat(): DateFormat {
  const stored = window.localStorage.getItem(DATE_FORMAT_KEY);
  return stored === 'MM/DD/YYYY' || stored === 'YYYY-MM-DD' ? stored : 'DD/MM/YYYY';
}

/**
 * Theme is real and wired app-wide (`ThemeContext`). Time format is real and
 * wired into every `formatTime` call (`lib/format.ts`). Language and date
 * format are saved as real preferences but don't yet drive rendering — the
 * rest of the dashboard's date displays ("Thu 6 Aug") are deliberately fixed
 * for readability and consistency with the other rebuilt screens, so this
 * stays a stored choice for now rather than a half-wired app-wide switch.
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
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
          <SlidersHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">
            Preferences
          </h2>
          <p className="text-sm text-muted-foreground">App appearance and behaviour.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {[
              { mode: 'light' as ThemeMode, label: 'Light', icon: Sun },
              { mode: 'dark' as ThemeMode, label: 'Dark', icon: Moon },
              { mode: 'system' as ThemeMode, label: 'Auto', icon: SunMoon },
            ].map((opt) => (
              <button
                key={opt.mode}
                type="button"
                aria-pressed={theme === opt.mode}
                onClick={() => setTheme(opt.mode)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  theme === opt.mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
          <Select className="w-40" value="en-GB" disabled aria-label="Language">
            <option value="en-GB">English (UK)</option>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          <Select
            className="w-40"
            value={timeFormat}
            aria-label="Time format"
            onChange={(e) => onTimeFormat(e.target.value as TimeFormatPreference)}
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          <Select
            className="w-40"
            value={dateFormat}
            aria-label="Date format"
            onChange={(e) => onDateFormat(e.target.value as DateFormat)}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}
