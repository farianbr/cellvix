import { forwardRef } from 'react';
import cn from '@/lib/cn';
import Spinner from './Spinner';

const VARIANTS = {
  /**
   * The gradient's primary home. Keep it on CTAs, not on surfaces.
   *
   * A DISABLED primary drops the gradient for a flat grey. Faded to 45% the
   * ramp becomes a muddy smear rather than a brand mark — and a control that
   * cannot be pressed has no business wearing the treatment reserved for the
   * one action a page most wants taken. The settings screens show this most:
   * their save button is disabled until something changes, so the unmodified
   * state of every one of them was a washed-out gradient sitting under the
   * form.
   *
   * `disabled:shadow-none` goes with it, because the elevation was lifting a
   * button that cannot be pressed.
   */
  primary:
    'bg-brand-gradient text-white shadow-card hover:brightness-110 active:brightness-95 ' +
    'disabled:bg-none disabled:bg-surface-3 disabled:text-ink-400 disabled:shadow-none disabled:opacity-100',
  solid: 'bg-ink-900 text-white hover:bg-ink-700 active:bg-ink-900',
  outline:
    'border border-line-strong bg-surface text-ink-700 hover:border-ink-300 hover:bg-surface-2 active:bg-surface-3',
  subtle: 'bg-surface-3 text-ink-700 hover:bg-line active:bg-line-strong',
  ghost: 'text-ink-500 hover:bg-surface-3 hover:text-ink-900 active:bg-line',
  brandSoft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-100',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-sm',
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-5 text-md gap-2 rounded-md',
  lg: 'h-13 px-7 text-lg gap-2 rounded-lg',
};

const SPINNER_SIZE = { xs: 'xs', sm: 'xs', md: 'sm', lg: 'sm' };

/**
 * The one button in the system. Anything that looks like a button uses this —
 * do not hand-roll a styled <button> elsewhere.
 *
 * Two details here are the difference between a button that feels responsive
 * and one that feels like a link with a background:
 *
 * `active:scale-[0.97]` gives the press a physical answer. It is the single
 * cheapest thing that makes an interface feel like it is listening, and it has
 * to be on the transform transition — not on `all`, which would drag every
 * colour change onto the press timing.
 *
 * The loading state keeps the label in place and cross-fades a spinner over
 * it, rather than swapping the label out. Replacing the text collapses the
 * button's width mid-click, which moves the thing the user just pressed.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    children,
    loading = false,
    disabled,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-display font-semibold',
        // Transform is listed first and the property list is explicit: a
        // `transition-all` here would animate the spinner's opacity on the same
        // curve as the press, which reads as the button lagging behind the tap.
        'transition-[transform,background-color,border-color,color,box-shadow,filter] duration-press ease-entrance',
        'active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100',
        /**
         * 60%, not 45%, and `primary` opts out of it entirely.
         *
         * Every other variant needs SOME fade, because their disabled colours
         * are otherwise identical to their enabled ones — a `danger` button
         * that looks completely live but does nothing is the worst case, since
         * the action it names is destructive. So the fade stays for them.
         *
         * But 45% put the label under 3:1, which is illegible rather than
         * quiet, and disabled still has to be readable: an operator needs to
         * know what the thing they cannot press would do. 60% keeps every
         * variant's label above 3:1 while still reading as unavailable.
         *
         * `primary` is exempt via `disabled:opacity-100` because it now states
         * its own disabled colours above, and fading those a second time is
         * what made the old gradient a smear.
         */
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {/* The label stays mounted and blurs out under the spinner. Blur is what
          keeps the crossfade from reading as two separate objects overlapping:
          it bridges the two states so the eye sees one thing changing. */}
      <span
        className={cn(
          'inline-flex items-center justify-center gap-[inherit]',
          'transition-[opacity,filter] duration-snap ease-entrance',
          loading && 'opacity-0 blur-[2px]',
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
        {children}
        {IconRight && <IconRight className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
      </span>

      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={SPINNER_SIZE[size]} />
        </span>
      )}
    </button>
  );
});

export default Button;
