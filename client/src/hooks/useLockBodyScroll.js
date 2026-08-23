import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousPadding = '';

/**
 * Locks page scroll while an overlay is open. Reference-counted so nested
 * overlays (mega menu -> account popup) do not unlock each other early, and it
 * compensates for the removed scrollbar so the layout does not jump.
 */
export function useLockBodyScroll(active) {
  useEffect(() => {
    if (!active) return undefined;

    if (lockCount === 0) {
      const { body } = document;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      previousOverflow = body.style.overflow;
      previousPadding = body.style.paddingRight;
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPadding;
      }
    };
  }, [active]);
}

export default useLockBodyScroll;
