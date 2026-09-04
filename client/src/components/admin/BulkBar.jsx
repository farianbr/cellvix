import { X } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The floating action bar that appears when rows are selected.
 *
 * **It floats rather than living in the toolbar.** A bulk bar wedged into the
 * filter row pushes the table down the moment a checkbox is ticked, which moves
 * the very rows the operator is aiming at; and once they have scrolled past it,
 * the actions for their selection are off screen. Fixed to the bottom of the
 * viewport, it stays reachable at row four hundred and never reflows the list.
 *
 * **The count is a statement, not a button.** It says what will be acted on,
 * because "Delete" with an ambiguous target is how somebody deletes thirty rows
 * they did not mean to select.
 *
 * `Clear` is always present and always last-but-one — an operator who opened
 * this bar by accident needs the way out to be in the same place every time.
 *
 * ```jsx
 * <BulkBar count={selected.length} onClear={() => setSelected([])}>
 *   <Button size="xs" variant="outline">Suspend</Button>
 * </BulkBar>
 * ```
 */
export function BulkBar({ count, noun = 'selected', onClear, children, className }) {
  if (!count) return null;

  return (
    <div
      // `pointer-events-none` on the positioner, restored on the bar itself, so
      // the strip of viewport either side of it stays clickable.
      className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4"
      role="region"
      aria-label={`${count} ${noun}`}
    >
      <div
        className={cn(
          'scroll-slim pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-surface px-2 py-2 shadow-card',
          className,
        )}
      >
        <p className="shrink-0 whitespace-nowrap px-2 text-sm text-ink-500">
          <span className="tnum font-semibold text-ink-900">{count}</span> {noun}
        </p>

        {children}

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
        >
          <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default BulkBar;
