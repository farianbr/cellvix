import cn from '@/lib/cn';
import { GRADES } from '@/lib/constants';

/**
 * The circular grade overlay that sits on the product image (brief §6, "PULL A").
 * Deliberately reads as a stamp, not a sticker — it is the first thing a business
 * buyer looks for.
 *
 * Everything here is a fight between a circle and a word:
 *
 *  1. Every multi-character grade stacks onto TWO short lines ("PULL"/"A",
 *     "AFT"/"MKT"). A single long line has to fit the circle's full diameter and
 *     never does; two short ones only have to fit a chord.
 *  2. This does NOT use the `eyebrow` utility, and must not. `eyebrow` hard-sets
 *     `font-size: 11px` and `letter-spacing: 0.08em`, and it beats any `text-[…]`
 *     or `tracking-[…]` put beside it — a per-line size here is not a preference,
 *     it is the whole mechanism, so the four properties are spelled out instead.
 *  3. The circle grows with the CARD (@container), not the viewport — 40px on a
 *     two-up phone card, 44px once there is room for it.
 */
export function GradeBadge({ grade, className }) {
  const meta = GRADES[grade] ?? { short: grade, tone: 'neutral' };

  /**
   * A pale tint with dark ink, not a saturated fill with white text.
   *
   * Four solid discs — green, blue, amber, near-black — sat on the four product
   * images of a single grid row, and each one was the highest-chroma object in
   * its card. The grade genuinely matters to a business buyer, which is the
   * argument for the badge existing at all; it is not the argument for it
   * outshouting the part it is stamped on. A buyer scans the grid for a PART
   * and reads the grade once they have found one.
   *
   * The tints keep the hue that makes a grade recognisable at a glance while
   * handing the visual weight back to the product.
   *
   * `brand` is the exception and carries the gradient, because AFTERMARKET is
   * the grade Cellvix sells on its own name rather than a manufacturer's — the
   * one badge where the brand mark is the information. The compact ramp, since
   * a 40px disc has no room for the full one's near-black opening.
   */
  const tones = {
    ok: 'bg-ok-50 text-ok',
    info: 'bg-info-50 text-info',
    brand: 'bg-brand-gradient-compact text-white',
    warn: 'bg-warn-50 text-warn',
    neutral: 'bg-surface-3 text-ink-700',
  };

  const parts = String(meta.short).split(' ');
  const stacked = parts.length > 1;
  // "PULL A" is a qualifier over a grade letter, so the letter is the larger of
  // the two. "AFT MKT" is one word broken in half — both halves stay equal.
  const letterLast = stacked && parts[parts.length - 1].length === 1;

  function lineClass(index) {
    if (!stacked) return 'text-2xs leading-none @min-[260px]:text-xs';
    if (!letterLast) return 'text-2xs leading-[1.15] @min-[260px]:text-2xs';
    return index === 0
      ? 'text-2xs leading-[1.25] @min-[260px]:text-2xs'
      : 'text-sm leading-[1] @min-[260px]:text-md';
  }

  return (
    <span
      className={cn(
        // One separator, not two. The badge used to carry a shadow AND a 2px
        // white ring, which is the same job done twice — the ring alone lifts it
        // off the photograph, and on a pale tint the shadow was reading as a
        // smudge under the disc rather than as elevation.
        'flex size-10 flex-col items-center justify-center overflow-hidden rounded-full px-1 text-center ring-2 ring-surface @min-[260px]:size-11',
        tones[meta.tone],
        className,
      )}
      title={meta.label ?? grade}
    >
      {parts.map((part, index) => (
        <span
          key={part}
          className={cn(
            // No opacity on the "PULL" line: knocking the ink back on a pale
            // tint drops it under 4.5:1. Size alone carries the hierarchy.
            'font-display font-bold uppercase tracking-[0.01em]',
            lineClass(index),
          )}
        >
          {part}
        </span>
      ))}
    </span>
  );
}

export default GradeBadge;
