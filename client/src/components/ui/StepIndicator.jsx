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

const STATES = {
  upcoming: 'border border-line bg-surface text-ink-300',
  active: 'bg-brand-gradient text-white shadow-card border border-transparent',
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
        'transition-[background,border-color,color] duration-[220ms]',
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
          'block bg-brand-gradient transition-[width,height] duration-[280ms] ease-[var(--ease-entrance)]',
          vertical ? 'w-full' : 'h-full',
          complete ? (vertical ? 'h-full' : 'w-full') : vertical ? 'h-0' : 'w-0',
        )}
      />
    </span>
  );
}

export default StepIndicator;
