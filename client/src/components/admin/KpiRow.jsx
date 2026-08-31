import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The KPI tile row every admin screen opens with (ERP rework §4, convention 7).
 *
 * Tiles carry a **coloured left border keyed to meaning, not decoration**
 * (§2b). The map below is the whole vocabulary — a tile does not get to invent
 * a colour:
 *
 *   money-in / positive     ok
 *   money-out / cost        warn
 *   overdue / negative      danger
 *   neutral count           info
 *   the page's headline     brand
 *
 * It **wraps to a grid rather than forcing one line**. CellShoppe's nine-tile
 * P&L row overflows its own container even on desktop; a tile row that clips is
 * a bug, so this one reflows instead.
 */

const TONE_BORDER = {
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  danger: 'border-l-danger',
  info: 'border-l-info',
  brand: 'border-l-brand',
  neutral: 'border-l-line-strong',
};

const TONE_VALUE = {
  ok: 'text-ink-900',
  warn: 'text-ink-900',
  danger: 'text-danger',
  info: 'text-ink-900',
  brand: 'text-ink-900',
  neutral: 'text-ink-900',
};

const TONE_ICON = {
  ok: 'bg-ok-50 text-ok',
  warn: 'bg-warn-50 text-warn',
  danger: 'bg-danger-50 text-danger',
  info: 'bg-info-50 text-info',
  brand: 'bg-brand-50 text-brand',
  neutral: 'bg-surface-2 text-ink-400',
};

/**
 * A period-over-period change. Direction is not assumed to be good: a rise in
 * expenses is not a win, so the caller says which way is up via `goodWhen`.
 */
function Delta({ delta, goodWhen = 'up' }) {
  if (delta == null || Number.isNaN(delta)) return null;

  const rising = delta > 0;
  const flat = delta === 0;
  const good = flat ? null : (rising ? goodWhen === 'up' : goodWhen === 'down');

  return (
    <span
      className={cn(
        'tnum text-[11.5px] font-semibold',
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
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-[7px]',
              TONE_ICON[tone] ?? TONE_ICON.neutral,
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <p className="eyebrow min-w-0 flex-1 truncate text-ink-400">{label}</p>
        {to && (
          <ArrowUpRight
            className="size-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <p
          className={cn(
            'tnum font-display text-[21px] font-bold leading-none',
            TONE_VALUE[tone] ?? TONE_VALUE.neutral,
          )}
        >
          {value}
        </p>
        <Delta delta={delta} goodWhen={goodWhen} />
      </div>

      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-400">{hint}</p>}
    </>
  );

  const shell = cn(
    'rounded-[12px] border border-line border-l-[3px] bg-surface p-3.5',
    TONE_BORDER[tone] ?? TONE_BORDER.neutral,
    className,
  );

  if (!to) return <div className={shell}>{body}</div>;

  return (
    <Link
      to={to}
      // Only the three neutral sides lift on hover: `hover:border-line-strong`
      // would set all four and take the tone-keyed left border with it, which
      // is the one part of the tile that carries meaning (§2b).
      className={cn(
        shell,
        'group block transition-colors hover:border-y-line-strong hover:border-r-line-strong hover:bg-surface-2',
      )}
    >
      {body}
    </Link>
  );
}

/**
 * Pass `tiles` as an array of KpiTile props. The grid tightens as the count
 * grows so a nine-tile P&L row does not become nine near-empty columns.
 */
export function KpiRow({ tiles = [], className, children }) {
  const count = tiles.length || 4;
  const dense = count >= 7;

  return (
    <div
      className={cn(
        'mb-4 grid gap-2.5',
        'grid-cols-2',
        dense ? 'md:grid-cols-4 xl:grid-cols-7' : 'md:grid-cols-3 xl:grid-cols-6',
        count <= 4 && 'xl:grid-cols-4',
        count === 5 && 'xl:grid-cols-5',
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
