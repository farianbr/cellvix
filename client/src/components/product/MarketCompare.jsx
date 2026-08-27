import { useId, useState } from 'react';
import { ChevronDown, TrendingDown } from 'lucide-react';
import cn from '@/lib/cn';
import { money } from '@/lib/format';

/**
 * The competitor comparison.
 *
 * Every number here is computed server-side (productService.marketPosition) and
 * arrives on `product.market`. Nothing in this file subtracts one price from
 * another — the saving on the card and the saving in the breakdown are the same
 * integer, so they cannot disagree by a rounding step.
 *
 * `market` is null whenever there is nothing honest to claim: no benchmarks, or
 * we are not actually cheaper than the market average. It also never survives
 * the price gate, so a buyer who cannot see our price cannot see the market's.
 *
 * Two shapes, one source:
 *   variant="card" — one line, collapsed, opens a breakdown in place.
 *   variant="detail" — the same breakdown, already open.
 */
export function MarketCompare({ market, price, variant = 'card', className }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!market) return null;

  const { competitors, average, savings, savingsPercent, isLowest } = market;

  // The rows, ours included and cheapest first — a comparison table that does
  // not rank is just a list, and the reader has to do the ordering themselves.
  const rows = [
    { name: 'Cellvix', price, isUs: true },
    ...competitors.map((entry) => ({ ...entry, isUs: false })),
  ].sort((a, b) => a.price - b.price);

  const breakdown = (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li
          key={row.name}
          className={cn(
            'flex items-baseline justify-between gap-3 text-[12px]',
            row.isUs ? 'font-semibold text-ink-900' : 'text-ink-500',
          )}
        >
          <span className="min-w-0 truncate">{row.name}</span>
          <span className="tnum shrink-0">{money(row.price)}</span>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1 text-[11.5px] text-ink-400">
        <span>Market average</span>
        <span className="tnum">{money(average)}</span>
      </li>
    </ul>
  );

  if (variant === 'detail') {
    return (
      <div className={cn('rounded-[12px] border border-line bg-surface-2 p-4', className)}>
        <p className="flex items-center gap-2 font-display text-[14px] font-bold text-ok">
          <TrendingDown className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          {isLowest ? 'Lowest price of the parts we track' : `Save ${money(savings)} vs market`}
        </p>
        <p className="mb-3 mt-1 text-[12px] leading-snug text-ink-400">
          {savingsPercent}% under the average of {competitors.length} comparable trade{' '}
          {competitors.length === 1 ? 'listing' : 'listings'}. Indicative pricing, checked
          periodically.
        </p>
        {breakdown}
      </div>
    );
  }

  // ---- card ---------------------------------------------------------------
  // A button, not a hover: the grid is the phone's primary surface and there is
  // no hover there.
  //
  // The breakdown opens as a layer over the card's own body rather than in
  // flow. Expanding it in flow stretched the grid row and shoved the price and
  // Add button of every other card on that row downwards — reading one card's
  // comparison should not move three cards the reader was not touching.
  //
  // It hangs UPWARD from the trigger (`bottom-full`) because the card clips its
  // own overflow: below the trigger there is only the Add row and then the card
  // edge, while above it is the image, which is the space to borrow.
  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1 rounded-[6px] text-left text-[11px] font-semibold text-ok transition-colors hover:text-ok/80 @min-[200px]:text-[11.5px]"
      >
        <TrendingDown className="size-3 shrink-0 @min-[200px]:size-3.5" strokeWidth={2.25} aria-hidden="true" />
        {/* "vs market" is the first thing to go when the card is narrow — the
            saving is the claim, and the comparison it is against is already
            implied by a green number under a price. */}
        <span className="tnum min-w-0 truncate">
          Save {money(savings)}
          <span className="hidden @min-[200px]:inline"> vs market</span>
        </span>
        {/* The chevron needs a card wide enough to spare the width; below that
            the row itself stays the target and the panel still opens. */}
        <ChevronDown
          className={cn(
            'ml-auto hidden size-3.5 shrink-0 text-ink-300 transition-transform duration-200 @min-[200px]:block',
            open && 'rotate-180',
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 bottom-full z-20 mb-1.5 rounded-[9px] border border-line bg-surface p-2.5 shadow-flyout"
        >
          {breakdown}
        </div>
      )}
    </div>
  );
}

export default MarketCompare;
