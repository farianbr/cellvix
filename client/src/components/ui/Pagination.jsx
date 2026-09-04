import { ChevronLeft, ChevronRight } from 'lucide-react';
import cn from '@/lib/cn';

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
        className="flex size-9 items-center justify-center rounded-[8px] border border-line bg-surface text-ink-500 transition-colors hover:border-line-strong hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
      </button>

      {pageList(page, pages).map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-[13px] text-ink-300" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'tnum flex size-9 items-center justify-center rounded-[8px] font-display text-[13px] font-semibold transition-[background,color,border-color]',
              // Outlined, not filled: the ring carries the brand ramp while the
              // face stays white, so the current page is marked without a solid
              // chip competing with the primary CTA on the same screen. A page
              // number is a position, not an action.
              item === page
                ? 'ring-brand-gradient font-bold text-brand'
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
        className="flex size-9 items-center justify-center rounded-[8px] border border-line bg-surface text-ink-500 transition-colors hover:border-line-strong hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </nav>
  );
}

export default Pagination;
