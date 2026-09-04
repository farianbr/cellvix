import { Check, Circle, Clock } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * Where a record sits in a pipeline it is carried through — an invoice's
 * payment states, a quote's ladder, a purchase order's automation cycle
 * (ERP rework §4, convention 12).
 *
 * **This is deliberately not `StepIndicator`.** The Instructions forbid forking
 * that component, and this does not: `StepIndicator` is a *wizard* the user
 * advances through (the tab wizard, checkout, order tracking). `ProcessStrip`
 * is a *status display* of where a record sits in a pipeline the user is not
 * driving. Same visual family, different job — do not merge them.
 *
 * ## Stations, not a rail
 *
 * This used to draw a continuous rail with a filled portion and one live
 * marker. It read as a progress bar, which is a claim about *proportion* —
 * "40% of the way there" — and these stages are not fractions of a journey.
 * They are discrete states a record is in: an invoice is unpaid, or partly
 * paid, or paid.
 *
 * So each stage is now its own bordered card with a ringed glyph, and the
 * connector between them is a dashed arrow: a hand-off, not a fill. The
 * current stage carries the only solid border on the row, which makes "where
 * is this?" answerable without reading a word — the thing an operator actually
 * does with this component.
 *
 * A stage that is already behind us keeps its colour but drops to a tick, so
 * completed and current are distinguishable by shape as well as by tone. That
 * matters for anyone who cannot separate the two hues.
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
 * brand colour — a rejected quote whose row reads as healthy progress is
 * telling the operator the opposite of what happened.
 */
const STOPPED = {
  danger: { ring: 'border-danger text-danger', card: 'border-danger', label: 'text-danger' },
  warn: { ring: 'border-warn text-warn', card: 'border-warn', label: 'text-warn' },
};

export function ProcessStrip({
  steps = PURCHASE_CYCLE,
  current,
  /** `'danger'` or `'warn'` when the record stopped here rather than passing through. */
  stoppedTone,
  /**
   * Draw the **final** stage in the completed tone when the record is on it.
   *
   * The live stage is normally brand red — "here, still moving". On the last
   * rung there is nowhere left to move, and colouring the finish line as an
   * alert reads as a problem: a fully paid invoice looked like it needed
   * attention. Off by default, because a pipeline whose last stage is merely
   * the last one (a purchase order reaching Inventory) is not an achievement.
   */
  successOnLast = false,
  /** Names what the row is. Without it a bare row of pills has to be inferred. */
  title = 'Life cycle',
  caption = 'Fully automated — manual override possible at any step.',
  className,
}) {
  const currentIndex = steps.findIndex((step) => step.key === current);
  const stopped = STOPPED[stoppedTone];

  return (
    <section
      aria-label={title}
      className={cn('rounded-lg border border-line bg-surface-2 px-4 py-5', className)}
    >
      <h2 className="mb-4 text-center font-display text-lg font-bold text-ink-900">{title}</h2>

      <ol
        className={cn(
          'flex flex-col items-stretch gap-1.5',
          // Horizontal from `sm` up, centred as a row of stations. Below that
          // the cards stack: seven labels across 375px is unreadable, and no
          // amount of truncation makes a seven-across row work on a phone.
          'sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-0',
        )}
      >
        {steps.map((step, index) => {
          const done = currentIndex > -1 && index < currentIndex;
          const active = index === currentIndex;
          const last = index === steps.length - 1;
          // Arriving at the end is a good outcome, not an alert — see `successOnLast`.
          const finished = active && last && successOnLast && !stopped;

          return (
            <li key={step.key} className="flex items-center gap-1.5 sm:gap-0">
              <div
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex flex-1 items-center gap-2.5 rounded-md border bg-surface px-3.5 py-2.5',
                  'transition-[border-color,box-shadow] duration-[200ms]',
                  // The live stage is the only solid, shadowed card on the row.
                  // Everything else is quiet, which is what makes it findable.
                  active &&
                    cn(
                      'shadow-card',
                      stopped ? stopped.card : finished ? 'border-ok' : 'border-brand',
                    ),
                  !active && 'border-line',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                    done && 'border-ok text-ok',
                    active &&
                      (stopped
                        ? stopped.ring
                        : finished
                          ? 'border-ok text-ok'
                          : 'border-brand text-brand'),
                    !done && !active && 'border-line-strong text-ink-300',
                  )}
                >
                  {done || finished ? (
                    <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />
                  ) : active ? (
                    <Clock className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Circle className="size-2 fill-current" strokeWidth={0} aria-hidden="true" />
                  )}
                </span>

                <span
                  className={cn(
                    'whitespace-nowrap text-xs font-semibold uppercase tracking-wider',
                    active
                      ? stopped
                        ? stopped.label
                        : 'text-ink-900'
                      : done
                        ? 'text-ink-700'
                        : 'text-ink-300',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* A dashed arrow, not a filled rail: this is a hand-off between
                  states, and a solid bar would read as a proportion of
                  progress that these stages do not have. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center px-2 text-ink-300"
                >
                  <span className="hidden text-sm tracking-[.2em] sm:inline">--&gt;</span>
                  <span className="text-sm sm:hidden">↓</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {caption && (
        <p className="mt-4 border-t border-line pt-3 text-center text-xs text-ink-400">
          {caption}
        </p>
      )}
    </section>
  );
}

export default ProcessStrip;
