import { Star } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * A star rating, read-only.
 *
 * Promoted out of `DealPage`, where it lived as a local function, when product
 * reviews arrived and a second and third surface needed the same mark. Two
 * copies of a rating glyph is two things free to disagree about what four and a
 * half stars looks like.
 *
 * WHOLE STARS, and it rounds DOWN at the half. A half-star needs a clipped
 * overlay to render honestly, and at 14px that clip reads as a rendering fault
 * rather than as a half; the numeric average sits beside this everywhere it is
 * used, and that is where the precision belongs.
 *
 * `Math.round` was wrong for the one case that matters most: an average of 3.5
 * drew four filled stars, so the mark claimed more than the number beside it.
 * Overstating a score is the one error a rating must not make, so a half rounds
 * down and the glyph is never ahead of the figure.
 *
 * The whole group carries one `aria-label` and the glyphs are hidden, so a
 * screen reader hears "3.5 out of 5" rather than the word "star" five times.
 */
export function Stars({ rating = 0, size = 'sm', className }) {
  const rounded = Math.floor(rating + 0.001);

  return (
    <span
      className={cn('flex items-center gap-0.5', className)}
      aria-label={`${Number(rating).toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={cn(
            size === 'md' ? 'size-4' : 'size-3.5',
            step <= rounded ? 'fill-warn text-warn' : 'text-ink-200',
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default Stars;
