import { useId, useMemo, useRef, useState } from 'react';
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
 *   · the SVG is `aria-hidden`, and the numbers reach a screen reader as real
 *     text beside it — a chart nobody can read is not accessible
 *
 * **How the accessible text is provided, and why it is not a hidden table.**
 * Every chart used to carry a visually hidden `<table>` of its data. Two of the
 * three already render that same data as a visible list, so the table read the
 * figures out twice; worse, a hidden table cannot be made small. `sr-only` is a
 * 1px box with `overflow: hidden`, and a table overrules any height below its
 * own rows, so each one stayed ~700px tall and scrollable inside that box — and
 * the document's scroll area counts that, which gave every screen holding a
 * chart a stretch of dead scroll past its content. Clipping and `contain` stop
 * it being reachable but do not stop it being counted.
 *
 * So the tables are gone. The donut and the bar list already list every label
 * and value in the DOM; the trend chart, whose data lives only in the SVG path,
 * states its shape in a sentence.
 */

function EmptyFrame({ height, message }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-line"
      style={{ height }}
    >
      <p className="text-sm text-ink-400">{message}</p>
    </div>
  );
}

/**
 * "Nice" axis bounds — round numbers a reader can actually do arithmetic with.
 *
 * A raw min/max puts the top gridline at $8,350.65, which nobody reads as a
 * quantity. This walks a 1-2-5 ladder to the next round step so the axis reads
 * $0 · $2K · $4K · $6K · $8K, and the series is guaranteed to fit inside it.
 *
 * **Zero is always included.** A money chart whose baseline is $4,000 makes a
 * 3% move look like a collapse — the classic truncated-axis lie. Where a series
 * goes negative the axis spans both sides so the zero line stays real.
 */
function niceScale(min, max, targetTicks = 5) {
  const low = Math.min(min, 0);
  const high = Math.max(max, 0);

  // An all-zero series still needs a frame to sit in — but only **one** labelled
  // tick. A nominal span of 1 would print `$0` twice, once at each end, because
  // the values are cents and both round to the same dollar label: an axis that
  // appears to say the top and the bottom of the chart are the same number.
  if (low === 0 && high === 0) return { low: 0, high: 1, step: 1, ticks: [0] };

  const rawStep = (high - low) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = (normalised > 5 ? 10 : normalised > 2 ? 5 : normalised > 1 ? 2 : 1) * magnitude;

  const niceLow = Math.floor(low / step) * step;
  const niceHigh = Math.ceil(high / step) * step;

  const ticks = [];
  // Accumulating `tick += step` drifts on floats; multiply from the index
  // instead so the last tick lands exactly on `niceHigh`.
  const count = Math.round((niceHigh - niceLow) / step);
  for (let index = 0; index <= count; index += 1) ticks.push(niceLow + index * step);

  return { low: niceLow, high: niceHigh, step, ticks };
}

/**
 * Pick roughly `target` labels out of `count` slots, always keeping the first
 * and the last. Ninety daily labels cannot all be drawn, and dropping every
 * other one until they fit leaves an axis that ends on a stub.
 */
function thinLabels(count, target = 7) {
  if (count <= target) return Array.from({ length: count }, (_, index) => index);
  const stride = Math.ceil((count - 1) / (target - 1));
  const kept = [];
  for (let index = 0; index < count - 1; index += stride) kept.push(index);
  // The final label is non-negotiable — it is the end of the range.
  if (kept[kept.length - 1] !== count - 1) kept.push(count - 1);
  return kept;
}

/**
 * Line + area trend with a real axis frame, gridlines and a hover readout.
 *
 * `points` is `[{ label, value }]` in order. A flat zero series still draws its
 * axis rather than collapsing — "nothing happened" is information.
 *
 * **Why this carries axes when the first version did not.** A bare line with no
 * scale shows shape and hides magnitude: the same curve reads identically at
 * $200 and $200,000, and a reader has to trust a caption for the only number
 * that matters. Gridlines at round values, a labelled y-axis and a per-point
 * hover readout make it a chart you can take a figure off rather than a
 * decoration that gestures at a trend.
 */
