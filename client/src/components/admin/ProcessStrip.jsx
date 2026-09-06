import {
  Banknote,
  Building2,
  Boxes,
  CircleDashed,
  FileText,
  PackageCheck,
  Send,
  Truck,
} from 'lucide-react';
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
 * ## Every stage wears its own icon, and only the current one is ringed
 *
 * This used to swap the glyph by *state*: a tick for anything behind us, a
 * clock for the live one, a dot for anything ahead. That is a timeline's
 * vocabulary — it described a stage's progress and said nothing about what the
 * stage IS, so all seven stations of a purchase cycle looked identical apart
 * from their labels, and the row could only be read by reading it.
 *
 * Each stage now carries a glyph for its own meaning — money, a truck, a
 * stethoscope — which is constant wherever that stage appears and is what
 * makes the row scannable as a shape rather than as a sentence. Position is
 * carried by **the ring alone**: the current stage is the one circled and the
 * one solid card on the row, and that single difference is easier to find than
 * three shapes competing.
 *
 * Steps that name no `icon` fall back to a neutral dashed circle, so a caller
 * that has not chosen glyphs still renders — badly, but not broken.
 */

export const PURCHASE_CYCLE = [
  { key: 'supplier', label: 'Supplier Info', icon: Building2 },
  { key: 'po', label: 'Purchase Order', icon: FileText },
  { key: 'sent', label: 'Send to Supplier', icon: Send },
  { key: 'payment', label: 'Payment', icon: Banknote },
  { key: 'shipment', label: 'Shipment', icon: Truck },
  { key: 'received', label: 'Received', icon: PackageCheck },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
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

/**
 * A stage's own glyph.
 *
 * `CircleDashed` where a caller has not named one — a step set that predates
 * icons still renders as a legible row rather than a gap, and the dashed
 * outline reads as "unnamed stage" rather than as a state of its own.
 */
function StepIcon({ step }) {
  const Icon = step.icon ?? CircleDashed;
  return <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />;
}

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
                  'transition-[border-color,box-shadow] duration-snap',
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
                {/* The stage's own glyph, always. Only the RING moves: it is
                    drawn on the current stage and nowhere else, so position is
                    carried by one difference rather than by three shapes. */}
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full',
                    active
                      ? cn(
                          'border-2',
                          stopped
                            ? stopped.ring
                            : finished
                              ? 'border-ok text-ok'
                              : 'border-brand text-brand',
                        )
                      : done
                        ? 'text-ink-500'
                        : 'text-ink-300',
                  )}
                >
                  <StepIcon step={step} />
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
