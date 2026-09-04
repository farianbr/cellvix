import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import cn from '@/lib/cn';
import { pressableSurface } from '@/lib/motion';

/**
 * The KPI tile row every admin screen opens with (ERP rework §4, convention 7).
 *
 * Tiles used to carry three colour signals each — a tone-keyed left border, a
 * tinted icon chip AND a tone-keyed value colour. On a seven-tile dashboard row
 * that produced a band of green, red and four blues across the top of the
 * screen, and none of it meant anything: "collected" is not more urgent than
 * "clients", it was merely assigned a different hue. Colour applied evenly to
 * everything is colour applied to nothing, because emphasis only exists
 * relative to what is quiet.
 *
 * So the tone map is gone from the tile's chrome. A tile is a plain surface;
 * the number is the loudest thing on it, which is correct, because the number
 * is what the operator came to read. `tone` still exists as a prop and still
 * has exactly one job: `danger` colours the VALUE, because a figure that is
 * actually wrong — overdue, negative, out of stock — has to be able to
 * interrupt a scan. Every other tone renders identically to neutral.
 *
 * The icon lost its coloured chip for the same reason and is now a plain
 * hairline glyph next to the label, where it aids recognition without
 * competing with the value for attention.
 *
 * It **wraps to a grid rather than forcing one line**. CellShoppe's nine-tile
 * P&L row overflows its own container even on desktop; a tile row that clips is
 * a bug, so this one reflows instead.
 */

/**
 * A period-over-period change. Direction is not assumed to be good: a rise in
 * expenses is not a win, so the caller says which way is up via `goodWhen`.
 */
function Delta({ delta, goodWhen = 'up' }) {
  if (delta == null || Number.isNaN(delta)) return null;

  const rising = delta > 0;
  const flat = delta === 0;
  const good = flat ? null : rising ? goodWhen === 'up' : goodWhen === 'down';

  return (
    <span
      className={cn(
        'tnum text-xs font-semibold',
        good === null ? 'text-ink-400' : good ? 'text-ok' : 'text-danger',
      )}
    >
      {rising ? '▲' : flat ? '·' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

/**
 * A tile becomes a link when the caller gives it `to`.
 *
 * A figure an operator wants to act on is a figure they will click, and a tile
 * that looks like a card but does nothing teaches them the row is inert. The
 * arrow appears on hover rather than sitting there permanently: seven arrows
 * in a row is noise, and the pointer already says the tile is live.
 *
 * `to` is optional on purpose — the P&L rows on Reports are read, not
 * navigated, and they keep the plain `div` with no focus ring to tab through.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
  delta,
  goodWhen,
  to,
  className,
}) {
  const body = (
    <>
      <div className="mb-2.5 flex items-center gap-1.5">
        {Icon && (
          <Icon className="size-3.5 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
        )}
        <p className="eyebrow min-w-0 flex-1 truncate text-ink-400">{label}</p>
        {to && (
          <ArrowUpRight
            className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity duration-fast group-hover:opacity-100"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <p
          className={cn(
            'tnum font-display text-2xl font-bold leading-none',
            // The one surviving use of tone. A figure that is wrong gets to
            // shout; everything else is ink.
            tone === 'danger' ? 'text-danger' : 'text-ink-900',
          )}
        >
          {value}
        </p>
        <Delta delta={delta} goodWhen={goodWhen} />
      </div>

      {hint && <p className="mt-2 text-xs leading-snug text-ink-400">{hint}</p>}
    </>
  );

  // Bordered, not shadowed — PROJECT_INSTRUCTIONS §2 is explicit that a surface
  // gets one or the other and never both.
  const shell = cn('rounded-lg border border-line bg-surface p-4', className);

  if (!to) return <div className={shell}>{body}</div>;

  return (
    <Link
      to={to}
      className={cn(
        shell,
        pressableSurface,
        'group block hover:border-line-strong hover:bg-surface-2',
      )}
    >
      {body}
    </Link>
  );
}

/**
 * Pass `tiles` as an array of KpiTile props. The grid tightens as the count
 * grows so a nine-tile P&L row does not become nine near-empty columns.
 *
 * Seven columns was the previous ceiling and it was too many: at 1440px each
 * tile got ~150px, which is narrower than the labels, so every heading
 * truncated to "COLLEC…", "OUTSTA…", "INVENTO…". A label the operator cannot
 * read is not a label. The grid tops out at five across and wraps instead —
 * two rows of readable tiles beat one row of ellipses.
 *
 * The column count is chosen per tile count so the rows come out BALANCED.
 * Seven tiles in a five-column grid leaves a row of five and a row of two, and
 * that stranded pair reads as a mistake — the eye expects a grid to be either
 * full or deliberately ragged, and 5+2 looks like neither. Seven splits 4+3,
 * which is even enough that the second row reads as part of the same block.
 */
const COLUMNS = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-3', // 3+3
  7: 'xl:grid-cols-4', // 4+3
  8: 'xl:grid-cols-4', // 4+4
  9: 'xl:grid-cols-5', // 5+4
  10: 'xl:grid-cols-5', // 5+5
};
export function KpiRow({ tiles = [], className, children }) {
  const count = tiles.length || 4;

  return (
    <div
      className={cn(
        'mb-4 grid gap-3',
        'grid-cols-2 md:grid-cols-3',
        COLUMNS[count] ?? 'xl:grid-cols-4',
        className,
      )}
    >
      {tiles.map(({ key, ...tile }) => (
        // `key` is pulled out of the spread: React warns when a key arrives
        // through `{...props}`, and it is not a KpiTile prop anyway.
        <KpiTile key={key ?? tile.label} {...tile} />
      ))}
      {children}
    </div>
  );
}

export default KpiRow;
