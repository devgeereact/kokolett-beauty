import type { JSX } from 'react';
import { Card } from '@/components/ui/Card';
import type { StatusCategory } from '@/lib/status';

const CATEGORY_COLOR_VAR: Record<StatusCategory, string> = {
  pending_approval: 'var(--status-pending)',
  confirmed: 'var(--status-confirmed)',
  in_service: 'var(--status-in-service)',
  completed: 'var(--status-completed)',
  cancelled: 'var(--status-cancelled)',
  no_show: 'var(--status-no-show)',
};

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A stacked-arc donut, hand-rolled in SVG (`stroke-dasharray` segments) — same no-library constraint as `TrendLineChart`. */
export function StatusDonutChart({
  data,
}: {
  data: { category: StatusCategory; label: string; count: number }[];
}): JSX.Element {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  let offset = 0;

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
        Appointments by status
      </h2>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No appointments in this period.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label="Appointments by status"
          >
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth={STROKE}
              />
              {data.map((d) => {
                const length = (d.count / total) * CIRCUMFERENCE;
                const dash = `${length} ${CIRCUMFERENCE - length}`;
                const el = (
                  <circle
                    key={d.category}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={CATEGORY_COLOR_VAR[d.category]}
                    strokeWidth={STROKE}
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return el;
              })}
            </g>
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              fontSize="26"
              fontWeight="600"
              fill="var(--foreground)"
            >
              {total}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              Total
            </text>
          </svg>

          <ul className="space-y-1.5">
            {data.map((d) => (
              <li key={d.category} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLOR_VAR[d.category] }}
                />
                <span className="text-foreground">{d.label}</span>
                <span className="text-muted-foreground">
                  {d.count} ({Math.round((d.count / total) * 1000) / 10}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
