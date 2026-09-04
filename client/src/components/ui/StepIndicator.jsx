import { Check } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The shared "step-completion" visual language (brief §10.5).
 *
 * ONE component, THREE consumers:
 *   1. the tab-wizard filter   (filters/TabWizard)
 *   2. conversational checkout (checkout/StepSection)
 *   3. order tracking          (account/OrderStepper)
 *
 * Never fork this. If a consumer needs a new state, add it here.
 */

const SIZES = {
  sm: { box: 'size-6 text-2xs', glyph: 'size-3.5' },
  md: { box: 'size-8 text-sm', glyph: 'size-4' },
  lg: { box: 'size-10 text-lg', glyph: 'size-5' },
};

/**
 * The COMPACT ramp on the active step, not the full one.
 *
 * A step indicator is a small CIRCLE, which is the hardest shape for a linear
 * ramp. Two things go wrong at 32px and the orb ramp fixes both.
 *
 * The full ramp spends its first 38% between near-black and deep red, so the
 * dark opening covers a third of the disc and reads as a stripe rather than as
 * depth. The orb ramp starts at the deep red, like the compact one.
 *
 * And a linear gradient is FLAT before its first stop and after its last, so
 * those flat regions hug the left and right rims as visible arcs — the circle
 * looks like it has a thin vertical stroke down each side. The orb ramp puts
 * its stops at -35% and 135%, outside the element, so both rims land on a
 * colour that is still changing and neither edge goes flat.
 */
const STATES = {
  upcoming: 'border border-line bg-surface text-ink-300',
  active: 'bg-brand-gradient-orb text-white shadow-card border border-transparent',
  completed: 'border border-ok/30 bg-ok-50 text-ok',
  error: 'border border-danger/30 bg-danger-50 text-danger',
};

/**
 * `glyph`:
 *   'auto'  — a tick once completed (the default everywhere).
 *   'index' — always the step number. The collapsed steps of the mobile tab
 *             wizard are numbers only, so a row of ticks would leave a buyer
 *             with no way to tell step 2 from step 4.
 */
export function StepIndicator({
  state = 'upcoming',
  index,
  icon: Icon,
  size = 'md',
  glyph = 'auto',
  className,
}) {
  const s = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tnum',
        'transition-[background,border-color,color] duration-panel',
        s.box,
        STATES[state],
        className,
      )}
    >
      {state === 'completed' && glyph !== 'index' ? (
        <Check className={s.glyph} strokeWidth={3} />
      ) : Icon && glyph !== 'index' ? (
        <Icon className={s.glyph} strokeWidth={2} />
      ) : (
        index
      )}
    </span>
  );
}

/**
 * The connector drawn between two indicators. Fills with the brand gradient once
 * the step behind it is complete, so a run of steps reads as a progress track.
 */
export function StepConnector({ complete = false, vertical = false, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block overflow-hidden rounded-full bg-line',
        vertical ? 'w-0.5 flex-1' : 'h-0.5 flex-1',
        className,
      )}
    >
      <span
        className={cn(
          // Compact ramp: this fill is 2px tall, so the full ramp's near-black
          // opening would put a dark stub at the start of every completed run.
          'block bg-brand-gradient-compact transition-[width,height] duration-panel ease-[var(--ease-entrance)]',
          vertical ? 'w-full' : 'h-full',
          complete ? (vertical ? 'h-full' : 'w-full') : vertical ? 'h-0' : 'w-0',
        )}
      />
    </span>
  );
}

export default StepIndicator;
