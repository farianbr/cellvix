import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * A homepage section drawn as a framed box whose heading sits in a tab that
 * breaks the frame's top edge.
 *
 * WHY A FRAME AT ALL. The homepage was a flat column: heading, grid, 48px of
 * air, heading, grid. Every section had exactly the same weight, so the page
 * had no structure a reader could skim - it read as one long list that happened
 * to change subject five times. The frame gives each section an edge, which is
 * what lets the eye count them.
 *
 * WHY THE TAB. A heading sitting above a box is a caption; a heading sitting IN
 * the box's edge is a label on a container, and a container is what these
 * actually are. It also solves the thing a plain framed section gets wrong,
 * which is that the title then floats in a corner of dead space with the
 * frame's top-left radius curling away from it.
 *
 * HOW IT IS DRAWN. Three borders on the tab (top, left, right) and a body with
 * a full border whose top edge is interrupted by the tab: the tab sits on
 * `-mb-px` so its own bottom edge lands exactly on the body's top border and
 * covers that one-pixel run. The tab keeps the surface background so the
 * covered pixel is invisible. No pseudo-element tricks, so it survives a
 * text-zoom that changes the tab's width.
 *
 * The tab's radius is `rounded-t-lg` against the body's `rounded-lg`, which
 * reads as one shape rather than as a chip resting on a box.
 */
export function SectionFrame({
  id,
  eyebrow,
  title,
  to,
  linkLabel,
  action,
  children,
  className,
  bodyClassName,
  /**
   * `muted` puts the section on `surface-2` instead of `surface`.
   *
   * The page alternates: a run of identical light frames is the same problem
   * the flat column had, one level up. Alternating gives the stack a rhythm
   * without any section needing a colour of its own.
   */
  tone = 'light',
  /**
   * `fit` shrinks the frame to its content instead of filling the page.
   *
   * A section holding four small tiles is not a section holding a grid, and
   * stretched to full width its frame is mostly empty panel - which reads as
   * content that failed to load rather than as a short list. The catalogue is
   * smartphone-only by rule, so the device and brand rows are genuinely small
   * and stay that way; this is what lets their frame say so.
   *
   * The section still spans the page - only the FRAME shrinks - so the tab and
   * its link keep their relationship and the stack keeps its left edge.
   */
  fit = false,
}) {
  return (
    <section className={cn('mt-10 sm:mt-12', className)} aria-labelledby={id}>
      {/* ---- the tab ---------------------------------------------------- */}
      <div className={cn('flex items-end justify-between gap-3', fit && 'w-fit max-w-full')}>
        <div
          className={cn(
            'relative z-1 -mb-px inline-flex max-w-full flex-col justify-end rounded-t-lg border border-b-0 border-line px-4 pb-2.5 pt-3 sm:px-5',
            tone === 'muted' ? 'bg-surface-2' : 'bg-surface',
          )}
        >
          {eyebrow && <p className="eyebrow mb-1 text-brand">{eyebrow}</p>}
          <h2 id={id} className="font-display text-lg font-bold leading-tight text-ink-900 sm:text-xl">
            {title}
          </h2>
        </div>

        {/* The section's own link, kept OUT of the tab.
            Inside it the tab has to stretch to hold both, at which point it is
            no longer a label - it is a header bar, and the shape stops meaning
            anything. Out here it sits on the frame's top border line, which is
            where a reader already looks for "more of this". */}
        {(to || action) && (
          <div className="mb-2.5 shrink-0">
            {action ?? (
              <Link
                to={to}
                className={cn(
                  pressable,
                  'inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand',
                )}
              >
                {linkLabel}
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ---- the body --------------------------------------------------- */}
      <div
        className={cn(
          'rounded-lg rounded-tl-none border border-line p-4 sm:p-5',
          fit && 'w-fit max-w-full',
          tone === 'muted' ? 'bg-surface-2' : 'bg-surface',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export default SectionFrame;
