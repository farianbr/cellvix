import { useId } from 'react';
import cn from '@/lib/cn';

/**
 * Hand-rolled inline SVG charts (ERP rework §4, Charts).
 *
 * Three shapes — a line/area trend, a donut, horizontal bars — do not justify a
 * charting dependency, and inline SVG inherits the design tokens for free. If a
 * later phase needs axes, brushing and stacking, revisit the decision then
 * rather than growing this file into a library.
 *
 * Rules these all obey:
 *   · colour comes from `currentColor` or a semantic token class, never a hex
 *   · a zero/empty series draws its frame and says so — never an empty box
 *   · the SVG is `aria-hidden` and the real content is a `<table>` for screen
 *     readers, because a chart nobody can read is not accessible
 */

/**
 * Screen-reader table behind every chart. Visually hidden, structurally real.
 *
 * The hidden box is a wrapping `div`, never the `<table>` itself. A table
 * overrules a height smaller than its own rows, so `sr-only`'s `height: 1px`
 * did nothing to it: the table stayed its full natural height, invisible but
 * occupying layout, and every screen holding a chart grew hundreds of pixels of
 * dead scroll below its content. The wrapper is 1px and clips it.
 */
function ChartData({ caption, rows }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.display ?? row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyFrame({ height, message }) {
  return (
    <div
      className="flex items-center justify-center rounded-[10px] border border-dashed border-line"
      style={{ height }}
    >
      <p className="text-[12.5px] text-ink-400">{message}</p>
    </div>
  );
}

/**
 * Line + area trend with an average reference line.
 *
 * `points` is `[{ label, value }]` in order. A flat zero series still draws its
 * axis rather than collapsing — "nothing happened" is information.
 */
export function TrendChart({
  points = [],
  height = 180,
  caption = 'Trend over the selected period',
  formatValue = (value) => value,
  className,
}) {
  const gradientId = useId();

  if (points.length < 2) {
    return <EmptyFrame height={height} message="Not enough data in this period to draw a trend." />;
  }

  const width = 600;
  const padding = { top: 8, right: 4, bottom: 18, left: 4 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  // A flat series would divide by zero; give it a nominal span so the line
  // lands mid-frame instead of at infinity.
  const span = max - min || 1;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  const x = (index) => padding.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => padding.top + plotHeight - ((value - min) / span) * plotHeight;

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${padding.top + plotHeight} L${x(0)},${padding.top + plotHeight} Z`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-auto w-full text-brand"
        style={{ height }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
          className="stroke-line"
          strokeWidth="1"
        />

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(average)}
          y2={y(average)}
          className="stroke-ink-200"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-ink-300">
        <span>{points[0].label}</span>
        <span className="tnum">avg {formatValue(Math.round(average))}</span>
        <span>{points[points.length - 1].label}</span>
      </div>

      <ChartData
        caption={caption}
        rows={points.map((point) => ({
          label: point.label,
          value: point.value,
          display: formatValue(point.value),
        }))}
      />
    </div>
  );
}

/** Slice colours, drawn from the semantic tokens rather than an arbitrary ramp. */
const SLICE_CLASS = [
  'text-brand',
  'text-info',
  'text-ok',
  'text-warn',
  'text-ink-500',
  'text-danger',
  'text-ink-300',
];

/** Donut with the legend beside it. `slices` is `[{ label, value }]`. */
export function DonutChart({
  slices = [],
  size = 150,
  caption = 'Breakdown by share',
  formatValue = (value) => value,
  className,
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (!slices.length || total <= 0) {
    return <EmptyFrame height={size} message="Nothing recorded in this period." />;
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <svg viewBox="0 0 140 140" style={{ width: size, height: size }} aria-hidden="true">
        <g transform="rotate(-90 70 70)">
          {slices.map((slice, index) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={slice.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="20"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className={SLICE_CLASS[index % SLICE_CLASS.length]}
              />
            );
            offset += dash;
            return element;
          })}
        </g>
      </svg>

      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-[12.5px]">
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-[3px] bg-current',
                SLICE_CLASS[index % SLICE_CLASS.length],
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-ink-600">{slice.label}</span>
            <span className="tnum shrink-0 font-medium text-ink-900">{formatValue(slice.value)}</span>
            <span className="tnum w-9 shrink-0 text-right text-ink-300">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <ChartData
        caption={caption}
        rows={slices.map((slice) => ({
          label: slice.label,
          value: slice.value,
          display: formatValue(slice.value),
        }))}
      />
    </div>
  );
}

// Static map, not `bg-${tone}` — Tailwind scans source text, so an interpolated
// class name is a class that never gets generated.
const BAR_TONE = {
  brand: 'bg-brand-gradient',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Horizontal bars — top categories, top clients, per-staff contribution. */
export function BarList({
  items = [],
  caption = 'Ranked totals',
  formatValue = (value) => value,
  tone = 'brand',
  className,
}) {
  if (!items.length) return <EmptyFrame height={120} message="Nothing to rank in this period." />;

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={cn('space-y-2.5', className)}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="min-w-0 truncate text-ink-700">{item.label}</span>
            <span className="tnum shrink-0 font-medium text-ink-900">{formatValue(item.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn('h-full rounded-full', BAR_TONE[tone] ?? BAR_TONE.brand)}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
          {item.hint && <p className="mt-0.5 text-[11px] text-ink-400">{item.hint}</p>}
        </div>
      ))}

      <ChartData
        caption={caption}
        rows={items.map((item) => ({
          label: item.label,
          value: item.value,
          display: formatValue(item.value),
        }))}
      />
    </div>
  );
}
