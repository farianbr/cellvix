import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Puts a new route at the top of the page.
 *
 * A client-side navigation keeps the scroll position by default, so following
 * "About us" from the footer landed the reader halfway down the About page.
 *
 * Keyed on `pathname` only: the Shop page mirrors its filters into the query
 * string, and jumping to the top on every facet click would fight the grid's
 * own scroll handling. Hash links are left alone so in-page anchors still work.
 *
 * **`behavior: 'instant'`, not `'auto'`, and that is the whole bug.** The
 * stylesheet sets `html { scroll-behavior: smooth }` for in-page anchors, and
 * that property governs programmatic scrolls too: `'auto'` means "follow the
 * CSS", so every route change started a ~450ms glide from wherever the reader
 * had been. Any scroll issued while that animation runs is swallowed by it, so
 * the calls below fired, were absorbed, and the glide carried on landing the
 * new page part-scrolled - measured at a consistent 130px arriving on About
 * from the blog footer. `'instant'` is the one value that overrides the CSS
 * and jumps.
 *
 * **The clicked link also keeps focus.** The anchor stays
 * `document.activeElement` across the route change, and the browser scrolls a
 * focused element back into view once the new page lays out. Blurring first
 * removes the second thing that pulls the page back down.
 *
 * **Why it then scrolls more than once.** Every route here is lazy, so a new
 * path first renders as `RouteFallback` - a short skeleton - and only then
 * swaps in the real page, which grows again as its query resolves. A single
 * scroll on mount runs against a document a few hundred pixels tall, where the
 * offset is clamped to that height. So the top is asserted before paint, on the
 * next frame, and once more after layout has settled. All three are cheap: a
 * `scrollTo` to a position the page already holds does nothing, and
 * `behavior: 'instant'` keeps each instant rather than animating a jump nobody
 * asked for.
 *
 * A POP (back/forward) is left alone: restoring where somebody was is exactly
 * what should happen there, and it is the one case a reader expects.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (hash || navigationType === 'POP') return;

    // Drop focus from whatever was clicked BEFORE scrolling. Left focused, the
    // browser pulls that element back into view and every scroll below is
    // undone. `<body>` is not focusable, so this returns focus to the document
    // - which is also where a reader landing on a new page expects to be: the
    // next Tab starts from the top of it rather than from the footer link they
    // came in through.
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // `hash` and the navigation type are deliberately not dependencies - only a
    // path change scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (hash || navigationType === 'POP') return;

    // The lazy chunk's fallback is shorter than the page that replaces it, so
    // the scroll above may have been clamped against a skeleton's height.
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

export default ScrollToTop;
