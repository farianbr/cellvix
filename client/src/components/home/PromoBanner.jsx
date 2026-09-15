import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { PartVisual } from '@/components/product/PartFrame';

/**
 * The wide promo that breaks the run of framed sections.
 *
 * It is the one element on the homepage that is NOT a bordered light panel,
 * and that is its whole job: five framed sections in a row stop registering as
 * separate things, so the page needs something that is a different shape AND a
 * different weight, not one or the other.
 *
 * WHY INVERTED. The first pass drew this on `surface-2` with a cut corner, and
 * the corner was invisible: the page ground is already `surface-2`, so the cut
 * removed one off-white triangle from another. A cut corner is only a shape if
 * the block it cuts contrasts with what is behind it. On `ink-deep` - the logo
 * black warmed toward the brand, the same inverted ground the editorial slabs
 * use - the diagonal is unmistakable and the band reads as a break rather than
 * as a gap in the stack.
 *
 * It is deliberately NOT a second gradient: a page gets one gradient block and
 * this page spends it on the hero CTA (Instructions §2.2). The single hairline
 * of brand along the top edge is the only ramp the band takes, matching `Slab`.
 *
 * Art on one side, words on the other, and a circular CTA - the orb is
 * reserved for this component so the shape MEANS "promo banner" rather than
 * being one more way to draw a button. The hero keeps a pill, because the hero
 * already has a secondary action beside it and two circles side by side have
 * no hierarchy between them.
 */
export function PromoBanner({
  eyebrow,
  title,
  titleAccent,
  script,
  to,
  ctaLabel = 'Shop now',
  product,
  /** `reverse` puts the art on the right. The second banner on a page takes it
      so the two do not read as the same block printed twice. */
  reverse = false,
  className,
  children,
}) {
  return (
    <section
      className={cn(
        'corner-cut relative mt-10 overflow-hidden bg-ink-deep sm:mt-12',
        className,
      )}
    >
      {/* The thin top rule §2.2 allows on an inverted block - what ties the
          band to the brand without filling anything. */}
      <span className="rule-brand-gradient absolute inset-x-0 top-0 h-0.75" aria-hidden="true" />

      {/* CAPPED, not full-bleed. At 1352px the copy sat with 400px of dead
          black on either side of it and the orb was marooned at the far rim -
          three elements in one row, each too far from the next to read as one
          statement. The inner cap pulls them back into a single block. */}
      <div
        className={cn(
          'mx-auto flex max-w-[980px] flex-col items-center gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:flex-row lg:gap-10 lg:py-12',
          reverse && 'lg:flex-row-reverse',
        )}
      >
        {/* ---- the art --------------------------------------------------
            A part, drawn large. No stock photography anywhere on this site, so
            the banner shows what is being sold.

            On a LIGHT disc, which is the only part of this block that is not
            inverted. Most of the catalogue is screens and they are themselves
            near-black: drawn on the band, or on a dark tinted disc, the part
            is a black shape on a black ground and simply does not appear. The
            disc is what gives it something to sit against, and on an inverted
            band that has to be near-white - the same reason the hero draws its
            part on `brand-50` rather than on the panel. */}
        {product && (
          <div className="flex size-40 shrink-0 items-center justify-center rounded-full bg-surface p-6 sm:size-48 sm:p-8">
            <PartVisual product={product} />
          </div>
        )}

        {/* ---- the words ------------------------------------------------ */}
        <div className="min-w-0 flex-1 text-center lg:text-left">
          {eyebrow && <p className="eyebrow mb-2 text-white/50">{eyebrow}</p>}

          <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
            {title}
            {titleAccent && <span className="font-normal text-white/60"> {titleAccent}</span>}
          </h2>

          {/* The one line of relaxed voice on the page. It sits under a hard
              display heading, so it needs to be a different register or the
              block is two sizes of the same sentence.

              NOT coloured. Flat `brand` (#cf3429) clears only about 4:1 on
              near-black and this is a 16px line; `brand-100` clears easily but
              at #fadcd9 is white for all practical purposes, so the line stops
              being an accent and becomes a third tone of the same paragraph.
              There is no step between the two in the ramp, and inventing one
              is a defect, so the line is separated by STYLE instead - italic
              display against an upright bold heading, which is a difference
              the reader registers without needing a colour at all. The band
              already carries its brand in the top rule and the orb. */}
          {script && (
            <p className="mt-2 font-display text-lg italic text-white/70">{script}</p>
          )}

          {children && <div className="mt-4">{children}</div>}
        </div>

        {/* ---- the orb --------------------------------------------------
            ORB ramp, not the standard one. A linear gradient is flat outside
            its end stops, and on a disc those flat runs hug the left and right
            rims as visible arcs - the button looks like it has a stroke down
            each side. `.bg-brand-gradient-orb` puts both stops outside the
            element so every rim pixel is mid-ramp.

            THE VIVID ORB RAMP, AND THE LABEL SIZED TO IT.

            The disc has two contrast jobs on an inverted band and they pull
            opposite ways: the label needs contrast against the disc, and the
            disc needs contrast against the band. The panel ramp wins the first
            easily (white 7.7:1) and loses the second badly - stopping at
            #9d251d it sits 2.58:1 from #1b0101, so the CTA reads as a dark
            smudge on dark brown rather than as the thing to press. The vivid
            ramp is 4.79:1 from the band.

            So the ramp stays vivid and the LABEL moves instead. White on the
            ramp's bright rim is 4.17:1, which fails the 4.5 floor for body
            text and clears the 3:1 floor for large text - so the label is set
            at 18px bold (`text-xl` on this scale - `text-lg` is 16px and does
            NOT qualify), where that floor applies. That is why it is one or
            two short words: at this size nothing longer fits a 112px disc. */}
        <Link
          to={to}
          className={cn(
            pressable,
            'bg-brand-gradient-orb flex size-28 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-center font-display text-xl font-bold leading-tight text-white transition-[filter] hover:brightness-110',
          )}
        >
          <ArrowUpRight className="size-4.5" strokeWidth={2.5} aria-hidden="true" />
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

export default PromoBanner;
