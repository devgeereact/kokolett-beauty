import { type JSX, useId } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDateShort } from '@/lib/format';

const WIDTH = 600;
const HEIGHT = 200;
const PAD_LEFT = 36;
const PAD_BOTTOM = 20;
const PAD_TOP = 10;

/** A single-series area/line chart, hand-rolled in SVG — no charting library in this project (see `today/BookingsOverviewChart`). */
export function TrendLineChart({
  title,
  points,
  colorVar,
  formatValue,
}: {
  title: string;
  points: { date: string; value: number }[];
  colorVar: string;
  formatValue: (n: number) => string;
}): JSX.Element {
  const gradientId = useId();
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerWidth = WIDTH - PAD_LEFT - 8;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((p, i) => {
    const x =
      PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerWidth);
    const y = PAD_TOP + innerHeight - (p.value / max) * innerHeight;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords.at(-1)!.x} ${PAD_TOP + innerHeight} L ${coords[0]!.x} ${PAD_TOP + innerHeight} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const xTickEvery = Math.max(1, Math.ceil(points.length / 5));

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-serif text-base font-semibold text-foreground">{title}</h2>
      {points.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No data in this period.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorVar} stopOpacity="0.25" />
              <stop offset="100%" stopColor={colorVar} stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => {
            const y = PAD_TOP + innerHeight - (t / max) * innerHeight;
            return (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  x2={WIDTH}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text x={0} y={y + 4} fontSize="10" fill="var(--muted-foreground)">
                  {formatValue(t)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={colorVar} strokeWidth="2" />
          {coords.map((c) => (
            <circle key={c.date} cx={c.x} cy={c.y} r="2.5" fill={colorVar} />
          ))}

          {coords
            .filter((_, i) => i % xTickEvery === 0)
            .map((c) => (
              <text
                key={c.date}
                x={c.x}
                y={HEIGHT - 4}
                fontSize="10"
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
                {formatDateShort(`${c.date}T00:00:00Z`)}
              </text>
            ))}
        </svg>
      )}
    </Card>
  );
}
