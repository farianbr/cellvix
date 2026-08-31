import { Check } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Where a record sits in a pipeline it is carried through — a purchase order's
 * automation cycle, a quote's ladder (ERP rework §4, convention 12).
 *
 * **This is deliberately not `StepIndicator`.** The Instructions forbid forking
 * that component, and this does not: `StepIndicator` is a *wizard* the user
 * advances through (the tab wizard, checkout, order tracking). `ProcessStrip`
 * is a *status display* of where a record sits in a pipeline the user is not
 * driving. Same visual family, different job — do not merge them.
 *
 * ## What the previous version got wrong
 *
 * Seven identical chevrons, each with a numbered circle. Three specific faults:
 *
 *   - **Nothing dominated.** Equal-weight segments across the full width made
 *     the current stage a colour change inside a row of sameness, so answering
 *     "where is this?" meant reading all seven and comparing.
 *   - **The numbers carried nothing.** A stage's position is already given by
 *     its place in the row; printing `1…7` beside it is a section number, and
 *     it crowded out the one glyph that does mean something — the tick.
 *   - **The chevron notch was a costume.** A `clip-path` arrow between every
 *     pair implies hand-off at each joint, which is not what a status display
 *     says, and it distorted as labels changed length.
 *
 * ## What replaces it
 *
 * A **continuous rail** with the completed portion filled and one marker for
 * the live stage. The rail is the progress; the labels sit under it, and only
 * the current one is at full weight. That makes position readable in a glance
 * without reading a single word — the thing an operator actually does with it.
 *
 * The fill is `--ease-entrance` on width, so advancing a stage animates the
 * rail forward rather than repainting the row.
 */

export const PURCHASE_CYCLE = [
  { key: 'supplier', label: 'Supplier Info' },
  { key: 'po', label: 'Purchase Order' },
  { key: 'sent', label: 'Send to Supplier' },
  { key: 'payment', label: 'Payment' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'received', label: 'Received' },
  { key: 'inventory', label: 'Inventory' },
];

/**
 * A pipeline that stopped is drawn in the tone of *why* it stopped, not in the
 * brand gradient — a rejected quote whose rail reads as healthy progress is
 * telling the operator the opposite of what happened.
 */
const STOPPED = {
  danger: { fill: 'bg-danger', node: 'bg-danger', label: 'text-danger' },
  warn: { fill: 'bg-warn', node: 'bg-warn', label: 'text-warn' },
};

export function ProcessStrip({
  steps = PURCHASE_CYCLE,
  current,
  /** `'danger'` or `'warn'` when the record stopped here rather than passing through. */
  stoppedTone,
  caption = 'Fully automated — manual override possible at any step.',
  className,
}) {
  const currentIndex = steps.findIndex((step) => step.key === current);
  const last = steps.length - 1;
  const stopped = STOPPED[stoppedTone];

  /**
   * How far the rail is filled, as a percentage of its own width.
   *
   * Measured to the **centre of the current node**, not past it: the fill means
   * "arrived here", and running it to the far edge of the marker would read as
   * the stage already being finished. A record at stage 0 shows an empty rail
   * with a live marker at its head, which is the honest picture of "started,
   * nothing completed".
   */
  const progress = currentIndex <= 0 ? 0 : (currentIndex / last) * 100;

  return (
    <section
      aria-label="Process status"
      className={cn('rounded-[12px] border border-line bg-surface px-4 py-3.5', className)}
    >
      <ol
        className={cn(
          'relative',
          // Horizontal from `sm` up; a stacked list below it. Seven labels
          // across 375px collided into "SupplierPurchaseSend to" — unreadable,
          // and no amount of truncation makes a seven-across row work on a
          // phone. Stacked, each stage gets a full line and the rail runs down
          // the side, which is the same information in the shape that fits.
          'flex flex-col gap-0',
          'sm:flex-row sm:items-start sm:justify-between sm:gap-1',
        )}
      >
        {/* The horizontal rail, drawn centre-to-centre.
            `left`/`right` are one half-cell in, so it starts under the first
            node and stops under the last rather than overshooting into the
            card's padding. */}
        <span
          aria-hidden="true"
          style={{ left: `${100 / steps.length / 2}%`, right: `${100 / steps.length / 2}%` }}
          className="absolute top-[9px] hidden h-0.5 -translate-y-1/2 rounded-full bg-line sm:block"
        >
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-[420ms] ease-[var(--ease-entrance)]',
              // Flat brand, not `bg-brand-gradient`: that utility is a 135°
              // diagonal fading to black, which on a 2px rail degenerates to a
              // near-solid bar whose end reads as dead rather than complete.
              stopped ? stopped.fill : 'bg-brand',
            )}
            style={{ width: `${progress}%` }}
          />
        </span>

        {steps.map((step, index) => {
          const done = currentIndex > -1 && index < currentIndex;
          const active = index === currentIndex;

          return (
            <li
              key={step.key}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'relative flex min-w-0',
                // Stacked on mobile: node beside label, one stage per line.
                'items-center gap-2.5 py-1',
                'sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5 sm:py-0',
              )}
            >
              {/* The vertical connector, mobile only — the stacked equivalent
                  of the horizontal rail. Drawn per row rather than as one
                  absolute bar, so it cannot outrun a wrapped label. */}
              {index < last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[8px] top-[22px] h-[calc(100%-14px)] w-0.5 rounded-full sm:hidden',
                    done ? (stopped ? stopped.fill : 'bg-brand') : 'bg-line',
                  )}
                />
              )}

              <span
                className={cn(
                  'relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full',
                  'transition-[background-color,box-shadow] duration-[280ms]',
                  // A completed node is the accent at 55% against the live
                  // node's full strength — legible as "done" without competing
                  // with the one stage that answers "where is this now".
                  done &&
                    (stopped
                      ? `${stopped.node} text-white opacity-55`
                      : 'bg-brand text-white opacity-55'),
                  // The live node is the one thing that should catch the eye, so
                  // it is the only element carrying a ring — a halo of the page
                  // background separates it from the rail running underneath.
                  // An 18px node is large enough for the diagonal to read, so
                  // the live marker keeps the gradient the rail cannot use.
                  active &&
                    cn(
                      'text-white shadow-[0_0_0_4px_var(--color-surface)]',
                      stopped ? stopped.node : 'bg-brand-gradient',
                    ),
                  !done && !active && 'bg-line',
                )}
              >
                {done && <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />}
                {active && <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />}
              </span>

              <span
                className={cn(
                  'min-w-0 text-[11px] leading-tight transition-colors',
                  'text-left sm:w-full sm:text-center',
                  // Only the live label is at full weight. Completed stages are
                  // legible but recede; upcoming ones recede further. That is
                  // the hierarchy the old row of equal chevrons never had.
                  active
                    ? cn('font-semibold', stopped ? stopped.label : 'text-ink-900')
                    : done
                      ? 'text-ink-500'
                      : 'text-ink-300',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {caption && (
        <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-ink-400">{caption}</p>
      )}
    </section>
  );
}

export default ProcessStrip;