export function TrendChart({
  points = [],
  height = 220,
  caption = 'Trend over the selected period',
  formatValue = (value) => value,
  formatTick,
  seriesLabel = 'Value',
  className,
}) {
  const gradientId = useId();
  const [active, setActive] = useState(null);
  const frameRef = useRef(null);

  const tickFormatter = formatTick ?? formatValue;

  // Hooks cannot sit behind the early return below, so the geometry is computed
  // unconditionally and the guard reads its result.
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const width = 600;
    // Left padding holds the y-axis labels; bottom holds the dates. Both were
    // 4px when the chart had no axes to make room for.
    const padding = { top: 10, right: 8, bottom: 26, left: 52 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const values = points.map((point) => point.value);
    const scale = niceScale(Math.min(...values), Math.max(...values));
    const span = scale.high - scale.low || 1;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    const x = (index) => padding.left + (index / (points.length - 1)) * plotWidth;
    const y = (value) => padding.top + plotHeight - ((value - scale.low) / span) * plotHeight;

    return { width, padding, plotWidth, plotHeight, values, scale, average, x, y };
  }, [points, height]);

  if (!geometry) {
    return <EmptyFrame height={height} message="Not enough data in this period to draw a trend." />;
  }

  const { width, padding, plotWidth, plotHeight, values, scale, average, x, y } = geometry;
  const max = Math.max(...values);
  const min = Math.min(...values);

  /**
   * A smoothed path rather than a polyline.
   *
   * Straight segments meeting at every data point give the trend a row of
   * sharp spikes, which reads as noise and makes two adjacent days look like a
   * dramatic event. This is a monotone cubic: each point gets control points
   * derived from its neighbours, and the tangent is **flattened to horizontal
   * wherever the series changes direction** (the `slope` sign test below).
   * That is what keeps the curve from overshooting — a plain Catmull-Rom
   * would bow past a local maximum and draw a value the data never reached,
   * which on a money chart is a lie rather than a smoothing artefact.
   */
  const coords = points.map((point, index) => [x(index), y(point.value)]);

  // Tangent at each point, in y-per-x. Endpoints take their one-sided slope;
  // an interior point takes the average of its two, or zero at a turn.
  const slopes = coords.map(([, py], index) => {
    const previous = coords[index - 1];
    const next = coords[index + 1];
    if (!previous) return (next[1] - py) / (next[0] - coords[index][0]);
    if (!next) return (py - previous[1]) / (coords[index][0] - previous[0]);

    const before = (py - previous[1]) / (coords[index][0] - previous[0]);
    const after = (next[1] - py) / (next[0] - coords[index][0]);
    // Opposite signs mean this point is a peak or a trough: flatten it, so the
    // curve turns around at the real value instead of sailing past it.
    return before * after <= 0 ? 0 : (before + after) / 2;
  });

  const line = coords
    .map(([px, py], index) => {
      if (index === 0) return `M${px},${py}`;

      const [prevX, prevY] = coords[index - 1];
      // A third of the gap is the standard Hermite-to-Bezier conversion and
      // keeps the curve visibly tight to its points.
      const third = (px - prevX) / 3;

      return (
        `C${prevX + third},${prevY + slopes[index - 1] * third} ` +
        `${px - third},${py - slopes[index] * third} ${px},${py}`
      );
    })
    .join(' ');

  // The fill closes on the **zero line**, not the bottom of the frame. With a
  // series that dips negative, closing at the frame bottom fills the area below
  // zero solid and reads as a large positive quantity — the opposite of what
  // happened. `niceScale` guarantees zero is inside the axis, so this is always
  // a real coordinate.
  const baseline = y(0);
  const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`;

  // What the chart says, in a sentence. A point-by-point reading of ninety days
  // is not usable with a screen reader; the range, the average and the extremes
  // are what somebody actually takes from glancing at the line.
  const peak = points[values.indexOf(max)];
  const trough = points[values.indexOf(min)];
  const summary =
    `${caption}. ${points.length} points from ${points[0].label} to ${points[points.length - 1].label}. ` +
    `Average ${formatValue(Math.round(average))}, ` +
    `highest ${formatValue(max)} on ${peak.label}, lowest ${formatValue(min)} on ${trough.label}.`;

  const labelIndexes = thinLabels(points.length);
  const hovered = active === null ? null : points[active];

  /**
   * Map a pointer position to the nearest data index.
   *
   * The SVG is `preserveAspectRatio="none"` and stretches, so the ratio of the
   * pointer's offset to the element's own width is the only reliable reading —
   * viewBox units would be wrong at every width but 600.
   */
  const handleMove = (event) => {
    const frame = frameRef.current;
    if (!frame) return;

    const bounds = frame.getBoundingClientRect();
    if (bounds.width === 0) return;

    const ratio = (event.clientX - bounds.left) / bounds.width;
    const plotRatio = (ratio * width - padding.left) / plotWidth;
    const index = Math.round(plotRatio * (points.length - 1));

    setActive(Math.min(Math.max(index, 0), points.length - 1));
  };

  return (
    <div className={className}>
      {/* Legend, matching the tooltip's vocabulary. Without it the dashed line
          is an unexplained mark — the reader can see there are two things and
          not which is which. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-brand" aria-hidden="true" />
          {seriesLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0 w-3 border-t border-dashed border-ink-200"
            aria-hidden="true"
          />
          Average {tickFormatter(Math.round(average))}
        </span>
      </div>

      <div
        ref={frameRef}
        className="relative"
        style={{ height }}
        onPointerMove={handleMove}
        onPointerLeave={() => setActive(null)}
      >
        {/* `role="img"` with a label is the whole accessible representation: the
            shapes inside carry no meaning on their own, and the sentence says
            what the line does. */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full text-brand"
          role="img"
          aria-label={summary}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Gridlines at the round values the axis labels name. Drawn first so
              the series always sits on top of them. */}
          {scale.ticks.map((tick) => (
            <line
              key={tick}
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(average)}
            y2={y(average)}
            className="stroke-ink-200"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
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

          {/* Hover marker: the rule locates the reading on the axis, the dot
              locates it on the line. */}
          {hovered && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                className="stroke-ink-200"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {/* Two circles rather than a stroked one: `preserveAspectRatio`
                  is `none`, so a stroke would render as an ellipse. */}
              <circle cx={x(active)} cy={y(hovered.value)} r="5" className="fill-surface" />
              <circle cx={x(active)} cy={y(hovered.value)} r="3.5" fill="currentColor" />
            </g>
          )}
        </svg>

        {/* Axis labels live in HTML, not SVG text: `preserveAspectRatio="none"`
            stretches the viewBox horizontally, and stretched type is the one
            thing that makes a hand-rolled chart look broken. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {scale.ticks.map((tick) => (
            <span
              key={tick}
              className="tnum absolute -translate-y-1/2 pr-2 text-right text-2xs leading-none text-ink-300"
              style={{ top: `${(y(tick) / height) * 100}%`, left: 0, width: padding.left }}
            >
              {tickFormatter(tick)}
            </span>
          ))}

          {labelIndexes.map((index) => (
            <span
              key={points[index].label}
              className={cn(
                'absolute -translate-x-1/2 whitespace-nowrap text-2xs leading-none',
                index === active ? 'font-medium text-ink-700' : 'text-ink-300',
              )}
              style={{ left: `${(x(index) / width) * 100}%`, bottom: 4 }}
            >
              {points[index].label}
            </span>
          ))}
        </div>

        {/* Tooltip. Flips to the left of the cursor past the midpoint so it
            never runs off the panel. */}
        {hovered && (
          <div
            className={cn(
              'pointer-events-none absolute top-2 z-10 rounded-md bg-surface px-2.5 py-1.5 shadow-pop',
              active > points.length / 2 ? '-translate-x-full -ml-3' : 'ml-3',
            )}
            style={{ left: `${(x(active) / width) * 100}%` }}
            role="status"
          >
            <p className="text-2xs leading-none text-ink-400">{hovered.label}</p>
            <p className="tnum mt-1 text-sm font-semibold leading-none text-ink-900">
              {formatValue(hovered.value)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-2xs text-ink-300">
        <span>
          Peak <span className="tnum font-medium text-ink-600">{tickFormatter(max)}</span> on{' '}
          {peak.label}
        </span>
        <span>
          Low <span className="tnum font-medium text-ink-600">{tickFormatter(min)}</span> on{' '}
          {trough.label}
        </span>
      </div>
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

      {/* The legend is the accessible content — every label, value and share is
          real text — so the ring beside it stays `aria-hidden`. */}
      <ul className="min-w-[140px] flex-1 space-y-1.5" aria-label={caption}>
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-sm bg-current',
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

/**
 * Horizontal bars — top categories, top clients, per-staff contribution.
 *
 * `rank` numbers the rows, and `showShare` prints each row's percentage of the
 * total. Both default off: a ranked list of five clients wants them, a list of
 * two stock categories does not.
 *
 * The bar is 6px rather than the 1.5px hairline it started as. At 1.5px the
 * length difference between the first and third row is invisible at a glance,
 * which is the one job the bar has — the numbers beside it are already exact.
 */
export function BarList({
  items = [],
  caption = 'Ranked totals',
  formatValue = (value) => value,
  tone = 'brand',
  rank = false,
  showShare = false,
  className,
}) {
  if (!items.length) return <EmptyFrame height={120} message="Nothing to rank in this period." />;

  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    // Each row already states its label, its value and its hint as text, so the
    // list is the accessible representation and the bars are decoration.
    <div className={cn('space-y-3', className)} role="list" aria-label={caption}>
      {items.map((item, index) => (
        <div key={item.label} role="listitem">
          <div className="mb-1.5 flex items-baseline gap-2 text-sm">
            {rank && (
              <span
                className="tnum w-4 shrink-0 text-2xs font-medium text-ink-300"
                aria-hidden="true"
              >
                {index + 1}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-ink-700">{item.label}</span>
            {showShare && total > 0 && (
              <span className="tnum shrink-0 text-2xs text-ink-300">
                {Math.round((item.value / total) * 100)}%
              </span>
            )}
            <span className="tnum shrink-0 font-medium text-ink-900">{formatValue(item.value)}</span>
          </div>

          {/* The track is indented to sit under the label when the rows are
              numbered, so the bars share one left edge and stay comparable. */}
          <div className={cn('flex items-center gap-2', rank && 'pl-6')}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500 ease-entrance',
                  BAR_TONE[tone] ?? BAR_TONE.brand,
                )}
                // A 2% floor keeps a tiny non-zero value visible as a mark
                // rather than rendering as nothing at all.
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </div>
          </div>

          {item.hint && (
            <p className={cn('mt-1 text-2xs text-ink-400', rank && 'pl-6')}>{item.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
