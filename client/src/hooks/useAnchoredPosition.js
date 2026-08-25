import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/** Gap between the trigger and its panel. */
const GUTTER = 6;
/** Closest a panel may come to the edge of the viewport. */
const EDGE = 12;

/**
 * Positions a floating panel against the control that opened it.
 *
 * A dropdown drawn as an absolutely-positioned child of its trigger is clipped
 * by any ancestor that scrolls or hides its overflow — a `Panel`, a modal body,
 * a table wrapper. Every one of those is somewhere a select already lives, so
 * the panel is rendered in a portal and given fixed coordinates instead.
 *
 * The returned style also decides:
 *   - which side to open on: below unless the space there is too small and
 *     there is more of it above;
 *   - how tall the panel may be, from the room actually left on that side;
 *   - how wide, from the room left on the side it is aligned to — which is what
 *     keeps a panel wider than its trigger from running off the screen without
 *     having to measure the panel first.
 *
 * @param {React.RefObject<HTMLElement>} triggerRef
 * @param {boolean} open
 * `rowHeight` (with the panel's own vertical padding) snaps the height to a
 * whole number of rows. Without it a scrolling panel ends on a half-drawn row,
 * which does not read as "there is more below" — it reads as clipped.
 *
 * @param {{
 *   align?: 'left' | 'right',
 *   maxHeight?: number,
 *   matchWidth?: boolean,
 *   rowHeight?: number,
 *   padding?: number,
 * }} [options]
 */
export function useAnchoredPosition(triggerRef, open, options = {}) {
  const { align = 'left', maxHeight = 320, matchWidth = true, rowHeight, padding = 0 } = options;
  const [style, setStyle] = useState(null);

  const measure = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GUTTER - EDGE;
    const above = rect.top - GUTTER - EDGE;

    // Flip only when below is genuinely cramped AND above is roomier — a panel
    // that flips at the first opportunity feels unstable while typing.
    const flip = below < 180 && above > below;
    let room = Math.max(140, Math.min(maxHeight, flip ? above : below));

    if (rowHeight) {
      const rows = Math.max(1, Math.floor((room - padding) / rowHeight));
      room = rows * rowHeight + padding;
    }

    setStyle({
      position: 'fixed',
      top: flip ? undefined : Math.round(rect.bottom + GUTTER),
      bottom: flip ? Math.round(window.innerHeight - rect.top + GUTTER) : undefined,
      left: align === 'left' ? Math.round(rect.left) : undefined,
      right: align === 'right' ? Math.round(window.innerWidth - rect.right) : undefined,
      minWidth: matchWidth ? Math.round(rect.width) : undefined,
      maxWidth: Math.round(
        align === 'left' ? window.innerWidth - rect.left - EDGE : rect.right - EDGE,
      ),
      maxHeight: Math.round(room),
    });
  }, [triggerRef, align, maxHeight, matchWidth, rowHeight, padding]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return undefined;
    }

    measure();

    // Capture phase: the scroll may happen in any ancestor, not just the window.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  // The trigger can move without anything scrolling — a row above it collapsing,
  // a font loading. Cheap enough to watch while the panel is open.
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (triggerRef.current) observer.observe(triggerRef.current);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [open, measure, triggerRef]);

  return style;
}

export default useAnchoredPosition;
