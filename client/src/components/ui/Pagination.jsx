import { ChevronLeft, ChevronRight } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/** Builds a page list with ellipses: 1 … 4 5 6 … 20 */
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);

  if (start > 2) items.push('…');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pages - 1) items.push('…');
  items.push(pages);

  return items;
}

/** The two arrows. Identical but for direction, so they are declared once. */
const ARROW_CLASS = cn(
  pressable,
  'flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-500',
  'hover:border-line-strong hover:text-ink-900',
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
);

/**
 * @param {boolean} [hideWhenSingle] Collapse to nothing at one page. Off by
 *   default: a lone "1" tells an operator they are looking at the whole set,
 *   and a control that disappears at small row counts makes the foot of a
 *   table change shape for no reason the reader can see. Pass it where the
 *   surrounding layout genuinely has no room.
 */
export function Pagination({ page, pages, onChange, className, hideWhenSingle = false }) {
  if (pages <= 1 && hideWhenSingle) return null;

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={ARROW_CLASS}
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
      </button>

      {pageList(page, pages).map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-ink-300" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              pressable,
              'tnum flex size-9 items-center justify-center rounded-md font-display text-sm font-semibold',
              /**
               * The current page is a FLAT brand chip.
               *
               * It used to be a gradient ring around a white face — an attempt
               * to mark the page without competing with the CTA, which ended up
               * doing neither well. §2.2 is explicit that pagination is one of
               * the places that takes flat `bg-brand` and not the gradient, and
               * a gradient ring is still the gradient: it put the signature
               * treatment on a control that marks a position rather than offers
               * an action, and at 36px the whole ramp was compressed into a 2px
               * outline where it read as a muddy red edge rather than as the
               * brand.
               *
               * Flat brand is unambiguous at this size, matches the active
               * filter pill it will often share a screen with, and leaves the
               * gradient to the one CTA on the page.
               */
              item === page
                ? 'bg-brand text-white'
                : 'border border-line bg-surface text-ink-700 hover:border-line-strong hover:text-ink-900',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
        className={ARROW_CLASS}
      >
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </nav>
  );
}

export default Pagination;
