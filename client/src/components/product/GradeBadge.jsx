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

  const tones = {
    ok: 'bg-ok text-white',
    info: 'bg-info text-white',
    brand: 'bg-brand-gradient text-white',
    warn: 'bg-warn text-white',
    neutral: 'bg-ink-900 text-white',
  };

  const parts = String(meta.short).split(' ');
  const stacked = parts.length > 1;
  // "PULL A" is a qualifier over a grade letter, so the letter is the larger of
  // the two. "AFT MKT" is one word broken in half — both halves stay equal.
  const letterLast = stacked && parts[parts.length - 1].length === 1;

  function lineClass(index) {
    if (!stacked) return 'text-[11px] leading-none @min-[260px]:text-[12px]';
    if (!letterLast) return 'text-[9.5px] leading-[1.15] @min-[260px]:text-[10.5px]';
    return index === 0
      ? 'text-[8px] leading-[1.25] @min-[260px]:text-[9px]'
      : 'text-[13px] leading-[1] @min-[260px]:text-[14px]';
  }

  return (
    <span
      className={cn(
        'flex size-10 flex-col items-center justify-center overflow-hidden rounded-full px-1 text-center shadow-card ring-2 ring-surface @min-[260px]:size-11',
        tones[meta.tone],
        className,
      )}
      title={meta.label ?? grade}
    >
      {parts.map((part, index) => (
        <span
          key={part}
          className={cn(
            // No opacity on the "PULL" line: knocking white back to 80% on the
            // amber fill drops it under 4.5:1. Size alone carries the hierarchy.
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
