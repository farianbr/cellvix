import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps Tab focus inside a container while `active`, and restores focus to the
 * element that opened it on close. Required for every overlay in the system.
 */
export function useFocusTrap(active) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    restoreTo.current = document.activeElement;

    const node = ref.current;
    if (!node) return undefined;

    // Focus the first sensible target, preferring an explicit autofocus.
    const initial =
      node.querySelector('[data-autofocus]') || node.querySelectorAll(FOCUSABLE)[0] || node;
    // rAF so the element exists after the entrance animation mounts it.
    const raf = requestAnimationFrame(() => initial.focus({ preventScroll: true }));

    function onKeyDown(event) {
      if (event.key !== 'Tab') return;

      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener('keydown', onKeyDown);
      restoreTo.current?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}

export default useFocusTrap;
