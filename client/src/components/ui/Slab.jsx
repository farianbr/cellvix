import cn from '@/lib/cn';
import Reveal from '@/components/motion/Reveal';

/**
 * A page section as a rounded panel on the `surface-2` page ground.
 *
 * The editorial pages (About, Contact) are stacks of these rather than one flat
 * column: each section owns its own ground, so a run of light panels can be
 * broken by a dark one without any section needing a background of its own.
 *
 * Tones: `light` is the default; `dark` is solid `ink-deep` — the logo black
 * warmed ~12% toward the brand red, so the inverted band reads as Cellvix and
 * not as a generic black box. It is deliberately NOT a second gradient: a page
 * gets one gradient block and that is the CTA (PROJECT_INSTRUCTIONS.md §2.2).
 * The single hairline of brand along its top edge is the only accent it takes.
 */

const TONES = {
  light: 'bg-surface border border-line',
  muted: 'bg-surface-2 border border-line',
  dark: 'relative bg-ink-deep text-white',
  gradient: 'bg-brand-gradient text-white',
};

export function Slab({ tone = 'light', className, innerClassName, children, ...props }) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[24px] px-5 py-12 sm:px-8 sm:py-16 lg:rounded-[32px] lg:px-14 lg:py-24',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {/* A 3px rule of the gradient across the top edge — the "thin top rule"
          §2.2 allows. It is what ties the inverted slab to the brand without
          filling anything. */}
      {tone === 'dark' && (
        <span
          className="rule-brand-gradient absolute inset-x-0 top-0 h-0.75"
          aria-hidden="true"
        />
      )}
      <div className={cn('mx-auto max-w-[1180px]', innerClassName)}>{children}</div>
    </section>
  );
}

/**
 * The split header those pages run on: an oversized display title on the left,
 * a quiet lede holding the right column. Centred when a section is a grid of
 * equals rather than an argument.
 */
export function SectionHeader({
  id,
  title,
  lede,
  centered = false,
  eyebrow,
  dark = false,
  className,
}) {
  return (
    <Reveal
      className={cn(
        centered
          ? 'mx-auto max-w-2xl text-center'
          : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-end lg:gap-12',
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <p className={cn('eyebrow mb-4', dark ? 'text-white/55' : 'text-brand')}>{eyebrow}</p>
        ) : null}
        <h2
          id={id}
          className={cn(
            'text-[28px] leading-[1.06] tracking-[-0.03em] sm:text-[38px] lg:text-[46px]',
            dark && 'text-white',
          )}
        >
          {title}
        </h2>
      </div>
      {lede ? (
        <p
          className={cn(
            'text-[15.5px] leading-relaxed',
            centered && 'mx-auto mt-4 max-w-xl',
            dark ? 'text-white/65' : 'text-ink-400',
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}

/**
 * The small pill that opens a centred section: a counter, a dot, then a label.
 * `count` is optional — without one the pill is just the label.
 */
export function EyebrowPill({ count, children, dark = false, className }) {
  return (
    <p
      className={cn(
        'eyebrow inline-flex items-center gap-2 rounded-full border px-3.5 py-2',
        dark ? 'border-white/15 bg-white/10 text-white/70' : 'border-line bg-surface text-ink-400',
        className,
      )}
    >
      {count ? <span className="tnum font-mono text-brand">{count}</span> : null}
      <span className={cn('size-1 rounded-full', dark ? 'bg-white/60' : 'bg-brand')} aria-hidden="true" />
      {children}
    </p>
  );
}

/** Icon in a rounded tile — the marker the editorial cards use. */
export function IconTile({ icon: Icon, className, solid = true }) {
  return (
    <span
      className={cn(
        'flex size-11 items-center justify-center rounded-[12px]',
        solid ? 'bg-brand text-white' : 'bg-brand-50 text-brand',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}

export default Slab;
