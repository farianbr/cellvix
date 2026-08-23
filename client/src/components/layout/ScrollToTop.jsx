import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Puts a new route at the top of the page.
 *
 * A client-side navigation keeps the scroll position by default, so following
 * "About us" from the footer landed the reader halfway down the About page.
 *
 * Keyed on `pathname` only: the Shop page mirrors its filters into the query
 * string, and jumping to the top on every facet click would fight the grid's
 * own scroll handling. Hash links are left alone so in-page anchors still work.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    // `hash` is deliberately not a dependency — only a path change scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

export default ScrollToTop;
