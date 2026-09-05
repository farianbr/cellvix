import cn from '@/lib/cn';

/**
 * Status pill.
 *
 * Each tone used to carry three separate colour signals at once — a tinted
 * background, a coloured border AND coloured text. Three signals for one piece
 * of meaning is what turns a table into a rainbow: eight badges down a status
 * column, each ringed and filled and tinted, and the eye can no longer tell
 * which of them is the one that needs attention. Redundant encoding does not
 * add emphasis, it removes it, because emphasis is relative.
 *
 * One signal now: a quiet tint, dark ink for the label, no border. The tint
 * says which category; contrast stays high because the text is near-black
 * rather than a mid-chroma colour on a pale ground, which is also what makes
 * these legible at 11px where the old coloured text was not.
 *
 * `danger` is the deliberate exception and keeps coloured text. It is the only
 * tone that means "something is wrong", and if every tone is quiet then the one
 * that must interrupt has to be louder than the rest. That is the whole point
 * of a reserved signal — it only works while it is rare.
 */
const TONES = {
  neutral: 'bg-surface-3 text-ink-500',
  brand: 'bg-brand-50 text-brand-700',
  ok: 'bg-ok-50 text-ink-700',
  warn: 'bg-warn-50 text-ink-700',
  danger: 'bg-danger-50 text-danger',
  info: 'bg-info-50 text-ink-700',
  dark: 'bg-ink-900 text-white',
};

/**
 * A 5px dot in the tone's own colour, shown for the tones whose text has gone
 * neutral. It restores the at-a-glance hue an operator scans a status column
 * by, at a fraction of the visual weight the old coloured text carried — the
 * colour is present but it is no longer competing with the label for the same
 * pixels.
 */
const DOTS = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  info: 'bg-info',
  // `brand` belongs here for the same reason the rest do: its label is dark ink
  // on a pale tint, so without the dot it is the one pill in a status column
  // carrying no hue at all — `Out for delivery` sat in an orders table looking
  // like a category the design had forgotten to colour. Flat `bg-brand`, not a
  // gradient: at 5px a ramp has no room to read as depth.
  brand: 'bg-brand',
};

const SIZES = {
  sm: 'h-5 px-1.5 text-2xs gap-1',
  md: 'h-6 px-2 text-2xs gap-1',
};

export function Badge({ tone = 'neutral', size = 'md', icon: Icon, dot = true, className, children }) {
  const dotClass = dot && !Icon ? DOTS[tone] : null;

  return (
    <span
      className={cn(
        // A pill is a fixed-height shape: let the label wrap and the second
        // line renders outside the border. It stays on one line and the layout
        // around it is responsible for giving it room.
        'eyebrow inline-flex items-center whitespace-nowrap rounded-full',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
      {dotClass && (
        <span className={cn('size-[5px] shrink-0 rounded-full', dotClass)} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

export default Badge;
